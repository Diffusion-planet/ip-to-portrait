"""
History management endpoints
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from core.database import get_db
from core.deps import get_current_user_optional
from models import HistoryItem
from models.user import User
from models.history_db import HistoryDB

router = APIRouter()


@router.get("/", response_model=List[HistoryItem])
async def get_history(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    favorites_only: bool = Query(default=False),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Get generation history - returns DB history for logged users, empty for non-logged"""

    # Non-authenticated users get empty response (frontend uses localStorage)
    if not current_user:
        return []

    # Build query for authenticated user
    query = select(HistoryDB).where(HistoryDB.user_id == current_user.id)

    if favorites_only:
        query = query.where(HistoryDB.is_favorite == True)

    # Sort by created_at descending
    query = query.order_by(HistoryDB.created_at.desc())
    query = query.offset(offset).limit(limit)

    result = await db.execute(query)
    items = result.scalars().all()

    return [item.to_dict() for item in items]


@router.get("/{item_id}", response_model=HistoryItem)
async def get_history_item(
    item_id: str,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific history item"""

    if not current_user:
        raise HTTPException(status_code=404, detail="History item not found")

    result = await db.execute(
        select(HistoryDB).where(
            HistoryDB.id == item_id,
            HistoryDB.user_id == current_user.id
        )
    )
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="History item not found")

    return item.to_dict()


@router.post("/{item_id}/favorite")
async def toggle_favorite(
    item_id: str,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Toggle favorite status of a history item"""

    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    result = await db.execute(
        select(HistoryDB).where(
            HistoryDB.id == item_id,
            HistoryDB.user_id == current_user.id
        )
    )
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="History item not found")

    item.is_favorite = not item.is_favorite
    await db.commit()

    return {"id": item_id, "is_favorite": item.is_favorite}


@router.patch("/{item_id}/title")
async def update_history_title(
    item_id: str,
    title: str = Query(..., description="New title"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Update history item title"""

    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    result = await db.execute(
        select(HistoryDB).where(
            HistoryDB.id == item_id,
            HistoryDB.user_id == current_user.id
        )
    )
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="History item not found")

    item.title = title
    await db.commit()

    return {"id": item_id, "title": title}


@router.delete("/{item_id}")
async def delete_history_item(
    item_id: str,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Delete a history item"""

    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    result = await db.execute(
        select(HistoryDB).where(
            HistoryDB.id == item_id,
            HistoryDB.user_id == current_user.id
        )
    )
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="History item not found")

    await db.delete(item)
    await db.commit()

    return {"status": "deleted", "id": item_id}


@router.delete("/")
async def clear_history(
    favorites_only: bool = Query(default=False),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Clear history (optionally keep favorites)"""

    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    if favorites_only:
        # Delete only non-favorites
        await db.execute(
            delete(HistoryDB).where(
                HistoryDB.user_id == current_user.id,
                HistoryDB.is_favorite == False
            )
        )
    else:
        # Delete all
        await db.execute(
            delete(HistoryDB).where(HistoryDB.user_id == current_user.id)
        )

    await db.commit()

    return {"status": "cleared"}


async def add_to_history_db(
    db: AsyncSession,
    user_id: str,
    item_data: dict
):
    """Add item to history database (called from pipeline service)"""

    history_item = HistoryDB(
        user_id=user_id,
        title=item_data.get("title"),
        face_image_url=item_data.get("face_image_url", ""),
        face_image_id=item_data.get("face_image_id"),
        reference_image_url=item_data.get("reference_image_url"),
        reference_image_id=item_data.get("reference_image_id"),
        result_urls=item_data.get("result_urls", []),
        prompt=item_data.get("prompt"),
        params=item_data.get("params", {}),
        count=str(item_data.get("count", "1")),
        parallel=item_data.get("parallel", False),
        is_favorite=item_data.get("is_favorite", False),
    )

    db.add(history_item)
    await db.commit()
    await db.refresh(history_item)

    return history_item.to_dict()
