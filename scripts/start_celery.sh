#!/bin/bash
# =============================================================================
# IP-to-Portrait - Celery 워커 시작 (단일 GPU)
# =============================================================================
# 실행 명령어:
#   bash scripts/start_celery.sh
#   ./scripts/start_celery.sh
# -----------------------------------------------------------------------------
# 환경 변수로 GPU ID 지정 가능:
#   GPU_ID=5 bash scripts/start_celery.sh
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/web/backend"
VENV_DIR="$PROJECT_ROOT/venv"
VENV_CELERY="$VENV_DIR/bin/celery"
LOG_DIR="$PROJECT_ROOT/logs"

# Check venv exists
if [ ! -f "$VENV_CELERY" ]; then
    echo "ERROR: venv not found at $VENV_DIR"
    echo "Run setup_backend.sh first!"
    exit 1
fi

# Create log directory
mkdir -p "$LOG_DIR"

# Default GPU ID (can be overridden by environment variable)
GPU_ID="${GPU_ID:-0}"

echo "============================================="
echo "  Starting Celery Worker on GPU $GPU_ID"
echo "============================================="

cd "$BACKEND_DIR"

# Run in foreground for direct log output
CUDA_VISIBLE_DEVICES=$GPU_ID "$VENV_CELERY" -A tasks worker \
    --loglevel=info \
    -Q gpu_queue \
    --concurrency=1 \
    -n "worker${GPU_ID}@%h"
