#!/bin/bash
# =============================================================================
# IP-to-Portrait - Celery 다중 GPU 워커 시작
# =============================================================================
# 실행 명령어:
#   bash scripts/start_celery_multi_gpu.sh
#   ./scripts/start_celery_multi_gpu.sh
# -----------------------------------------------------------------------------
# 환경 변수로 GPU 지정 가능:
#   GPU_IDS="5,6,7" bash scripts/start_celery_multi_gpu.sh  # 특정 GPU 지정
#   GPU_COUNT=2 bash scripts/start_celery_multi_gpu.sh      # GPU 0,1 사용
# =============================================================================
# 각 GPU마다 별도의 Celery 워커를 실행하여 병렬 처리
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

# Determine GPU IDs to use
if [ -n "$GPU_IDS" ]; then
    # Use specified GPU IDs (comma-separated)
    IFS=',' read -ra GPU_ARRAY <<< "$GPU_IDS"
elif [ -n "$GPU_COUNT" ]; then
    # Use first N GPUs
    GPU_ARRAY=()
    for ((i=0; i<GPU_COUNT; i++)); do
        GPU_ARRAY+=($i)
    done
else
    # Auto-detect available GPUs
    if command -v nvidia-smi &> /dev/null; then
        GPU_COUNT=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | wc -l)
        GPU_ARRAY=()
        for ((i=0; i<GPU_COUNT; i++)); do
            GPU_ARRAY+=($i)
        done
    else
        echo "WARNING: nvidia-smi not found. Defaulting to GPU 0."
        GPU_ARRAY=(0)
    fi
fi

# Kill existing workers
echo "Stopping existing Celery workers..."
pkill -f "celery -A tasks worker" 2>/dev/null
sleep 1

echo "============================================="
echo "  Starting Celery Workers"
echo "  GPUs: ${GPU_ARRAY[*]}"
echo "  Logs: $LOG_DIR/worker*.log"
echo "============================================="

cd "$BACKEND_DIR"

# Start a worker for each GPU
for GPU_ID in "${GPU_ARRAY[@]}"; do
    WORKER_NAME="worker${GPU_ID}"
    LOG_FILE="$LOG_DIR/${WORKER_NAME}.log"

    echo "Starting $WORKER_NAME on GPU $GPU_ID..."

    CUDA_VISIBLE_DEVICES=$GPU_ID nohup "$VENV_CELERY" -A tasks worker \
        --loglevel=info \
        -Q gpu_queue \
        --concurrency=1 \
        -n "${WORKER_NAME}@%h" \
        >> "$LOG_FILE" 2>&1 &

    echo "  PID: $!, Log: $LOG_FILE"
done

echo ""
echo "============================================="
echo "  All workers started!"
echo "============================================="
echo ""
echo "Check logs:"
echo "  tail -f $LOG_DIR/worker*.log  # 모든 워커"
for GPU_ID in "${GPU_ARRAY[@]}"; do
    echo "  tail -f $LOG_DIR/worker${GPU_ID}.log  # GPU $GPU_ID"
done
echo ""
echo "Stop all workers:"
echo "  pkill -f 'celery -A tasks worker'"
echo ""
