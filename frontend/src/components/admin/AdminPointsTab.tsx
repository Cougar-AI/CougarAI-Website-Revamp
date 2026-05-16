import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import { Star, TrendingUp, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';

const BACKEND = import.meta.env.VITE_BACKEND_API_URL ?? 'http://localhost:5001';
void BACKEND;

// ── Types ──────────────────────────────────────────────────────────────────────

interface TopEarner {
  user_id: number;
  name: string;
  total: number;
}

interface PointsSummary {
  total_this_month: number;
  top_earners: TopEarner[];
  recent: PointRecord[];
}

interface PointRecord {
  points_id?: number;
  user_id: number;
  user_name?: string;
  user_email?: string;
  points: number;
  reason: string;
  event_id?: number | null;
  created_at?: string;
  timestamp?: string;
}

interface PointsListResponse {
  records: PointRecord[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface UserSearchResult {
  user_id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
}

interface UsersResponse {
  users: UserSearchResult[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface Event {
  event_id: number;
  name: string;
  starts_at: string;
}

// ── Shared styles ──────────────────────────────────────────────────────────────

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

// ── Sub-components ─────────────────────────────────────────────────────────────

function SummarySection() {
  const { data, isLoading, isError } = useQuery<PointsSummary>({
    queryKey: ['admin-points-summary'],
    queryFn: () => apiGet<PointsSummary>('/admin/points/summary'),
    staleTime: 60_000,
    retry: false,
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Points this month */}
      <div className="rounded-xl p-5 flex items-start gap-4" style={cardStyle}>
        <div
          className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'rgba(185,28,28,.2)', border: '1px solid rgba(185,28,28,.3)' }}
        >
          <Star size={18} className="text-red-400" />
        </div>
        <div>
          <p className="text-xs text-white/40 uppercase tracking-wide">Points Awarded This Month</p>
          {isLoading ? (
            <p className="text-2xl font-bold text-white/30 font-['Oxanium'] mt-0.5">…</p>
          ) : isError ? (
            <p className="text-sm text-white/30 mt-1">Backend not yet available</p>
          ) : (
            <p className="text-2xl font-bold text-white font-['Oxanium'] mt-0.5">
              {data?.total_this_month ?? 0}
            </p>
          )}
        </div>
      </div>

      {/* Top earners */}
      <div className="rounded-xl p-5 flex flex-col gap-3" style={cardStyle}>
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'rgba(185,28,28,.2)', border: '1px solid rgba(185,28,28,.3)' }}
          >
            <TrendingUp size={18} className="text-red-400" />
          </div>
          <p className="text-xs text-white/40 uppercase tracking-wide">Top Earners</p>
        </div>

        {isLoading && (
          <p className="text-xs text-white/30">Loading…</p>
        )}
        {isError && (
          <p className="text-xs text-white/30">Backend not yet available</p>
        )}
        {data && (data.top_earners ?? []).length === 0 && (
          <p className="text-xs text-white/30">No data yet.</p>
        )}
        {data && (data.top_earners ?? []).slice(0, 5).map((u, i) => (
          <div key={u.user_id} className="flex items-center gap-3">
            <span
              className="text-xs font-bold w-5 text-center shrink-0"
              style={{ color: i === 0 ? 'rgba(250,204,21,.9)' : 'rgba(255,255,255,.3)' }}
            >
              {i + 1}
            </span>
            <p className="text-sm text-white flex-1 truncate">{u.name}</p>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
              style={{ background: 'rgba(185,28,28,.2)', color: 'rgba(248,113,113,.9)' }}
            >
              {u.total} pts
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface AttendeeUser {
  user_id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

function AwardForm({ onSuccess }: { onSuccess: () => void }) {
  const qc = useQueryClient();

  const [userSearch, setUserSearch] = useState('');
  const [debouncedUserSearch, setDebouncedUserSearch] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<UserSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const [eventId, setEventId] = useState<string>('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const userDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleUserSearchChange = (val: string) => {
    setUserSearch(val);
    setShowDropdown(val.length >= 2);
    if (userDebounceRef.current) clearTimeout(userDebounceRef.current);
    userDebounceRef.current = setTimeout(() => setDebouncedUserSearch(val), 300);
  };

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const { data: userResults } = useQuery<UsersResponse>({
    queryKey: ['admin-user-search-pts', debouncedUserSearch],
    queryFn: () => apiGet<UsersResponse>(`/admin/users?search=${encodeURIComponent(debouncedUserSearch)}&limit=8`),
    enabled: debouncedUserSearch.length >= 2,
    staleTime: 30_000,
  });

  const { data: eventsData } = useQuery<{ events: Event[] }>({
    queryKey: ['admin-events-pts'],
    queryFn: () => apiGet<{ events: Event[] }>('/events/?limit=50'),
    staleTime: 120_000,
  });

  function addUser(u: UserSearchResult) {
    if (selectedUsers.length >= 20) return;
    if (selectedUsers.some((s) => s.user_id === u.user_id)) return;
    setSelectedUsers((prev) => [...prev, u]);
    setUserSearch('');
    setDebouncedUserSearch('');
    setShowDropdown(false);
  }

  function removeUser(userId: number) {
    setSelectedUsers((prev) => prev.filter((u) => u.user_id !== userId));
  }

  async function loadFromEvent(evId: string) {
    if (!evId) return;
    setLoadingAttendees(true);
    try {
      const res = await import('@/lib/api').then((m) =>
        m.apiGet<{ attendance_count: number; attendees: AttendeeUser[] }>(`/admin/events/${evId}/attendance`)
      );
      const ev = eventsData?.events.find((e) => String(e.event_id) === evId);
      const newUsers: UserSearchResult[] = res.attendees
        .filter((a) => a.user_id)
        .map((a) => ({
          user_id: a.user_id,
          email: a.email,
          first_name: a.first_name,
          last_name: a.last_name,
          role: 'member',
        }));
      setSelectedUsers(newUsers.slice(0, 20));
      if (ev) {
        setPoints(String(ev.event_id)); // will be overwritten below
        setReason(`${ev.name} attendance`);
      }
    } catch {
      setFormError('Failed to load attendees for that event');
    } finally {
      setLoadingAttendees(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (selectedUsers.length === 0) { setFormError('Select at least one user.'); return; }
    const pts = parseInt(points, 10);
    if (isNaN(pts) || pts === 0) { setFormError('Enter a non-zero points value.'); return; }
    if (!reason.trim()) { setFormError('Reason is required.'); return; }

    setSubmitting(true);
    try {
      await Promise.all(
        selectedUsers.map((u) =>
          apiPost('/admin/points', {
            user_id: u.user_id,
            points: pts,
            reason: reason.trim(),
            ...(eventId ? { event_id: parseInt(eventId, 10) } : {}),
          })
        )
      );
      qc.invalidateQueries({ queryKey: ['admin-points-summary'] });
      qc.invalidateQueries({ queryKey: ['admin-points-list'] });
      setSelectedUsers([]);
      setUserSearch('');
      setPoints('');
      setReason('');
      setEventId('');
      setFormError('');
      onSuccess();
    } catch (err: unknown) {
      setFormError((err as Error)?.message ?? 'Failed to award points to one or more users');
    } finally {
      setSubmitting(false);
    }
  }

  const pointsNum = parseInt(points, 10);
  const isDeduct = !isNaN(pointsNum) && pointsNum < 0;

  return (
    <div className="rounded-xl p-5 flex flex-col gap-4" style={cardStyle}>
      <h3 className="text-sm font-semibold text-white font-['Oxanium']">
        Award / Deduct Points
      </h3>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* Load from event attendees */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-white/40 uppercase tracking-wide">
            Quick-load from Event <span className="text-white/25 normal-case">(optional — loads all attendees)</span>
          </label>
          <div className="flex gap-2">
            <select
              value=""
              onChange={(e) => { setEventId(e.target.value); loadFromEvent(e.target.value); }}
              className="flex-1 rounded-lg px-3 py-2 text-sm"
              style={inputStyle}
            >
              <option value="" style={{ background: '#1a0000' }}>— Pick an event to load attendees —</option>
              {(eventsData?.events ?? []).map((ev) => (
                <option key={ev.event_id} value={String(ev.event_id)} style={{ background: '#1a0000' }}>
                  {ev.name} ({new Date(ev.starts_at).toLocaleDateString()})
                </option>
              ))}
            </select>
            {loadingAttendees && <span className="text-xs text-white/40 self-center">Loading…</span>}
          </div>
        </div>

        {/* User search + chips */}
        <div className="flex flex-col gap-1.5 relative" ref={dropdownRef}>
          <div className="flex items-center justify-between">
            <label className="text-xs text-white/40 uppercase tracking-wide">Users *</label>
            {selectedUsers.length > 0 && (
              <span className="text-xs text-white/30">{selectedUsers.length}/20 selected</span>
            )}
          </div>

          {/* Selected chips */}
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-1">
              {selectedUsers.map((u) => (
                <div
                  key={u.user_id}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
                  style={{ background: 'rgba(185,28,28,.2)', border: '1px solid rgba(185,28,28,.3)', color: '#fff' }}
                >
                  <span>{u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.email}</span>
                  <button
                    type="button"
                    onClick={() => removeUser(u.user_id)}
                    className="text-white/40 hover:text-white/80 transition-colors"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Search input */}
          {selectedUsers.length < 20 && (
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                placeholder="Search by name or email…"
                value={userSearch}
                onChange={(e) => handleUserSearchChange(e.target.value)}
                onFocus={() => userSearch.length >= 2 && setShowDropdown(true)}
                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm placeholder:text-white/30"
                style={inputStyle}
              />
            </div>
          )}
          {showDropdown && userResults && userResults.users.length > 0 && (
            <div
              className="absolute top-full left-0 right-0 mt-1 rounded-lg overflow-hidden z-20 flex flex-col"
              style={{ background: 'rgba(15,0,0,.97)', border: '1px solid rgba(185,28,28,.3)', boxShadow: '0 8px 24px rgba(0,0,0,.5)' }}
            >
              {userResults.users.map((u) => {
                const already = selectedUsers.some((s) => s.user_id === u.user_id);
                return (
                  <button
                    key={u.user_id}
                    type="button"
                    onClick={() => addUser(u)}
                    disabled={already}
                    className="flex items-center gap-3 px-3 py-2 text-left hover:bg-white/5 transition-colors disabled:opacity-40"
                  >
                    <div
                      className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: 'rgba(185,28,28,.3)', color: 'rgba(248,113,113,.9)' }}
                    >
                      {u.first_name?.[0] ?? u.email[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">
                        {u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.email}
                      </p>
                      {u.first_name && <p className="text-xs text-white/40 truncate">{u.email}</p>}
                    </div>
                    {already && <span className="text-xs text-white/30 ml-auto shrink-0">added</span>}
                  </button>
                );
              })}
            </div>
          )}
          {showDropdown && userResults && userResults.users.length === 0 && (
            <div
              className="absolute top-full left-0 right-0 mt-1 rounded-lg px-4 py-3 text-xs text-white/40 z-20"
              style={{ background: 'rgba(15,0,0,.97)', border: '1px solid rgba(185,28,28,.2)' }}
            >
              No users found.
            </div>
          )}
        </div>

        {/* Points + reason row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/40 uppercase tracking-wide">
              Points * <span className="text-white/25 normal-case">(negative to deduct)</span>
            </label>
            <input
              type="number"
              placeholder="e.g. 10 or -5"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm placeholder:text-white/30"
              style={{
                ...inputStyle,
                color: isDeduct ? 'rgba(248,113,113,.9)' : (points && !isDeduct ? 'rgba(74,222,128,.9)' : '#fff'),
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/40 uppercase tracking-wide">Reason *</label>
            <input
              type="text"
              placeholder="e.g. Workshop attendance"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm placeholder:text-white/30"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Linked event (separate from quick-load) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-white/40 uppercase tracking-wide">
            Linked Event <span className="text-white/25 normal-case">(optional)</span>
          </label>
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm"
            style={inputStyle}
          >
            <option value="" style={{ background: '#1a0000' }}>— None —</option>
            {(eventsData?.events ?? []).map((ev) => (
              <option key={ev.event_id} value={String(ev.event_id)} style={{ background: '#1a0000' }}>
                {ev.name} ({new Date(ev.starts_at).toLocaleDateString()})
              </option>
            ))}
          </select>
        </div>

        {formError && <p className="text-xs text-red-400">{formError}</p>}

        <button
          type="submit"
          disabled={submitting || selectedUsers.length === 0}
          className="self-end px-5 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-40"
          style={{ background: 'rgba(185,28,28,.6)' }}
        >
          {submitting
            ? `Awarding to ${selectedUsers.length} user${selectedUsers.length !== 1 ? 's' : ''}…`
            : isDeduct
            ? `Deduct from ${selectedUsers.length || '?'} user${selectedUsers.length !== 1 ? 's' : ''}`
            : `Award to ${selectedUsers.length || '?'} user${selectedUsers.length !== 1 ? 's' : ''}`}
        </button>
      </form>
    </div>
  );
}

function RecentAdjustments() {
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });

  const { data, isLoading, isError } = useQuery<PointsListResponse>({
    queryKey: ['admin-points-list', page],
    queryFn: () => apiGet<PointsListResponse>(`/admin/points?${params}`),
    staleTime: 30_000,
    retry: false,
  });

  const fmt = (s?: string) => {
    if (!s) return '—';
    return new Date(s).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-white font-['Oxanium']">Recent Adjustments</h3>

      <div className="rounded-xl overflow-hidden" style={cardStyle}>
        {isLoading && (
          <div className="p-8 text-center text-white/40 text-sm">Loading…</div>
        )}
        {isError && (
          <div className="p-8 text-center text-white/30 text-sm">
            Backend endpoint not yet available.
          </div>
        )}
        {data && data.records.length === 0 && (
          <div className="p-8 text-center text-white/40 text-sm">No adjustments yet.</div>
        )}
        {data && data.records.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(185,28,28,.15)' }}>
                  {['User', 'Points', 'Reason', 'Date'].map((h) => (
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
                {data.records.map((r, i) => (
                  <tr
                    key={r.points_id ?? i}
                    className="transition-colors hover:bg-white/[0.02]"
                    style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}
                  >
                    <td className="px-4 py-3">
                      <p className="text-white text-sm">{r.user_name ?? `User #${r.user_id}`}</p>
                      {r.user_email && (
                        <p className="text-xs text-white/40">{r.user_email}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-sm font-semibold font-['Oxanium']"
                        style={{ color: r.points >= 0 ? 'rgba(74,222,128,.9)' : 'rgba(248,113,113,.9)' }}
                      >
                        {r.points >= 0 ? '+' : ''}{r.points}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-white/70 max-w-xs">
                      <p className="truncate">{r.reason}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-white/40 whitespace-nowrap">
                      {fmt(r.created_at ?? r.timestamp)}
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
          <span className="text-white/40 text-xs">Page {page} of {data.pages}</span>
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
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function AdminPointsTab() {
  const qc = useQueryClient();

  function handleAwardSuccess() {
    qc.invalidateQueries({ queryKey: ['admin-points-summary'] });
    qc.invalidateQueries({ queryKey: ['admin-points-list'] });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Summary cards */}
      <SummarySection />

      {/* Award form */}
      <AwardForm onSuccess={handleAwardSuccess} />

      {/* Recent adjustments */}
      <RecentAdjustments />
    </div>
  );
}
