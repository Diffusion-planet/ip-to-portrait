#!/bin/bash
# Start Celery Worker for parallel GPU processing

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/web/backend"
VENV_DIR="$PROJECT_ROOT/venv"

# Activate venv
source "$VENV_DIR/bin/activate"

cd "$BACKEND_DIR"
echo "Starting Celery worker..."
celery -A tasks worker --loglevel=info -Q gpu_queue --concurrency=1
