"""
Image generation endpoints
"""

import uuid
from typing import List, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from models import (
    GenerationRequest,
    GenerationResponse,
    GenerationTask,
    TaskStatus,
)
from models.user import User
from services.pipeline_service import PipelineService
from services.task_manager import task_manager
from services.websocket_manager import websocket_manager
from core.deps import get_current_user_optional

router = APIRouter()
pipeline_service = PipelineService()


@router.post("/start", response_model=GenerationResponse)
async def start_generation(
    request: GenerationRequest,
    background_tasks: BackgroundTasks,
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Start a new generation batch"""

    # Create batch ID
    batch_id = str(uuid.uuid4())

    # Auto-subscribe client to batch BEFORE starting generation
    # This ensures WebSocket updates are received even if Celery is fast
    if request.client_id:
        websocket_manager.subscribe_to_batch(request.client_id, batch_id)

    # Create tasks for each generation
    tasks: List[GenerationTask] = []
    for i in range(request.count):
        task = GenerationTask(
            id=f"{batch_id}-{i}",
            status=TaskStatus.PENDING,
        )
        tasks.append(task)
        task_manager.add_task(task)

    # Get user_id if logged in
    user_id = current_user.id if current_user else None

    # Start generation in background
    background_tasks.add_task(
        pipeline_service.run_generation_batch,
        batch_id=batch_id,
        face_image_id=request.face_image_id,
        reference_image_id=request.reference_image_id,
        params=request.params,
        task_ids=[t.id for t in tasks],
        parallel=request.parallel,
        user_id=user_id,
        title=request.title,
    )

    return GenerationResponse(
        batch_id=batch_id,
        tasks=tasks,
        total_count=request.count,
    )


@router.get("/status/{batch_id}")
async def get_batch_status(batch_id: str):
    """Get status of all tasks in a batch"""

    tasks = task_manager.get_batch_tasks(batch_id)
    if not tasks:
        raise HTTPException(status_code=404, detail="Batch not found")

    return {
        "batch_id": batch_id,
        "tasks": tasks,
        "completed": sum(1 for t in tasks if t.status == TaskStatus.COMPLETED),
        "total": len(tasks),
    }


@router.get("/task/{task_id}")
async def get_task_status(task_id: str):
    """Get status of a specific task"""

    task = task_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return task


@router.post("/cancel/{batch_id}")
async def cancel_batch(batch_id: str):
    """Cancel all tasks in a batch"""

    cancelled = task_manager.cancel_batch(batch_id)
    if cancelled == 0:
        raise HTTPException(status_code=404, detail="Batch not found or already completed")

    return {"status": "cancelled", "cancelled_count": cancelled}


@router.post("/task/{task_id}/regenerate")
async def regenerate_task(task_id: str, background_tasks: BackgroundTasks):
    """Regenerate a specific task with new seed"""

    task = task_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Reset task status
    task.status = TaskStatus.PENDING
    task.progress = 0
    task.preview_url = None
    task.result_url = None
    task.error = None

    # Start regeneration
    background_tasks.add_task(
        pipeline_service.regenerate_single,
        task_id=task_id,
    )

    return task
