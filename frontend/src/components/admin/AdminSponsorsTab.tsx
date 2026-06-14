import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { Plus, Edit2, X, ExternalLink, Building2, Trash2 } from 'lucide-react';

const BACKEND = import.meta.env.VITE_BACKEND_API_URL ?? 'http://localhost:5001';

interface Sponsor {
  sponsor_id: number;
  name: string;
  logo_url: string | null;
  website: string | null;
  tier: string;
  description: string | null;
  contact_name: string | null;
  contact_email: string | null;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  display_order: number;
}

interface SponsorsResponse { sponsors: Sponsor[] }

const TIERS = ['platinum', 'gold', 'silver', 'bronze', 'community'];

const TIER_STYLES: Record<string, { bg: string; text: string }> = {
  platinum: { bg: 'rgba(148,163,184,.2)', text: 'rgba(226,232,240,.9)' },
  gold:     { bg: 'rgba(161,120,0,.25)',  text: 'rgba(250,204,21,.9)' },
  silver:   { bg: 'rgba(100,116,139,.2)', text: 'rgba(203,213,225,.9)' },
  bronze:   { bg: 'rgba(120,53,15,.25)',  text: 'rgba(253,186,116,.9)' },
  community:{ bg: 'rgba(185,28,28,.2)',   text: 'rgba(248,113,113,.9)' },
};

const cardStyle = {
  background: 'rgba(255,255,255,.04)',
  border: '1px solid rgba(185,28,28,.22)',
  backdropFilter: 'blur(10px)',
} as const;

const inputStyle = {
  background: 'rgba(255,255,255,.06)',
  border: '1px solid rgba(185,28,28,.2)',
  color: '#fff',
} as const;

function LogoImage({ url, name }: { url: string | null; name: string }) {
  const [err, setErr] = useState(false);
  const letter = name.trim().charAt(0).toUpperCase();

  if (!url || err) {
    return (
      <div
        className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold font-['Oxanium']"
        style={{ background: 'rgba(185,28,28,.2)', color: 'rgba(248,113,113,.9)' }}
      >
        {letter}
      </div>
    );
  }

  const src = url.startsWith('/admin/uploads/') ? `${BACKEND}${url}` : url;
  return (
    <img
      src={src}
      alt={name}
      onError={() => setErr(true)}
      className="h-10 w-10 rounded-lg object-contain shrink-0"
      style={{ background: 'rgba(255,255,255,.06)', padding: 4 }}
    />
  );
}

