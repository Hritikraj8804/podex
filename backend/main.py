import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config.settings import settings
from backend.kubernetes.client import init_k8s_client
from backend.api.routes import router as api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize the Kubernetes Client
    print("Starting Podex Backend...")
    success = init_k8s_client()
    if not success:
        print("Warning: Kubernetes API client initialization failed. "
              "Podex will run, but Kubernetes features will return errors or fallbacks.")
    yield
    # Shutdown
    print("Shutting down Podex Backend...")

app = FastAPI(
    title="Podex Backend API",
    description="Backend service for Podex, the beginner-friendly Kubernetes learning workspace",
    version="0.1.0",
    lifespan=lifespan
)

# Configure CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local docker-compose environment
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
