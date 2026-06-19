import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CalendarDays, Clock3, ExternalLink, MessageSquare, Search, Sparkles, Tag } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/lib/dates";
import { hasAccessToken } from "@/lib/auth";

type KnowledgeType = "all" | "workshop" | "project" | "cai_news" | "ai_news" | "officer_advice";

interface KnowledgeEntrySummary {
  entry_id: number;
  content_type: KnowledgeType | string;
  title: string;
  summary: string;
  body: string;
  source_label: string | null;
  source_url: string | null;
  tags: string[];
  published_at: string;
  updated_at: string;
  is_featured: boolean;
  comment_count: number;
}

interface KnowledgeComment {
  comment_id: number;
  entry_id: number;
  user_id: number;
  display_name: string;
  body: string;
  created_at: string;
  updated_at: string;
}

interface KnowledgeEntryDetail extends KnowledgeEntrySummary {
  comments: KnowledgeComment[];
}

const TYPE_OPTIONS: Array<{ value: KnowledgeType; label: string }> = [
  { value: "all", label: "All topics" },
  { value: "workshop", label: "Workshops" },
  { value: "project", label: "Projects" },
  { value: "cai_news", label: "CAI News" },
  { value: "ai_news", label: "AI News" },
  { value: "officer_advice", label: "Officer Advice" },
];

const TYPE_META: Record<string, { label: string; tone: string; ring: string }> = {
  workshop: { label: "Workshop", tone: "rgba(248,113,113,.92)", ring: "rgba(248,113,113,.28)" },
  project: { label: "Project", tone: "rgba(239,68,68,.92)", ring: "rgba(239,68,68,.28)" },
  cai_news: { label: "CAI News", tone: "rgba(248,181,0,.92)", ring: "rgba(248,181,0,.24)" },
  ai_news: { label: "AI News", tone: "rgba(96,165,250,.92)", ring: "rgba(96,165,250,.24)" },
  officer_advice: { label: "Officer Advice", tone: "rgba(34,197,94,.92)", ring: "rgba(34,197,94,.22)" },
  all: { label: "All", tone: "rgba(255,255,255,.8)", ring: "rgba(255,255,255,.16)" },
};

function KnowledgeChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-4 py-2 text-sm font-semibold transition"
      style={{
        background: active ? "rgba(185,28,28,.22)" : "rgba(255,255,255,.05)",
        border: active ? "1px solid rgba(185,28,28,.45)" : "1px solid rgba(255,255,255,.1)",
        color: active ? "#fff" : "rgba(255,255,255,.72)",
      }}
    >
      {label}
    </button>
  );
}

