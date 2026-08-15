import os

from fastapi import FastAPI, WebSocket

try:
    from shell.session import run_shell_ws
except ImportError:
    from session import run_shell_ws

# Origins allowed to connect to the shell WebSocket. In Docker, the frontend
# connects from the same host via the browser, so we allow localhost and
# 127.0.0.1 (and any origin when running behind a sandbox/proxy).
ALLOWED_ORIGINS = {
    "http://localhost:3456",
    "http://127.0.0.1:3456",
    "http://localhost:3458",
    "http://127.0.0.1:3458",
}

app = FastAPI(title="Podex Shell Service", version="1.0.0")


def _origin_allowed(websocket: WebSocket) -> bool:
    origin = websocket.headers.get("origin")
    if not origin:
        return True  # Non-browser client
    if os.path.exists("/.dockerenv"):
        return True  # In Docker, allow sandbox origins
    origin_host = origin.split("://")[-1] if "://" in origin else origin
    host = origin_host.split(":")[0]
    return host in ("localhost", "127.0.0.1", "0.0.0.0")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "podex-shell"}


@app.websocket("/ws/shell")
async def shell_endpoint(websocket: WebSocket) -> None:
    if not _origin_allowed(websocket):
        await websocket.close(code=1008, reason="Origin not allowed")
        return
    await run_shell_ws(websocket)