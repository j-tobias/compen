"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Activity, ChevronRight, Inbox } from "lucide-react";
import { api, Project } from "@/lib/api";
import CreateProjectDialog from "./CreateProjectDialog";

export default function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProjects(await api.projects.list());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={20} className="text-blue-400" />
          <span className="font-semibold text-white tracking-tight">compen</span>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
        >
          <Plus size={15} />
          New project
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold mb-1">Projects</h1>
        <p className="text-zinc-400 text-sm mb-8">
          Each project collects inbound events at <span className="font-mono text-zinc-300">{"POST /{slug}/ingest"}</span>.
        </p>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-zinc-800/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Inbox size={40} className="text-zinc-600 mb-4" />
            <p className="text-zinc-400 font-medium">No projects yet</p>
            <p className="text-zinc-600 text-sm mt-1">Create one to start collecting events.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-6 flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
            >
              <Plus size={15} />
              New project
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/${p.slug}`}
                  className="flex items-center justify-between p-5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-xl transition-all group"
                >
                  <div>
                    <p className="font-medium text-white">{p.name}</p>
                    <p className="text-xs font-mono text-zinc-500 mt-0.5">{p.slug}</p>
                    {p.description && (
                      <p className="text-sm text-zinc-400 mt-1">{p.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="text-lg font-semibold text-white">{p.event_count.toLocaleString()}</p>
                      <p className="text-xs text-zinc-500">events</p>
                    </div>
                    <ChevronRight size={16} className="text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      {showCreate && (
        <CreateProjectDialog
          onCreated={() => { setShowCreate(false); load(); }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
