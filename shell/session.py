import asyncio
import os
import tempfile
import threading
from typing import Optional

try:
    import fcntl
    import pty
    import struct
    import termios
    import signal
    POSIX = True
except ImportError:
    POSIX = False

try:
    from winpty import PtyProcess
    HAS_CONPTY = True
except ImportError:
    HAS_CONPTY = False

from fastapi import WebSocket

_PODEX_LOGO = (
    "\033[1;36m"
    "  ____   _____  ____  _____  __  __\r\n"
    " |  _ \\  |  __ \\|  _ \\| ____| \\ \\/ /\r\n"
    " | |_) | | |  | | | | |  _|    \\  /\r\n"
    " |  __/  | |__| | |_| | |___   /  \\\r\n"
    " |_|     |_____/|____/|_____| /_/\\_\\"
    "\033[0m"
)

_HINTS = (
    "\033[1;90m\033[1mQuick start:\033[0m\r\n"
    "  \033[1;36mkubectl get pods\033[0m      - list running pods\r\n"
    "  \033[1;36mkubectl get all\033[0m       - everything in the namespace\r\n"
    "  \033[1;36mkubectl describe pod X\033[0m - deep-dive a resource\r\n"
    "  \033[1;36mhelp\033[0m                  - show this again\r\n"
)

PODEX_BANNER = (
    _PODEX_LOGO + "\r\n\r\n"
    "\033[1;32mWelcome to the Podex Shell\033[0m - your interactive cluster workspace.\r\n"
    + _HINTS +
    "\r\n"
)


def _banner_text() -> str:
    logo = (
        "\033[1;36m"
        "  ____   _____  ____  _____  __  __\r\n"
        " |  _ \\  |  __ \\|  _ \\| ____| \\ \\/ /\r\n"
        " | |_) | | |  | | | | |  _|    \\  /\r\n"
        " |  __/  | |__| | |_| | |___   /  \\\r\n"
        " |_|     |_____/|____/|_____| /_/\\_\\"
        "\033[0m\r\n"
    )
    welcome = (
        "\r\n"
        "\033[1;32mWelcome to the Podex Shell\033[0m - your interactive cluster workspace.\r\n"
        "\033[1;90m\033[1mQuick start:\033[0m\r\n"
        "  \033[1;36mkubectl get pods\033[0m      - list running pods\r\n"
        "  \033[1;36mkubectl get all\033[0m       - everything in the namespace\r\n"
        "  \033[1;36mkubectl describe pod X\033[0m - deep-dive a resource\r\n"
        "  \033[1;36mhelp\033[0m                  - show this again\r\n"
        "\r\n"
    )
    return logo + welcome


def _write_banner_file(newline: str) -> str:
    path = os.path.join(tempfile.gettempdir(), "podex-banner.txt")
    with open(path, "w", encoding="utf-8", newline=newline) as f:
        f.write(_banner_text())
    return path


def _write_windows_startup() -> str:
    """Write a startup .bat + banner .txt for cmd.exe so the banner is part of
    the shell's own buffer (keeps cmd cursor codes aligned with the screen)."""
    banner_path = _write_banner_file("\r\n")

    bat_path = os.path.join(tempfile.gettempdir(), "podex-startup.cmd")
    with open(bat_path, "w", encoding="utf-8", newline="") as f:
        f.write("@echo off\r\n")
        f.write("cls\r\n")
        f.write("type \"" + banner_path + "\"\r\n")
        f.write("prompt $P$G\r\n")
    return bat_path


def _find_git_bash() -> Optional[str]:
    candidates = [
        r"C:\Program Files\Git\bin\bash.exe",
        r"C:\Program Files\Git\usr\bin\bash.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Git\bin\bash.exe"),
        os.path.expandvars(r"%ProgramFiles%\Git\bin\bash.exe"),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None


def _write_bash_rc() -> str:
    """Write a bash rcfile that prints the Podex banner INSIDE bash's own
    screen buffer (so bash never clears/overwrites it on redraw) and sets a
    friendly prompt."""
    banner_path = _write_banner_file("\n")
    rc = os.path.join(tempfile.gettempdir(), "podex-bashrc")
    with open(rc, "w", encoding="utf-8") as f:
        f.write('export TERM=xterm-256color\n')
        # clear the screen then print the banner (LF line endings for bash)
        f.write('clear\n')
        # escape backslashes for the double-quoted path
        bash_path = banner_path.replace("\\", "\\\\")
        f.write('cat "' + bash_path + '"\n')
        f.write('PS1="\\[\\033[1;36m\\]podex@\\h\\[\\033[0m\\]:'
                '\\[\\033[1;34m\\]\\w\\[\\033[0m\\]$ "\n')
    return rc


