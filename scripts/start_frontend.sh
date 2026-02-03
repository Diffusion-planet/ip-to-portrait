#!/bin/bash
# =============================================================================
# IP-to-Portrait - 프론트엔드 서버만 시작
# =============================================================================
# 실행 명령어:
#   bash scripts/start_frontend.sh
#   ./scripts/start_frontend.sh
# =============================================================================
# Next.js 서버: http://localhost:3008
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$PROJECT_ROOT/web/frontend"

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

cd "$FRONTEND_DIR"
echo "Starting frontend server on http://localhost:3008"
npm run dev
