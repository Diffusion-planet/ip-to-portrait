"""
Task manager for tracking generation tasks
"""

from typing import Dict, List, Optional
from models import GenerationTask, TaskStatus


class TaskManager:
    """Manages generation tasks and their states"""

    def __init__(self):
        self.tasks: Dict[str, GenerationTask] = {}
        self.batch_tasks: Dict[str, List[str]] = {}  # batch_id -> list of task_ids

    def add_task(self, task: GenerationTask):
        """Add a new task"""
        self.tasks[task.id] = task

        # Extract batch_id from task_id (format: batch_id-index)
        if "-" in task.id:
            batch_id = task.id.rsplit("-", 1)[0]
            if batch_id not in self.batch_tasks:
                self.batch_tasks[batch_id] = []
            self.batch_tasks[batch_id].append(task.id)

    def get_task(self, task_id: str) -> Optional[GenerationTask]:
        """Get a task by ID"""
        return self.tasks.get(task_id)

    def get_batch_tasks(self, batch_id: str) -> List[GenerationTask]:
        """Get all tasks in a batch"""
        task_ids = self.batch_tasks.get(batch_id, [])
        return [self.tasks[tid] for tid in task_ids if tid in self.tasks]

    def update_task(
        self,
        task_id: str,
        status: Optional[TaskStatus] = None,
        progress: Optional[int] = None,
        current_step: Optional[int] = None,
        total_steps: Optional[int] = None,
        preview_url: Optional[str] = None,
        result_url: Optional[str] = None,
        error: Optional[str] = None,
        started_at = None,
        completed_at = None,
        generated_prompt: Optional[str] = None,
    ):
        """Update task properties"""
        task = self.tasks.get(task_id)
        if not task:
            return None

        if status is not None:
            task.status = status
        if progress is not None:
            task.progress = progress
        if current_step is not None:
            task.current_step = current_step
        if total_steps is not None:
            task.total_steps = total_steps
        if preview_url is not None:
            task.preview_url = preview_url
        if result_url is not None:
            task.result_url = result_url
        if error is not None:
            task.error = error
        if started_at is not None:
            task.started_at = started_at
        if completed_at is not None:
            task.completed_at = completed_at
        if generated_prompt is not None:
            task.generated_prompt = generated_prompt

        return task

    def cancel_batch(self, batch_id: str) -> int:
        """Cancel all pending/processing tasks in a batch"""
        task_ids = self.batch_tasks.get(batch_id, [])
        cancelled = 0

        for task_id in task_ids:
            task = self.tasks.get(task_id)
            if task and task.status in [TaskStatus.PENDING, TaskStatus.PROCESSING]:
                task.status = TaskStatus.CANCELLED
                cancelled += 1

        return cancelled

    def is_batch_cancelled(self, batch_id: str) -> bool:
        """Check if a batch has been cancelled"""
        tasks = self.get_batch_tasks(batch_id)
        return any(t.status == TaskStatus.CANCELLED for t in tasks)

    def cleanup_old_tasks(self, max_age_hours: int = 24):
        """Remove tasks older than specified hours"""
        from datetime import datetime, timedelta

        cutoff = datetime.now() - timedelta(hours=max_age_hours)

        tasks_to_remove = []
        for task_id, task in self.tasks.items():
            if task.completed_at and task.completed_at < cutoff:
                tasks_to_remove.append(task_id)

        for task_id in tasks_to_remove:
            del self.tasks[task_id]

        # Clean up batch_tasks
        for batch_id in list(self.batch_tasks.keys()):
            self.batch_tasks[batch_id] = [
                tid for tid in self.batch_tasks[batch_id]
                if tid in self.tasks
            ]
            if not self.batch_tasks[batch_id]:
                del self.batch_tasks[batch_id]


# Global task manager instance
task_manager = TaskManager()
