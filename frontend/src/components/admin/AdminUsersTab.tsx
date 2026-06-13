import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch, apiDelete } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { Search, ChevronLeft, ChevronRight, X, CalendarPlus } from 'lucide-react';
import { formatDate } from '@/lib/dates';

const BACKEND = import.meta.env.VITE_BACKEND_API_URL ?? 'http://localhost:5001';

interface AdminUser {
  user_id: number;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string | null;
  last_login: string | null;
  first_name: string | null;
  last_name: string | null;
  student_id: string | null;
  avatar_url: string | null;
  membership_expires_at: string | null;
  membership_status: 'active' | 'expired' | 'none';
  has_profile: boolean;
}

interface UserDetail extends AdminUser {
  stripe_customer_id: string | null;
  profile: {
    grade_level: string | null;
    major: string | null;
    shirt_size: string | null;
    discord_id: string | null;
    is_public: boolean;
    current_streak: number;
    max_streak: number;
  } | null;
  payments: {
    payment_id: number;
    date: string | null;
    amount: number;
    plan_id: string | null;
    expires_at: string | null;
    stripe_session_id: string | null;
    is_manual: boolean;
    note: string | null;
  }[];
  points_total: number;
  events_attended: number;
  checkin_count: number;
}

interface UsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  admin: { bg: 'rgba(185,28,28,.25)', text: 'rgba(248,113,113,.9)' },
  officer: { bg: 'rgba(29,78,216,.2)', text: 'rgba(96,165,250,.9)' },
  partner: { bg: 'rgba(109,40,217,.2)', text: 'rgba(167,139,250,.9)' },
  member: { bg: 'rgba(21,128,61,.2)', text: 'rgba(74,222,128,.9)' },
  'non-member': { bg: 'rgba(255,255,255,.08)', text: 'rgba(255,255,255,.5)' },
};

const MEMBERSHIP_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: 'rgba(21,128,61,.2)', text: 'rgba(74,222,128,.9)' },
  expired: { bg: 'rgba(185,28,28,.2)', text: 'rgba(248,113,113,.9)' },
  none: { bg: 'rgba(255,255,255,.06)', text: 'rgba(255,255,255,.4)' },
};

const ALL_ROLES = ['admin', 'officer', 'partner', 'member', 'non-member'];

function Badge({ value, colorMap }: { value: string; colorMap: Record<string, { bg: string; text: string }> }) {
  const style = colorMap[value] ?? colorMap['non-member'];
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: style.bg, color: style.text }}
    >
      {value}
    </span>
  );
}

function Avatar({ user }: { user: AdminUser }) {
  const url = user.avatar_url ? `${BACKEND}${user.avatar_url}` : null;
  const initials = [user.first_name, user.last_name]
    .filter(Boolean)
    .map((n) => n![0].toUpperCase())
    .join('') || user.email[0].toUpperCase();
  return url ? (
    <img src={url} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
  ) : (
    <div
      className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
      style={{ background: 'rgba(185,28,28,.3)', color: 'rgba(248,113,113,.9)' }}
    >
      {initials}
    </div>
  );
}