class ShellSession:
    """Interactive shell session bridged over a WebSocket.

    POSIX/Linux (Docker microservice) uses a real PTY with a bash prompt.
    Windows uses ConPTY (pywinpty) with a startup batch that prints the
    Podex banner inside the shell buffer, so typed input never lands on the
    artwork and the prompt is always below it.
    """

    def __init__(self, ws: WebSocket):
        self.ws = ws
        self.pid: Optional[int] = None
        self.fd: Optional[int] = None
        self.proc: Optional[object] = None
        self.pty_proc: Optional[object] = None
        self.loop = asyncio.get_running_loop()
        self.should_stop = False
        self.windows_startup = False

    def spawn(self) -> None:
        if POSIX:
            shell = os.environ.get("SHELL", "/bin/bash")
            self.pid, self.fd = pty.fork()
            if self.pid == 0:
                os.environ["TERM"] = "xterm-256color"
                os.environ["PS1"] = (
                    "\\[\\033[1;36m\\]podex@\\h\\[\\033[0m\\]:"
                    "\\[\\033[1;34m\\]\\w\\[\\033[0m\\]$ "
                )
                os.execvp(shell, [shell, "-l"])
        elif HAS_CONPTY:
            # Prefer Git Bash (real bash with ls/grep/pipes/kubectl); fall
            # back to cmd.exe so the shell always works.
            git_bash = _find_git_bash()
            if git_bash:
                try:
                    rc = _write_bash_rc()
                    self.pty_proc = PtyProcess.spawn(
                        [git_bash, "--rcfile", rc, "-i"], dimensions=(30, 120)
                    )
                    self.windows_startup = True
                    return
                except Exception:
                    self.pty_proc = None
            shell = os.environ.get("SHELL", "")
            if shell and os.path.exists(shell):
                argv = [shell]
            else:
                argv = ["cmd.exe"]
            try:
                startup = _write_windows_startup()
                self.windows_startup = True
                self.pty_proc = PtyProcess.spawn(
                    argv + ["/Q", "/K", startup], dimensions=(30, 120)
                )
            except Exception:
                self.pty_proc = None
                self.windows_startup = False
                self._spawn_pipe_fallback()
        else:
            self._spawn_pipe_fallback()

    def _spawn_pipe_fallback(self) -> None:
        import subprocess
        shell = os.environ.get("SHELL", "")
        if shell and os.path.exists(shell):
            cmd = [shell, "-l"]
        else:
            cmd = ["cmd.exe"]
        env = dict(os.environ)
        env["PROMPT"] = "PODEX$S$P$G "
        self.proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            env=env,
            bufsize=0,
        )

    def set_size(self, cols: int, rows: int) -> None:
        if self.pty_proc is not None:
            try:
                self.pty_proc.setwinsize((rows, cols))
            except Exception:
                pass
        elif self.fd is not None:
            try:
                winsize = struct.pack("HHHH", rows, cols, 0, 0)
                fcntl.ioctl(self.fd, termios.TIOCSWINSZ, winsize)
            except Exception:
                pass

    def start_reader(self) -> None:
        threading.Thread(target=self.run_reader, daemon=True).start()

    def run_reader(self) -> None:
        try:
            if self.pty_proc is not None:
                import select
                fd = self.pty_proc.fileno()
                while not self.should_stop:
                    r, _, _ = select.select([fd], [], [], 0.2)
                    if not r:
                        continue
                    data = self.pty_proc.read()
                    if not data:
                        if not self.pty_proc.isalive():
                            break
                        continue
                    asyncio.run_coroutine_threadsafe(
                        self.ws.send_text(data), self.loop
                    )
            elif self.proc is not None and self.proc.stdout is not None:
                while not self.should_stop:
                    data = self.proc.stdout.read(1024)
                    if not data:
                        break
                    asyncio.run_coroutine_threadsafe(
                        self.ws.send_bytes(data), self.loop
                    )
            else:
                while not self.should_stop and self.pid is not None and self.fd is not None:
                    data = os.read(self.fd, 1024)
                    if not data:
                        break
                    asyncio.run_coroutine_threadsafe(
                        self.ws.send_bytes(data), self.loop
                    )
        except Exception:
            pass
        finally:
            try:
                asyncio.run_coroutine_threadsafe(self.ws.close(), self.loop)
            except Exception:
                pass

    def write(self, data: str) -> None:
        if self.pty_proc is not None:
            try:
                self.pty_proc.write(data)
            except Exception:
                pass
        elif self.proc is not None and self.proc.stdin is not None:
            try:
                import re
                payload = re.sub(r"\r(?!\n)", "\r\n", data)
                self.proc.stdin.write(payload.encode())
                self.proc.stdin.flush()
            except Exception:
                pass
        elif self.pid is not None and self.fd is not None:
            try:
                os.write(self.fd, data.encode())
            except Exception:
                pass

    def close(self) -> None:
        self.should_stop = True
        if self.pty_proc is not None:
            try:
                self.pty_proc.terminate()
            except Exception:
                pass
            try:
                self.pty_proc.close()
            except Exception:
                pass
            self.pty_proc = None
        if self.proc is not None:
            try:
                self.proc.kill()
            except Exception:
                pass
            self.proc = None
        if self.pid is not None:
            try:
                os.kill(self.pid, signal.SIGHUP)
            except Exception:
                pass
        if self.fd is not None:
            try:
                os.close(self.fd)
            except Exception:
                pass
        self.pid = None
        self.fd = None


async def run_shell_ws(websocket: WebSocket) -> None:
    await websocket.accept()
    session = ShellSession(websocket)
    try:
        session.spawn()
    except Exception as e:
        await websocket.send_text(f"\r\n[Podex shell error: {e}]\r\n")
        await websocket.close()
        return

    session.set_size(120, 30)

    # On Windows the banner is printed by the startup .bat inside the shell
    # buffer; on POSIX we send it over the wire first.
    if not session.windows_startup:
        await websocket.send_text(PODEX_BANNER)

    session.start_reader()

    try:
        while True:
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                break
            text = message.get("text")
            binary = message.get("bytes")
            if text and text.startswith("__RESIZE__:"):
                parts = text.split(":")
                if len(parts) >= 3:
                    try:
                        session.set_size(int(parts[1]), int(parts[2]))
                    except ValueError:
                        pass
                continue
            if binary is not None:
                session.write(binary.decode(errors="replace"))
            elif text is not None:
                session.write(text)
    except Exception:
        pass
    finally:
        session.close()
