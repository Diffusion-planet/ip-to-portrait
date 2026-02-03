#!/bin/bash
# =============================================================================
# IP-to-Portrait - 백엔드 서버만 시작
# =============================================================================
# 실행 명령어:
#   bash scripts/start_backend.sh
#   ./scripts/start_backend.sh
# =============================================================================
# FastAPI 서버: http://localhost:8008
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/web/backend"
VENV_DIR="$PROJECT_ROOT/venv"
VENV_PYTHON="$VENV_DIR/bin/python"

# Check venv exists
if [ ! -f "$VENV_PYTHON" ]; then
    echo "ERROR: venv not found at $VENV_DIR"
    echo "Run setup_backend.sh first!"
    exit 1
fi

# Start services if not running
service postgresql start 2>/dev/null || true
redis-server --daemonize yes 2>/dev/null || true

cd "$BACKEND_DIR"
echo "Starting backend server on http://0.0.0.0:8008"
"$VENV_PYTHON" main.py
