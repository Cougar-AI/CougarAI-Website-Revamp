import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { Building2, Users, Calendar, BarChart2, Link2, Plus, Trash2, ExternalLink, X } from 'lucide-react';

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
  created_at: string | null;
  member_count?: number;
  partner_role?: string;
}

interface PartnerMember {
  user_id: number;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  partner_role: string;
  joined_at: string | null;
}

interface PartnerEvent {
  event_id: number;
  name: string;
  event_type: string;
  location: string | null;
  starts_at: string | null;
  ends_at: string | null;
  points_value: number;
  partner_role: string;
  attendance_count: number;
}

interface PartnerStats {
  member_count: number;
  event_count: number;
  total_checkins: number;
}

interface ResourceLink {
  link_id: number;
  title: string;
  url: string;
  description: string | null;
  created_at: string | null;
}

type Tab = 'profile' | 'members' | 'events' | 'stats' | 'resources';

const cardStyle = {
  background: 'rgba(255,255,255,.04)',
  border: '1px solid rgba(185,28,28,.22)',
  backdropFilter: 'blur(10px)',
};

const inputStyle = {
  background: 'rgba(255,255,255,.06)',
  border: '1px solid rgba(185,28,28,.2)',
  color: '#fff',
};

function AddLinkModal({ partnerId, onClose, onSaved }: { partnerId: number; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ title: '', url: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiPost(`/partners/${partnerId}/resource-links`, {
        title: form.title,
        url: form.url,
        description: form.description || null,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to add link');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: 'rgba(10,0,0,.95)', border: '1px solid rgba(185,28,28,.3)', boxShadow: '0 20px 60px rgba(0,0,0,.6)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white font-['Oxanium']">Add Resource Link</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/80"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            required
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="rounded-lg px-3 py-2 text-sm"
            style={inputStyle}
          />
          <input
            required
            type="url"
            placeholder="https://..."
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            className="rounded-lg px-3 py-2 text-sm"
            style={inputStyle}
          />
          <textarea
            placeholder="Description (optional)"
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="rounded-lg px-3 py-2 text-sm resize-none"
            style={inputStyle}
          />
          {error && <p className="text-rose-400 text-xs">{error}</p>}
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white" style={{ background: 'rgba(255,255,255,.06)' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: 'rgba(185,28,28,.7)' }}>
              {saving ? 'Adding…' : 'Add Link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PartnerDashboard() {
  const user = getStoredUser();
  const isAdmin = user?.role === 'admin';
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
  const [showAddLink, setShowAddLink] = useState(false);

  // Admins load all partners; partner users load their own
  const { data: allPartnersData, isLoading: loadingAll } = useQuery<{ partners: Partner[] }>({
    queryKey: ['partner-admin-list'],
    queryFn: () => apiGet('/partners/'),
    enabled: isAdmin,
    staleTime: 60_000,
  });

  const { data: myPartnersData, isLoading: loadingMy } = useQuery<{ partners: Partner[] }>({
    queryKey: ['partner-my'],
    queryFn: () => apiGet('/partners/my'),
    enabled: !isAdmin,
    staleTime: 60_000,
  });

  const partners = isAdmin ? (allPartnersData?.partners ?? []) : (myPartnersData?.partners ?? []);
  const isLoading = isAdmin ? loadingAll : loadingMy;

  // Resolve the active partner ID
  const partnerId = selectedPartnerId ?? partners[0]?.partner_id ?? null;
  const activePartner = partners.find((p) => p.partner_id === partnerId);

  // Tab data queries — only run when partnerId is set
  const { data: membersData } = useQuery<{ members: PartnerMember[] }>({
    queryKey: ['partner-members', partnerId],
    queryFn: () => apiGet(`/partners/${partnerId}/members`),
    enabled: !!partnerId && activeTab === 'members',
    staleTime: 60_000,
  });

  const { data: eventsData } = useQuery<{ events: PartnerEvent[] }>({
    queryKey: ['partner-events', partnerId],
    queryFn: () => apiGet(`/partners/${partnerId}/events`),
    enabled: !!partnerId && activeTab === 'events',
    staleTime: 60_000,
  });

  const { data: statsData } = useQuery<PartnerStats>({
    queryKey: ['partner-stats', partnerId],
    queryFn: () => apiGet(`/partners/${partnerId}/stats`),
    enabled: !!partnerId && activeTab === 'stats',
    staleTime: 60_000,
  });

  const { data: linksData } = useQuery<{ links: ResourceLink[] }>({
    queryKey: ['partner-links', partnerId],
    queryFn: () => apiGet(`/partners/${partnerId}/resource-links`),
    enabled: !!partnerId && activeTab === 'resources',
    staleTime: 60_000,
  });

  const deleteLink = useMutation({
    mutationFn: (linkId: number) => apiDelete(`/partners/${partnerId}/resource-links/${linkId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partner-links', partnerId] }),
  });

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'profile', label: 'Profile', icon: <Building2 size={14} /> },
    { id: 'members', label: 'Members', icon: <Users size={14} /> },
    { id: 'events', label: 'Events', icon: <Calendar size={14} /> },
    { id: 'stats', label: 'Stats', icon: <BarChart2 size={14} /> },
    { id: 'resources', label: 'Resources', icon: <Link2 size={14} /> },
  ];

  if (isLoading) {
    return (
      <main className="relative min-h-screen font-['Oxanium'] flex items-center justify-center">
        <p className="text-white/40">Loading…</p>
      </main>
    );
  }

  if (!partners.length) {
    return (
      <main className="relative min-h-screen font-['Oxanium'] flex items-center justify-center">
        <p className="text-white/50">No partner organizations found.</p>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen font-['Oxanium'] px-4 py-10 sm:px-8">
      {showAddLink && partnerId && (
        <AddLinkModal
          partnerId={partnerId}
          onClose={() => setShowAddLink(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['partner-links', partnerId] })}
        />
      )}

      <div className="mx-auto max-w-5xl flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Partner Portal</h1>
            <p className="text-white/40 text-sm mt-1">Manage your organization's presence with CougarAI</p>
          </div>

          {/* Admin: org selector */}
          {isAdmin && partners.length > 1 && (
            <select
              value={partnerId ?? ''}
              onChange={(e) => setSelectedPartnerId(Number(e.target.value))}
              className="rounded-xl px-4 py-2 text-sm text-white"
              style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(185,28,28,.3)' }}
            >
              {partners.map((p) => (
                <option key={p.partner_id} value={p.partner_id} style={{ background: '#1a0000' }}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Org name + type banner */}
        {activePartner && (
          <div
            className="rounded-2xl p-5 flex items-center gap-4"
            style={cardStyle}
          >
            {activePartner.logo_url && (
              <img
                src={`${BACKEND}${activePartner.logo_url}`}
                alt={activePartner.name}
                className="h-14 w-14 rounded-xl object-contain bg-white/5"
              />
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-white truncate">{activePartner.name}</h2>
              <div className="flex items-center gap-3 mt-1">
                {activePartner.type && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(185,28,28,.2)', color: 'rgba(248,113,113,.9)' }}>
                    {activePartner.type}
                  </span>
                )}
                {activePartner.website && (
                  <a href={activePartner.website} target="_blank" rel="noopener noreferrer" className="text-xs text-white/40 hover:text-white flex items-center gap-1 transition">
                    <ExternalLink size={11} /> Website
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm transition-all"
              style={
                activeTab === t.id
                  ? { background: 'rgba(185,28,28,.5)', color: '#fff', border: '1px solid rgba(185,28,28,.4)' }
                  : { background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.5)', border: '1px solid rgba(255,255,255,.08)' }
              }
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'profile' && activePartner && (
          <div className="rounded-2xl p-6 flex flex-col gap-4" style={cardStyle}>
            {activePartner.description && (
              <div>
                <p className="text-xs text-white/40 mb-1">About</p>
                <p className="text-white/80 text-sm leading-relaxed">{activePartner.description}</p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activePartner.contact_name && (
                <div>
                  <p className="text-xs text-white/40 mb-0.5">Contact</p>
                  <p className="text-white text-sm">{activePartner.contact_name}</p>
                </div>
              )}
              {activePartner.contact_email && (
                <div>
                  <p className="text-xs text-white/40 mb-0.5">Email</p>
                  <a href={`mailto:${activePartner.contact_email}`} className="text-red-400 hover:text-red-300 text-sm transition">
                    {activePartner.contact_email}
                  </a>
                </div>
              )}
              {activePartner.website && (
                <div>
                  <p className="text-xs text-white/40 mb-0.5">Website</p>
                  <a href={activePartner.website} target="_blank" rel="noopener noreferrer" className="text-red-400 hover:text-red-300 text-sm transition break-all">
                    {activePartner.website}
                  </a>
                </div>
              )}
              {activePartner.created_at && (
                <div>
                  <p className="text-xs text-white/40 mb-0.5">Partner Since</p>
                  <p className="text-white/70 text-sm">{new Date(activePartner.created_at).toLocaleDateString()}</p>
                </div>
              )}
            </div>
            {isAdmin && (
              <p className="text-xs text-white/30 mt-2">
                To edit org details, use the Partners tab in <a href="/admin?tab=partners" className="text-red-400 hover:text-red-300">Admin Dashboard</a>.
              </p>
            )}
          </div>
        )}

        {activeTab === 'members' && (
          <div className="rounded-2xl overflow-hidden" style={cardStyle}>
            {!membersData ? (
              <p className="p-8 text-center text-white/40 text-sm">Loading…</p>
            ) : !membersData.members.length ? (
              <p className="p-8 text-center text-white/40 text-sm">No members assigned to this org yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(185,28,28,.15)' }}>
                    {['Member', 'Email', 'Role', 'Joined'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs text-white/40 uppercase tracking-wide font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {membersData.members.map((m) => (
                    <tr key={m.user_id} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'rgba(185,28,28,.3)', color: 'rgba(248,113,113,.9)' }}>
                            {m.first_name?.[0] ?? m.email[0].toUpperCase()}
                          </div>
                          <span className="text-white">{m.first_name && m.last_name ? `${m.first_name} ${m.last_name}` : '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white/50 text-xs">{m.email}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(185,28,28,.2)', color: 'rgba(248,113,113,.8)' }}>
                          {m.partner_role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/40 text-xs">
                        {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'events' && (
          <div className="rounded-2xl overflow-hidden" style={cardStyle}>
            {!eventsData ? (
              <p className="p-8 text-center text-white/40 text-sm">Loading…</p>
            ) : !eventsData.events.length ? (
              <p className="p-8 text-center text-white/40 text-sm">No events tagged to this partner yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(185,28,28,.15)' }}>
                    {['Event', 'Date', 'Location', 'Attendance', 'Role'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs text-white/40 uppercase tracking-wide font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {eventsData.events.map((ev) => {
                    const isPast = ev.starts_at && new Date(ev.starts_at) < new Date();
                    return (
                      <tr key={ev.event_id} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                        <td className="px-4 py-3">
                          <p className="text-white font-medium">{ev.name}</p>
                          <span className="text-xs text-white/30">{ev.event_type}</span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: isPast ? 'rgba(255,255,255,.3)' : 'rgba(248,113,113,.8)' }}>
                          {ev.starts_at ? new Date(ev.starts_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-white/50">{ev.location ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-white/70">{ev.attendance_count}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(185,28,28,.2)', color: 'rgba(248,113,113,.8)' }}>
                            {ev.partner_role}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {!statsData ? (
              <p className="col-span-3 text-center text-white/40 text-sm py-8">Loading…</p>
            ) : (
              <>
                {[
                  { label: 'Partner Members', value: statsData.member_count, sub: 'CougarAI users in your org' },
                  { label: 'Tagged Events', value: statsData.event_count, sub: "Events you've collaborated on" },
                  { label: 'Total Check-ins', value: statsData.total_checkins, sub: 'Member attendance at your events' },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl p-6 flex flex-col gap-2" style={cardStyle}>
                    <p className="text-4xl font-bold text-white">{s.value}</p>
                    <p className="text-sm font-medium text-white/80">{s.label}</p>
                    <p className="text-xs text-white/40">{s.sub}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {activeTab === 'resources' && (
          <div className="flex flex-col gap-4">
            {isAdmin && (
              <div className="flex justify-end">
                <button
                  onClick={() => setShowAddLink(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all"
                  style={{ background: 'rgba(185,28,28,.6)', boxShadow: '0 0 20px rgba(185,28,28,.2)' }}
                >
                  <Plus size={14} /> Add Link
                </button>
              </div>
            )}
            <div className="rounded-2xl overflow-hidden" style={cardStyle}>
              {!linksData ? (
                <p className="p-8 text-center text-white/40 text-sm">Loading…</p>
              ) : !linksData.links.length ? (
                <p className="p-8 text-center text-white/40 text-sm">No resource links yet.{isAdmin ? ' Add one above.' : ''}</p>
              ) : (
                <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,.04)' }}>
                  {linksData.links.map((l) => (
                    <div key={l.link_id} className="flex items-center gap-4 px-5 py-4">
                      <Link2 size={16} className="shrink-0 text-white/30" />
                      <div className="flex-1 min-w-0">
                        <a
                          href={l.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-white font-medium hover:text-red-400 transition flex items-center gap-1"
                        >
                          {l.title} <ExternalLink size={11} className="opacity-50" />
                        </a>
                        {l.description && <p className="text-xs text-white/40 mt-0.5">{l.description}</p>}
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => {
                            if (confirm(`Remove "${l.title}"?`)) deleteLink.mutate(l.link_id);
                          }}
                          className="p-1.5 rounded-lg transition-colors shrink-0"
                          style={{ background: 'rgba(185,28,28,.12)', color: 'rgba(248,113,113,.7)' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
