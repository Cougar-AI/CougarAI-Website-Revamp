import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { Search, X, Download, ChevronLeft, ChevronRight } from 'lucide-react';

const BACKEND = import.meta.env.VITE_BACKEND_API_URL ?? 'http://localhost:5001';

interface DirectoryUser {
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
  points_total?: number;
  checkin_count?: number;
  events_attended?: number;
}

interface UserDetail extends DirectoryUser {
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
    is_manual: boolean;
    note: string | null;
  }[];
  points_total: number;
  events_attended: number;
  checkin_count: number;
}

interface UsersResponse {
  users: DirectoryUser[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  admin:        { bg: 'rgba(185,28,28,.25)',   text: 'rgba(248,113,113,.9)' },
  webmaster:    { bg: 'rgba(185,28,28,.15)',   text: 'rgba(248,113,113,.7)' },
  officer:      { bg: 'rgba(29,78,216,.2)',    text: 'rgba(96,165,250,.9)' },
  partner:      { bg: 'rgba(109,40,217,.2)',   text: 'rgba(167,139,250,.9)' },
  member:       { bg: 'rgba(21,128,61,.2)',    text: 'rgba(74,222,128,.9)' },
  'non-member': { bg: 'rgba(255,255,255,.08)', text: 'rgba(255,255,255,.5)' },
};

const MEMBERSHIP_COLORS: Record<string, { bg: string; text: string }> = {
  active:  { bg: 'rgba(21,128,61,.2)',    text: 'rgba(74,222,128,.9)' },
  expired: { bg: 'rgba(161,120,0,.2)',    text: 'rgba(250,204,21,.8)' },
  none:    { bg: 'rgba(255,255,255,.06)', text: 'rgba(255,255,255,.4)' },
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

function Badge({ value, colorMap }: { value: string; colorMap: Record<string, { bg: string; text: string }> }) {
  const style = colorMap[value] ?? colorMap['non-member'] ?? { bg: 'rgba(255,255,255,.06)', text: 'rgba(255,255,255,.4)' };
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ background: style.bg, color: style.text }}
    >
      {value}
    </span>
  );
}

