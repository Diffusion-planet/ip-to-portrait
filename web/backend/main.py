"""
FastAPI backend for IP-to-Portrait inpainting pipeline
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from pathlib import Path

from routers import generation, upload, history, settings, auth
from services.websocket_manager import websocket_endpoint
from core.database import init_db, close_db
from pipeline_loader import warmup_pipeline


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - initialize and cleanup resources"""
    # Startup
    # Note: Database migrations are handled by Alembic.
    # Run `alembic upgrade head` to apply migrations.
    # init_db() is kept for backwards compatibility but tables should be created via alembic.
    await init_db()

    # Preload models for faster generation
    print("🚀 Preloading models...")
    warmup_pipeline()

    yield
    # Shutdown
    await close_db()


class StaticFilesCORSMiddleware(BaseHTTPMiddleware):
    """Add CORS headers to static file responses"""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        # Add CORS headers for static files (uploads and outputs)
        if request.url.path.startswith("/uploads") or request.url.path.startswith("/outputs"):
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "*"
        return response


# Create FastAPI app
app = FastAPI(
    title="IP-to-Portrait API",
    description="Backend API for inpainting pipeline with real-time progress",
    version="1.0.0",
    lifespan=lifespan,
)

# Add static files CORS middleware first
app.add_middleware(StaticFilesCORSMiddleware)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3008"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for uploads and outputs
UPLOAD_DIR = Path(__file__).parent / "uploads"
OUTPUT_DIR = Path(__file__).parent / "outputs"
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")
app.mount("/outputs", StaticFiles(directory=str(OUTPUT_DIR)), name="outputs")

# Include routers
app.include_router(generation.router, prefix="/api/generation", tags=["generation"])
app.include_router(upload.router, prefix="/api/upload", tags=["upload"])
app.include_router(history.router, prefix="/api/history", tags=["history"])
app.include_router(settings.router, prefix="/api/settings", tags=["settings"])
app.include_router(auth.router)  # Auth router already has /api/auth prefix

# WebSocket endpoint
@app.websocket("/ws/{client_id}")
async def websocket_route(websocket: WebSocket, client_id: str):
    await websocket_endpoint(websocket, client_id)


@app.get("/")
async def root():
    return {"message": "IP-to-Portrait API", "status": "running"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    import os

    # Log level: set LOG_LEVEL=debug for verbose, LOG_LEVEL=warning for quiet
    log_level = os.getenv("LOG_LEVEL", "info").lower()

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8008,
        reload=True,
        log_level=log_level,
        # access_log=False  # Uncomment to disable request logs entirely
    )
