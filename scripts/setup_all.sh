#!/bin/bash
# =============================================================================
# IP-to-Portrait Complete Setup Script (Runpod Environment)
# =============================================================================
# 실행 명령어:
#   bash scripts/setup_all.sh
#   또는: cd ip-to-portrait && bash scripts/setup_all.sh
# =============================================================================
# This script runs both frontend and backend setup scripts
# Use this when the Runpod instance is freshly initialized
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE}  IP-to-Portrait Complete Setup${NC}"
echo -e "${BLUE}  (Runpod Environment)${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""

# -----------------------------------------------------------------------------
# Run Backend Setup
# -----------------------------------------------------------------------------
echo -e "${YELLOW}========== BACKEND SETUP ==========${NC}"
echo ""
bash "$SCRIPT_DIR/setup_backend.sh"

echo ""
echo -e "${YELLOW}========== FRONTEND SETUP ==========${NC}"
echo ""

# -----------------------------------------------------------------------------
# Run Frontend Setup
# -----------------------------------------------------------------------------
bash "$SCRIPT_DIR/setup_frontend.sh"

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo ""
echo -e "${BLUE}=============================================${NC}"
echo -e "${GREEN}  COMPLETE SETUP FINISHED!${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""
echo -e "${GREEN}All components installed:${NC}"
echo -e "  - PostgreSQL (localhost:5433)"
echo -e "  - Redis (localhost:6379)"
echo -e "  - Python venv with all requirements"
echo -e "  - Node.js with nvm"
echo -e "  - npm dependencies"
echo ""
echo -e "${YELLOW}Startup Commands:${NC}"
echo -e "  All services:   ${GREEN}$SCRIPT_DIR/start_all.sh${NC}"
echo -e "  Backend only:   ${GREEN}$SCRIPT_DIR/start_backend.sh${NC}"
echo -e "  Frontend only:  ${GREEN}$SCRIPT_DIR/start_frontend.sh${NC}"
echo -e "  Celery worker:  ${GREEN}$SCRIPT_DIR/start_celery.sh${NC}"
echo ""
echo -e "${YELLOW}Port Forwarding (Runpod):${NC}"
echo -e "  - 3008 (Frontend)"
echo -e "  - 8008 (Backend)"
echo ""
echo -e "${RED}Important:${NC}"
echo -e "  1. Set GEMINI_API_KEY in .env file"
echo -e "  2. Configure port forwarding 3008, 8008 in Runpod"
echo ""
