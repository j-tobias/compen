"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { X } from "lucide-react";

interface Props {
  onCreated: () => void;
  onClose: () => void;
}

export default function CreateProjectDialog({ onCreated, onClose }: Props) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function deriveSlug(raw: string) {
    return raw.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.projects.create({ name, slug, description: description || undefined });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md mx-4 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">New project</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Name</label>
            <input
              className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="My Pipeline"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug || slug === deriveSlug(name)) setSlug(deriveSlug(e.target.value));
              }}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Slug</label>
            <input
              className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              placeholder="my-pipeline"
              value={slug}
              onChange={(e) => setSlug(deriveSlug(e.target.value))}
              required
            />
            <p className="text-xs text-zinc-500 mt-1">
              Used in the ingest URL: <span className="font-mono text-zinc-400">POST /{"{"}slug{"}"}/ingest</span>
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Description <span className="text-zinc-600">(optional)</span></label>
            <input
              className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="What does this project track?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition-colors"
            >
              {loading ? "Creating…" : "Create project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
