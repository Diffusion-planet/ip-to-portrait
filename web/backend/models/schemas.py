"""
Pydantic schemas for API models
"""

from enum import Enum
from typing import Optional, List, Any
from datetime import datetime
from pydantic import BaseModel, Field


class TaskStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class GenerationParams(BaseModel):
    """Parameters for image generation"""
    prompt: str = Field(default="", description="Positive prompt")
    seed: int = Field(default=-1, description="Random seed (-1 for random)")
    steps: int = Field(default=50, ge=1, le=100, description="Number of diffusion steps")
    guidance_scale: float = Field(default=7.5, ge=1.0, le=20.0, description="Guidance scale")
    denoise_strength: float = Field(default=0.92, ge=0.0, le=1.0, description="Denoising strength")

    # Face settings
    face_strength: float = Field(default=0.85, ge=0.0, le=1.5, description="Face strength")
    stop_at: float = Field(default=1.0, ge=0.0, le=1.0, description="FaceID stop at")

    # Adapter mode
    adapter_mode: str = Field(default="faceid_plus", description="Adapter mode: faceid, faceid_plus, dual, clip_blend")
    face_blend_weight: float = Field(default=0.6, ge=0.0, le=1.0, description="Face blend weight for clip_blend mode")
    hair_blend_weight: float = Field(default=0.4, ge=0.0, le=1.0, description="Hair blend weight for clip_blend mode")

    # Mask settings
    mask_blur: int = Field(default=15, ge=0, le=64, description="Mask blur")
    mask_expand: float = Field(default=0.3, ge=0.0, le=1.0, description="Mask expand ratio")
    mask_padding: int = Field(default=0, ge=-100, le=100, description="Mask padding pixels")
    include_hair: bool = Field(default=True, description="Include hair in mask")
    include_neck: bool = Field(default=False, description="Include neck in mask")

    # Prompt settings
    auto_prompt: bool = Field(default=False, description="Auto-generate prompt with Gemini Vision")


class GenerationRequest(BaseModel):
    """Request for starting image generation"""
    face_image_id: str = Field(..., description="ID of uploaded face image")
    reference_image_id: Optional[str] = Field(None, description="ID of uploaded reference/background image")
    params: GenerationParams = Field(default_factory=GenerationParams)
    count: int = Field(default=4, ge=1, le=8, description="Number of images to generate")
    parallel: bool = Field(default=False, description="Run generations in parallel")
    title: Optional[str] = Field(None, description="Custom title for history")
    client_id: Optional[str] = Field(None, description="WebSocket client ID for auto-subscribe")


class GenerationTask(BaseModel):
    """A single generation task"""
    id: str
    status: TaskStatus = TaskStatus.PENDING
    progress: int = 0
    current_step: int = 0
    total_steps: int = 0
    preview_url: Optional[str] = None
    result_url: Optional[str] = None
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    generated_prompt: Optional[str] = None


class GenerationResponse(BaseModel):
    """Response for generation request"""
    batch_id: str
    tasks: List[GenerationTask]
    total_count: int


class HistoryItem(BaseModel):
    """History item for past generations"""
    id: str
    title: Optional[str] = None
    face_image_url: str
    face_image_id: Optional[str] = None
    reference_image_url: Optional[str] = None
    reference_image_id: Optional[str] = None
    result_urls: List[str]
    params: GenerationParams
    count: Optional[int] = None
    parallel: Optional[bool] = None
    created_at: datetime
    is_favorite: bool = False


class Settings(BaseModel):
    """User settings"""
    default_params: GenerationParams = Field(default_factory=GenerationParams)
    default_count: int = Field(default=4, ge=1, le=8)
    parallel_mode: bool = Field(default=False)
    auto_prompt: bool = Field(default=True)
    show_intermediate: bool = Field(default=True)


class ProgressMessage(BaseModel):
    """Real-time progress update"""
    task_id: str
    batch_id: str
    status: TaskStatus
    progress: int
    current_step: int
    total_steps: int
    preview_url: Optional[str] = None
    message: Optional[str] = None


class WebSocketMessage(BaseModel):
    """WebSocket message wrapper"""
    type: str
    data: Any
