import asyncio
import platform
import subprocess
import os
import shutil
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


def find_windows_shell() -> str:
    """Find the best available shell on Windows: Git Bash > cmd > powershell"""
    bash_candidates = [
        r"C:\Program Files\Git\bin\bash.exe",
        r"C:\Program Files\Git\usr\bin\bash.exe",
        "bash.exe",
    ]
    for b in bash_candidates:
        path = shutil.which(b)
        if path:
            return f'"{path}" --login'
    if shutil.which("cmd.exe"):
        return "cmd.exe"
    return "powershell.exe"


class ShellSession:
    def __init__(self, ws: WebSocket):
        self.ws = ws
        self.proc = None
        self.should_stop = False

    async def start(self):
        if platform.system() == "Windows":
            shell_cmd = find_windows_shell()
        else:
            shell_cmd = os.environ.get("SHELL", "")
            if not shell_cmd or shell_cmd == "/bin/sh":
                shell_cmd = "/bin/bash" if os.path.exists("/bin/bash") else "/bin/sh"
        try:
            self.proc = await asyncio.create_subprocess_shell(
                shell_cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
            )
            asyncio.create_task(self.read_stdout())
        except Exception as e:
            await self.ws.send_text(f"\r\n[Shell error: {e}]\r\n")

    async def read_stdout(self):
        try:
            while not self.should_stop and self.proc and self.proc.stdout:
                data = await self.proc.stdout.read(4096)
                if not data:
                    break
                await self.ws.send_bytes(data)
        except Exception as e:
            print(f"Shell read error: {e}")
        finally:
            await self.ws.close()

    async def write(self, data: str):
        if self.proc and self.proc.stdin:
            try:
                self.proc.stdin.write(data.encode())
                await self.proc.stdin.drain()
            except Exception as e:
                print(f"Shell write error: {e}")

    def close(self):
        self.should_stop = True
        if self.proc:
            try:
                self.proc.kill()
            except Exception:
                pass


@router.websocket("/ws/shell")
async def ws_shell(websocket: WebSocket):
    await websocket.accept()
    session = ShellSession(websocket)
    await session.start()

    try:
        while True:
            data = await websocket.receive_text()
            await session.write(data)
    except WebSocketDisconnect:
        pass
    finally:
        session.close()
