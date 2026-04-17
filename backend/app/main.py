from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import CORS_ORIGINS
from .database import init_db
from .routers import projects, events, ingest, analysis, auth


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="compen",
    description="Collect and visualize events from pipelines, services, and production systems.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(projects.router, prefix="/api")
app.include_router(events.router, prefix="/api")
app.include_router(analysis.router)
app.include_router(ingest.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
