import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { Plus, Edit2, UserMinus, Trash2, X, Search } from 'lucide-react';
import { formatDate } from '@/lib/dates';

const BACKEND = import.meta.env.VITE_BACKEND_API_URL ?? 'http://localhost:5001';

interface Officer {
  student_id: string;
  officer_role: string;
  join_date: string | null;
  end_date: string | null;
  position_id: number | null;
  position_title: string | null;
  position_department: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  user_id: number | null;
  email: string | null;
  is_active: boolean;
}

interface OfficerPosition {
  position_id: number;
  title: string;
  department: string;
}

interface AdminUser {
  user_id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  student_id: string | null;
  avatar_url: string | null;
  role: string;
}

const OFFICER_ROLES = ['officer', 'admin'];

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  admin: { bg: 'rgba(185,28,28,.25)', text: 'rgba(248,113,113,.9)' },
  officer: { bg: 'rgba(29,78,216,.2)', text: 'rgba(96,165,250,.9)' },
};

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

function AddOfficerModal({ onClose, onSaved, positions }: { onClose: () => void; onSaved: () => void; positions: OfficerPosition[] }) {
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [officerRole, setOfficerRole] = useState('officer');
  const [positionId, setPositionId] = useState('');
  const [joinDate, setJoinDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: searchResults } = useQuery<{ users: AdminUser[] }>({
    queryKey: ['admin-user-search', search],
    queryFn: () => apiGet(`/admin/users?search=${encodeURIComponent(search)}&limit=8`),
    enabled: search.length >= 2,
    staleTime: 10_000,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;
    setSaving(true);
    setError('');
    try {
      await apiPost('/admin/officers', {
        user_id: selectedUser.user_id,
        officer_role: officerRole,
        join_date: joinDate,
        position_id: positionId ? Number(positionId) : null,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to add officer');
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
        className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-5"
        style={{ background: 'rgba(10,0,0,.95)', border: '1px solid rgba(185,28,28,.3)', boxShadow: '0 20px 60px rgba(0,0,0,.6)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white font-['Oxanium']">Add Officer</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/80"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* User search */}
          <div className="flex flex-col gap-2">
            <label className="text-xs text-white/50">Search user by name or email</label>
            {selectedUser ? (
              <div
                className="flex items-center justify-between rounded-lg px-3 py-2"
                style={{ background: 'rgba(185,28,28,.15)', border: '1px solid rgba(185,28,28,.3)' }}
              >
                <div>
                  <p className="text-sm text-white">
                    {selectedUser.first_name} {selectedUser.last_name}
                  </p>
                  <p className="text-xs text-white/40">{selectedUser.email}</p>
                  {!selectedUser.student_id && (
                    <p className="text-xs text-red-400">⚠ No linked student ID — cannot assign officer</p>
                  )}
                </div>
                <button type="button" onClick={() => setSelectedUser(null)} className="text-white/40 hover:text-white/80">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="text"
                    placeholder="Type to search…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg text-sm"
                    style={inputStyle}
                  />
                </div>
                {searchResults?.users && search.length >= 2 && (
                  <div
                    className="rounded-lg overflow-hidden"
                    style={{ border: '1px solid rgba(185,28,28,.2)' }}
                  >
                    {searchResults.users.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-white/40">No users found</p>
                    ) : (
                      searchResults.users.map((u) => (
                        <button
                          key={u.user_id}
                          type="button"
                          onClick={() => { setSelectedUser(u); setSearch(''); }}
                          className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-white/[0.04] transition-colors"
                          style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}
                        >
                          <div
                            className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                            style={{ background: 'rgba(185,28,28,.3)', color: 'rgba(248,113,113,.9)' }}
                          >
                            {(u.first_name ?? u.email)[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm text-white">
                              {u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.email}
                            </p>
                            <p className="text-xs text-white/40">{u.email}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Officer role */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50">System Role</label>
            <select
              value={officerRole}
              onChange={(e) => setOfficerRole(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm"
              style={inputStyle}
            >
              {OFFICER_ROLES.map((r) => (
                <option key={r} value={r} style={{ background: '#1a0000' }}>{r}</option>
              ))}
            </select>
          </div>

          {/* Position / Title */}
          {positions.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/50">Position / Title</label>
              <select
                value={positionId}
                onChange={(e) => setPositionId(e.target.value)}
                className="rounded-lg px-3 py-2 text-sm"
                style={inputStyle}
              >
                <option value="" style={{ background: '#1a0000' }}>— None —</option>
                {Object.entries(
                  positions.reduce<Record<string, OfficerPosition[]>>((acc, p) => {
                    (acc[p.department] ??= []).push(p);
                    return acc;
                  }, {})
                ).map(([dept, deptPositions]) => (
                  <optgroup key={dept} label={dept}>
                    {deptPositions.map((p) => (
                      <option key={p.position_id} value={p.position_id} style={{ background: '#1a0000' }}>
                        {p.title}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          )}

          {/* Join date */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50">Join Date</label>
            <input
              type="date"
              value={joinDate}
              onChange={(e) => setJoinDate(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm"
              style={inputStyle}
            />
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white transition-colors"
              style={{ background: 'rgba(255,255,255,.06)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !selectedUser || !selectedUser.student_id}
              className="px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40 transition-all"
              style={{ background: 'rgba(185,28,28,.7)' }}
            >
              {saving ? 'Adding…' : 'Add Officer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditOfficerModal({
  officer,
  onClose,
  onSaved,
  positions,
}: {
  officer: Officer;
  onClose: () => void;
  onSaved: () => void;
  positions: OfficerPosition[];
}) {
  const [officerRole, setOfficerRole] = useState(officer.officer_role);
  const [positionId, setPositionId] = useState(officer.position_id?.toString() ?? '');
  const [joinDate, setJoinDate] = useState(officer.join_date?.slice(0, 10) ?? '');
  const [endDate, setEndDate] = useState(officer.end_date?.slice(0, 10) ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiPatch(`/admin/officers/${officer.student_id}`, {
        officer_role: officerRole,
        join_date: joinDate || null,
        end_date: endDate || null,
        position_id: positionId ? Number(positionId) : null,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to update officer');
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
        className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-5"
        style={{ background: 'rgba(10,0,0,.95)', border: '1px solid rgba(185,28,28,.3)', boxShadow: '0 20px 60px rgba(0,0,0,.6)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white font-['Oxanium']">
            Edit Officer — {officer.first_name ?? officer.student_id}
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/80"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50">System Role</label>
            <select
              value={officerRole}
              onChange={(e) => setOfficerRole(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm"
              style={inputStyle}
            >
              {OFFICER_ROLES.map((r) => (
                <option key={r} value={r} style={{ background: '#1a0000' }}>{r}</option>
              ))}
            </select>
          </div>
          {positions.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/50">Position / Title</label>
              <select
                value={positionId}
                onChange={(e) => setPositionId(e.target.value)}
                className="rounded-lg px-3 py-2 text-sm"
                style={inputStyle}
              >
                <option value="" style={{ background: '#1a0000' }}>— None —</option>
                {Object.entries(
                  positions.reduce<Record<string, OfficerPosition[]>>((acc, p) => {
                    (acc[p.department] ??= []).push(p);
                    return acc;
                  }, {})
                ).map(([dept, deptPositions]) => (
                  <optgroup key={dept} label={dept}>
                    {deptPositions.map((p) => (
                      <option key={p.position_id} value={p.position_id} style={{ background: '#1a0000' }}>
                        {p.title}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50">Join Date</label>
            <input type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50">End Date (leave blank if active)</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-white/60" style={{ background: 'rgba(255,255,255,.06)' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ background: 'rgba(185,28,28,.7)' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminOfficersTab() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editingOfficer, setEditingOfficer] = useState<Officer | null>(null);

  const { data, isLoading, error } = useQuery<{ officers: Officer[] }>({
    queryKey: ['admin-officers'],
    queryFn: () => apiGet('/admin/officers'),
    staleTime: 30_000,
  });

  const { data: positionsData } = useQuery<{ positions: OfficerPosition[] }>({
    queryKey: ['admin-officer-positions'],
    queryFn: () => apiGet('/admin/officer-positions'),
    staleTime: 300_000,
  });
  const positions = positionsData?.positions ?? [];

  const removeOfficer = useMutation({
    mutationFn: (studentId: string) => apiDelete(`/admin/officers/${studentId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-officers'] }),
  });

  const deleteOfficer = useMutation({
    mutationFn: (studentId: string) => apiDelete(`/admin/officers/${studentId}?hard=1`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-officers'] }),
  });

  const officers = data?.officers ?? [];
  const active = officers.filter((o) => o.is_active);
  const inactive = officers.filter((o) => !o.is_active);

  function OfficerRow({ o }: { o: Officer }) {
    const roleColor = ROLE_COLORS[o.officer_role] ?? ROLE_COLORS.officer;
    const url = o.avatar_url ? `${BACKEND}${o.avatar_url}` : null;
    const initials = [o.first_name, o.last_name].filter(Boolean).map((n) => n![0]).join('') || (o.student_id?.[0] ?? '?');
    return (
      <tr
        className="transition-colors hover:bg-white/[0.02]"
        style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            {url ? (
              <img src={url} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
            ) : (
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: 'rgba(185,28,28,.3)', color: 'rgba(248,113,113,.9)' }}
              >
                {initials.toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm text-white font-medium">
                {o.first_name && o.last_name ? `${o.first_name} ${o.last_name}` : <span className="text-white/40 italic">No profile</span>}
              </p>
              <p className="text-xs text-white/40">{o.email ?? o.student_id}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: roleColor.bg, color: roleColor.text }}>
            {o.officer_role}
          </span>
        </td>
        <td className="px-4 py-3">
          {o.position_title ? (
            <div>
              <p className="text-xs text-white/80">{o.position_title}</p>
              <p className="text-xs text-white/30">{o.position_department}</p>
            </div>
          ) : (
            <span className="text-xs text-white/20">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-xs text-white/50">
          {o.join_date ? formatDate(o.join_date) : '—'}
        </td>
        <td className="px-4 py-3 text-xs text-white/50">
          {o.end_date ? formatDate(o.end_date) : '—'}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setEditingOfficer(o)}
              className="p-1.5 rounded-lg text-white/50 hover:text-white transition-colors"
              style={{ background: 'rgba(255,255,255,.06)' }}
              title="Edit"
            >
              <Edit2 size={13} />
            </button>
            {o.is_active && (
              <button
                onClick={() => {
                  if (confirm(`Remove ${o.first_name ?? o.student_id} as officer? Their end_date will be set to today.`)) {
                    removeOfficer.mutate(o.student_id);
                  }
                }}
                className="p-1.5 rounded-lg transition-colors"
                style={{ background: 'rgba(185,28,28,.12)', color: 'rgba(248,113,113,.7)' }}
                title="Remove officer"
              >
                <UserMinus size={13} />
              </button>
            )}
            <button
              onClick={() => {
                if (confirm(`Permanently delete ${o.first_name ?? o.student_id} from the officers table? This cannot be undone.`)) {
                  deleteOfficer.mutate(o.student_id);
                }
              }}
              className="p-1.5 rounded-lg transition-colors"
              style={{ background: 'rgba(185,28,28,.08)', color: 'rgba(248,113,113,.5)' }}
              title="Delete record"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <>
      {showAdd && (
        <AddOfficerModal
          onClose={() => setShowAdd(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['admin-officers'] })}
          positions={positions}
        />
      )}
      {editingOfficer && (
        <EditOfficerModal
          officer={editingOfficer}
          onClose={() => setEditingOfficer(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['admin-officers'] })}
          positions={positions}
        />
      )}

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white font-['Oxanium']">Officers</h2>
            <p className="text-xs text-white/40">{active.length} active, {inactive.length} past</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: 'rgba(185,28,28,.6)', boxShadow: '0 0 20px rgba(185,28,28,.2)' }}
          >
            <Plus size={14} /> Add Officer
          </button>
        </div>

        <div className="rounded-xl overflow-hidden" style={cardStyle}>
          {isLoading ? (
            <div className="p-8 text-center text-white/40 text-sm">Loading…</div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-red-400">
              Failed to load officers{(error as { status?: number })?.status ? ` (${(error as { status?: number }).status})` : ''}: {error instanceof Error ? error.message : 'Unknown error'}
            </div>
          ) : !officers.length ? (
            <div className="p-8 text-center text-white/40 text-sm">No officers found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(185,28,28,.15)' }}>
                    {['Officer', 'Role', 'Position', 'Joined', 'End Date', 'Actions'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs text-white/40 uppercase tracking-wide font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {active.map((o) => <OfficerRow key={o.student_id} o={o} />)}
                  {inactive.length > 0 && (
                    <>
                      <tr>
                        <td colSpan={6} className="px-4 py-2 text-xs text-white/30 uppercase tracking-wide bg-white/[0.01]">
                          Past Officers
                        </td>
                      </tr>
                      {inactive.map((o) => <OfficerRow key={o.student_id} o={o} />)}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
