import { getToken, clearToken } from "./auth";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface Project {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  created_at: string;
  event_count: number;
  is_public: boolean;
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
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      request<{ access_token: string; token_type: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      }),
  },
  projects: {
    list: () => request<Project[]>("/api/projects"),
    get: (slug: string) => request<Project>(`/api/projects/${slug}`),
    create: (body: { name: string; slug: string; description?: string }) =>
      request<Project>("/api/projects", { method: "POST", body: JSON.stringify(body) }),
    update: (slug: string, body: { is_public: boolean }) =>
      request<Project>(`/api/projects/${slug}`, { method: "PATCH", body: JSON.stringify(body) }),
    delete: async (slug: string) => {
      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${BASE}/api/projects/${slug}`, { method: "DELETE", headers });
      if (res.status === 401) {
        clearToken();
        if (typeof window !== "undefined") window.location.href = "/login";
        throw new Error("Session expired");
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status} ${res.statusText}: ${text}`);
      }
    },
    stats: (slug: string) => request<ProjectStats>(`/api/projects/${slug}/stats`),
    latestInsight: (slug: string) =>
      request<Insight | null>(`/api/projects/${slug}/insights/latest`),
  },
  events: {
    list: (slug: string, limit = 100, offset = 0) =>
      request<Event[]>(`/api/projects/${slug}/events?limit=${limit}&offset=${offset}`),
  },
};
