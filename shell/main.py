import os

from fastapi import FastAPI, WebSocket

try:
    from shell.session import run_shell_ws
except ImportError:
    from session import run_shell_ws

app = FastAPI(title="Podex Shell Service", version="1.0.0")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "podex-shell"}


@app.websocket("/ws/shell")
async def shell_endpoint(websocket: WebSocket) -> None:
    await run_shell_ws(websocket)
