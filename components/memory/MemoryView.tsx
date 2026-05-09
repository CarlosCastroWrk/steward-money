"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, Trash2, Pencil, Check, X, ChevronLeft } from "lucide-react";
import type { UserMemory, MemoryCategory } from "@/lib/memory";

const CATEGORIES: { key: MemoryCategory; label: string }[] = [
  { key: "identity",      label: "Identity" },
  { key: "financial",     label: "Financial" },
  { key: "faith",         label: "Faith" },
  { key: "relationships", label: "Relationships" },
  { key: "patterns",      label: "Patterns" },
  { key: "preferences",   label: "Preferences" },
];

const AGENT_COLORS: Record<string, string> = {
  luka:    "var(--luka)",
  argus:   "var(--argus)",
  solomon: "var(--solomon)",
  silas:   "var(--silas)",
  kairos:  "var(--kairos)",
  eden:    "var(--eden)",
  iron:    "var(--iron)",
  nova:    "var(--nova)",
  echo:    "var(--echo)",
  manna:   "var(--manna)",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface Props {
  initialMemories: UserMemory[];
}

export function MemoryView({ initialMemories }: Props) {
  const router = useRouter();
  const [memories, setMemories] = useState<UserMemory[]>(initialMemories);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmClearCategory, setConfirmClearCategory] = useState<MemoryCategory | null>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return memories;
    const q = query.toLowerCase();
    return memories.filter((m) => m.content.toLowerCase().includes(q));
  }, [memories, query]);

  async function handleDelete(id: string) {
    setConfirmDelete(null);
    const res = await fetch(`/api/memory/${id}`, { method: "DELETE" });
    if (res.ok) setMemories((prev) => prev.filter((m) => m.id !== id));
  }

  async function handleEdit(id: string) {
    const res = await fetch(`/api/memory/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editContent }),
    });
    if (res.ok) {
      setMemories((prev) => prev.map((m) => m.id === id ? { ...m, content: editContent } : m));
    }
    setEditingId(null);
    setEditContent("");
  }

  async function handleClearCategory(cat: MemoryCategory) {
    setConfirmClearCategory(null);
    const ids = memories.filter((m) => m.categories.includes(cat)).map((m) => m.id);
    await Promise.all(ids.map((id) => fetch(`/api/memory/${id}`, { method: "DELETE" })));
    setMemories((prev) => prev.filter((m) => !m.categories.includes(cat)));
  }

  const grouped = useMemo(() => {
    return CATEGORIES.map(({ key, label }) => ({
      key,
      label,
      items: filtered.filter((m) => m.categories.includes(key)),
    })).filter(({ items }) => items.length > 0);
  }, [filtered]);

  return (
    <div className="px-4 pb-10 pt-6 md:px-8 md:pt-8 max-w-lg">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors"
          aria-label="Back"
        >
          <ChevronLeft size={22} strokeWidth={1.6} />
        </button>
        <h1 className="text-2xl font-semibold text-[var(--text-1)]">Memory</h1>
      </div>

      <p className="text-sm text-[var(--text-3)] mb-5 leading-relaxed">
        What your agents remember about you. You can edit or delete any entry.
      </p>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
        <input
          type="text"
          placeholder="Search memories..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] py-2.5 pl-9 pr-4 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)]"
        />
      </div>

      {/* Empty state */}
      {memories.length === 0 && (
        <div className="text-center py-16">
          <p className="text-[var(--text-3)] text-sm">No memories yet.</p>
          <p className="text-[var(--text-3)] text-xs mt-1">Chat with Luka and your agents will start building memory.</p>
        </div>
      )}

      {filtered.length === 0 && memories.length > 0 && (
        <div className="text-center py-10">
          <p className="text-[var(--text-3)] text-sm">No memories match that search.</p>
        </div>
      )}

      {/* Category sections */}
      <div className="space-y-6">
        {grouped.map(({ key, label, items }) => (
          <div key={key}>
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">{label}</p>
              {items.length > 0 && (
                <button
                  onClick={() => setConfirmClearCategory(key)}
                  className="text-[10px] text-[var(--text-3)] hover:text-red-400 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden divide-y divide-[var(--border)]">
              {items.map((mem) => (
                <div key={mem.id} className="px-4 py-3">
                  {editingId === mem.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-3 py-2 text-sm text-[var(--text-1)] outline-none focus:border-[var(--accent)] resize-none"
                        autoFocus
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => { setEditingId(null); setEditContent(""); }}
                          className="flex items-center gap-1 text-xs text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors"
                        >
                          <X size={13} /> Cancel
                        </button>
                        <button
                          onClick={() => handleEdit(mem.id)}
                          className="flex items-center gap-1 text-xs text-[var(--accent)] hover:opacity-80 transition-opacity"
                        >
                          <Check size={13} /> Save
                        </button>
                      </div>
                    </div>
                  ) : confirmDelete === mem.id ? (
                    <div className="space-y-2">
                      <p className="text-sm text-[var(--text-2)]">Delete this memory?</p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="text-xs text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDelete(mem.id)}
                          className="text-xs text-red-400 hover:opacity-80 transition-opacity"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[var(--text-1)] leading-relaxed">{mem.content}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span
                            className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: AGENT_COLORS[mem.saved_by_agent] ?? "var(--text-3)" }}
                          />
                          <span className="text-[11px] text-[var(--text-3)] capitalize">{mem.saved_by_agent}</span>
                          <span className="text-[11px] text-[var(--text-dim)]">·</span>
                          <span className="text-[11px] text-[var(--text-dim)]">{relativeTime(mem.updated_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
                        <button
                          onClick={() => { setEditingId(mem.id); setEditContent(mem.content); }}
                          className="text-[var(--text-dim)] hover:text-[var(--text-2)] transition-colors"
                          aria-label="Edit"
                        >
                          <Pencil size={14} strokeWidth={1.6} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(mem.id)}
                          className="text-[var(--text-dim)] hover:text-red-400 transition-colors"
                          aria-label="Delete"
                        >
                          <Trash2 size={14} strokeWidth={1.6} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Clear category confirmation modal */}
      {confirmClearCategory && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5">
            <p className="text-sm font-medium text-[var(--text-1)] mb-1">
              Clear all {CATEGORIES.find((c) => c.key === confirmClearCategory)?.label} memories?
            </p>
            <p className="text-xs text-[var(--text-3)] mb-4">This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmClearCategory(null)}
                className="text-sm text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleClearCategory(confirmClearCategory)}
                className="text-sm text-red-400 hover:opacity-80 transition-opacity"
              >
                Clear all
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