function SponsorModal({
  sponsor,
  onClose,
  onSaved,
}: {
  sponsor: Sponsor | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: sponsor?.name ?? '',
    website: sponsor?.website ?? '',
    tier: sponsor?.tier ?? 'community',
    description: sponsor?.description ?? '',
    contact_name: sponsor?.contact_name ?? '',
    contact_email: sponsor?.contact_email ?? '',
    start_date: sponsor?.start_date ?? '',
    end_date: sponsor?.end_date ?? '',
    display_order: sponsor?.display_order?.toString() ?? '0',
    is_active: sponsor?.is_active ?? true,
    logo_url: sponsor?.logo_url ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(
    sponsor?.logo_url
      ? sponsor.logo_url.startsWith('/admin/uploads/')
        ? `${BACKEND}${sponsor.logo_url}`
        : sponsor.logo_url
      : null
  );
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleLogoUpload(file: File) {
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${BACKEND}/admin/upload-image?category=sponsors`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Upload failed');
      setForm((f) => ({ ...f, logo_url: json.url }));
      setLogoPreview(`${BACKEND}${json.url}`);
    } catch (e: any) {
      setError(e?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        website: form.website.trim() || null,
        tier: form.tier,
        description: form.description.trim() || null,
        contact_name: form.contact_name.trim() || null,
        contact_email: form.contact_email.trim() || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        display_order: Number(form.display_order) || 0,
        is_active: form.is_active,
        logo_url: form.logo_url || null,
      };
      if (sponsor) {
        await apiPatch(`/admin/sponsors/${sponsor.sponsor_id}`, payload);
      } else {
        await apiPost('/admin/sponsors', payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-6 flex flex-col gap-5 my-4"
        style={{ background: 'rgba(10,0,0,.95)', border: '1px solid rgba(185,28,28,.3)', boxShadow: '0 20px 60px rgba(0,0,0,.6)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white font-['Oxanium']">
            {sponsor ? 'Edit Sponsor' : 'Add Sponsor'}
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/80"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Logo upload */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50">Logo</label>
            <div className="flex items-center gap-3">
              {logoPreview ? (
                <img src={logoPreview} alt="logo preview" className="h-12 w-12 rounded-lg object-contain" style={{ background: 'rgba(255,255,255,.06)', padding: 4 }} />
              ) : (
                <div className="h-12 w-12 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,.06)', border: '1px dashed rgba(185,28,28,.3)' }}>
                  <Building2 size={16} className="text-white/30" />
                </div>
              )}
              <div className="flex flex-col gap-1 flex-1">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  className="text-xs px-3 py-1.5 rounded-lg text-white/70 disabled:opacity-40"
                  style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.1)' }}
                >
                  {uploading ? 'Uploading…' : 'Upload Image'}
                </button>
                <input
                  type="text"
                  value={form.logo_url}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, logo_url: e.target.value }));
                    setLogoPreview(e.target.value || null);
                  }}
                  placeholder="or paste URL"
                  className="rounded-lg px-3 py-1.5 text-xs"
                  style={inputStyle}
                />
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleLogoUpload(f);
                }}
              />
            </div>
          </div>

          {/* Name + tier */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/50">Name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="rounded-lg px-3 py-2 text-sm"
                style={inputStyle}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/50">Tier</label>
              <select
                value={form.tier}
                onChange={(e) => setForm({ ...form, tier: e.target.value })}
                className="rounded-lg px-3 py-2 text-sm"
                style={inputStyle}
              >
                {TIERS.map((t) => (
                  <option key={t} value={t} style={{ background: '#1a0000' }}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Website */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50">Website</label>
            <input
              type="url"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="https://example.com"
              className="rounded-lg px-3 py-2 text-sm"
              style={inputStyle}
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50">Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="rounded-lg px-3 py-2 text-sm resize-none"
              style={inputStyle}
            />
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/50">Contact Name</label>
              <input
                value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                className="rounded-lg px-3 py-2 text-sm"
                style={inputStyle}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/50">Contact Email</label>
              <input
                type="email"
                value={form.contact_email}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                className="rounded-lg px-3 py-2 text-sm"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Dates + order */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/50">Start Date</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="rounded-lg px-3 py-2 text-xs"
                style={{ ...inputStyle, colorScheme: 'dark' }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/50">End Date</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="rounded-lg px-3 py-2 text-xs"
                style={{ ...inputStyle, colorScheme: 'dark' }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/50">Display Order</label>
              <input
                type="number"
                min="0"
                value={form.display_order}
                onChange={(e) => setForm({ ...form, display_order: e.target.value })}
                className="rounded-lg px-3 py-2 text-sm"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Active toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <div
              onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
              className="w-9 h-5 rounded-full transition-colors relative"
              style={{ background: form.is_active ? 'rgba(185,28,28,.7)' : 'rgba(255,255,255,.12)' }}
            >
              <div
                className="absolute top-0.5 h-4 w-4 rounded-full transition-transform bg-white"
                style={{ transform: form.is_active ? 'translateX(18px)' : 'translateX(2px)' }}
              />
            </div>
            <span className="text-xs text-white/60">Active (shown on sponsors page)</span>
          </label>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-white/60"
              style={{ background: 'rgba(255,255,255,.06)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.name.trim()}
              className="px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
              style={{ background: 'rgba(185,28,28,.7)' }}
            >
              {saving ? 'Saving…' : sponsor ? 'Save Changes' : 'Add Sponsor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminSponsorsTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Sponsor | null | 'new'>(null);
  const [confirmDelete, setConfirmDelete] = useState<Sponsor | null>(null);
  const [tierFilter, setTierFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState('all');

  const { data, isLoading, error } = useQuery<SponsorsResponse>({
    queryKey: ['admin-sponsors'],
    queryFn: () => apiGet<SponsorsResponse>('/admin/sponsors'),
    staleTime: 60_000,
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      apiPatch(`/admin/sponsors/${id}`, { is_active: active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-sponsors'] }),
  });

  const deleteSponsor = useMutation({
    mutationFn: (id: number) => apiDelete(`/admin/sponsors/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sponsors'] });
      setConfirmDelete(null);
    },
  });

  function handleSaved() {
    qc.invalidateQueries({ queryKey: ['admin-sponsors'] });
  }

  const all = data?.sponsors ?? [];
  const filtered = all.filter((s) => {
    if (tierFilter !== 'all' && s.tier !== tierFilter) return false;
    if (activeFilter === 'active' && !s.is_active) return false;
    if (activeFilter === 'inactive' && s.is_active) return false;
    return true;
  });

  return (
    <>
      {editing !== null && (
        <SponsorModal
          sponsor={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
            style={{ background: 'rgba(10,0,0,.95)', border: '1px solid rgba(185,28,28,.3)' }}
          >
            <h3 className="text-base font-bold text-white font-['Oxanium']">Delete Sponsor?</h3>
            <p className="text-sm text-white/60">
              This will permanently delete <span className="text-white">{confirmDelete.name}</span>. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-lg text-sm text-white/60"
                style={{ background: 'rgba(255,255,255,.06)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteSponsor.mutate(confirmDelete.sponsor_id)}
                disabled={deleteSponsor.isPending}
                className="px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
                style={{ background: 'rgba(185,28,28,.7)' }}
              >
                {deleteSponsor.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-base font-bold text-white font-['Oxanium']">Sponsors</h2>
            <p className="text-xs text-white/40">Manage club sponsors shown on the public Sponsors page</p>
          </div>
          <button
            onClick={() => setEditing('new')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: 'rgba(185,28,28,.6)', boxShadow: '0 0 20px rgba(185,28,28,.2)' }}
          >
            <Plus size={14} /> Add Sponsor
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="text-xs rounded-lg px-3 py-1.5"
            style={inputStyle}
          >
            <option value="all" style={{ background: '#1a0000' }}>All Tiers</option>
            {TIERS.map((t) => (
              <option key={t} value={t} style={{ background: '#1a0000' }}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="text-xs rounded-lg px-3 py-1.5"
            style={inputStyle}
          >
            <option value="all" style={{ background: '#1a0000' }}>All Status</option>
            <option value="active" style={{ background: '#1a0000' }}>Active</option>
            <option value="inactive" style={{ background: '#1a0000' }}>Inactive</option>
          </select>
        </div>

        {/* Cards */}
        {isLoading ? (
          <div className="p-8 text-center text-white/40 text-sm rounded-xl" style={cardStyle}>
            Loading…
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-red-400 rounded-xl" style={cardStyle}>
            Failed to load sponsors{(error as { status?: number })?.status ? ` (${(error as { status?: number }).status})` : ''}: {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        ) : !filtered.length ? (
          <div className="p-8 text-center text-white/40 text-sm rounded-xl" style={cardStyle}>
            No sponsors found.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((s) => {
              const ts = TIER_STYLES[s.tier] ?? TIER_STYLES.community;
              return (
                <div
                  key={s.sponsor_id}
                  className="rounded-xl p-4 flex flex-col gap-3"
                  style={{
                    ...cardStyle,
                    opacity: s.is_active ? 1 : 0.55,
                  }}
                >
                  {/* Top row: logo + name + tier */}
                  <div className="flex items-start gap-3">
                    <LogoImage url={s.logo_url} name={s.name} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white truncate font-['Oxanium']">{s.name}</div>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full mt-0.5 inline-block"
                        style={{ background: ts.bg, color: ts.text }}
                      >
                        {s.tier}
                      </span>
                    </div>
                    {s.website && (
                      <a href={s.website} target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-white/70 transition-colors shrink-0">
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>

                  {s.description && (
                    <p className="text-xs text-white/50 line-clamp-2">{s.description}</p>
                  )}

                  {s.contact_name && (
                    <p className="text-xs text-white/40">
                      {s.contact_name}{s.contact_email ? ` · ${s.contact_email}` : ''}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-auto pt-1 border-t border-white/5">
                    <button
                      onClick={() => setEditing(s)}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg text-white/50 hover:text-white transition-colors"
                      style={{ background: 'rgba(255,255,255,.06)' }}
                    >
                      <Edit2 size={11} /> Edit
                    </button>
                    <button
                      onClick={() => toggleActive.mutate({ id: s.sponsor_id, active: !s.is_active })}
                      className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                      style={
                        s.is_active
                          ? { background: 'rgba(185,28,28,.12)', color: 'rgba(248,113,113,.7)', border: '1px solid rgba(185,28,28,.15)' }
                          : { background: 'rgba(21,128,61,.12)', color: 'rgba(74,222,128,.8)', border: '1px solid rgba(21,128,61,.15)' }
                      }
                    >
                      {s.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(s)}
                      className="ml-auto p-1.5 rounded-lg text-white/30 hover:text-red-400 transition-colors"
                      style={{ background: 'rgba(255,255,255,.04)' }}
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
