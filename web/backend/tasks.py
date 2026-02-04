"""
Celery tasks for GPU-based image generation
Each task runs on a separate GPU worker for true parallel processing
"""

import os
import subprocess
import random
from pathlib import Path
from typing import Optional, Dict, Any
from celery import current_task

from celery_app import celery_app

# Paths - relative to backend directory
BACKEND_DIR = Path(__file__).parent
PIPELINE_DIR = BACKEND_DIR.parent.parent
PIPELINE_SCRIPT = PIPELINE_DIR / "inpainting-pipeline.py"
OUTPUT_DIR = BACKEND_DIR / "outputs"
UPLOAD_DIR = BACKEND_DIR / "uploads"
VENV_PYTHON = PIPELINE_DIR / "venv" / "bin" / "python"  # Use venv Python for packages


def find_image_path(base_dir: Path, image_id: str) -> Optional[Path]:
    """Find image file with any supported extension"""
    for ext in [".png", ".jpg", ".jpeg", ".webp"]:
        path = base_dir / f"{image_id}{ext}"
        if path.exists():
            return path
    return None


@celery_app.task(bind=True, name='tasks.generate_image')
def generate_image(
    self,
    task_id: str,
    batch_id: str,
    face_image_id: str,
    reference_image_id: Optional[str],
    params: Dict[str, Any],
    output_index: int,
) -> Dict[str, Any]:
    """
    Generate a single image using the inpainting pipeline.
    This task runs on a GPU worker.

    Args:
        task_id: Unique task identifier
        batch_id: Batch identifier for grouping
        face_image_id: ID of uploaded face image
        reference_image_id: ID of reference/background image (optional)
        params: Generation parameters
        output_index: Index in the batch (for output filename)

    Returns:
        Dict with status, result_url, and any error message
    """

    try:
        # Find face image
        face_image_path = find_image_path(UPLOAD_DIR, face_image_id)
        if not face_image_path:
            return {
                'status': 'failed',
                'error': f'Face image not found: {face_image_id}',
                'task_id': task_id,
            }

        # Find reference/background image
        if reference_image_id:
            background_path = find_image_path(UPLOAD_DIR, reference_image_id)
            if not background_path:
                # Fall back to default background
                background_path = PIPELINE_DIR / "inputs" / "background.png"
        else:
            background_path = PIPELINE_DIR / "inputs" / "background.png"

        if not background_path.exists():
            return {
                'status': 'failed',
                'error': 'Background image not found',
                'task_id': task_id,
            }

        # Prepare output
        OUTPUT_DIR.mkdir(exist_ok=True)
        output_filename = f"{batch_id}_{output_index}.png"
        output_path = OUTPUT_DIR / output_filename

        # Determine seed
        seed = params.get('seed', -1)
        if seed < 0:
            seed = random.randint(0, 2147483647)

        # Build command (use venv Python for package access)
        cmd = [
            str(VENV_PYTHON),
            "-u",
            str(PIPELINE_SCRIPT),
            str(background_path),
            str(face_image_path),
            "--output", str(output_path),
            "--seed", str(seed),
            "--steps", str(params.get('steps', 50)),
            "--guidance", str(params.get('guidance_scale', 7.5)),
            "--denoising", str(params.get('denoise_strength', 0.92)),
            "--face-strength", str(params.get('face_strength', 0.85)),
            "--mask-blur", str(params.get('mask_blur', 15)),
            "--mask-expand", str(params.get('mask_expand', 0.3)),
            "--mask-padding", str(params.get('mask_padding', 0)),
            "--stop-at", str(params.get('stop_at', 1.0)),
        ]

        # Add prompt handling
        auto_prompt = params.get('auto_prompt', False)
        prompt = params.get('prompt', '')

        if auto_prompt or not prompt:
            cmd.append("--auto-prompt")
        if prompt:
            cmd.extend(["--prompt", prompt])

        # Add adapter mode
        adapter_mode = params.get('adapter_mode', 'faceid_plus')
        if adapter_mode == "faceid":
            cmd.append("--use-faceid")
        elif adapter_mode == "faceid_plus":
            cmd.append("--use-faceid-plus")
            cmd.extend(["--shortcut-scale", str(params.get('shortcut_scale', 1.0))])
        elif adapter_mode == "dual":
            cmd.append("--use-dual-adapter")
        elif adapter_mode == "clip_blend":
            cmd.append("--use-clip-blend")
            cmd.extend(["--face-blend-weight", str(params.get('face_blend_weight', 0.8))])
            cmd.extend(["--hair-blend-weight", str(params.get('hair_blend_weight', 0.2))])

        # Add mask flags
        if not params.get('include_hair', True):
            cmd.append("--no-hair")
        if params.get('include_neck', False):
            cmd.append("--include-neck")

        # Enable preview generation
        cmd.append("--save-preview")

        print(f"[Celery Worker] Running task {task_id}: {' '.join(cmd)}")

        # Update task state
        self.update_state(
            state='PROCESSING',
            meta={'task_id': task_id, 'progress': 0, 'message': 'Starting generation...'}
        )

        # Run subprocess
        env = os.environ.copy()
        env['PYTHONUNBUFFERED'] = '1'

        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            env=env,
            text=True,
            bufsize=1,
            cwd=str(PIPELINE_DIR),  # Run in pipeline directory so face_id.py can be imported
        )

        generated_prompt = None
        current_step = 0
        total_steps = params.get('steps', 50)
        preview_url = None
        progress = 0  # Initialize progress

        # Process output in real-time
        for line in process.stdout:
            line = line.strip()
            if not line:
                continue

            print(f"[Celery Worker {task_id}] {line}")

            # Parse preview image path
            if line.startswith("PREVIEW:"):
                preview_abs_path = line.replace("PREVIEW:", "").strip()
                try:
                    preview_path = Path(preview_abs_path)
                    # Convert to URL relative to outputs
                    if OUTPUT_DIR in preview_path.parents or preview_path.parent == OUTPUT_DIR:
                        relative_path = preview_path.relative_to(OUTPUT_DIR)
                        preview_url = f"/outputs/{relative_path.as_posix()}"
                    else:
                        # Try to find relative to backend outputs
                        preview_url = f"/outputs/{preview_path.name}"

                    # Immediately update state with preview
                    self.update_state(
                        state='PROCESSING',
                        meta={
                            'task_id': task_id,
                            'progress': progress,
                            'current_step': current_step,
                            'total_steps': total_steps,
                            'preview_url': preview_url,
                            'message': f'Preview available',
                        }
                    )
                    print(f"[Celery Worker {task_id}] Preview URL: {preview_url}")
                except Exception as e:
                    print(f"[Celery Worker {task_id}] Preview path error: {e}")

            # Parse progress
            if "Step" in line and "/" in line:
                try:
                    parts = line.split("Step")[1].split("/")
                    current_step = int(parts[0].strip())
                    progress = int((current_step / total_steps) * 100)

                    self.update_state(
                        state='PROCESSING',
                        meta={
                            'task_id': task_id,
                            'progress': progress,
                            'current_step': current_step,
                            'total_steps': total_steps,
                            'message': f'Step {current_step}/{total_steps}',
                            'preview_url': preview_url,
                        }
                    )
                except (IndexError, ValueError):
                    pass

            # Capture generated prompt
            if "Generated prompt:" in line or "Auto-generated prompt:" in line or "GENERATED_PROMPT:" in line:
                generated_prompt = line.split(":", 1)[1].strip() if ":" in line else None
                # Update task state with generated prompt so backend can broadcast it
                if generated_prompt:
                    self.update_state(
                        state='PROCESSING',
                        meta={
                            'task_id': task_id,
                            'progress': progress or 0,
                            'message': 'Generated prompt',
                            'generated_prompt': generated_prompt,
                        }
                    )

        process.wait()

        if process.returncode != 0:
            return {
                'status': 'failed',
                'error': f'Pipeline exited with code {process.returncode}',
                'task_id': task_id,
            }

        # Check result - pipeline creates subfolder with timestamp
        # Output structure: outputs/{batch_id}_{index}_{timestamp}/5_result.png
        import shutil

        # First check if direct output exists
        if output_path.exists():
            result_url = f"/outputs/{output_filename}"
            return {
                'status': 'completed',
                'result_url': result_url,
                'task_id': task_id,
                'generated_prompt': generated_prompt,
                'current_step': current_step or total_steps,
            }

        # Look for output in subfolder (pipeline creates: {base_name}_{timestamp}/)
        output_base = output_path.stem  # e.g., "batch_id_1"
        matching_folders = sorted(
            [f for f in OUTPUT_DIR.iterdir() if f.is_dir() and f.name.startswith(output_base)],
            key=lambda x: x.stat().st_mtime,
            reverse=True
        )

        for folder in matching_folders[:1]:  # Check most recent matching folder
            result_file = folder / "5_result.png"
            if result_file.exists():
                # Copy to expected location for consistent URL
                shutil.copy(result_file, output_path)
                result_url = f"/outputs/{output_filename}"
                return {
                    'status': 'completed',
                    'result_url': result_url,
                    'task_id': task_id,
                    'generated_prompt': generated_prompt,
                    'current_step': current_step or total_steps,
                }

        # Fallback: check any recent output folders
        if OUTPUT_DIR.exists():
            folders = sorted(
                [f for f in OUTPUT_DIR.iterdir() if f.is_dir()],
                key=lambda x: x.stat().st_mtime,
                reverse=True
            )
            for folder in folders[:3]:
                result_file = folder / "5_result.png"
                if result_file.exists():
                    shutil.copy(result_file, output_path)
                    result_url = f"/outputs/{output_filename}"
                    return {
                        'status': 'completed',
                        'result_url': result_url,
                        'task_id': task_id,
                        'generated_prompt': generated_prompt,
                        'current_step': current_step or total_steps,
                    }

        return {
            'status': 'failed',
            'error': 'No output file generated',
            'task_id': task_id,
        }

    except Exception as e:
        print(f"[Celery Worker] Task {task_id} failed: {str(e)}")
        return {
            'status': 'failed',
            'error': str(e),
            'task_id': task_id,
        }
