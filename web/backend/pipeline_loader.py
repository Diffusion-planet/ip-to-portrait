"""
Pre-load models when Celery worker starts
Models are loaded once and reused for all tasks
"""

import sys
from pathlib import Path

# Add parent directory to path to import inpainting-pipeline
BACKEND_DIR = Path(__file__).parent
PIPELINE_DIR = BACKEND_DIR.parent.parent
sys.path.insert(0, str(PIPELINE_DIR))

# Import after adding to path
try:
    # This will be implemented after we refactor inpainting-pipeline.py
    from inpainting_pipeline_module import FaceInpaintingPipeline

    # Global pipeline instance
    _pipeline = None

    def get_pipeline():
        """Get or create the global pipeline instance"""
        global _pipeline
        if _pipeline is None:
            print("🔄 Loading models into memory (this may take a minute)...")
            _pipeline = FaceInpaintingPipeline(
                device="cuda",
                use_bisenet=True,
                adapter_mode="faceid_plus"
            )
            print("✅ Models loaded successfully! Ready for fast generation.")
        return _pipeline

    def warmup_pipeline():
        """Warmup the pipeline when worker starts"""
        get_pipeline()

except ImportError as e:
    print(f"⚠️  Could not import pipeline module: {e}")
    print("⚠️  Will fall back to subprocess method")

    def get_pipeline():
        return None

    def warmup_pipeline():
        pass
