#!/bin/bash
# =============================================================================
# IP-to-Portrait - Celery 다중 GPU 워커 시작
# =============================================================================
# 실행 명령어:
#   bash scripts/start_celery_multi_gpu.sh
#   ./scripts/start_celery_multi_gpu.sh
# -----------------------------------------------------------------------------
# 환경 변수로 GPU 개수 지정 가능:
#   GPU_COUNT=4 bash scripts/start_celery_multi_gpu.sh
# =============================================================================
# 각 GPU마다 별도의 Celery 워커를 실행하여 병렬 처리
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

# Detect GPU count or use environment variable
if [ -z "$GPU_COUNT" ]; then
    if command -v nvidia-smi &> /dev/null; then
        GPU_COUNT=$(nvidia-smi --query-gpu=name --format=csv,noheader | wc -l)
    else
        GPU_COUNT=1
        echo "WARNING: nvidia-smi not found. Defaulting to 1 GPU."
    fi
fi

echo "============================================="
echo "  Starting Celery Workers for $GPU_COUNT GPUs"
echo "============================================="

cd "$BACKEND_DIR"

# Start a worker for each GPU
for ((i=0; i<GPU_COUNT; i++)); do
    WORKER_NAME="gpu_worker_$i"
    echo "Starting worker '$WORKER_NAME' on GPU $i..."

    CUDA_VISIBLE_DEVICES=$i nohup "$VENV_CELERY" -A tasks worker \
        --loglevel=info \
        -Q gpu_queue \
        --concurrency=1 \
        -n "$WORKER_NAME@%h" \
        > "/tmp/celery_gpu$i.log" 2>&1 &

    echo "  PID: $!"
    echo "  Log: /tmp/celery_gpu$i.log"
done

echo ""
echo "============================================="
echo "  All workers started!"
echo "============================================="
echo ""
echo "Check logs:"
for ((i=0; i<GPU_COUNT; i++)); do
    echo "  - GPU $i: tail -f /tmp/celery_gpu$i.log"
done
echo ""
echo "Stop all workers:"
echo "  pkill -f 'celery -A tasks worker'"
echo ""
