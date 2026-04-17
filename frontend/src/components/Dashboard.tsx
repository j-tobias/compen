"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { ArrowLeft, Activity, RefreshCw, Copy, Check } from "lucide-react";
import { api, Event, ProjectStats, Project } from "@/lib/api";
import InsightsPanel from "./InsightsPanel";

const COLORS = [
  "#60a5fa", "#34d399", "#f472b6", "#fb923c",
  "#a78bfa", "#facc15", "#22d3ee", "#f87171",
];

interface Props {
  slug: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function IngestUrl({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/${slug}/ingest`;
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-2 font-mono text-xs text-zinc-400 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
    >
      <span className="text-blue-400">POST</span>
      <span>{url}</span>
      {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
    </button>
  );
}

function StatsBar({ stats }: { stats: ProjectStats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {[
        { label: "Total events", value: stats.total_events.toLocaleString() },
        { label: "Sources", value: stats.sources.length || "—" },
        { label: "First event", value: stats.first_event_at ? formatDate(stats.first_event_at) : "—" },
        { label: "Last event", value: stats.last_event_at ? formatDate(stats.last_event_at) : "—" },
      ].map(({ label, value }) => (
        <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
          <p className="text-xs text-zinc-500 mb-1">{label}</p>
          <p className="text-sm font-semibold text-white truncate">{value}</p>
        </div>
      ))}
    </div>
  );
}

function NumericChart({ events, fields }: { events: Event[]; fields: string[] }) {
  if (fields.length === 0 || events.length === 0) return null;

  const chartData = [...events].reverse().map((e) => ({
    time: new Date(e.received_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    ...Object.fromEntries(fields.map((f) => [f, e.numeric_fields[f] ?? null])),
  }));

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6">
      <h3 className="text-sm font-semibold text-white mb-4">Numeric fields over time</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey="time" tick={{ fill: "#71717a", fontSize: 11 }} />
          <YAxis tick={{ fill: "#71717a", fontSize: 11 }} width={45} />
          <Tooltip
            contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "#a1a1aa" }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }} />
          {fields.map((f, i) => (
            <Line
              key={f}
              type="monotone"
              dataKey={f}
              stroke={COLORS[i % COLORS.length]}
              dot={false}
              strokeWidth={2}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function EventFeed({ events }: { events: Event[] }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Event feed</h3>
        <span className="text-xs text-zinc-500">{events.length} shown</span>
      </div>
      {events.length === 0 ? (
        <div className="px-5 py-12 text-center text-zinc-500 text-sm">No events yet. Send a POST to the ingest URL.</div>
      ) : (
        <ul className="divide-y divide-zinc-800 max-h-[480px] overflow-y-auto">
          {events.map((e) => (
            <li key={e.id} className="px-5 py-3 hover:bg-zinc-800/50 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {e.source && (
                    <span className="text-xs font-mono px-2 py-0.5 bg-blue-950 text-blue-400 rounded-full border border-blue-900">
                      {e.source}
                    </span>
                  )}
                  <span className="text-xs text-zinc-500 font-mono">{e.id.slice(-6)}</span>
                </div>
                <span className="text-xs text-zinc-500">{formatDate(e.received_at)}</span>
              </div>
              <pre className="text-xs text-zinc-300 font-mono overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                {JSON.stringify(e.payload, null, 2)}
              </pre>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Dashboard({ slug }: Props) {
  const [project, setProject] = useState<Project | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const [proj, evts, st] = await Promise.all([
        api.projects.get(slug),
        api.events.list(slug, 100),
        api.projects.stats(slug),
      ]);
      setProject(proj);
      setEvents(evts);
      setStats(st);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(load, 5000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, load]);

  const numericFields = stats?.numeric_field_stats.map((f) => f.field).slice(0, 8) ?? [];

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400">
        Project not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors text-sm">
            <ArrowLeft size={15} />
            <Activity size={16} className="text-blue-400" />
            <span className="font-semibold text-white">compen</span>
          </Link>
          <span className="text-zinc-700">/</span>
          <span className="text-sm font-medium">{project.name}</span>
        </div>

        <div className="flex items-center gap-3">
          <IngestUrl slug={slug} />
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              autoRefresh
                ? "bg-green-950 border-green-800 text-green-400"
                : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white"
            }`}
          >
            <RefreshCw size={12} className={autoRefresh ? "animate-spin" : ""} style={autoRefresh ? { animationDuration: "3s" } : {}} />
            {autoRefresh ? "Live" : "Paused"}
          </button>
          <button onClick={load} className="p-1.5 text-zinc-400 hover:text-white transition-colors" title="Refresh now">
            <RefreshCw size={14} />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {project.description && (
          <p className="text-zinc-400 text-sm mb-6">{project.description}</p>
        )}

        {stats && <StatsBar stats={stats} />}
        <NumericChart events={events} fields={numericFields} />
        <InsightsPanel slug={slug} eventCount={stats?.total_events ?? 0} />
        <EventFeed events={events} />
      </main>
    </div>
  );
}
