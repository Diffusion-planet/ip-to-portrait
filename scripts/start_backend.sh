#!/bin/bash
# Start IP-to-Portrait Backend Server

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/web/backend"
VENV_DIR="$PROJECT_ROOT/venv"

# Activate venv
source "$VENV_DIR/bin/activate"

# Start services if not running
service postgresql start 2>/dev/null || true
redis-server --daemonize yes 2>/dev/null || true

cd "$BACKEND_DIR"
echo "Starting backend server on http://0.0.0.0:8008"
python main.py
