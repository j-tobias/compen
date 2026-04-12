from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Project, Event
from ..schemas import EventOut

router = APIRouter(tags=["events"])


@router.get("/projects/{slug}/events", response_model=list[EventOut])
async def list_events(
    slug: str,
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    project = await db.scalar(select(Project).where(Project.slug == slug))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.execute(
        select(Event)
        .where(Event.project_id == project.id)
        .order_by(Event.received_at.desc())
        .limit(limit)
        .offset(offset)
    )
    events = result.scalars().all()
    return [
        EventOut(
            id=e.id,
            project_id=e.project_id,
            source=e.source,
            payload=e.payload_dict(),
            numeric_fields=e.numeric_fields_dict(),
            received_at=e.received_at,
        )
        for e in events
    ]
