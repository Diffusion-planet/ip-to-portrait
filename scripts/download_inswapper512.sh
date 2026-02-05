#!/bin/bash
# =============================================================================
# Download inswapper_512.onnx for higher quality face swap
# This model has 4x resolution compared to inswapper_128
# =============================================================================
# 실행: bash scripts/download_inswapper512.sh
# =============================================================================

set -e

# InsightFace models directory
INSIGHTFACE_DIR="$HOME/.insightface/models/buffalo_l"
mkdir -p "$INSIGHTFACE_DIR"

INSWAPPER_PATH="$INSIGHTFACE_DIR/inswapper_512.onnx"

echo "=========================================="
echo "Downloading inswapper_512.onnx"
echo "=========================================="

if [ -f "$INSWAPPER_PATH" ]; then
    echo "inswapper_512.onnx already exists at $INSWAPPER_PATH"
    exit 0
fi

# Download from Hugging Face
echo "Downloading from Hugging Face..."
pip install -q huggingface_hub

python3 << 'EOF'
from huggingface_hub import hf_hub_download
import os
import shutil

# Download inswapper_512.onnx
try:
    # Try from deepinsight repo
    path = hf_hub_download(
        repo_id="deepinsight/inswapper",
        filename="inswapper_512.onnx",
        local_dir_use_symlinks=False
    )
    dest = os.path.expanduser("~/.insightface/models/buffalo_l/inswapper_512.onnx")
    if path != dest:
        shutil.copy(path, dest)
    print(f"Downloaded to: {dest}")
except Exception as e:
    print(f"Failed from deepinsight: {e}")
    # Try alternative source
    try:
        path = hf_hub_download(
            repo_id="ashleykleynhans/inswapper",
            filename="inswapper_512.onnx",
            local_dir_use_symlinks=False
        )
        dest = os.path.expanduser("~/.insightface/models/buffalo_l/inswapper_512.onnx")
        if path != dest:
            shutil.copy(path, dest)
        print(f"Downloaded to: {dest}")
    except Exception as e2:
        print(f"Failed from alternative: {e2}")
        print("\nManual download required:")
        print("1. Search for 'inswapper_512.onnx' on Hugging Face")
        print("2. Download and place at: ~/.insightface/models/buffalo_l/inswapper_512.onnx")
        exit(1)
EOF

echo ""
echo "=========================================="
echo "Download complete!"
echo "Location: $INSWAPPER_PATH"
echo "=========================================="
