"""
Image upload endpoints
"""

import uuid
import aiofiles
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel

router = APIRouter()

UPLOAD_DIR = Path(__file__).parent.parent / "uploads"


class UploadResponse(BaseModel):
    id: str
    filename: str
    url: str


@router.post("/image", response_model=UploadResponse)
async def upload_image(file: UploadFile = File(...)):
    """Upload a face image for processing"""

    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    # Generate unique ID
    file_id = str(uuid.uuid4())
    ext = Path(file.filename or "image.png").suffix or ".png"
    filename = f"{file_id}{ext}"
    filepath = UPLOAD_DIR / filename

    # Save file
    try:
        async with aiofiles.open(filepath, "wb") as f:
            content = await file.read()
            await f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    return UploadResponse(
        id=file_id,
        filename=filename,
        url=f"/uploads/{filename}",
    )


@router.delete("/{file_id}")
async def delete_upload(file_id: str):
    """Delete an uploaded file"""

    # Find and delete file
    for filepath in UPLOAD_DIR.glob(f"{file_id}.*"):
        filepath.unlink()
        return {"status": "deleted", "id": file_id}

    raise HTTPException(status_code=404, detail="File not found")
