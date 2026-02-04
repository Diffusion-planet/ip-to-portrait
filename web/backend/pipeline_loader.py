"""
Pre-load models when backend/worker starts
Models are loaded once and reused for all tasks
"""

import sys
import importlib.util
from pathlib import Path

# Add parent directory to path to import inpainting-pipeline.py
BACKEND_DIR = Path(__file__).parent
PIPELINE_DIR = BACKEND_DIR.parent.parent
PIPELINE_SCRIPT = PIPELINE_DIR / "inpainting-pipeline.py"

# Global pipeline instance
_pipeline = None

def get_pipeline():
    """Get or create the global pipeline instance"""
    global _pipeline
    if _pipeline is None:
        try:
            print("🔄 Loading models into memory (this may take a minute)...")
            print(f"[DEBUG pipeline_loader] PIPELINE_DIR: {PIPELINE_DIR}")
            print(f"[DEBUG pipeline_loader] sys.path before: {sys.path[:3]}")

            # Add PIPELINE_DIR to sys.path so face_id.py can be imported
            if str(PIPELINE_DIR) not in sys.path:
                sys.path.insert(0, str(PIPELINE_DIR))
                print(f"[DEBUG pipeline_loader] ✅ Added {PIPELINE_DIR} to sys.path")

            # Import inpainting-pipeline.py using importlib
            spec = importlib.util.spec_from_file_location("inpainting_pipeline", PIPELINE_SCRIPT)
            if spec and spec.loader:
                pipeline_module = importlib.util.module_from_spec(spec)
                sys.modules["inpainting_pipeline"] = pipeline_module
                spec.loader.exec_module(pipeline_module)

                # Create pipeline instance with FaceID Plus v2 (recommended)
                _pipeline = pipeline_module.AutoIDPhotoCompositor(
                    detection_method='opencv',
                    use_bisenet=True,
                    use_faceid_plus=True
                )
                print("✅ Models loaded successfully! Ready for fast generation.")
            else:
                raise ImportError(f"Could not load {PIPELINE_SCRIPT}")
        except Exception as e:
            print(f"⚠️  Could not load pipeline: {e}")
            print("⚠️  Will fall back to subprocess method")
            _pipeline = None

    return _pipeline

def warmup_pipeline():
    """Warmup the pipeline when worker/server starts"""
    get_pipeline()