function EntryCard({
  entry,
  selected,
  onSelect,
}: {
  entry: KnowledgeEntrySummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const meta = TYPE_META[entry.content_type] ?? TYPE_META.all;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-2xl p-4 text-left transition hover:-translate-y-0.5"
      style={{
        background: selected ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.04)",
        border: selected ? "1px solid rgba(185,28,28,.4)" : "1px solid rgba(185,28,28,.18)",
        boxShadow: selected ? "0 12px 36px rgba(185,28,28,.16)" : "0 6px 24px rgba(0,0,0,.26)",
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em]"
          style={{ background: `${meta.tone}18`, color: meta.tone, border: `1px solid ${meta.ring}` }}
        >
          <Sparkles className="h-3 w-3" />
          {meta.label}
        </span>
        {entry.is_featured && (
          <span className="rounded-full bg-red-700/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-red-300 ring-1 ring-red-500/25">
            Featured
          </span>
        )}
      </div>

      <h3 className="font-['Oxanium'] text-lg font-bold text-white">{entry.title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/62">{entry.summary}</p>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-white/40">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" />
          {formatDate(entry.published_at)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" />
          {entry.comment_count} comment{entry.comment_count === 1 ? "" : "s"}
        </span>
      </div>
    </button>
  );
}

export default function KnowledgeBase() {
  const qc = useQueryClient();
  const [activeType, setActiveType] = useState<KnowledgeType>("all");
  const [query, setQuery] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const { user } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    content_type: "cai_news",
    title: "",
    summary: "",
    body: "",
    tags: "",
    source_label: "",
    source_url: "",
    is_featured: false,
  });

  const canOpenAdd = !!(user && (user.role === "admin" || user.role === "officer" || user.role === "partner"));

  async function saveNewEntry() {
    try {
      const payload = { ...addForm, tags: addForm.tags.split(",").map((t) => t.trim()).filter(Boolean) };
      await apiPost("/knowledge-base/entries", payload);
      setShowAddModal(false);
      setAddForm({ content_type: "cai_news", title: "", summary: "", body: "", tags: "", source_label: "", source_url: "", is_featured: false });
      await qc.invalidateQueries({ queryKey: ["knowledge-base-entries"] });
    } catch (err) {
      console.error(err);
      alert("Could not save entry: " + (((err as any)?.message) || ""));
    }
  }

  const canComment = hasAccessToken();

  const entriesQuery = useQuery<{ entries: KnowledgeEntrySummary[] }>({
    queryKey: ["knowledge-base-entries", activeType, query],
    queryFn: () =>
      apiGet<{ entries: KnowledgeEntrySummary[] }>(
        `/knowledge-base/entries?type=${encodeURIComponent(activeType)}&q=${encodeURIComponent(query.trim())}`
      ),
    staleTime: 60_000,
  });

  const entries = entriesQuery.data?.entries ?? [];

  useEffect(() => {
    if (entries.length === 0) {
      setSelectedEntryId(null);
      return;
    }
    if (!selectedEntryId || !entries.some((entry) => entry.entry_id === selectedEntryId)) {
      setSelectedEntryId(entries[0].entry_id);
    }
  }, [entries, selectedEntryId]);

  const detailQuery = useQuery<{ entry: KnowledgeEntryDetail }>({
    queryKey: ["knowledge-base-entry", selectedEntryId],
    queryFn: () => apiGet<{ entry: KnowledgeEntryDetail }>(`/knowledge-base/entries/${selectedEntryId}`),
    enabled: selectedEntryId !== null,
    staleTime: 30_000,
  });

  const selectedEntry = detailQuery.data?.entry ?? null;

  const commentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEntryId) throw new Error("Select an entry first.");
      return apiPost<{ comment: KnowledgeComment }>(`/knowledge-base/entries/${selectedEntryId}/comments`, {
        body: commentBody,
      });
    },
    onSuccess: async () => {
      setCommentBody("");
      await qc.invalidateQueries({ queryKey: ["knowledge-base-entry", selectedEntryId] });
      await qc.invalidateQueries({ queryKey: ["knowledge-base-entries"] });
    },
  });

  const topTags = useMemo(() => {
    const tags = new Set<string>();
    for (const entry of entries.slice(0, 6)) {
      for (const tag of entry.tags ?? []) tags.add(tag);
    }
    return Array.from(tags).slice(0, 6);
  }, [entries]);

  return (
    <>
    <main className="mx-auto min-h-[calc(100vh-96px)] max-w-7xl px-4 py-10 text-white sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-[28px] border border-red-500/20 bg-[rgba(255,255,255,.04)] shadow-[0_24px_80px_rgba(0,0,0,.45)] backdrop-blur">
        <div className="border-b border-white/8 px-6 py-8 sm:px-8 lg:px-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-red-500/25 bg-red-700/15 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-red-200">
            <BookOpen className="h-3.5 w-3.5" />
            Phase 3 Knowledge Base
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,.8fr)] lg:items-end">
            <div>
              <h1 className="font-['Oxanium'] text-4xl font-extrabold tracking-tight sm:text-5xl">
                Workshop history, club notes, and AI learning in one place
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-white/68 sm:text-lg">
                Browse past workshops, project recaps, CAI updates, curated AI news, and advice from previous officers.
                Anyone can read the archive, and logged-in users can add their thoughts to each topic.
              </p>
            </div>

            <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:grid-cols-3 lg:grid-cols-1">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">Topics</div>
                <div className="mt-1 text-lg font-semibold text-white">{entries.length}</div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">Comments</div>
                <div className="mt-1 text-lg font-semibold text-white">{entries.reduce((sum, entry) => sum + (entry.comment_count ?? 0), 0)}</div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">Access</div>
                <div className="mt-1 text-lg font-semibold text-white">Public reading</div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search workshops, advice, AI news, and project recaps"
                className="w-full rounded-2xl border border-white/10 bg-black/25 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/30 focus:border-red-500/40"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {TYPE_OPTIONS.map((option) => (
                <KnowledgeChip
                  key={option.value}
                  label={option.label}
                  active={activeType === option.value}
                  onClick={() => setActiveType(option.value)}
                />
              ))}
              {canOpenAdd && (
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="rounded-full px-4 py-2 text-sm font-semibold bg-green-700/70 text-white"
                >
                  Add Entry
                </button>
              )}
            </div>
          </div>

          {topTags.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2 text-xs text-white/45">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/55">
                <Tag className="h-3.5 w-3.5" />
                Trending tags
              </span>
              {topTags.map((tag) => (
                <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:px-8 lg:py-8">
          <div className="space-y-4">
            {entriesQuery.isLoading ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/45">
                Loading knowledge base…
              </div>
            ) : entries.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/45">
                No entries match your filters yet.
              </div>
            ) : (
              entries.map((entry) => (
                <EntryCard
                  key={entry.entry_id}
                  entry={entry}
                  selected={entry.entry_id === selectedEntryId}
                  onSelect={() => setSelectedEntryId(entry.entry_id)}
                />
              ))
            )}
          </div>

          <aside className="sticky top-6 h-fit rounded-[26px] border border-red-500/20 bg-black/25 p-5 shadow-[0_18px_40px_rgba(0,0,0,.36)] backdrop-blur">
            {detailQuery.isLoading ? (
              <div className="text-sm text-white/45">Loading topic details…</div>
            ) : selectedEntry ? (
              <>
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-red-300/90">
                      {TYPE_META[selectedEntry.content_type]?.label ?? selectedEntry.content_type}
                    </div>
                    <h2 className="mt-2 font-['Oxanium'] text-2xl font-bold text-white">
                      {selectedEntry.title}
                    </h2>
                  </div>
                  {selectedEntry.source_url ? (
                    <a
                      href={selectedEntry.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10"
                      aria-label="Open source"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-white/45">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    <Clock3 className="h-3.5 w-3.5" />
                    {formatDate(selectedEntry.published_at)}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    <MessageSquare className="h-3.5 w-3.5" />
                    {selectedEntry.comment_count} comment{selectedEntry.comment_count === 1 ? "" : "s"}
                  </span>
                </div>

                <p className="mt-4 whitespace-pre-line text-sm leading-7 text-white/68">{selectedEntry.body}</p>

                {selectedEntry.source_label && (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">Source</div>
                    <div className="mt-1 text-sm text-white/80">{selectedEntry.source_label}</div>
                  </div>
                )}

                {selectedEntry.tags?.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedEntry.tags.map((tag) => (
                      <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-6 border-t border-white/8 pt-5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white/80">
                    <MessageSquare className="h-4 w-4 text-red-300" />
                    Discussion
                  </div>

                  <div className="mt-4 space-y-3">
                    {(selectedEntry.comments ?? []).length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/45">
                        No thoughts yet. Be the first to add one.
                      </div>
                    ) : (
                      selectedEntry.comments.map((comment) => (
                        <div key={comment.comment_id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-['Oxanium'] text-sm font-semibold text-white">{comment.display_name}</div>
                            <div className="text-[11px] text-white/35">{formatDate(comment.created_at)}</div>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-white/68">{comment.body}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
                    {canComment ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!commentBody.trim()) return;
                          commentMutation.mutate();
                        }}
                        className="space-y-3"
                      >
                        <label className="block text-xs font-bold uppercase tracking-[0.16em] text-white/40">
                          Share your thoughts
                        </label>
                        <textarea
                          value={commentBody}
                          onChange={(e) => setCommentBody(e.target.value)}
                          rows={4}
                          placeholder="What did you learn, disagree with, or want to build next?"
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-red-500/40"
                        />
                        <button
                          type="submit"
                          disabled={commentMutation.isPending || !commentBody.trim()}
                          className="inline-flex items-center justify-center rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                          style={{ boxShadow: "0 0 20px rgba(185,28,28,.32)" }}
                        >
                          {commentMutation.isPending ? "Posting…" : "Post comment"}
                        </button>
                      </form>
                    ) : (
                      <div className="space-y-3 text-sm text-white/55">
                        <p>Log in to join the discussion. Members and non-members can comment.</p>
                        <div className="flex flex-wrap gap-3">
                          <Link
                            to="/auth?mode=login"
                            state={{ from: "/knowledge-base" }}
                            className="rounded-xl bg-red-700 px-4 py-2.5 font-semibold text-white transition hover:bg-red-800"
                          >
                            Log in
                          </Link>
                          <Link
                            to="/auth?mode=register"
                            state={{ from: "/knowledge-base" }}
                            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 font-semibold text-white transition hover:bg-white/10"
                          >
                            Create account
                          </Link>
                        </div>
                      </div>
                    )}
                    {commentMutation.isError && (
                      <p className="mt-3 text-sm text-rose-300">Couldn’t post your comment. Try again.</p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-sm text-white/45">Pick a topic to view details.</div>
            )}
          </aside>
        </div>
      </section>
    </main>
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-black/25 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Add Knowledge Entry</h3>
              <button onClick={() => setShowAddModal(false)} className="text-white/60">Close</button>
            </div>
            <div className="mt-4 grid gap-3">
              <label className="text-sm">Type</label>
              <select value={addForm.content_type} onChange={(e) => setAddForm(f => ({ ...f, content_type: e.target.value }))} className="rounded px-3 py-2 bg-white/5">
                {TYPE_OPTIONS.filter(o => o.value !== 'all').map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>

              <label className="text-sm">Title</label>
              <input value={addForm.title} onChange={(e) => setAddForm(f => ({ ...f, title: e.target.value }))} className="rounded px-3 py-2 bg-white/5" />

              <label className="text-sm">Summary</label>
              <input value={addForm.summary} onChange={(e) => setAddForm(f => ({ ...f, summary: e.target.value }))} className="rounded px-3 py-2 bg-white/5" />

              <label className="text-sm">Body</label>
              <textarea value={addForm.body} onChange={(e) => setAddForm(f => ({ ...f, body: e.target.value }))} rows={6} className="rounded px-3 py-2 bg-white/5" />

              <label className="text-sm">Tags (comma separated)</label>
              <input value={addForm.tags} onChange={(e) => setAddForm(f => ({ ...f, tags: e.target.value }))} className="rounded px-3 py-2 bg-white/5" />

              <div className="flex gap-2">
                <button onClick={() => saveNewEntry()} className="rounded bg-red-700 px-4 py-2 text-white">Save</button>
                <button onClick={() => setShowAddModal(false)} className="rounded border border-white/10 px-4 py-2 text-white">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}