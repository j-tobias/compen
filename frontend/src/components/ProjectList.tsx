"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Activity, ChevronRight, Inbox, LogOut, Globe, Lock, Trash2, X } from "lucide-react";
import { api, Project } from "@/lib/api";
import { isAuthenticated, clearToken } from "@/lib/auth";
import CreateProjectDialog from "./CreateProjectDialog";

export default function ProjectList() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) router.replace("/login");
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProjects(await api.projects.list());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleLogout() {
    clearToken();
    router.replace("/login");
  }

  async function handleDelete(slug: string) {
    setDeleting(slug);
    try {
      await api.projects.delete(slug);
      setProjects((prev) => prev.filter((p) => p.slug !== slug));
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={20} className="text-blue-400" />
          <span className="font-semibold text-white tracking-tight">compen</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 rounded-lg transition-colors"
          >
            <LogOut size={14} />
            Sign out
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
          >
            <Plus size={15} />
            New project
          </button>
        </div>
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
              <li key={p.id} className="flex items-stretch gap-2">
                <Link
                  href={`/${p.slug}`}
                  className="flex flex-1 items-center justify-between p-5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-xl transition-all group"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-medium text-white">{p.name}</p>
                      {p.is_public ? (
                        <span className="flex items-center gap-1 text-xs text-green-400 bg-green-950/50 border border-green-900 px-2 py-0.5 rounded-full">
                          <Globe size={10} /> Public
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-zinc-500 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">
                          <Lock size={10} /> Private
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono text-zinc-500">{p.slug}</p>
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

                {/* Delete control */}
                {confirmDelete === p.slug ? (
                  <div className="flex items-center gap-1 px-3 bg-zinc-900 border border-red-900 rounded-xl">
                    <button
                      onClick={() => handleDelete(p.slug)}
                      disabled={deleting === p.slug}
                      className="px-2 py-1 text-xs font-medium text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
                    >
                      {deleting === p.slug ? "…" : "Delete"}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(p.slug)}
                    className="px-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-red-900 text-zinc-600 hover:text-red-400 rounded-xl transition-all"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
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