function UserAvatar({ user, size = 8 }: { user: DirectoryUser; size?: number }) {
  const url = user.avatar_url ? `${BACKEND}${user.avatar_url}` : null;
  const initials =
    [user.first_name, user.last_name]
      .filter(Boolean)
      .map((n) => n![0].toUpperCase())
      .join('') || user.email[0].toUpperCase();
  const sizeClass = `h-${size} w-${size}`;
  return url ? (
    <img src={url} alt="" className={`${sizeClass} rounded-full object-cover shrink-0`} />
  ) : (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center text-xs font-bold shrink-0`}
      style={{ background: 'rgba(185,28,28,.3)', color: 'rgba(248,113,113,.9)' }}
    >
      {initials}
    </div>
  );
}

function DetailModal({ userId, onClose }: { userId: number; onClose: () => void }) {
  const { data: user, isLoading, isError } = useQuery<UserDetail>({
    queryKey: ['admin-user-detail-dir', userId],
    queryFn: () => apiGet<UserDetail>(`/admin/users/${userId}`),
    staleTime: 0,
  });

  const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString() : '—');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto"
        style={{
          background: 'rgba(10,0,0,.97)',
          border: '1px solid rgba(185,28,28,.3)',
          boxShadow: '0 20px 60px rgba(0,0,0,.6)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white font-['Oxanium']">Member Profile</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors">
            <X size={18} />
          </button>
        </div>

        {isLoading && (
          <div className="py-12 text-center text-white/40 text-sm">Loading…</div>
        )}

        {isError && (
          <div className="py-12 text-center text-red-400 text-sm">Failed to load user details.</div>
        )}

        {user && (
          <>
            {/* Identity */}
            <div className="flex items-center gap-4">
              <div
                className="h-14 w-14 rounded-full flex items-center justify-center text-lg font-bold shrink-0"
                style={{ background: 'rgba(185,28,28,.3)', color: 'rgba(248,113,113,.9)' }}
              >
                {user.first_name?.[0] ?? user.email[0].toUpperCase()}
              </div>
              <div>
                <p className="text-white font-semibold text-base">
                  {user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : '—'}
                </p>
                <p className="text-xs text-white/50">{user.email}</p>
                {user.student_id && (
                  <p className="text-xs text-white/30 mt-0.5">Student ID: {user.student_id}</p>
                )}
              </div>
            </div>

            {/* Role + membership */}
            <div className="flex flex-wrap gap-2">
              <Badge value={user.role} colorMap={ROLE_COLORS} />
              <Badge value={user.membership_status} colorMap={MEMBERSHIP_COLORS} />
              {!user.is_active && (
                <span className="text-xs text-white/30 px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,.06)' }}>
                  Inactive
                </span>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Points',    value: user.points_total },
                { label: 'Events',    value: user.events_attended },
                { label: 'Check-ins', value: user.checkin_count },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-lg p-3 text-center"
                  style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(185,28,28,.15)' }}
                >
                  <p className="text-xl font-bold text-white font-['Oxanium']">{value ?? '—'}</p>
                  <p className="text-xs text-white/40">{label}</p>
                </div>
              ))}
            </div>

            {/* Profile info */}
            {user.profile && (
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wide mb-2">Academic Info</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-white/50">
                  {user.profile.major && (
                    <span>Major: <span className="text-white/70">{user.profile.major}</span></span>
                  )}
                  {user.profile.grade_level && (
                    <span>Year: <span className="text-white/70">{user.profile.grade_level}</span></span>
                  )}
                  <span>Streak: <span className="text-white/70">{user.profile.current_streak} mo (max {user.profile.max_streak})</span></span>
                  <span>Public: <span className="text-white/70">{user.profile.is_public ? 'Yes' : 'No'}</span></span>
                </div>
              </div>
            )}

            {/* Dates */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-white/50">
              <span>Joined: <span className="text-white/70">{fmt(user.created_at)}</span></span>
              <span>Last login: <span className="text-white/70">{fmt(user.last_login)}</span></span>
              {user.membership_expires_at && (
                <span>Membership exp: <span className="text-white/70">{fmt(user.membership_expires_at)}</span></span>
              )}
            </div>

            {/* Payments (read-only) */}
            {user.payments.length > 0 && (
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wide mb-2">Payment History</p>
                <div className="flex flex-col gap-1">
                  {user.payments.slice(0, 5).map((p) => (
                    <div
                      key={p.payment_id}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                      style={{ background: 'rgba(255,255,255,.04)' }}
                    >
                      <span className="text-white/60">{fmt(p.date)} · {p.plan_id ?? '—'}</span>
                      {p.is_manual ? (
                        <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'rgba(161,120,0,.2)', color: 'rgba(250,204,21,.8)' }}>
                          Manual
                        </span>
                      ) : (
                        <span className="text-white font-medium">${p.amount.toFixed(2)}</span>
                      )}
                      <span className="text-white/40 ml-auto">Exp: {fmt(p.expires_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function exportCsv(users: DirectoryUser[]) {
  const headers = ['Name', 'Email', 'Student ID', 'Role', 'Membership', 'Points', 'Check-ins', 'Joined'];
  const rows = users.map((u) => [
    u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : '',
    u.email,
    u.student_id ?? '',
    u.role,
    u.membership_status,
    u.points_total ?? '',
    u.checkin_count ?? '',
    u.created_at ? new Date(u.created_at).toLocaleDateString() : '',
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `member-directory-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminMemberDirectoryTab() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [membershipFilter, setMembershipFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
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

  const { data, isLoading } = useQuery<UsersResponse>({
    queryKey: ['admin-directory', page, debouncedSearch, roleFilter, membershipFilter],
    queryFn: () => apiGet<UsersResponse>(`/admin/users?${params}`),
    staleTime: 60_000,
  });

  const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString() : '—');

  return (
    <>
      {selectedUserId !== null && (
        <DetailModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
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
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm placeholder:text-white/30"
              style={inputStyle}
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="rounded-lg px-3 py-2 text-sm"
            style={inputStyle}
          >
            <option value="" style={{ background: '#1a0000' }}>All roles</option>
            {['admin', 'webmaster', 'officer', 'partner', 'member', 'non-member'].map((r) => (
              <option key={r} value={r} style={{ background: '#1a0000' }}>{r}</option>
            ))}
          </select>

          <select
            value={membershipFilter}
            onChange={(e) => { setMembershipFilter(e.target.value); setPage(1); }}
            className="rounded-lg px-3 py-2 text-sm"
            style={inputStyle}
          >
            <option value="" style={{ background: '#1a0000' }}>All memberships</option>
            <option value="active" style={{ background: '#1a0000' }}>Active</option>
            <option value="expired" style={{ background: '#1a0000' }}>Expired</option>
            <option value="none" style={{ background: '#1a0000' }}>None</option>
          </select>

          <button
            onClick={() => data && exportCsv(data.users)}
            disabled={!data || data.users.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white transition-colors disabled:opacity-30"
            style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)' }}
          >
            <Download size={14} />
            Export CSV
          </button>

          {data && (
            <span className="text-xs text-white/40 ml-auto">
              {data.total} user{data.total !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Table */}
        <div className="rounded-xl overflow-hidden" style={cardStyle}>
          {isLoading ? (
            <div className="p-8 text-center text-white/40 text-sm">Loading members…</div>
          ) : !data?.users.length ? (
            <div className="p-8 text-center text-white/40 text-sm">No members found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(185,28,28,.15)' }}>
                    {['Member', 'Role', 'Membership', 'Points', 'Check-ins', ''].map((h) => (
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
                      className="transition-colors hover:bg-white/[0.02] cursor-pointer"
                      style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}
                      onClick={() => setSelectedUserId(u.user_id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <UserAvatar user={u} />
                          <div>
                            <p className="text-white text-sm font-medium">
                              {u.first_name && u.last_name
                                ? `${u.first_name} ${u.last_name}`
                                : <span className="text-white/40 italic">No name</span>}
                            </p>
                            <p className="text-xs text-white/40">{u.email}</p>
                            {u.student_id && (
                              <p className="text-xs text-white/25">ID: {u.student_id}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge value={u.role} colorMap={ROLE_COLORS} />
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <Badge value={u.membership_status} colorMap={MEMBERSHIP_COLORS} />
                          {u.membership_expires_at && u.membership_status === 'active' && (
                            <p className="text-xs text-white/30 mt-0.5">
                              Exp: {fmt(u.membership_expires_at)}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-white/70">
                        {u.points_total ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-white/70">
                        {u.checkin_count ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedUserId(u.user_id); }}
                          className="text-xs px-2.5 py-1 rounded-lg transition-colors text-white/50 hover:text-white"
                          style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)' }}
                        >
                          View
                        </button>
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
              Page {page} of {data.pages} — {data.total} members
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
