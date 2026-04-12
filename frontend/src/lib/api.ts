const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface Project {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  created_at: string;
  event_count: number;
}

export interface Event {
  id: string;
  project_id: string;
  source: string | null;
  payload: Record<string, unknown>;
  numeric_fields: Record<string, number>;
  received_at: string;
}

export interface FieldStat {
  field: string;
  min: number;
  max: number;
  avg: number;
  count: number;
}

export interface Insight {
  id: string;
  content: string;
  event_count: number;
  generated_at: string;
}

export interface ProjectStats {
  total_events: number;
  sources: string[];
  numeric_field_stats: FieldStat[];
  first_event_at: string | null;
  last_event_at: string | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

export const api = {
  projects: {
    list: () => request<Project[]>("/api/projects"),
    get: (slug: string) => request<Project>(`/api/projects/${slug}`),
    create: (body: { name: string; slug: string; description?: string }) =>
      request<Project>("/api/projects", { method: "POST", body: JSON.stringify(body) }),
    delete: (slug: string) =>
      fetch(`${BASE}/api/projects/${slug}`, { method: "DELETE" }),
    stats: (slug: string) => request<ProjectStats>(`/api/projects/${slug}/stats`),
    latestInsight: (slug: string) => request<Insight | null>(`/api/projects/${slug}/insights/latest`),
  },
  events: {
    list: (slug: string, limit = 100, offset = 0) =>
      request<Event[]>(`/api/projects/${slug}/events?limit=${limit}&offset=${offset}`),
  },
};
