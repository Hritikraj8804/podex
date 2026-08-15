"""WebSocket security helpers: origin validation to prevent CSWSH
(Cross-Site WebSocket Hijacking)."""

import os
from fastapi import WebSocket

# Origins that are allowed to connect to Podex WebSockets.
# In development: localhost and 127.0.0.1 on the Vite/FastAPI ports.
# In Docker behind nginx: the origin will be the same host serving the
# frontend (or the sandbox hostname), so we fall back to allowing
# any origin whose host is reachable locally.
ALLOWED_ORIGINS = {
    "http://localhost:3456",
    "http://127.0.0.1:3456",
    "http://localhost:3457",
    "http://127.0.0.1:3457",
    "https://localhost:3456",
    "https://127.0.0.1:3456",
}


def is_origin_allowed(websocket: WebSocket) -> bool:
    """
    Validate that the WebSocket request's Origin header is allowed.

    Browser WebSocket clients always send an Origin header, so a missing
    Origin is acceptable for non-browser clients (e.g., curl, tests).

    In production/Docker we are more lenient (allow any origin) because the
    frontend may be served from a sandbox hostname; the backend is still
    bound to 0.0.0.0 only for local/sandbox use.
    """
    origin = websocket.headers.get("origin")
    if not origin:
        # Non-browser client (curl, ws, tests) - allow
        return True

    # In Docker (production), allow all origins since the frontend may be
    # served from arbitrary sandbox hostnames.
    if os.path.exists("/.dockerenv"):
        return True

    if origin in ALLOWED_ORIGINS:
        return True

    # Allow any localhost origin regardless of port (defensive)
    origin_host = origin.split("://")[-1] if "://" in origin else origin
    host_part = origin_host.split(":")[0]
    if host_part in ("localhost", "127.0.0.1", "0.0.0.0"):
        return True

    return False