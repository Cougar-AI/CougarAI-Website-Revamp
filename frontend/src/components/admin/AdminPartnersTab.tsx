import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { Plus, Edit2, X, ExternalLink, Building2, Trash2, Users } from 'lucide-react';

const BACKEND = import.meta.env.VITE_BACKEND_API_URL ?? 'http://localhost:5001';

interface Partner {
  partner_id: number;
  name: string;
  type: string;
  logo_url: string | null;
  website: string | null;
  description: string | null;
  contact_name: string | null;
  contact_email: string | null;
  manager_user_id: number | null;
  is_active: boolean;
  member_count: number;
}

interface PartnerMember {
  user_id: number;
  partner_role: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

interface UserSearchResult {
  user_id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

const PARTNER_TYPES = ['company', 'university_org', 'nonprofit', 'other'];
const PARTNER_ROLES = ['President', 'Marketing', 'Manager', 'Officer'];

const TYPE_LABELS: Record<string, string> = {
  company: 'Company',
  university_org: 'University Org',
  nonprofit: 'Nonprofit',
  other: 'Other',
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
      <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold font-['Oxanium']"
        style={{ background: 'rgba(185,28,28,.2)', color: 'rgba(248,113,113,.9)' }}>
        {letter}
      </div>
    );
  }
  const src = url.startsWith('/admin/uploads/') ? `${BACKEND}${url}` : url;
  return (
    <img src={src} alt={name} onError={() => setErr(true)}
      className="h-10 w-10 rounded-lg object-contain shrink-0"
      style={{ background: 'rgba(255,255,255,.06)', padding: 4 }} />
  );
}

