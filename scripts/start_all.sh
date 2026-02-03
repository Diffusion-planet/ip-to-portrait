#!/bin/bash
# Start all IP-to-Portrait services

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

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

# Activate venv
source "$PROJECT_ROOT/venv/bin/activate"

# Start Celery in background
echo "[3/4] Starting Celery worker in background..."
cd "$PROJECT_ROOT/web/backend"
nohup celery -A tasks worker --loglevel=info -Q gpu_queue --concurrency=1 > /tmp/celery.log 2>&1 &
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

# Start backend in foreground
cd "$PROJECT_ROOT/web/backend"
python main.py
