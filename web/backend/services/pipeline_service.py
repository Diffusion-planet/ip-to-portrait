"""
Pipeline service wrapping inpainting-pipeline.py via subprocess
Supports both local execution and Celery-based parallel GPU workers
"""

import subprocess
import asyncio
import shutil
import random
from pathlib import Path
from datetime import datetime
from typing import List, Optional
from models import GenerationParams, TaskStatus, ProgressMessage, WebSocketMessage
from .task_manager import task_manager
from .websocket_manager import websocket_manager
from core.config import settings
from pipeline_loader import get_pipeline

# Paths
PIPELINE_DIR = Path(__file__).parent.parent.parent.parent
PIPELINE_SCRIPT = PIPELINE_DIR / "inpainting-pipeline.py"
DEFAULT_BACKGROUND = PIPELINE_DIR / "inputs" / "background.png"
VENV_PYTHON = PIPELINE_DIR / "venv" / "bin" / "python"  # Use venv Python for packages


class PipelineService:
    """Service for running the inpainting pipeline via subprocess"""

    def __init__(self):
        self.output_dir = Path(__file__).parent.parent / "outputs"
        self.output_dir.mkdir(exist_ok=True)
        self.upload_dir = Path(__file__).parent.parent / "uploads"
        self.upload_dir.mkdir(exist_ok=True)

    def _get_face_image_path(self, face_image_id: str) -> Optional[Path]:
        """Get the path to an uploaded face image"""
        for ext in [".png", ".jpg", ".jpeg", ".webp"]:
            path = self.upload_dir / f"{face_image_id}{ext}"
            if path.exists():
                return path
        return None

    def _get_reference_image_path(self, reference_image_id: str) -> Optional[Path]:
        """Get the path to an uploaded reference/background image"""
        for ext in [".png", ".jpg", ".jpeg", ".webp"]:
            path = self.upload_dir / f"{reference_image_id}{ext}"
            if path.exists():
                return path
        return None

    def _get_background_path(self) -> Path:
        """Get default background image path"""
        if DEFAULT_BACKGROUND.exists():
            return DEFAULT_BACKGROUND

        inputs_dir = PIPELINE_DIR / "inputs"
        for pattern in ["background.*", "bg.*", "*.png", "*.jpg"]:
            files = list(inputs_dir.glob(pattern))
            if files:
                return files[0]

        # Create a simple white background if none exists
        from PIL import Image
        bg = Image.new("RGB", (1024, 1024), color=(255, 255, 255))
        bg_path = inputs_dir / "background.png"
        inputs_dir.mkdir(exist_ok=True)
        bg.save(bg_path)
        return bg_path

    async def _send_progress(
        self,
        task_id: str,
        batch_id: str,
        status: TaskStatus,
        progress: int,
        current_step: int = 0,
        total_steps: int = 0,
        preview_url: Optional[str] = None,
        message: Optional[str] = None,
    ):
        """Send progress update via WebSocket"""
        progress_msg = ProgressMessage(
            task_id=task_id,
            batch_id=batch_id,
            status=status,
            progress=progress,
            current_step=current_step,
            total_steps=total_steps,
            preview_url=preview_url,
            message=message,
        )
        await websocket_manager.broadcast_progress(progress_msg)

    async def run_generation_batch(
        self,
        batch_id: str,
        face_image_id: str,
        reference_image_id: Optional[str],
        params: GenerationParams,
        task_ids: List[str],
        parallel: bool = False,
        user_id: Optional[str] = None,
        title: Optional[str] = None,
    ):
        """Run a batch of generations"""

        face_image_path = self._get_face_image_path(face_image_id)
        if not face_image_path:
            for task_id in task_ids:
                task_manager.update_task(
                    task_id,
                    status=TaskStatus.FAILED,
                    error="Face image not found",
                )
                await self._send_progress(
                    task_id, batch_id, TaskStatus.FAILED, 0,
                    message="Face image not found"
                )
            return

        # Use reference image if provided, otherwise use default background
        if reference_image_id:
            background_path = self._get_reference_image_path(reference_image_id)
            if not background_path:
                background_path = self._get_background_path()
        else:
            background_path = self._get_background_path()

        # Use Celery for parallel processing when enabled
        if settings.USE_CELERY and parallel and len(task_ids) > 1:
            await self._run_celery_batch(
                batch_id=batch_id,
                face_image_id=face_image_id,
                reference_image_id=reference_image_id,
                params=params,
                task_ids=task_ids,
            )
        elif parallel:
            # Local async parallel (same GPU, concurrent I/O)
            tasks = [
                self._run_single_generation(
                    task_id=task_id,
                    batch_id=batch_id,
                    face_image_path=face_image_path,
                    background_path=background_path,
                    params=params,
                    index=i,
                )
                for i, task_id in enumerate(task_ids)
            ]
            await asyncio.gather(*tasks)
        else:
            # Sequential execution
            for i, task_id in enumerate(task_ids):
                if task_manager.is_batch_cancelled(batch_id):
                    break

                await self._run_single_generation(
                    task_id=task_id,
                    batch_id=batch_id,
                    face_image_path=face_image_path,
                    background_path=background_path,
                    params=params,
                    index=i,
                )

        # Only save to history for logged-in users
        if user_id:
            await self._add_to_history_db(batch_id, face_image_id, reference_image_id, params, task_ids, len(task_ids), parallel, user_id, title)

    async def _run_celery_batch(
        self,
        batch_id: str,
        face_image_id: str,
        reference_image_id: Optional[str],
        params: GenerationParams,
        task_ids: List[str],
    ):
        """Run batch using Celery workers for true parallel GPU processing"""
        from tasks import generate_image

        # Convert params to dict for Celery serialization
        params_dict = params.model_dump()

        # Dispatch all tasks to Celery workers
        celery_tasks = []
        for i, task_id in enumerate(task_ids):
            # Update local task status
            task_manager.update_task(
                task_id,
                status=TaskStatus.PROCESSING,
                total_steps=params.steps,
                started_at=datetime.now(),
            )
            await self._send_progress(
                task_id, batch_id, TaskStatus.PROCESSING, 0,
                total_steps=params.steps,
                message="Queued for GPU worker..."
            )

            # Dispatch to Celery
            celery_task = generate_image.delay(
                task_id=task_id,
                batch_id=batch_id,
                face_image_id=face_image_id,
                reference_image_id=reference_image_id,
                params=params_dict,
                output_index=i,
            )
            celery_tasks.append((task_id, celery_task))

        # Monitor all tasks
        await self._monitor_celery_tasks(batch_id, celery_tasks, params.steps)

    async def _monitor_celery_tasks(
        self,
        batch_id: str,
        celery_tasks: List[tuple],
        total_steps: int,
    ):
        """Monitor Celery tasks and send progress updates via WebSocket"""
        pending_tasks = {task_id: celery_task for task_id, celery_task in celery_tasks}

        while pending_tasks:
            for task_id, celery_task in list(pending_tasks.items()):
                # Check if batch was cancelled
                if task_manager.is_batch_cancelled(batch_id):
                    celery_task.revoke(terminate=True)
                    task_manager.update_task(
                        task_id,
                        status=TaskStatus.CANCELLED,
                    )
                    await self._send_progress(
                        task_id, batch_id, TaskStatus.CANCELLED, 0,
                        message="Cancelled"
                    )
                    del pending_tasks[task_id]
                    continue

                # Check task state
                if celery_task.ready():
                    result = celery_task.result

                    if result.get('status') == 'completed':
                        result_url = result.get('result_url')
                        current_step = result.get('current_step', total_steps)
                        generated_prompt = result.get('generated_prompt')

                        task_manager.update_task(
                            task_id,
                            status=TaskStatus.COMPLETED,
                            progress=100,
                            current_step=current_step,
                            result_url=result_url,
                            completed_at=datetime.now(),
                            generated_prompt=generated_prompt,
                        )

                        await self._send_progress(
                            task_id, batch_id, TaskStatus.COMPLETED, 100,
                            current_step=current_step,
                            total_steps=total_steps,
                            preview_url=result_url,
                            message="Generation completed"
                        )
                    else:
                        error = result.get('error', 'Unknown error')
                        task_manager.update_task(
                            task_id,
                            status=TaskStatus.FAILED,
                            error=error,
                            completed_at=datetime.now(),
                        )

                        await self._send_progress(
                            task_id, batch_id, TaskStatus.FAILED, 0,
                            message=f"Generation failed: {error}"
                        )

                    del pending_tasks[task_id]

                elif celery_task.state == 'PROCESSING':
                    # Get progress from task meta
                    meta = celery_task.info or {}
                    progress = meta.get('progress', 0)
                    current_step = meta.get('current_step', 0)
                    message = meta.get('message', 'Processing...')
                    preview_url = meta.get('preview_url')
                    generated_prompt = meta.get('generated_prompt')

                    task_manager.update_task(
                        task_id,
                        progress=progress,
                        current_step=current_step,
                        preview_url=preview_url,
                        generated_prompt=generated_prompt,
                    )

                    # Send generated prompt via WebSocket if available
                    if generated_prompt:
                        prompt_message = WebSocketMessage(
                            type="generated_prompt",
                            data={"prompt": generated_prompt}
                        )
                        await websocket_manager.broadcast_to_batch(batch_id, prompt_message)

                    await self._send_progress(
                        task_id, batch_id, TaskStatus.PROCESSING, progress,
                        current_step=current_step,
                        total_steps=total_steps,
                        preview_url=preview_url,
                        message=message
                    )

            # Small delay before checking again
            if pending_tasks:
                await asyncio.sleep(0.5)

    async def _run_single_generation(
        self,
        task_id: str,
        batch_id: str,
        face_image_path: Path,
        background_path: Path,
        params: GenerationParams,
        index: int,
    ):
        """Run a single generation via subprocess"""

        task = task_manager.get_task(task_id)
        if not task or task.status == TaskStatus.CANCELLED:
            return

        task_manager.update_task(
            task_id,
            status=TaskStatus.PROCESSING,
            total_steps=params.steps,
            started_at=datetime.now(),
        )

        await self._send_progress(
            task_id, batch_id, TaskStatus.PROCESSING, 0,
            total_steps=params.steps,
            message="Starting generation..."
        )

        try:
            seed = params.seed if params.seed >= 0 else random.randint(0, 2147483647)

            result_path = await self._execute_pipeline(
                task_id=task_id,
                batch_id=batch_id,
                face_image_path=face_image_path,
                background_path=background_path,
                params=params,
                seed=seed,
                output_index=index,
            )

            if result_path and result_path.exists():
                result_url = f"/outputs/{result_path.name}"
                # Get the last recorded step from the task
                current_task = task_manager.get_task(task_id)
                final_step = current_task.current_step if current_task and current_task.current_step > 0 else params.steps
                task_manager.update_task(
                    task_id,
                    status=TaskStatus.COMPLETED,
                    progress=100,
                    current_step=final_step,
                    result_url=result_url,
                    completed_at=datetime.now(),
                )

                await self._send_progress(
                    task_id, batch_id, TaskStatus.COMPLETED, 100,
                    current_step=final_step,
                    total_steps=params.steps,
                    preview_url=result_url,
                    message="Generation completed"
                )
            else:
                raise Exception("Pipeline returned no result")

        except Exception as e:
            task_manager.update_task(
                task_id,
                status=TaskStatus.FAILED,
                error=str(e),
                completed_at=datetime.now(),
            )

            await self._send_progress(
                task_id, batch_id, TaskStatus.FAILED, 0,
                message=f"Generation failed: {str(e)}"
            )

    async def _execute_pipeline(
        self,
        task_id: str,
        batch_id: str,
        face_image_path: Path,
        background_path: Path,
        params: GenerationParams,
        seed: int,
        output_index: int,
    ) -> Optional[Path]:
        """Execute the inpainting pipeline - use subprocess for preview support"""

        output_filename = f"{batch_id}_{output_index}.png"
        output_path = self.output_dir / output_filename

        # Always use subprocess for consistent preview support
        # (Preloaded pipeline can't capture stdout for previews)
        return await self._execute_pipeline_subprocess(
            task_id, batch_id, face_image_path, background_path,
            params, seed, output_index, output_path
        )

    async def _execute_pipeline_direct(
        self,
        pipeline,
        task_id: str,
        batch_id: str,
        face_image_path: Path,
        background_path: Path,
        params: GenerationParams,
        seed: int,
        output_index: int,
        output_path: Path,
    ) -> Optional[Path]:
        """Execute pipeline directly using preloaded model"""

        try:
            # Handle auto-prompt if requested
            final_prompt = params.prompt or "professional portrait, natural expression"
            generated_prompt = None

            if params.auto_prompt or not params.prompt:
                try:
                    from prompt_generator import generate_prompt_from_face_image
                    print(f"[Pipeline Direct] Generating prompt for {face_image_path}...")
                    generated_prompt = generate_prompt_from_face_image(str(face_image_path))
                    final_prompt = generated_prompt
                    print(f"[Pipeline Direct] Generated prompt: {generated_prompt}")

                    # Send to WebSocket
                    task_manager.update_task(task_id, generated_prompt=generated_prompt)
                    message = WebSocketMessage(
                        type="generated_prompt",
                        data={"prompt": generated_prompt}
                    )
                    await websocket_manager.broadcast_to_batch(batch_id, message)
                except Exception as e:
                    print(f"[Pipeline Direct] Failed to generate prompt: {e}")
                    # Continue with default prompt

            # Run in thread pool to avoid blocking
            import concurrent.futures
            from PIL import Image

            def run_pipeline():
                result = pipeline.composite_face_auto(
                    background_path=str(background_path),
                    source_face_path=str(face_image_path),
                    prompt=final_prompt,
                    output_path=str(output_path),
                    face_strength=params.face_strength,
                    denoising_strength=params.denoise_strength,
                    num_inference_steps=params.steps,
                    guidance_scale=params.guidance_scale,
                    mask_expand=params.mask_expand,
                    mask_blur=params.mask_blur,
                    seed=seed,
                    include_hair=params.include_hair,
                    include_neck=params.include_neck,
                    face_blend_weight=params.face_blend_weight,
                    hair_blend_weight=params.hair_blend_weight,
                    mask_padding=params.mask_padding,
                    stop_at=params.stop_at,
                    save_preview=True,
                )
                return result

            # Run in executor
            loop = asyncio.get_event_loop()
            with concurrent.futures.ThreadPoolExecutor() as executor:
                result = await loop.run_in_executor(executor, run_pipeline)

            # Check if output exists
            if output_path.exists():
                return output_path
            else:
                raise Exception("Pipeline did not generate output file")

        except Exception as e:
            print(f"[Pipeline Direct] Error: {e}")
            raise

    async def _execute_pipeline_subprocess(
        self,
        task_id: str,
        batch_id: str,
        face_image_path: Path,
        background_path: Path,
        params: GenerationParams,
        seed: int,
        output_index: int,
        output_path: Path,
    ) -> Optional[Path]:
        """Execute the inpainting pipeline via subprocess (fallback)"""

        # Build command (use venv Python for package access)
        cmd = [
            str(VENV_PYTHON),
            "-u",  # Unbuffered output for real-time logging
            str(PIPELINE_SCRIPT),
            str(background_path),
            str(face_image_path),
            "--output", str(output_path),
            "--seed", str(seed),
            "--steps", str(params.steps),
            "--guidance", str(params.guidance_scale),
            "--denoising", str(params.denoise_strength),
            "--face-strength", str(params.face_strength),
            "--mask-blur", str(params.mask_blur),
            "--mask-expand", str(params.mask_expand),
            "--mask-padding", str(params.mask_padding),
            "--stop-at", str(params.stop_at),
        ]

        # Add prompt handling
        if params.auto_prompt or not params.prompt:
            cmd.append("--auto-prompt")
        if params.prompt:
            cmd.extend(["--prompt", params.prompt])

        # Add adapter mode
        if params.adapter_mode == "faceid":
            cmd.append("--use-faceid")
        elif params.adapter_mode == "faceid_plus":
            cmd.append("--use-faceid-plus")
        elif params.adapter_mode == "dual":
            cmd.append("--use-dual-adapter")
        elif params.adapter_mode == "clip_blend":
            cmd.append("--use-clip-blend")
            cmd.extend(["--face-blend-weight", str(params.face_blend_weight)])
            cmd.extend(["--hair-blend-weight", str(params.hair_blend_weight)])

        # Add mask flags
        if not params.include_hair:
            cmd.append("--no-hair")
        if params.include_neck:
            cmd.append("--include-neck")

        # Enable preview generation
        cmd.append("--save-preview")

        print(f"[Pipeline] Running: {' '.join(cmd)}")

        # Run subprocess with unbuffered output
        import os
        env = os.environ.copy()
        env['PYTHONUNBUFFERED'] = '1'

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(PIPELINE_DIR),
            env=env,
        )

        # Read output and parse progress
        step = 0
        total_steps = params.steps
        progress = 0

        while True:
            # Check if task was cancelled
            task = task_manager.get_task(task_id)
            if task and task.status == TaskStatus.CANCELLED:
                print(f"[Pipeline] Task {task_id} cancelled, terminating subprocess...")
                process.terminate()
                await process.wait()
                return None

            line = await process.stdout.readline()
            if not line:
                break

            line_text = line.decode('utf-8', errors='ignore').strip()
            print(f"[Pipeline] {line_text}")

            # Parse generated prompt
            if line_text.startswith("GENERATED_PROMPT:"):
                generated_prompt = line_text.replace("GENERATED_PROMPT:", "").strip()
                task_manager.update_task(
                    task_id,
                    generated_prompt=generated_prompt,
                )
                message = WebSocketMessage(
                    type="generated_prompt",
                    data={"prompt": generated_prompt}
                )
                await websocket_manager.broadcast_to_batch(batch_id, message)

            # Parse preview image path
            elif line_text.startswith("PREVIEW:"):
                preview_abs_path = line_text.replace("PREVIEW:", "").strip()
                # Convert absolute path to relative URL path
                try:
                    preview_path = Path(preview_abs_path)
                    relative_to_output = preview_path.relative_to(self.output_dir)
                    preview_url = f"/outputs/{relative_to_output.as_posix()}"
                except ValueError:
                    # If path is not relative to output_dir, skip
                    continue

                task_manager.update_task(
                    task_id,
                    preview_url=preview_url,
                )

                await self._send_progress(
                    task_id, batch_id, TaskStatus.PROCESSING, progress,
                    current_step=step,
                    total_steps=total_steps,
                    preview_url=preview_url,
                )

            # Parse progress from output
            elif "step" in line_text.lower() or "%" in line_text:
                try:
                    if "/" in line_text:
                        parts = line_text.split("/")
                        for part in parts:
                            nums = [int(s) for s in part.split() if s.isdigit()]
                            if nums:
                                step = nums[0]
                                break
                except:
                    step += 1

                progress = min(int((step / total_steps) * 100), 99)

                task_manager.update_task(
                    task_id,
                    progress=progress,
                    current_step=step,
                )

                await self._send_progress(
                    task_id, batch_id, TaskStatus.PROCESSING, progress,
                    current_step=step,
                    total_steps=total_steps,
                )

        await process.wait()

        if process.returncode != 0:
            stderr = await process.stderr.read()
            error_msg = stderr.decode('utf-8', errors='ignore')
            print(f"[Pipeline] Error: {error_msg}")
            raise Exception(f"Pipeline failed: {error_msg[:200]}")

        # Check if output exists, otherwise look in output directory for pipeline-created folders
        if not output_path.exists():
            if self.output_dir.exists():
                # Find folders matching this batch output name
                output_filename = output_path.name
                output_name_prefix = output_filename.rsplit('.', 1)[0]  # Remove .png extension
                matching_folders = [
                    f for f in self.output_dir.iterdir()
                    if f.is_dir() and f.name.startswith(output_name_prefix)
                ]

                # Sort by modification time and get the most recent
                if matching_folders:
                    recent_folder = sorted(
                        matching_folders,
                        key=lambda x: x.stat().st_mtime,
                        reverse=True
                    )[0]

                    print(f"[Pipeline] Looking for result in: {recent_folder}")

                    # Look for final result image (not preview)
                    for img_file in recent_folder.glob("*.png"):
                        if ("result" in img_file.name or "output" in img_file.name) and "preview" not in img_file.name:
                            print(f"[Pipeline] Copying result: {img_file} -> {output_path}")
                            shutil.copy(img_file, output_path)
                            break
                    else:
                        # If no result/output file, copy the first PNG
                        png_files = list(recent_folder.glob("*.png"))
                        if png_files:
                            print(f"[Pipeline] Copying first PNG: {png_files[0]} -> {output_path}")
                            shutil.copy(png_files[0], output_path)

        return output_path if output_path.exists() else None

    async def _add_to_history_db(
        self,
        batch_id: str,
        face_image_id: str,
        reference_image_id: Optional[str],
        params: GenerationParams,
        task_ids: List[str],
        count: int,
        parallel: bool,
        user_id: str,
        title: Optional[str] = None,
    ):
        """Add completed batch to database history for logged-in users"""
        from core.database import async_session_factory
        from routers.history import add_to_history_db

        tasks = task_manager.get_batch_tasks(batch_id)
        result_urls = [t.result_url for t in tasks if t.result_url]

        # Get actual completed steps from first completed task
        actual_steps = params.steps
        for task in tasks:
            if task.status == TaskStatus.COMPLETED and task.current_step > 0:
                actual_steps = task.current_step
                break

        if result_urls:
            face_ext = ".png"
            for ext in [".png", ".jpg", ".jpeg", ".webp"]:
                if (self.upload_dir / f"{face_image_id}{ext}").exists():
                    face_ext = ext
                    break

            reference_image_url = None
            if reference_image_id:
                reference_ext = ".png"
                for ext in [".png", ".jpg", ".jpeg", ".webp"]:
                    if (self.upload_dir / f"{reference_image_id}{ext}").exists():
                        reference_ext = ext
                        break
                reference_image_url = f"/uploads/{reference_image_id}{reference_ext}"

            # Get generated prompt from tasks (if auto-generated by Gemini)
            generated_prompt = None
            for task in tasks:
                if task.generated_prompt:
                    generated_prompt = task.generated_prompt
                    break

            # Use generated prompt or original prompt
            final_prompt = generated_prompt or params.prompt

            # Use provided title, or generate from prompt, or use timestamp
            now = datetime.now()
            if title:
                final_title = title
            elif final_prompt:
                final_title = final_prompt[:50] + ("..." if len(final_prompt) > 50 else "")
            else:
                final_title = now.strftime("%Y-%m-%d %H:%M:%S")

            # Update params with actual completed steps and generated prompt
            params_dict = params.model_dump()
            params_dict['actual_steps'] = actual_steps
            if final_prompt:
                params_dict['prompt'] = final_prompt

            history_item = {
                "title": final_title,
                "face_image_url": f"/uploads/{face_image_id}{face_ext}",
                "face_image_id": face_image_id,
                "reference_image_url": reference_image_url,
                "reference_image_id": reference_image_id,
                "result_urls": result_urls,
                "params": params_dict,
                "count": count,
                "parallel": parallel,
            }

            # Save to database
            async with async_session_factory() as db:
                await add_to_history_db(db, user_id, history_item)

    async def regenerate_single(self, task_id: str):
        """Regenerate a single task with new seed"""
        task = task_manager.get_task(task_id)
        if not task:
            return

        batch_id = task_id.rsplit("-", 1)[0] if "-" in task_id else task_id
        params = GenerationParams(seed=-1)

        total_steps = params.steps
        for step in range(1, total_steps + 1):
            task = task_manager.get_task(task_id)
            if task and task.status == TaskStatus.CANCELLED:
                return

            progress = int((step / total_steps) * 100)
            task_manager.update_task(task_id, progress=progress, current_step=step)
            await self._send_progress(
                task_id, batch_id, TaskStatus.PROCESSING, progress,
                current_step=step, total_steps=total_steps,
            )
            await asyncio.sleep(0.1)

        from PIL import Image
        output_filename = f"{task_id}_regen.png"
        output_path = self.output_dir / output_filename
        img = Image.new("RGB", (512, 512), color=(100, 100, 150))
        img.save(output_path)

        task_manager.update_task(
            task_id,
            status=TaskStatus.COMPLETED,
            progress=100,
            result_url=f"/outputs/{output_filename}",
        )
