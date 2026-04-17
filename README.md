# compen

compen is a self-hosted event collection and dashboard tool. You send JSON events to a project's ingest endpoint from any pipeline, service, or script, and compen stores them, visualises them in a real-time dashboard, and lets you run AI-powered analysis over them. Everything runs in Docker on your own server — no third-party services required except an optional OpenAI-compatible LLM for insights.

---

## Features

- **Ingest anything** — POST arbitrary JSON payloads; numeric fields are extracted automatically for charting
- **Real-time dashboard** — live event feed, stats bar, and time-series chart with 5-second auto-refresh
- **AI insights** — streaming LLM analysis of your latest events (works with any OpenAI-compatible endpoint)
- **Admin login** — JWT-based authentication; a single admin account protects all management operations
- **Public / private projects** — share a project's dashboard publicly without exposing others
- **Self-contained** — SQLite database, no external dependencies beyond Docker

---

## Deployment

### Prerequisites

- Docker and Docker Compose installed on the server
- The server is reachable at a hostname (examples below use `malve`)

### 1. Clone the repo

```bash
git clone https://github.com/j-tobias/compen.git
cd compen
```

### 2. Create your `.env` file

```bash
cp .env.example .env
```

Open `.env` and set at minimum:

```env
# A random secret used to sign JWT tokens — change this before going live
SECRET_KEY=your-random-secret-here

# Admin login credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=a-strong-password

# The public URL of the backend, as seen from the browser
NEXT_PUBLIC_API_URL=http://malve:8000

# Origins the backend allows (must match the frontend URL)
CORS_ORIGINS=http://malve:3001

# LLM endpoint (OpenAI-compatible)
LLM_BASE_URL=http://malve:4100/v1
LLM_MODEL=Gemma4-26B
LLM_API_KEY=
```

> **Note:** `NEXT_PUBLIC_API_URL` is baked into the frontend image at build time. If you change it, you must rebuild (`docker compose up -d --build`).

### 3. Build and start

```bash
docker compose up -d --build
```

On first run this downloads base images and builds both containers — expect 2–3 minutes.

### 4. Verify

```bash
curl http://malve:8000/health
# {"status":"ok"}
```

- **Frontend:** `http://malve:3001`
- **Backend API:** `http://malve:8000`

---

## Admin login

Open the frontend in a browser. You will be redirected to the sign-in page.

| Field    | Default value |
|----------|---------------|
| Username | `admin`       |
| Password | `changeme`    |

**Change the defaults** by editing `ADMIN_USERNAME` and `ADMIN_PASSWORD` in `.env`, then restarting the backend (no rebuild needed):

```bash
docker compose up -d backend
```

The JWT session lasts **24 hours**. After it expires you will be redirected to the sign-in page automatically.

---

## Projects

Projects are the top-level containers for events. Each project gets a unique slug that identifies its ingest endpoint.

### Create a project

1. Sign in and open the home page (`http://malve:3001`)
2. Click **New project**
3. Fill in:
   - **Name** — a human-readable label
   - **Slug** — URL-safe identifier (lowercase letters, digits, hyphens; 2–64 characters). This becomes the ingest path: `/{slug}/ingest`
   - **Description** *(optional)*
4. Click **Create**

### Delete a project

On the home page, click the trash icon on the right side of a project row. A **Delete / ✕** confirmation appears inline — click **Delete** to confirm. Deletion is permanent and cascades to all events and insights.

### Public / private visibility

By default every project is **private** — only the signed-in admin can view its dashboard.

To make a project publicly accessible:

1. Open the project dashboard
2. Click the **Private** button in the top-right header
3. It toggles to **Public** (green)

Anyone with the project URL can now view the dashboard without logging in. The ingest endpoint is always public regardless of this setting.

---

## Ingesting events

Send a JSON object to the ingest endpoint for your project:

```
POST http://malve:8000/{slug}/ingest
Content-Type: application/json
```

The body must be a JSON object (`{}`). Any shape is accepted — nested objects and arrays are fine. compen automatically extracts all numeric leaf values for charting.

### Optional header

| Header     | Description                                                               |
|------------|---------------------------------------------------------------------------|
| `X-Source` | Labels the event with a source name (shown as a badge in the event feed). Falls back to `payload.source`, `payload.service`, or `payload.system` if not set. |

### Examples

**curl**
```bash
curl -X POST http://malve:8000/my-project/ingest \
  -H "Content-Type: application/json" \
  -H "X-Source: my-service" \
  -d '{"status": "ok", "latency_ms": 42, "queue_depth": 7}'
```

**Python**
```python
import httpx

httpx.post(
    "http://malve:8000/my-project/ingest",
    json={"status": "ok", "latency_ms": 42, "queue_depth": 7},
    headers={"X-Source": "my-service"},
)
```

**JavaScript / Node**
```js
await fetch("http://malve:8000/my-project/ingest", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Source": "my-service",
  },
  body: JSON.stringify({ status: "ok", latency_ms: 42, queue_depth: 7 }),
});
```

### Response

```json
{
  "event_id": "01JRMQ3...",
  "project_slug": "my-project",
  "received_at": "2026-04-17T12:00:00Z"
}
```

### Copying the ingest URL

The project dashboard shows a **POST** button with the full ingest URL. Clicking it copies the URL to your clipboard.

---

## Dashboard

Open a project from the home page to reach its dashboard.

