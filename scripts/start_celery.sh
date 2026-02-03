#!/bin/bash
# =============================================================================
# IP-to-Portrait - Celery 워커만 시작
# =============================================================================
# 실행 명령어:
#   bash scripts/start_celery.sh
#   ./scripts/start_celery.sh
# =============================================================================
# GPU 병렬 처리를 위한 Celery 워커
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/web/backend"
VENV_DIR="$PROJECT_ROOT/venv"
VENV_CELERY="$VENV_DIR/bin/celery"

# Check venv exists
if [ ! -f "$VENV_CELERY" ]; then
    echo "ERROR: venv not found at $VENV_DIR"
    echo "Run setup_backend.sh first!"
    exit 1
fi

cd "$BACKEND_DIR"
echo "Starting Celery worker..."
"$VENV_CELERY" -A tasks worker --loglevel=info -Q gpu_queue --concurrency=1
