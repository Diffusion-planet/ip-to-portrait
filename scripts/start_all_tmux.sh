#!/bin/bash
# =============================================================================
# IP-to-Portrait - 모든 서비스 시작 (tmux 분할 화면)
# =============================================================================
# 실행 명령어:
#   bash scripts/start_all_tmux.sh
#   ./scripts/start_all_tmux.sh
# -----------------------------------------------------------------------------
# 환경 변수로 GPU 지정 가능:
#   GPU_IDS="5,6,7" bash scripts/start_all_tmux.sh
# -----------------------------------------------------------------------------
# 종료 명령어:
#   tmux kill-session -t ip-to-portrait
# =============================================================================
# 4분할 화면으로 모든 로그를 실시간으로 확인 가능
# 마우스 지원 자동 활성화 (클릭으로 창 이동, 스크롤 가능)
# Ctrl+B → D: 세션 분리, Ctrl+B → o: 다음 창 이동
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SESSION_NAME="ip-to-portrait"
LOG_DIR="$PROJECT_ROOT/logs"

# Create log directory
mkdir -p "$LOG_DIR"

echo "============================================="
echo "  Starting IP-to-Portrait Services (tmux)"
echo "============================================="

# Ensure services are running
echo "[1/2] Starting PostgreSQL & Redis..."
service postgresql start 2>/dev/null || true
redis-server --daemonize yes 2>/dev/null || true

# Kill existing session if exists
tmux kill-session -t $SESSION_NAME 2>/dev/null || true

echo "[2/2] Creating tmux session with split panes..."

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
        DETECTED_COUNT=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | wc -l)
        GPU_ARRAY=()
        for ((i=0; i<DETECTED_COUNT; i++)); do
            GPU_ARRAY+=($i)
        done
    else
        GPU_ARRAY=(0)
    fi
fi

GPU_COUNT=${#GPU_ARRAY[@]}

# Create new tmux session with backend
tmux new-session -d -s $SESSION_NAME -n main

# Enable mouse support for easier navigation
tmux set -g mouse on

# Pane 0: Backend (top-left) - use venv python directly
tmux send-keys -t $SESSION_NAME "cd $PROJECT_ROOT/web/backend && echo '=== BACKEND ===' && $PROJECT_ROOT/venv/bin/python main.py" C-m

# Split horizontally (top-right): Celery
tmux split-window -h -t $SESSION_NAME

if [ "$GPU_COUNT" -gt 1 ]; then
    # Multi-GPU: Start multiple workers in background, show combined logs
    CELERY_CMD="cd $PROJECT_ROOT/web/backend && echo '=== CELERY (Multi-GPU: ${GPU_ARRAY[*]}) ===' && "
    for GPU_ID in "${GPU_ARRAY[@]}"; do
        CELERY_CMD+="CUDA_VISIBLE_DEVICES=$GPU_ID $PROJECT_ROOT/venv/bin/celery -A tasks worker --loglevel=info -Q gpu_queue --concurrency=1 -n worker${GPU_ID}@%h >> $LOG_DIR/worker${GPU_ID}.log 2>&1 & "
    done
    CELERY_CMD+="sleep 1 && echo 'All ${GPU_COUNT} workers started. Showing combined logs...' && tail -f $LOG_DIR/worker*.log"
    tmux send-keys -t $SESSION_NAME "$CELERY_CMD" C-m
else
    # Single GPU: Direct output
    GPU_ID="${GPU_ARRAY[0]}"
    tmux send-keys -t $SESSION_NAME "cd $PROJECT_ROOT/web/backend && echo '=== CELERY (GPU $GPU_ID) ===' && CUDA_VISIBLE_DEVICES=$GPU_ID $PROJECT_ROOT/venv/bin/celery -A tasks worker --loglevel=info -Q gpu_queue --concurrency=1 -n worker${GPU_ID}@%h" C-m
fi

# Split pane 1 vertically (bottom-right): Frontend
tmux split-window -v -t $SESSION_NAME
tmux send-keys -t $SESSION_NAME "export NVM_DIR=\"\$HOME/.nvm\" && [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\" && cd $PROJECT_ROOT/web/frontend && echo '=== FRONTEND ===' && npm run dev" C-m

# Select pane 0 and split vertically (bottom-left): Logs/Shell
tmux select-pane -t $SESSION_NAME:0.0
tmux split-window -v -t $SESSION_NAME
tmux send-keys -t $SESSION_NAME "echo '=== SHELL (for commands) ===' && cd $PROJECT_ROOT" C-m

# Set layout to tiled (equal sized panes)
tmux select-layout -t $SESSION_NAME tiled

echo ""
echo "============================================="
echo "  tmux session '$SESSION_NAME' created!"
echo "============================================="
echo ""
echo "GPUs: ${GPU_ARRAY[*]}"
echo "Logs: $LOG_DIR/worker*.log"
echo ""
echo "Layout:"
echo "  +------------+------------+"
echo "  |  Backend   |   Celery   |"
echo "  +------------+------------+"
echo "  |   Shell    |  Frontend  |"
echo "  +------------+------------+"
echo ""
echo "Commands:"
echo "  Attach:     tmux attach -t $SESSION_NAME"
echo "  Detach:     Ctrl+B, then D"
echo "  Switch:     Ctrl+B, then arrow keys"
echo "  Kill:       tmux kill-session -t $SESSION_NAME"
echo ""
echo "Attaching now..."
echo ""

# Attach to session
tmux attach -t $SESSION_NAME