### Stats bar

Four summary cards at the top:

| Card         | Description                          |
|--------------|--------------------------------------|
| Total events | Count of all stored events           |
| Sources      | Number of distinct source labels     |
| First event  | Timestamp of the oldest event        |
| Last event   | Timestamp of the most recent event   |

### Numeric chart

All numeric fields found across events are plotted as time-series lines. Up to 8 fields are shown simultaneously, each in a distinct colour. The X-axis is the event receipt time; the Y-axis is the field value.

### Event feed

The 100 most recent events in reverse chronological order. Each entry shows:
- Source badge (if present)
- Short event ID
- Receipt timestamp
- Full JSON payload (formatted)

### Auto-refresh

The dashboard refreshes every **5 seconds** automatically. The **Live** / **Paused** toggle in the header controls this. You can also force an immediate refresh with the refresh icon button.

---

## AI Insights

The **AI Insights** panel analyses your latest events using an LLM and streams the result in real time.

### Running an analysis

1. Open a project dashboard that has at least one event
2. Click **Analyse** in the AI Insights panel
3. The analysis streams token by token from the LLM
4. The completed analysis is saved and shown as cached on future visits

### Cached insights

The most recently generated insight is stored in the database and loaded automatically when you open the dashboard. A badge shows how many new events have arrived since it was generated. Click **Re-analyse** to generate a fresh one.

### Stopping a stream

Click **Stop** while streaming to cancel the request. No insight is saved for a cancelled run.

### LLM configuration

compen uses any OpenAI-compatible API. Configure it via environment variables:

| Variable      | Description                              | Default                    |
|---------------|------------------------------------------|----------------------------|
| `LLM_BASE_URL`| Base URL of the OpenAI-compatible API   | `http://malve:4100/v1`     |
| `LLM_MODEL`   | Model name to use                        | `Gemma4-26B`               |
| `LLM_API_KEY` | API key (leave empty if not required)    | *(empty)*                  |

---

## API reference

All endpoints except `/health` and `/{slug}/ingest` require authentication unless the project is marked public.

**Authentication:** Pass the JWT token in the `Authorization` header:
```
Authorization: Bearer <token>
```

Obtain a token via `POST /auth/login`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | None | Health check — returns `{"status":"ok"}` |
| `POST` | `/auth/login` | None | Log in; returns a JWT token |
| `POST` | `/api/projects` | Required | Create a new project |
| `GET` | `/api/projects` | Required | List all projects with event counts |
| `GET` | `/api/projects/{slug}` | Optional* | Get a single project |
| `PATCH` | `/api/projects/{slug}` | Required | Update project (toggle `is_public`) |
| `DELETE` | `/api/projects/{slug}` | Required | Delete a project and all its data |
| `GET` | `/api/projects/{slug}/stats` | Optional* | Aggregate stats (counts, sources, field ranges) |
| `GET` | `/api/projects/{slug}/events` | Optional* | List events (paginated, max 500) |
| `GET` | `/api/projects/{slug}/insights/latest` | Optional* | Get the most recent cached insight |
| `GET` | `/api/projects/{slug}/insights/stream` | Optional* | Stream a fresh LLM analysis (SSE) |
| `POST` | `/{slug}/ingest` | None | Ingest an event payload |

*Optional — unauthenticated requests succeed only if the project is marked public; otherwise returns `403`.

### `POST /auth/login`

```json
// Request
{ "username": "admin", "password": "changeme" }

// Response
{ "access_token": "eyJ...", "token_type": "bearer" }
```

### `POST /api/projects`

```json
// Request
{ "name": "My Project", "slug": "my-project", "description": "Optional" }
```

### `PATCH /api/projects/{slug}`

```json
// Request
{ "is_public": true }
```

### `GET /api/projects/{slug}/events`

Query parameters:

| Parameter | Default | Max | Description |
|-----------|---------|-----|-------------|
| `limit`   | `100`   | `500` | Number of events to return |
| `offset`  | `0`     | —   | Pagination offset |

### `POST /{slug}/ingest`

```json
// Request body — any JSON object
{ "any": "shape", "nested": { "values": 1 }, "array": [1, 2, 3] }

// Response
{ "event_id": "01JRMQ3...", "project_slug": "my-project", "received_at": "2026-04-17T12:00:00Z" }
```

---

## Configuration reference

All variables can be set in `.env` at the project root or as environment variables. The backend reads them at startup; the frontend bakes `NEXT_PUBLIC_API_URL` in at build time.

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | `change-me-in-production` | Secret used to sign JWT tokens. **Change before going live.** |
| `ADMIN_USERNAME` | `admin` | Admin login username |
| `ADMIN_PASSWORD` | `changeme` | Admin login password. **Change before going live.** |
| `DATABASE_URL` | `sqlite+aiosqlite:///./compen.db` | SQLAlchemy async database URL. Defaults to SQLite; volume-mounted at `/data/compen.db` in Docker. |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated list of allowed origins for the backend API. Must include the frontend URL. |
| `LLM_BASE_URL` | `http://malve:4100/v1` | Base URL of the OpenAI-compatible LLM API |
| `LLM_MODEL` | `Gemma4-26B` | Model name passed to the LLM API |
| `LLM_API_KEY` | *(empty)* | API key for the LLM (leave empty if not required) |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Public URL of the backend API, as seen from the browser. Baked in at frontend build time. |
