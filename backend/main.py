import uvicorn
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from fastapi.responses import JSONResponse

from backend.config.settings import settings
from backend.kubernetes.client import init_k8s_client
from backend.api.routes import router as api_router

logger = logging.getLogger("podex")

# ── Rate limiting ─────────────────────────────────────────────────────────────
# In-memory rate limiter. Limits are per-IP-address.
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["60/minute"],  # general protection
    headers_enabled=True,
)

# ── Request size limit middleware ─────────────────────────────────────────────
MAX_REQUEST_SIZE = 1_000_000  # 1MB

class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_REQUEST_SIZE:
            raise HTTPException(status_code=413, detail="Request too large.")
        return await call_next(request)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize the Kubernetes Client
    logger.info("Starting Podex Backend...")
    success = init_k8s_client()
    if not success:
        logger.warning("Kubernetes API client initialization failed. "
                       "Podex will run, but Kubernetes features will return errors or fallbacks.")
    yield
    # Shutdown
    logger.info("Shutting down Podex Backend...")

app = FastAPI(
    title="Podex Backend API",
    description="Backend service for Podex, the beginner-friendly Kubernetes learning workspace",
    version="0.1.0",
    lifespan=lifespan
)

# ── Rate limiting setup ───────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, lambda request, exc: JSONResponse(
    status_code=429,
    content={"detail": "Too many requests. Please slow down."}
))

# ── Request size limit (before CORS) ──────────────────────────────────────────
app.add_middleware(RequestSizeLimitMiddleware)

# ── CORS: For local dev, allow all origins but DO NOT set allow_credentials
#    with a wildcard origin (browsers reject it per spec).
#    When running in Docker behind nginx, the frontend uses same-origin requests
#    through the nginx proxy, so CORS is not needed.
#    When using Vite dev server (localhost:3456), we restrict to local origins.
# ──────────────────────────────────────────────────────────────────────────────
cors_origins = [
    "http://localhost:3456",
    "http://127.0.0.1:3456",
    "http://localhost:3457",
    "http://127.0.0.1:3457",
]

if settings.environment == "production":
    # Production: use wildcard but no credentials (requests carry no cookies)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Register routes
app.include_router(api_router, prefix="/api")

# Basic Health check
@app.get("/health")
def health_check():
    return {"status": "ok", "app": "podex-backend"}

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.environment == "development"
    )