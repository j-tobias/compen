"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Sparkles, RefreshCw, AlertCircle, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Props {
  slug: string;
  eventCount: number;
}

/** Minimal markdown renderer: handles ##, **, bullet lists */
function RenderMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("## ")) {
      elements.push(
        <h3 key={i} className="text-sm font-semibold text-white mt-5 mb-1.5 first:mt-0">
          {line.slice(3)}
        </h3>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <li key={i} className="text-sm text-zinc-300 leading-relaxed ml-3 list-disc list-inside">
          {renderInline(line.slice(2))}
        </li>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-1" />);
    } else {
      elements.push(
        <p key={i} className="text-sm text-zinc-300 leading-relaxed">
          {renderInline(line)}
        </p>
      );
    }
  }

  return <div>{elements}</div>;
}

function renderInline(text: string): React.ReactNode {
  // Bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="text-white font-medium">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    )
  );
}

export default function InsightsPanel({ slug, eventCount }: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [cachedEventCount, setCachedEventCount] = useState<number | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load cached insight on mount
  const loadCached = useCallback(async () => {
    try {
      const insight = await api.projects.latestInsight(slug);
      if (insight) {
        setContent(insight.content);
        setCachedAt(insight.generated_at);
        setCachedEventCount(insight.event_count);
      }
    } catch {
      // no cached insight is fine
    }
  }, [slug]);

  useEffect(() => { loadCached(); }, [loadCached]);

  const runAnalysis = useCallback(async () => {
    if (streaming) {
      abortRef.current?.abort();
      return;
    }

    setStreaming(true);
    setError(null);
    setContent("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const token = getToken();
      const res = await fetch(`${BASE}/api/projects/${slug}/insights/stream`, {
        signal: controller.signal,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (!json) continue;

          try {
            const msg = JSON.parse(json);
            if (msg.error) throw new Error(msg.error);
            if (msg.token) setContent((prev) => (prev ?? "") + msg.token);
            if (msg.done) setCachedEventCount(msg.event_count);
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== json) throw parseErr;
          }
        }
      }

      setCachedAt(new Date().toISOString());
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Analysis failed");
      setContent(null);
    } finally {
      setStreaming(false);
    }
  }, [slug, streaming]);

  const stale = cachedEventCount !== null && cachedEventCount < eventCount;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-6">
      {/* Header */}
      <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-purple-400" />
          <h3 className="text-sm font-semibold text-white">AI Insights</h3>
          {stale && !streaming && (
            <span className="text-xs text-amber-400 bg-amber-950/50 border border-amber-900 px-2 py-0.5 rounded-full">
              {eventCount - (cachedEventCount ?? 0)} new events
            </span>
          )}
        </div>
        <button
          onClick={runAnalysis}
          disabled={eventCount === 0}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            streaming
              ? "bg-red-950/50 border-red-900 text-red-400 hover:bg-red-950"
              : "bg-purple-950/50 border-purple-900 text-purple-300 hover:bg-purple-900/50 disabled:opacity-40 disabled:cursor-not-allowed"
          }`}
        >
          <RefreshCw size={12} className={streaming ? "animate-spin" : ""} />
          {streaming ? "Stop" : content ? "Re-analyse" : "Analyse"}
        </button>
      </div>

      {/* Body */}
      <div className="px-5 py-4">
        {error && (
          <div className="flex items-start gap-2 text-sm text-red-400 bg-red-950/30 border border-red-900 rounded-lg px-3 py-2">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!content && !error && !streaming && (
          <div className="text-center py-8">
            <Sparkles size={28} className="text-zinc-700 mx-auto mb-3" />
            <p className="text-sm text-zinc-500">
              {eventCount === 0
                ? "Send some events first, then run analysis."
                : "Click Analyse to get AI-powered insights on your events."}
            </p>
          </div>
        )}

        {content && (
          <>
            <RenderMarkdown text={content} />
            {streaming && (
              <span className="inline-block w-1.5 h-4 bg-purple-400 ml-0.5 animate-pulse rounded-sm" />
            )}
            {cachedAt && !streaming && (
              <div className="flex items-center gap-1 mt-4 text-xs text-zinc-600">
                <Clock size={11} />
                Analysed {new Date(cachedAt).toLocaleString()} · {cachedEventCount} events
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
