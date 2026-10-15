import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, Eye, EyeOff, FolderKanban, Plus, Trash2, X } from 'lucide-react';
import { apiDelete, apiGet, apiPatch, apiPost, apiUpload } from '@/lib/api';
import { PROJECT_STATUS_LABELS, resolveUploadUrl, type Project, type ProjectStatus } from '@/lib/projects';

interface SponsorOption { sponsor_id: number; name: string }

const cardStyle = { background: 'rgba(255,255,255,.04)', border: '1px solid rgba(185,28,28,.22)', backdropFilter: 'blur(10px)' } as const;
const inputStyle = { background: 'rgba(255,255,255,.06)', border: '1px solid rgba(185,28,28,.2)', color: '#fff' } as const;
const inputCls = 'w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500/40';
const labelCls = 'text-xs text-white/50';

function splitList(value: string): string[] {
  return value.split(/[,\n]/).map((v) => v.trim()).filter(Boolean);
}

function ProjectModal({ project, sponsors, onClose, onSaved }: { project: Project | null; sponsors: SponsorOption[]; onClose: () => void; onSaved: (message: string) => void }) {
  const [form, setForm] = useState({
    title: project?.title ?? '',
    summary: project?.summary ?? '',
    description: project?.description ?? '',
    status: (project?.status ?? 'active') as ProjectStatus,
    semester: project?.semester ?? '',
    tags: (project?.tags ?? []).join(', '),
    team_members: (project?.team_members ?? []).join(', '),
    cover_image_url: project?.cover_image_url ?? '',
    github_url: project?.github_url ?? '',
    demo_url: project?.demo_url ?? '',
    sponsor_id: project?.sponsor?.sponsor_id?.toString() ?? '',
    is_published: project?.is_published ?? true,
    display_order: project?.display_order?.toString() ?? '0',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function handleUpload(file: File) {
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { url } = await apiUpload<{ url: string }>('/admin/upload-image?category=projects', fd);
      set('cover_image_url', url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload = {
      title: form.title.trim(),
      summary: form.summary.trim() || null,
      description: form.description.trim() || null,
      status: form.status,
      semester: form.semester.trim() || null,
      tags: splitList(form.tags),
      team_members: splitList(form.team_members),
      cover_image_url: form.cover_image_url.trim() || null,
      github_url: form.github_url.trim() || null,
      demo_url: form.demo_url.trim() || null,
      sponsor_id: form.sponsor_id ? Number(form.sponsor_id) : null,
      is_published: form.is_published,
      display_order: Number(form.display_order) || 0,
    };
    try {
      if (project) await apiPatch(`/admin/projects/${project.project_id}`, payload);
      else await apiPost('/admin/projects', payload);
      onSaved(project ? `Saved “${payload.title}”.` : `Added “${payload.title}”.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const preview = resolveUploadUrl(form.cover_image_url.trim() || null);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4" style={{ background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(4px)' }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="my-4 flex w-full max-w-2xl flex-col gap-5 rounded-2xl p-6" style={{ background: 'rgba(10,0,0,.95)', border: '1px solid rgba(185,28,28,.3)', boxShadow: '0 20px 60px rgba(0,0,0,.6)' }}>
        <div className="flex items-center justify-between">
          <h2 className="font-['Oxanium'] text-base font-bold text-white">{project ? 'Edit project' : 'Add project'}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/80" aria-label="Close"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_10rem]">
            <label className="flex flex-col gap-1"><span className={labelCls}>Title *</span>
              <input required maxLength={200} value={form.title} onChange={(e) => set('title', e.target.value)} className={inputCls} style={inputStyle} />
            </label>
            <label className="flex flex-col gap-1"><span className={labelCls}>Status</span>
              <select value={form.status} onChange={(e) => set('status', e.target.value as ProjectStatus)} className={inputCls} style={inputStyle}>
                {(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map((s) => <option key={s} value={s} style={{ background: '#1a0505' }}>{PROJECT_STATUS_LABELS[s]}</option>)}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1"><span className={labelCls}>Short summary (shown on the card)</span>
            <input maxLength={500} value={form.summary} onChange={(e) => set('summary', e.target.value)} className={inputCls} style={inputStyle} />
          </label>
          <label className="flex flex-col gap-1"><span className={labelCls}>Full description</span>
            <textarea rows={5} value={form.description} onChange={(e) => set('description', e.target.value)} className={`${inputCls} resize-y`} style={inputStyle} />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1"><span className={labelCls}>Semester</span>
              <input maxLength={50} value={form.semester} onChange={(e) => set('semester', e.target.value)} placeholder="Fall 2026" className={inputCls} style={inputStyle} />
            </label>
            <label className="flex flex-col gap-1"><span className={labelCls}>Sponsor</span>
              <select value={form.sponsor_id} onChange={(e) => set('sponsor_id', e.target.value)} className={inputCls} style={inputStyle}>
                <option value="" style={{ background: '#1a0505' }}>None</option>
                {sponsors.map((s) => <option key={s.sponsor_id} value={s.sponsor_id} style={{ background: '#1a0505' }}>{s.name}</option>)}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1"><span className={labelCls}>Tags (comma separated, up to 10)</span>
            <input value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="nlp, computer vision, robotics" className={inputCls} style={inputStyle} />
          </label>
          <label className="flex flex-col gap-1"><span className={labelCls}>Team members (comma separated)</span>
            <input value={form.team_members} onChange={(e) => set('team_members', e.target.value)} placeholder="Ana Lopez, Ben Kim" className={inputCls} style={inputStyle} />
          </label>

          <div className="flex flex-col gap-1">
            <span className={labelCls}>Cover image</span>
            <div className="flex items-center gap-3">
              {preview
                ? <img src={preview} alt="" className="h-16 w-24 rounded-lg object-cover" style={{ background: 'rgba(255,255,255,.06)' }} />
                : <div className="flex h-16 w-24 items-center justify-center rounded-lg" style={{ background: 'rgba(255,255,255,.06)', border: '1px dashed rgba(185,28,28,.3)' }}><FolderKanban size={18} className="text-white/30" /></div>}
              <div className="flex flex-1 flex-col gap-1.5">
                <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className="self-start rounded-lg px-3 py-1.5 text-xs text-white/70 disabled:opacity-40" style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.1)' }}>
                  {uploading ? 'Uploading…' : 'Upload image (JPEG/PNG/WebP, 5 MB max)'}
                </button>
                <input value={form.cover_image_url} onChange={(e) => set('cover_image_url', e.target.value)} placeholder="or paste an https:// image URL" className="rounded-lg px-3 py-1.5 text-xs" style={inputStyle} />
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1"><span className={labelCls}>GitHub URL</span>
              <input type="url" value={form.github_url} onChange={(e) => set('github_url', e.target.value)} placeholder="https://github.com/…" className={inputCls} style={inputStyle} />
            </label>
            <label className="flex flex-col gap-1"><span className={labelCls}>Demo URL</span>
              <input type="url" value={form.demo_url} onChange={(e) => set('demo_url', e.target.value)} placeholder="https://…" className={inputCls} style={inputStyle} />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-white/75">
              <input type="checkbox" checked={form.is_published} onChange={(e) => set('is_published', e.target.checked)} />
              Published (visible on the public Projects page)
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-white/60">
              Order
              <input type="number" value={form.display_order} onChange={(e) => set('display_order', e.target.value)} className="w-20 rounded-lg px-2 py-1 text-sm" style={inputStyle} title="Lower numbers show first" />
            </label>
          </div>

          {error && <p className="text-sm text-rose-300">{error}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-white/65" style={{ background: 'rgba(255,255,255,.06)' }}>Cancel</button>
            <button type="submit" disabled={saving || uploading} className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: 'rgba(185,28,28,.78)' }}>
              {saving ? 'Saving…' : project ? 'Save changes' : 'Add project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminProjectsTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Project | null | 'new'>(null);
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const { data, isLoading, error } = useQuery<{ projects: Project[] }>({ queryKey: ['admin-projects'], queryFn: () => apiGet('/admin/projects') });
  const { data: sponsorData } = useQuery<{ sponsors: SponsorOption[] }>({ queryKey: ['public-sponsors-options'], queryFn: () => apiGet('/sponsors/'), staleTime: 5 * 60_000 });
  const projects = data?.projects ?? [];

  function refresh() {
    qc.invalidateQueries({ queryKey: ['admin-projects'] });
    qc.invalidateQueries({ queryKey: ['public-projects'] });
  }

  const togglePublished = useMutation({
    mutationFn: (p: Project) => apiPatch(`/admin/projects/${p.project_id}`, { is_published: !p.is_published }),
    onSuccess: (_, p) => { refresh(); setNotice({ kind: 'success', text: `${p.is_published ? 'Unpublished' : 'Published'} “${p.title}”.` }); },
    onError: (e) => setNotice({ kind: 'error', text: e instanceof Error ? e.message : 'Update failed' }),
  });

  const deleteProject = useMutation({
    mutationFn: (p: Project) => apiDelete(`/admin/projects/${p.project_id}`),
    onSuccess: (_, p) => { refresh(); setConfirmDelete(null); setNotice({ kind: 'success', text: `Deleted “${p.title}”.` }); },
    onError: (e) => setNotice({ kind: 'error', text: e instanceof Error ? e.message : 'Delete failed' }),
  });

  return (
    <div className="space-y-4 p-6">
      {editing && (
        <ProjectModal
          project={editing === 'new' ? null : editing}
          sponsors={sponsorData?.sponsors ?? []}
          onClose={() => setEditing(null)}
          onSaved={(text) => { refresh(); setNotice({ kind: 'success', text }); }}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.75)' }} onClick={(e) => e.target === e.currentTarget && setConfirmDelete(null)}>
          <div className="w-full max-w-sm space-y-4 rounded-2xl p-6" style={{ background: 'rgba(10,0,0,.95)', border: '1px solid rgba(185,28,28,.3)' }}>
            <h3 className="font-['Oxanium'] font-bold text-white">Delete project?</h3>
            <p className="text-sm text-white/65">“{confirmDelete.title}” will be removed from the site. To hide it temporarily, unpublish it instead.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="rounded-xl px-4 py-2 text-sm text-white/65" style={{ background: 'rgba(255,255,255,.06)' }}>Cancel</button>
              <button onClick={() => deleteProject.mutate(confirmDelete)} disabled={deleteProject.isPending} className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: 'rgba(185,28,28,.78)' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4" style={cardStyle}>
        <div className="flex items-center gap-2">
          <div className="rounded-lg p-2" style={{ background: 'rgba(185,28,28,.15)' }}><FolderKanban size={16} className="text-red-300" /></div>
          <div>
            <h2 className="font-['Oxanium'] text-xl font-bold leading-tight text-white">Projects</h2>
            <p className="text-xs text-white/35">Shown on the public <a href="/projects" target="_blank" rel="noreferrer" className="text-red-300 hover:text-red-200">Projects page</a>. Unpublished projects stay hidden.</p>
          </div>
        </div>
        <button onClick={() => setEditing('new')} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: 'rgba(185,28,28,.78)' }}><Plus size={14} /> Add project</button>
      </div>

      {notice && <p className={`text-sm ${notice.kind === 'error' ? 'text-rose-300' : 'text-emerald-300'}`}>{notice.text}</p>}
      {error instanceof Error && <p className="text-sm text-rose-300">{error.message}</p>}
      {isLoading && <p className="text-sm text-white/40">Loading projects…</p>}
      {!isLoading && !error && projects.length === 0 && (
        <div className="rounded-2xl p-8 text-center text-sm text-white/45" style={cardStyle}>No projects yet. Add the first one to start the public Projects page.</div>
      )}

      <div className="space-y-2">
        {projects.map((p) => {
          const cover = resolveUploadUrl(p.cover_image_url);
          return (
            <div key={p.project_id} className="flex flex-wrap items-center gap-3 rounded-xl p-3" style={{ ...cardStyle, opacity: p.is_published ? 1 : 0.6 }}>
              {cover
                ? <img src={cover} alt="" className="h-12 w-16 shrink-0 rounded-lg object-cover" />
                : <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg" style={{ background: 'rgba(185,28,28,.15)' }}><FolderKanban size={16} className="text-red-300/70" /></div>}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-semibold text-white">{p.title}</span>
                  <span className="text-[11px] uppercase tracking-wide text-white/40">{PROJECT_STATUS_LABELS[p.status]}</span>
                  {!p.is_published && <span className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-200" style={{ background: 'rgba(245,158,11,.15)' }}>Draft</span>}
                </div>
                <div className="truncate text-xs text-white/45">{[p.semester, p.team_members.length ? `${p.team_members.length} member${p.team_members.length === 1 ? '' : 's'}` : null, p.tags.join(', ') || null].filter(Boolean).join(' · ') || 'No details yet'}</div>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button onClick={() => togglePublished.mutate(p)} disabled={togglePublished.isPending} title={p.is_published ? 'Unpublish' : 'Publish'} className="rounded-lg p-2 text-white/60 hover:text-white" style={{ background: 'rgba(255,255,255,.06)' }}>{p.is_published ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                <button onClick={() => setEditing(p)} title="Edit" className="rounded-lg p-2 text-white/60 hover:text-white" style={{ background: 'rgba(255,255,255,.06)' }}><Edit2 size={14} /></button>
                <button onClick={() => setConfirmDelete(p)} title="Delete" className="rounded-lg p-2 text-rose-300/80 hover:text-rose-200" style={{ background: 'rgba(255,255,255,.06)' }}><Trash2 size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
