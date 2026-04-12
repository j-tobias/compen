import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ulid import ULID

from ..database import get_db
from ..models import Project, Event
from ..schemas import IngestResponse
from ..ingest import extract_numeric_fields

router = APIRouter(tags=["ingest"])


@router.post("/{slug}/ingest", response_model=IngestResponse)
async def ingest_event(
    slug: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_source: str | None = Header(default=None),
):
    project = await db.scalar(select(Project).where(Project.slug == slug))
    if not project:
        raise HTTPException(status_code=404, detail=f"Project '{slug}' not found")

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Request body must be valid JSON")

    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Payload must be a JSON object")

    numeric = extract_numeric_fields(body)
    received_at = datetime.now(timezone.utc)

    # Allow the payload itself to carry a 'source' field as fallback
    source = x_source or body.get("source") or body.get("service") or body.get("system")

    event = Event(
        id=str(ULID()),
        project_id=project.id,
        source=str(source) if source else None,
        payload=json.dumps(body),
        numeric_fields=json.dumps(numeric) if numeric else None,
        received_at=received_at,
    )
    db.add(event)
    await db.commit()

    return IngestResponse(
        event_id=event.id,
        project_slug=slug,
        received_at=received_at,
    )
