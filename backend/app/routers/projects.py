import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from ulid import ULID

from ..auth import require_auth, optional_auth
from ..database import get_db
from ..models import Project, Event
from ..schemas import ProjectCreate, ProjectOut, ProjectStats, FieldStat, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])


def _gate(project: Project, user: str | None):
    if not project.is_public and user is None:
        raise HTTPException(status_code=403, detail="Project is private")


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(
    body: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_auth),
):
    existing = await db.scalar(select(Project).where(Project.slug == body.slug))
    if existing:
        raise HTTPException(status_code=409, detail=f"Project slug '{body.slug}' already exists")

    project = Project(
        id=str(ULID()),
        slug=body.slug,
        name=body.name,
        description=body.description,
        created_at=datetime.now(timezone.utc),
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)

    out = ProjectOut.model_validate(project)
    out.event_count = 0
    return out


@router.get("", response_model=list[ProjectOut])
async def list_projects(
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_auth),
):
    result = await db.execute(
        select(Project, func.count(Event.id).label("event_count"))
        .outerjoin(Event, Event.project_id == Project.id)
        .group_by(Project.id)
        .order_by(Project.created_at.desc())
    )
    rows = result.all()
    projects = []
    for project, count in rows:
        out = ProjectOut.model_validate(project)
        out.event_count = count
        projects.append(out)
    return projects


@router.get("/{slug}", response_model=ProjectOut)
async def get_project(
    slug: str,
    db: AsyncSession = Depends(get_db),
    user: str | None = Depends(optional_auth),
):
    project = await db.scalar(select(Project).where(Project.slug == slug))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _gate(project, user)

    count = await db.scalar(
        select(func.count(Event.id)).where(Event.project_id == project.id)
    )
    out = ProjectOut.model_validate(project)
    out.event_count = count or 0
    return out


@router.patch("/{slug}", response_model=ProjectOut)
async def update_project(
    slug: str,
    body: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_auth),
):
    project = await db.scalar(select(Project).where(Project.slug == slug))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project.is_public = body.is_public
    await db.commit()
    await db.refresh(project)

    count = await db.scalar(
        select(func.count(Event.id)).where(Event.project_id == project.id)
    )
    out = ProjectOut.model_validate(project)
    out.event_count = count or 0
    return out


@router.delete("/{slug}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    slug: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_auth),
):
    project = await db.scalar(select(Project).where(Project.slug == slug))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.delete(project)
    await db.commit()


@router.get("/{slug}/stats", response_model=ProjectStats)
async def project_stats(
    slug: str,
    db: AsyncSession = Depends(get_db),
    user: str | None = Depends(optional_auth),
):
    project = await db.scalar(select(Project).where(Project.slug == slug))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _gate(project, user)

    total = await db.scalar(
        select(func.count(Event.id)).where(Event.project_id == project.id)
    ) or 0

    sources_result = await db.execute(
        select(Event.source).where(Event.project_id == project.id).distinct()
    )
    sources = [r[0] for r in sources_result if r[0] is not None]

    timestamps = await db.execute(
        select(func.min(Event.received_at), func.max(Event.received_at))
        .where(Event.project_id == project.id)
    )
    first_at, last_at = timestamps.one()

    events_result = await db.execute(
        select(Event.numeric_fields).where(
            Event.project_id == project.id,
            Event.numeric_fields.isnot(None),
        )
    )
    field_accumulator: dict[str, list[float]] = {}
    for (nf_json,) in events_result:
        if nf_json:
            nf = json.loads(nf_json)
            for k, v in nf.items():
                field_accumulator.setdefault(k, []).append(v)

    field_stats = []
    for field, values in sorted(field_accumulator.items()):
        field_stats.append(FieldStat(
            field=field,
            min=min(values),
            max=max(values),
            avg=sum(values) / len(values),
            count=len(values),
        ))

    return ProjectStats(
        total_events=total,
        sources=sources,
        numeric_field_stats=field_stats,
        first_event_at=first_at,
        last_event_at=last_at,
    )
