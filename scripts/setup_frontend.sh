#!/bin/bash
# =============================================================================
# IP-to-Portrait Frontend Setup Script (Runpod Environment)
# =============================================================================
# 실행 명령어:
#   bash scripts/setup_frontend.sh
# =============================================================================
# This script sets up the frontend environment including:
# - nvm (Node Version Manager)
# - Node.js LTS
# - npm dependencies
# - Port forwarding for 3008
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$PROJECT_ROOT/web/frontend"

echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE}  IP-to-Portrait Frontend Setup${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""

# -----------------------------------------------------------------------------
# 1. Install nvm if not installed
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[1/4] Checking nvm installation...${NC}"

export NVM_DIR="$HOME/.nvm"

if [ ! -d "$NVM_DIR" ]; then
    echo -e "${YELLOW}Installing nvm...${NC}"
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

    # Load nvm immediately
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

    echo -e "${GREEN}nvm installed successfully!${NC}"
else
    echo -e "${GREEN}nvm already installed.${NC}"
    # Load nvm
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
fi

# -----------------------------------------------------------------------------
# 2. Install Node.js LTS
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}[2/4] Installing Node.js LTS...${NC}"

# Install and use Node.js 20 LTS
nvm install 20
nvm use 20
nvm alias default 20

NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)

echo -e "${GREEN}Node.js $NODE_VERSION installed${NC}"
echo -e "${GREEN}npm $NPM_VERSION installed${NC}"

# -----------------------------------------------------------------------------
# 3. Install npm dependencies
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}[3/4] Installing npm dependencies...${NC}"

cd "$FRONTEND_DIR"

# Clean install for reliability
if [ -d "node_modules" ]; then
    echo -e "${YELLOW}Removing existing node_modules...${NC}"
    rm -rf node_modules
fi

if [ -f "package-lock.json" ]; then
    echo -e "${YELLOW}Removing package-lock.json for clean install...${NC}"
    rm -f package-lock.json
fi

npm install

echo -e "${GREEN}npm dependencies installed!${NC}"

# -----------------------------------------------------------------------------
# 4. Add nvm to shell profile
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}[4/4] Configuring shell profile...${NC}"

# Add nvm to bashrc if not already there
if ! grep -q "NVM_DIR" ~/.bashrc 2>/dev/null; then
    cat >> ~/.bashrc << 'EOF'

# NVM (Node Version Manager)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
EOF
    echo -e "${GREEN}Added nvm to ~/.bashrc${NC}"
else
    echo -e "${GREEN}nvm already in ~/.bashrc${NC}"
fi

# Also add to .zshrc if zsh is used
if [ -f ~/.zshrc ]; then
    if ! grep -q "NVM_DIR" ~/.zshrc 2>/dev/null; then
        cat >> ~/.zshrc << 'EOF'

# NVM (Node Version Manager)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
EOF
        echo -e "${GREEN}Added nvm to ~/.zshrc${NC}"
    fi
fi

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo ""
echo -e "${BLUE}=============================================${NC}"
echo -e "${GREEN}  Frontend Setup Complete!${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""
echo -e "Node.js: ${GREEN}$NODE_VERSION${NC}"
echo -e "npm:     ${GREEN}$NPM_VERSION${NC}"
echo -e "Path:    ${GREEN}$FRONTEND_DIR${NC}"
echo ""
echo -e "${YELLOW}To start the frontend dev server:${NC}"
echo -e "  cd $FRONTEND_DIR"
echo -e "  npm run dev"
echo ""
echo -e "${YELLOW}Frontend will be available at:${NC}"
echo -e "  ${GREEN}http://localhost:3008${NC}"
echo ""
