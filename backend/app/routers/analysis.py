import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from ulid import ULID

from ..auth import optional_auth
from ..database import get_db
from ..models import Project, Event, ProjectInsight
from ..llm import stream_analysis

router = APIRouter(prefix="/api/projects", tags=["analysis"])


class InsightOut(BaseModel):
    id: str
    content: str
    event_count: int
    generated_at: datetime

    model_config = {"from_attributes": True}


@router.get("/{slug}/insights/latest", response_model=InsightOut | None)
async def get_latest_insight(
    slug: str,
    db: AsyncSession = Depends(get_db),
    user: str | None = Depends(optional_auth),
):
    project = await db.scalar(select(Project).where(Project.slug == slug))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.is_public and user is None:
        raise HTTPException(status_code=403, detail="Project is private")

    insight = await db.scalar(
        select(ProjectInsight)
        .where(ProjectInsight.project_id == project.id)
        .order_by(ProjectInsight.generated_at.desc())
    )
    return insight


@router.get("/{slug}/insights/stream")
async def stream_insight(
    slug: str,
    db: AsyncSession = Depends(get_db),
    user: str | None = Depends(optional_auth),
):
    project = await db.scalar(select(Project).where(Project.slug == slug))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.is_public and user is None:
        raise HTTPException(status_code=403, detail="Project is private")

    events_result = await db.execute(
        select(Event)
        .where(Event.project_id == project.id)
        .order_by(Event.received_at.desc())
        .limit(50)
    )
    events = events_result.scalars().all()

    if not events:
        raise HTTPException(status_code=422, detail="No events to analyse yet")

    event_dicts = [
        {
            "payload": e.payload_dict(),
            "numeric_fields": e.numeric_fields_dict(),
            "source": e.source,
            "received_at": e.received_at.isoformat(),
        }
        for e in events
    ]

    project_name = project.name
    project_desc = project.description
    project_id = project.id
    event_count = len(events)

    async def generate():
        full_text: list[str] = []
        try:
            async for token in stream_analysis(project_name, project_desc, event_dicts):
                full_text.append(token)
                yield f"data: {json.dumps({'token': token})}\n\n"

            async with db.begin_nested():
                insight = ProjectInsight(
                    id=str(ULID()),
                    project_id=project_id,
                    content="".join(full_text),
                    event_count=event_count,
                    generated_at=datetime.now(timezone.utc),
                )
                db.add(insight)
            await db.commit()

            yield f"data: {json.dumps({'done': True, 'event_count': event_count})}\n\n"

        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
