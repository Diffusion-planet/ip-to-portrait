"""
Celery application configuration for parallel GPU processing
"""

from celery import Celery
from core.config import settings

# Get Redis URL from settings or use default
REDIS_URL = getattr(settings, 'REDIS_URL', 'redis://localhost:6379/0')

# Create Celery app
celery_app = Celery(
    'inpainting_tasks',
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=['tasks']
)

# Celery configuration
celery_app.conf.update(
    # Task settings
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,

    # Worker settings
    worker_prefetch_multiplier=1,  # One task per worker at a time (important for GPU)
    worker_concurrency=1,  # One process per worker (each worker = one GPU)

    # Result settings
    result_expires=3600,  # Results expire after 1 hour

    # Task routing (optional - for multi-GPU setups)
    task_routes={
        'tasks.generate_image': {'queue': 'gpu_queue'},
    },

    # Retry settings
    task_acks_late=True,
    task_reject_on_worker_lost=True,
)
