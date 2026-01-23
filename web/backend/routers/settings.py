"""
Settings management endpoints
"""

import json
from pathlib import Path
from fastapi import APIRouter
from models import Settings, GenerationParams

router = APIRouter()

SETTINGS_FILE = Path(__file__).parent.parent / "data" / "settings.json"


def load_settings() -> Settings:
    """Load settings from file"""
    if not SETTINGS_FILE.exists():
        return Settings()
    try:
        with open(SETTINGS_FILE, "r") as f:
            data = json.load(f)
            return Settings(**data)
    except Exception:
        return Settings()


def save_settings(settings: Settings):
    """Save settings to file"""
    SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(SETTINGS_FILE, "w") as f:
        json.dump(settings.model_dump(), f, indent=2)


@router.get("/", response_model=Settings)
async def get_settings():
    """Get current settings"""
    return load_settings()


@router.put("/", response_model=Settings)
async def update_settings(settings: Settings):
    """Update settings"""
    save_settings(settings)
    return settings


@router.patch("/params", response_model=Settings)
async def update_default_params(params: GenerationParams):
    """Update default generation parameters"""
    settings = load_settings()
    settings.default_params = params
    save_settings(settings)
    return settings


@router.post("/reset", response_model=Settings)
async def reset_settings():
    """Reset settings to defaults"""
    settings = Settings()
    save_settings(settings)
    return settings