function PartnerModal({ partner, onClose, onSaved }: { partner: Partner | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: partner?.name ?? '',
    type: partner?.type ?? 'company',
    website: partner?.website ?? '',
    description: partner?.description ?? '',
    contact_name: partner?.contact_name ?? '',
    contact_email: partner?.contact_email ?? '',
    logo_url: partner?.logo_url ?? '',
    is_active: partner?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(
    partner?.logo_url
      ? partner.logo_url.startsWith('/admin/uploads/') ? `${BACKEND}${partner.logo_url}` : partner.logo_url
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
      const res = await fetch(`${BACKEND}/admin/upload-image?category=partners`, {
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
        type: form.type,
        website: form.website.trim() || null,
        description: form.description.trim() || null,
        contact_name: form.contact_name.trim() || null,
        contact_email: form.contact_email.trim() || null,
        logo_url: form.logo_url || null,
        is_active: form.is_active,
      };
      if (partner) {
        await apiPatch(`/admin/partners/${partner.partner_id}`, payload);
      } else {
        await apiPost('/admin/partners', payload);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-2xl p-6 flex flex-col gap-5 my-4"
        style={{ background: 'rgba(10,0,0,.95)', border: '1px solid rgba(185,28,28,.3)', boxShadow: '0 20px 60px rgba(0,0,0,.6)' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white font-['Oxanium']">{partner ? 'Edit Partner' : 'Add Partner'}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/80"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Logo */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50">Logo</label>
            <div className="flex items-center gap-3">
              {logoPreview ? (
                <img src={logoPreview} alt="logo" className="h-12 w-12 rounded-lg object-contain" style={{ background: 'rgba(255,255,255,.06)', padding: 4 }} />
              ) : (
                <div className="h-12 w-12 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,.06)', border: '1px dashed rgba(185,28,28,.3)' }}>
                  <Building2 size={16} className="text-white/30" />
                </div>
              )}
              <div className="flex flex-col gap-1 flex-1">
                <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()}
                  className="text-xs px-3 py-1.5 rounded-lg text-white/70 disabled:opacity-40"
                  style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.1)' }}>
                  {uploading ? 'Uploading…' : 'Upload Image'}
                </button>
                <input type="text" value={form.logo_url}
                  onChange={(e) => { setForm((f) => ({ ...f, logo_url: e.target.value })); setLogoPreview(e.target.value || null); }}
                  placeholder="or paste URL"
                  className="rounded-lg px-3 py-1.5 text-xs" style={inputStyle} />
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/50">Name *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/50">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="rounded-lg px-3 py-2 text-sm" style={inputStyle}>
                {PARTNER_TYPES.map((t) => (
                  <option key={t} value={t} style={{ background: '#1a0000' }}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50">Website</label>
            <input type="url" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="https://example.com" className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50">Description</label>
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="rounded-lg px-3 py-2 text-sm resize-none" style={inputStyle} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/50">Contact Name</label>
              <input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/50">Contact Email</label>
              <input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <div onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
              className="w-9 h-5 rounded-full transition-colors relative"
              style={{ background: form.is_active ? 'rgba(185,28,28,.7)' : 'rgba(255,255,255,.12)' }}>
              <div className="absolute top-0.5 h-4 w-4 rounded-full transition-transform bg-white"
                style={{ transform: form.is_active ? 'translateX(18px)' : 'translateX(2px)' }} />
            </div>
            <span className="text-xs text-white/60">Active</span>
          </label>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-white/60"
              style={{ background: 'rgba(255,255,255,.06)' }}>Cancel</button>
            <button type="submit" disabled={saving || !form.name.trim()}
              className="px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
              style={{ background: 'rgba(185,28,28,.7)' }}>
              {saving ? 'Saving…' : partner ? 'Save Changes' : 'Add Partner'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MembersDrawer({ partner, onClose }: { partner: Partner; onClose: () => void }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [addRole, setAddRole] = useState('Manager');
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery<{ members: PartnerMember[] }>({
    queryKey: ['partner-members', partner.partner_id],
    queryFn: () => apiGet(`/admin/partners/${partner.partner_id}/members`),
    staleTime: 30_000,
  });

  const removeMember = useMutation({
    mutationFn: (userId: number) => apiDelete(`/admin/partners/${partner.partner_id}/members/${userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-members', partner.partner_id] });
      qc.invalidateQueries({ queryKey: ['admin-partners'] });
    },
  });

  async function doSearch(q: string) {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res: any = await apiGet(`/admin/users?search=${encodeURIComponent(q)}&limit=8`);
      setSearchResults(res.users ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function handleAdd(userId: number) {
    setAdding(true);
    setError('');
    try {
      await apiPost(`/admin/partners/${partner.partner_id}/members`, { user_id: userId, partner_role: addRole });
      qc.invalidateQueries({ queryKey: ['partner-members', partner.partner_id] });
      qc.invalidateQueries({ queryKey: ['admin-partners'] });
      setSearch('');
      setSearchResults([]);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to add member');
    } finally {
      setAdding(false);
    }
  }

  const members = data?.members ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl p-5 flex flex-col gap-4 max-h-[85vh] overflow-y-auto"
        style={{ background: 'rgba(10,0,0,.97)', border: '1px solid rgba(185,28,28,.3)', boxShadow: '0 20px 60px rgba(0,0,0,.6)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white font-['Oxanium']">{partner.name}</h2>
            <p className="text-xs text-white/40">Partner members</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80"><X size={16} /></button>
        </div>

        {/* Add member */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); doSearch(e.target.value); }}
              placeholder="Search users by name or email…"
              className="flex-1 rounded-lg px-3 py-2 text-sm"
              style={inputStyle}
            />
            <select value={addRole} onChange={(e) => setAddRole(e.target.value)}
              className="rounded-lg px-2 py-2 text-sm" style={inputStyle}>
              {PARTNER_ROLES.map((r) => (
                <option key={r} value={r} style={{ background: '#1a0000' }}>{r}</option>
              ))}
            </select>
          </div>
          {searching && <p className="text-xs text-white/30">Searching…</p>}
          {searchResults.length > 0 && (
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(185,28,28,.2)' }}>
              {searchResults.map((u) => (
                <button key={u.user_id} onClick={() => handleAdd(u.user_id)} disabled={adding}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-white/5 transition-colors"
                  style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                  <span className="text-white">{u.first_name} {u.last_name}</span>
                  <span className="text-white/40">{u.email}</span>
                </button>
              ))}
            </div>
          )}
          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>

        {/* Member list */}
        <div className="flex flex-col gap-1">
          <p className="text-xs text-white/40 uppercase tracking-wide">{members.length} member{members.length !== 1 ? 's' : ''}</p>
          {isLoading ? (
            <p className="text-xs text-white/30 py-3">Loading…</p>
          ) : members.length === 0 ? (
            <p className="text-xs text-white/30 py-3">No members yet.</p>
          ) : (
            members.map((m) => (
              <div key={m.user_id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.03] group"
                style={{ border: '1px solid rgba(255,255,255,.04)' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white">{m.first_name} {m.last_name}</p>
                  <p className="text-xs text-white/40 truncate">{m.email}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full shrink-0"
                  style={{ background: 'rgba(185,28,28,.15)', color: 'rgba(248,113,113,.8)' }}>
                  {m.partner_role}
                </span>
                <button onClick={() => removeMember.mutate(m.user_id)}
                  className="text-white/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0">
                  <X size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminPartnersTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partner | null | 'new'>(null);
  const [membersFor, setMembersFor] = useState<Partner | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Partner | null>(null);

  const { data, isLoading, error } = useQuery<{ partners: Partner[] }>({
    queryKey: ['admin-partners'],
    queryFn: () => apiGet('/admin/partners'),
    staleTime: 60_000,
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      apiPatch(`/admin/partners/${id}`, { is_active: active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-partners'] }),
  });

  const deletePartner = useMutation({
    mutationFn: (id: number) => apiDelete(`/admin/partners/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-partners'] });
      setConfirmDelete(null);
    },
  });

  const partners = data?.partners ?? [];

  return (
    <>
      {editing !== null && (
        <PartnerModal
          partner={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['admin-partners'] })}
        />
      )}

      {membersFor && (
        <MembersDrawer partner={membersFor} onClose={() => setMembersFor(null)} />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
            style={{ background: 'rgba(10,0,0,.95)', border: '1px solid rgba(185,28,28,.3)' }}>
            <h3 className="text-base font-bold text-white font-['Oxanium']">Delete Partner?</h3>
            <p className="text-sm text-white/60">
              Permanently delete <span className="text-white">{confirmDelete.name}</span> and remove all member associations.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-lg text-sm text-white/60"
                style={{ background: 'rgba(255,255,255,.06)' }}>Cancel</button>
              <button onClick={() => deletePartner.mutate(confirmDelete.partner_id)} disabled={deletePartner.isPending}
                className="px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
                style={{ background: 'rgba(185,28,28,.7)' }}>
                {deletePartner.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-base font-bold text-white font-['Oxanium']">Partner Organizations</h2>
            <p className="text-xs text-white/40">Manage collaborating organizations and their members</p>
          </div>
          <button onClick={() => setEditing('new')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: 'rgba(185,28,28,.6)', boxShadow: '0 0 20px rgba(185,28,28,.2)' }}>
            <Plus size={14} /> Add Partner
          </button>
        </div>

        <div className="rounded-xl overflow-hidden" style={cardStyle}>
          {isLoading ? (
            <div className="p-8 text-center text-white/40 text-sm">Loading…</div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-red-400">
              Failed to load partners{(error as { status?: number })?.status ? ` (${(error as { status?: number }).status})` : ''}: {error instanceof Error ? error.message : 'Unknown error'}
            </div>
          ) : !partners.length ? (
            <div className="p-8 text-center text-white/40 text-sm">No partners found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(185,28,28,.15)' }}>
                    {['Partner', 'Type', 'Members', 'Contact', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs text-white/40 uppercase tracking-wide font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {partners.map((p) => (
                    <tr key={p.partner_id} className="transition-colors hover:bg-white/[0.02]"
                      style={{ borderBottom: '1px solid rgba(255,255,255,.04)', opacity: p.is_active ? 1 : 0.55 }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <LogoImage url={p.logo_url} name={p.name} />
                          <div>
                            <p className="text-white font-medium text-sm">{p.name}</p>
                            {p.website && (
                              <a href={p.website} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-white/30 hover:text-white/60 flex items-center gap-1">
                                <ExternalLink size={10} /> website
                              </a>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-white/60">{TYPE_LABELS[p.type] ?? p.type}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => setMembersFor(p)}
                          className="flex items-center gap-1 text-xs text-white/60 hover:text-white transition-colors">
                          <Users size={11} /> {p.member_count}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs text-white/50">
                        {p.contact_name ?? <span className="text-white/20">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={p.is_active
                            ? { background: 'rgba(21,128,61,.2)', color: 'rgba(74,222,128,.9)' }
                            : { background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.4)' }}>
                          {p.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setEditing(p)}
                            className="p-1.5 rounded-lg text-white/50 hover:text-white transition-colors"
                            style={{ background: 'rgba(255,255,255,.06)' }} title="Edit">
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => setMembersFor(p)}
                            className="p-1.5 rounded-lg text-white/50 hover:text-white transition-colors"
                            style={{ background: 'rgba(255,255,255,.06)' }} title="Members">
                            <Users size={13} />
                          </button>
                          <button
                            onClick={() => toggleActive.mutate({ id: p.partner_id, active: !p.is_active })}
                            className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                            style={p.is_active
                              ? { background: 'rgba(185,28,28,.12)', color: 'rgba(248,113,113,.7)', border: '1px solid rgba(185,28,28,.15)' }
                              : { background: 'rgba(21,128,61,.12)', color: 'rgba(74,222,128,.8)', border: '1px solid rgba(21,128,61,.15)' }}>
                            {p.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button onClick={() => setConfirmDelete(p)}
                            className="p-1.5 rounded-lg text-white/30 hover:text-red-400 transition-colors"
                            style={{ background: 'rgba(255,255,255,.04)' }} title="Delete">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
