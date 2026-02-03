#!/bin/bash
# =============================================================================
# IP-to-Portrait - 모든 서비스 시작 (백그라운드)
# =============================================================================
# 실행 명령어:
#   bash scripts/start_all.sh
#   ./scripts/start_all.sh
# =============================================================================
# Backend: foreground, Celery/Frontend: background
# 로그 파일: /tmp/celery.log, /tmp/frontend.log
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$PROJECT_ROOT/venv"
VENV_PYTHON="$VENV_DIR/bin/python"
VENV_CELERY="$VENV_DIR/bin/celery"

echo "============================================="
echo "  Starting IP-to-Portrait Services"
echo "============================================="

# Check venv exists
if [ ! -f "$VENV_PYTHON" ]; then
    echo "ERROR: venv not found at $VENV_DIR"
    echo "Run setup_backend.sh first!"
    exit 1
fi

# Ensure services are running
echo "[1/4] Starting PostgreSQL..."
service postgresql start 2>/dev/null || true

echo "[2/4] Starting Redis..."
redis-server --daemonize yes 2>/dev/null || true

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Start Celery in background (using venv celery directly)
echo "[3/4] Starting Celery worker in background..."
cd "$PROJECT_ROOT/web/backend"
nohup "$VENV_CELERY" -A tasks worker --loglevel=info -Q gpu_queue --concurrency=1 > /tmp/celery.log 2>&1 &
CELERY_PID=$!
echo "Celery worker started (PID: $CELERY_PID)"

# Start frontend in background
echo "[4/4] Starting Frontend in background..."
cd "$PROJECT_ROOT/web/frontend"
nohup npm run dev > /tmp/frontend.log 2>&1 &
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
echo "  - Celery:   /tmp/celery.log"
echo "  - Frontend: /tmp/frontend.log"
echo ""
echo "Starting backend server..."
echo ""

# Start backend in foreground (using venv python directly)
cd "$PROJECT_ROOT/web/backend"
"$VENV_PYTHON" main.py
