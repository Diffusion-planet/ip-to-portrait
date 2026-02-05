#!/bin/bash
# =============================================================================
# Ghost Face Swap Model Setup Script
# High-quality face swap using ai-forever/ghost
# =============================================================================
# 실행: bash scripts/setup_ghost.sh
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
GHOST_DIR="$PROJECT_ROOT/ghost"
MODELS_DIR="$PROJECT_ROOT/models/ghost"

echo "=========================================="
echo "Ghost Face Swap Model Setup"
echo "=========================================="

# Clone Ghost repository if not exists
if [ ! -d "$GHOST_DIR" ]; then
    echo "[1/4] Cloning Ghost repository..."
    git clone https://github.com/ai-forever/ghost.git "$GHOST_DIR"
    cd "$GHOST_DIR"
    git submodule init
    git submodule update
else
    echo "[1/4] Ghost repository already exists"
fi

# Create models directory
mkdir -p "$MODELS_DIR"

# Download Ghost models
echo "[2/4] Downloading Ghost models..."
cd "$GHOST_DIR"

# Check if download script exists and run it
if [ -f "download_models.sh" ]; then
    bash download_models.sh
fi

# Alternative: Direct download of required models
echo "[3/4] Ensuring required models are downloaded..."

# Generator model (G_unet_2blocks.pth)
GENERATOR_URL="https://drive.google.com/uc?id=1lI-89A5PX7fRIK2_FXd8-R5_qI4GXMHY"
GENERATOR_PATH="$MODELS_DIR/G_unet_2blocks.pth"

if [ ! -f "$GENERATOR_PATH" ]; then
    echo "Downloading Generator model..."
    pip install gdown -q
    gdown "$GENERATOR_URL" -O "$GENERATOR_PATH" || echo "Manual download may be required"
fi

# ArcFace model for face embedding
ARCFACE_URL="https://drive.google.com/uc?id=1p0hCsKQsNhNPpLQ3T8bFPzPEUj-CpGSx"
ARCFACE_PATH="$MODELS_DIR/arcface.pth"

if [ ! -f "$ARCFACE_PATH" ]; then
    echo "Downloading ArcFace model..."
    gdown "$ARCFACE_URL" -O "$ARCFACE_PATH" || echo "Manual download may be required"
fi

# Install Ghost dependencies
echo "[4/4] Installing Ghost dependencies..."
pip install kornia face-alignment

echo ""
echo "=========================================="
echo "Ghost setup complete!"
echo "Models directory: $MODELS_DIR"
echo "=========================================="
echo ""
echo "If automatic download failed, manually download from:"
echo "https://github.com/ai-forever/ghost#pretrained-models"