function UserDetailModal({ user, onClose }: { user: UserDetail; onClose: () => void }) {
  const qc = useQueryClient();
  const [editRole, setEditRole] = useState(user.role);
  const [editEmail, setEditEmail] = useState(user.email);
  const [saving, setSaving] = useState(false);
  const [showExtend, setShowExtend] = useState(false);
  const [extendDate, setExtendDate] = useState('');
  const [extendNote, setExtendNote] = useState('');
  const [extending, setExtending] = useState(false);
  const [extendError, setExtendError] = useState('');
  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState('');

  const currentUser = getStoredUser();
  const isAdmin = currentUser?.role === 'admin';
  const hasActiveMembership = user.payments.some((p) => {
    if (!p.expires_at) return false;
    return new Date(`${p.expires_at}T23:59:59`).getTime() >= Date.now();
  });

  async function saveRole() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      if (editRole !== user.role) payload.role = editRole;
      if (editEmail.trim() !== user.email) payload.email = editEmail.trim();
      if (Object.keys(payload).length > 0) {
        await apiPatch(`/admin/users/${user.user_id}`, payload);
      }
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleExtend(e: React.FormEvent) {
    e.preventDefault();
    setExtending(true);
    setExtendError('');
    try {
      await apiPatch(`/admin/users/${user.user_id}/membership`, {
        expires_at: extendDate,
        note: extendNote.trim() || null,
      });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-user', user.user_id] });
      setShowExtend(false);
      setExtendDate('');
      setExtendNote('');
    } catch (err: any) {
      setExtendError(err?.message ?? 'Failed to extend');
    } finally {
      setExtending(false);
    }
  }

  async function handleRevokeMembership() {
    setRevoking(true);
    setRevokeError('');
    try {
      await apiDelete(`/admin/users/${user.user_id}/membership`);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-user-detail', user.user_id] });
    } catch (err: any) {
      setRevokeError(err?.message ?? 'Failed to remove membership');
    } finally {
      setRevoking(false);
    }
  }

  const formatDateLocal = (d: string | null) => (d ? formatDate(d) : '—');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto"
        style={{
          background: 'rgba(10,0,0,.95)',
          border: '1px solid rgba(185,28,28,.3)',
          boxShadow: '0 20px 60px rgba(0,0,0,.6)',
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white font-['Oxanium']">User Detail</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Identity */}
        <div className="flex items-center gap-3">
          <div
            className="h-12 w-12 rounded-full flex items-center justify-center text-base font-bold"
            style={{ background: 'rgba(185,28,28,.3)', color: 'rgba(248,113,113,.9)' }}
          >
            {user.first_name?.[0] ?? user.email[0].toUpperCase()}
          </div>
          <div>
            <p className="text-white font-medium">
              {user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.email}
            </p>
            <p className="text-xs text-white/40">{user.email}</p>
            {user.student_id && <p className="text-xs text-white/30">ID: {user.student_id}</p>}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Points', value: user.points_total },
            { label: 'Events', value: user.events_attended },
            { label: 'Check-ins', value: user.checkin_count },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-lg p-3 text-center"
              style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(185,28,28,.15)' }}
            >
              <p className="text-xl font-bold text-white font-['Oxanium']">{value}</p>
              <p className="text-xs text-white/40">{label}</p>
            </div>
          ))}
        </div>

        {/* Email editor */}
        <div className="flex flex-col gap-2">
          <label className="text-xs text-white/50 uppercase tracking-wide">Email</label>
          <input
            type="email"
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm text-white"
            style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(185,28,28,.2)' }}
          />
        </div>

        {/* Role editor */}
        <div className="flex flex-col gap-2">
          <label className="text-xs text-white/50 uppercase tracking-wide">Role</label>
          <div className="flex gap-2">
            <select
              value={editRole}
              onChange={(e) => setEditRole(e.target.value)}
              className="flex-1 rounded-lg px-3 py-2 text-sm text-white"
              style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(185,28,28,.2)' }}
            >
              {ALL_ROLES.map((r) => (
                <option key={r} value={r} style={{ background: '#1a0000' }}>
                  {r}
                </option>
              ))}
            </select>
            <button
              onClick={saveRole}
              disabled={saving || (editRole === user.role && editEmail.trim() === user.email)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-40"
              style={{ background: 'rgba(185,28,28,.6)' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {/* Info rows */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-white/50">
          <span>Joined: <span className="text-white/70">{formatDate(user.created_at)}</span></span>
          <span>Last login: <span className="text-white/70">{formatDate(user.last_login)}</span></span>
          <span>Profile: <span className="text-white/70">{user.has_profile ? 'Linked' : 'Not linked'}</span></span>
          <span>Active: <span className="text-white/70">{user.is_active ? 'Yes' : 'No'}</span></span>
        </div>

        {/* Payments */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-white/50 uppercase tracking-wide">Payment History</p>
            {isAdmin && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRevokeMembership}
                  disabled={revoking || !hasActiveMembership}
                  className="text-xs px-2.5 py-1 rounded-lg transition-colors disabled:opacity-40"
                  style={{ background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.8)', border: '1px solid rgba(255,255,255,.12)' }}
                >
                  {revoking ? 'Removing…' : 'Remove Membership'}
                </button>
                <button
                  onClick={() => setShowExtend(!showExtend)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-colors"
                  style={{ background: 'rgba(185,28,28,.15)', color: 'rgba(248,113,113,.8)', border: '1px solid rgba(185,28,28,.2)' }}
                >
                  <CalendarPlus size={11} /> Manually Extend
                </button>
              </div>
            )}
          </div>
          {revokeError && <p className="text-red-400 text-xs mb-2">{revokeError}</p>}

          {/* Manual extend form — admin only */}
          {isAdmin && showExtend && (
            <form onSubmit={handleExtend} className="flex flex-col gap-2 mb-3 p-3 rounded-lg" style={{ background: 'rgba(185,28,28,.08)', border: '1px solid rgba(185,28,28,.2)' }}>
              <p className="text-xs text-white/60">Grant manual membership access</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-white/40">Expires On *</label>
                  <input
                    required
                    type="date"
                    value={extendDate}
                    onChange={(e) => setExtendDate(e.target.value)}
                    className="rounded-lg px-2 py-1.5 text-xs"
                    style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(185,28,28,.2)', color: '#fff', colorScheme: 'dark' }}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-white/40">Note (optional)</label>
                  <input
                    type="text"
                    value={extendNote}
                    onChange={(e) => setExtendNote(e.target.value)}
                    placeholder="e.g. scholarship"
                    className="rounded-lg px-2 py-1.5 text-xs"
                    style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(185,28,28,.2)', color: '#fff' }}
                  />
                </div>
              </div>
              {extendError && <p className="text-red-400 text-xs">{extendError}</p>}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowExtend(false)} className="text-xs px-3 py-1.5 rounded-lg text-white/50" style={{ background: 'rgba(255,255,255,.06)' }}>Cancel</button>
                <button type="submit" disabled={extending || !extendDate} className="text-xs px-3 py-1.5 rounded-lg text-white disabled:opacity-40" style={{ background: 'rgba(185,28,28,.6)' }}>
                  {extending ? 'Granting…' : 'Grant Access'}
                </button>
              </div>
            </form>
          )}

          {user.payments.length === 0 ? (
            <p className="text-xs text-white/30 py-2">No payment history.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {user.payments.slice(0, 5).map((p) => (
                <div
                  key={p.payment_id}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs flex-wrap"
                  style={{ background: 'rgba(255,255,255,.04)' }}
                >
                  <span className="text-white/60">{formatDate(p.date)} · {p.plan_id ?? '—'}</span>
                  {p.is_manual ? (
                    <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'rgba(161,120,0,.2)', color: 'rgba(250,204,21,.8)' }}>Manual</span>
                  ) : (
                    <span className="text-white font-medium">${p.amount.toFixed(2)}</span>
                  )}
                  <span className="text-white/40 ml-auto">Exp: {formatDate(p.expires_at)}</span>
                  {p.note && <span className="text-white/30 w-full text-xs">{p.note}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminUsersTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [membershipFilter, setMembershipFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  // Debounce search
  const handleSearchChange = (val: string) => {
    setSearch(val);
    clearTimeout((window as any)._adminSearchTimer);
    (window as any)._adminSearchTimer = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 300);
  };

  const params = new URLSearchParams({
    page: String(page),
    limit: '25',
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(roleFilter && { role: roleFilter }),
    ...(membershipFilter && { membership_status: membershipFilter }),
  });

  const { data, isLoading, error } = useQuery<UsersResponse>({
    queryKey: ['admin-users', page, debouncedSearch, roleFilter, membershipFilter],
    queryFn: () => apiGet<UsersResponse>(`/admin/users?${params}`),
    staleTime: 30_000,
  });

  const { data: selectedUser, isLoading: loadingDetail } = useQuery<UserDetail>({
    queryKey: ['admin-user-detail', selectedUserId],
    queryFn: () => apiGet<UserDetail>(`/admin/users/${selectedUserId}`),
    enabled: selectedUserId !== null,
    staleTime: 0,
  });

  const toggleActive = useMutation({
    mutationFn: ({ userId, isActive }: { userId: number; isActive: boolean }) =>
      apiPatch(`/admin/users/${userId}`, { is_active: isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const cardStyle = {
    background: 'rgba(255,255,255,.04)',
    border: '1px solid rgba(185,28,28,.22)',
    backdropFilter: 'blur(10px)',
  };

  const formatDateLocal = (d: string | null) => (d ? formatDate(d) : '—');

  return (
    <>
      {selectedUser && !loadingDetail && (
        <UserDetailModal user={selectedUser} onClose={() => setSelectedUserId(null)} />
      )}

      <div className="flex flex-col gap-4">
        {/* Filter bar */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm text-white placeholder:text-white/30"
              style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(185,28,28,.2)' }}
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="rounded-lg px-3 py-2 text-sm text-white"
            style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(185,28,28,.2)' }}
          >
            <option value="" style={{ background: '#1a0000' }}>All roles</option>
            {ALL_ROLES.map((r) => (
              <option key={r} value={r} style={{ background: '#1a0000' }}>{r}</option>
            ))}
          </select>

          <select
            value={membershipFilter}
            onChange={(e) => { setMembershipFilter(e.target.value); setPage(1); }}
            className="rounded-lg px-3 py-2 text-sm text-white"
            style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(185,28,28,.2)' }}
          >
            <option value="" style={{ background: '#1a0000' }}>All memberships</option>
            <option value="active" style={{ background: '#1a0000' }}>Active</option>
            <option value="expired" style={{ background: '#1a0000' }}>Expired</option>
            <option value="none" style={{ background: '#1a0000' }}>None</option>
          </select>

          {data && (
            <span className="text-xs text-white/40 ml-auto">{data.total} user{data.total !== 1 ? 's' : ''}</span>
          )}
        </div>

        {/* Table */}
        <div className="rounded-xl overflow-hidden" style={cardStyle}>
          {isLoading ? (
            <div className="p-8 text-center text-white/40 text-sm">Loading users…</div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-red-400">
              Failed to load users{(error as { status?: number })?.status ? ` (${(error as { status?: number }).status})` : ''}: {error instanceof Error ? error.message : 'Unknown error'}
            </div>
          ) : !data?.users.length ? (
            <div className="p-8 text-center text-white/40 text-sm">No users found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(185,28,28,.15)' }}>
                    {['User', 'Role', 'Membership', 'Joined', 'Last Login', 'Actions'].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-xs text-white/40 uppercase tracking-wide font-medium"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((u) => (
                    <tr
                      key={u.user_id}
                      className="transition-colors hover:bg-white/[0.02]"
                      style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar user={u} />
                          <div>
                            <p className="text-white text-sm font-medium">
                              {u.first_name && u.last_name
                                ? `${u.first_name} ${u.last_name}`
                                : <span className="text-white/40 italic">No profile</span>}
                            </p>
                            <p className="text-xs text-white/40">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge value={u.role} colorMap={ROLE_COLORS} />
                        {!u.is_active && (
                          <span className="ml-2 text-xs text-white/30">(inactive)</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <Badge value={u.membership_status} colorMap={MEMBERSHIP_COLORS} />
                          {u.membership_expires_at && u.membership_status === 'active' && (
                            <p className="text-xs text-white/30 mt-0.5">
                              Exp: {formatDate(u.membership_expires_at)}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-white/50">{formatDate(u.created_at)}</td>
                      <td className="px-4 py-3 text-xs text-white/50">{formatDate(u.last_login)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedUserId(u.user_id)}
                            className="text-xs px-2.5 py-1 rounded-lg transition-colors text-white/60 hover:text-white"
                            style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)' }}
                          >
                            View
                          </button>
                          <button
                            onClick={() => toggleActive.mutate({ userId: u.user_id, isActive: !u.is_active })}
                            className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                            style={
                              u.is_active
                                ? { background: 'rgba(185,28,28,.15)', color: 'rgba(248,113,113,.7)', border: '1px solid rgba(185,28,28,.2)' }
                                : { background: 'rgba(21,128,61,.15)', color: 'rgba(74,222,128,.8)', border: '1px solid rgba(21,128,61,.2)' }
                            }
                          >
                            {u.is_active ? 'Deactivate' : 'Reactivate'}
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

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-white/60 hover:text-white disabled:opacity-30 transition-colors"
              style={{ background: 'rgba(255,255,255,.06)' }}
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <span className="text-white/40 text-xs">
              Page {page} of {data.pages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
              disabled={page === data.pages}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-white/60 hover:text-white disabled:opacity-30 transition-colors"
              style={{ background: 'rgba(255,255,255,.06)' }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
