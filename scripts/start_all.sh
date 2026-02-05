#!/bin/bash
# =============================================================================
# IP-to-Portrait - 모든 서비스 시작
# =============================================================================
# 실행 명령어:
#   bash scripts/start_all.sh
#   ./scripts/start_all.sh
# -----------------------------------------------------------------------------
# 환경 변수로 GPU 지정 가능:
#   GPU_IDS="5,6,7" bash scripts/start_all.sh
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$PROJECT_ROOT/venv"
LOG_DIR="$PROJECT_ROOT/logs"

# Create log directory
mkdir -p "$LOG_DIR"

echo "============================================="
echo "  Starting IP-to-Portrait Services"
echo "============================================="

# Ensure services are running
echo "[1/4] Starting PostgreSQL..."
service postgresql start 2>/dev/null || true

echo "[2/4] Starting Redis..."
redis-server --daemonize yes 2>/dev/null || true

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Start Celery workers using multi-GPU script
echo "[3/4] Starting Celery workers..."
bash "$SCRIPT_DIR/start_celery_multi_gpu.sh"

# Start frontend in background
echo "[4/4] Starting Frontend in background..."
cd "$PROJECT_ROOT/web/frontend"
nohup npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "Frontend started (PID: $FRONTEND_PID)"

sleep 3

echo ""
echo "============================================="
echo "  All services started!"
echo "============================================="
echo ""
echo "Frontend:  http://localhost:3008"
echo "Backend:   http://localhost:8008"
echo ""
echo "Log files:"
echo "  - Celery:   $LOG_DIR/worker*.log"
echo "  - Frontend: $LOG_DIR/frontend.log"
echo ""
echo "Starting backend server..."
echo ""

# Start backend in foreground
cd "$PROJECT_ROOT/web/backend"
"$VENV_DIR/bin/python" main.py
