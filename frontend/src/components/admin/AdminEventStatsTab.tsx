import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { BarChart2, Users, TrendingUp, Calendar, X, ChevronUp, ChevronDown } from 'lucide-react';
import { formatDate, formatTime } from '@/lib/dates';

const BACKEND = import.meta.env.VITE_BACKEND_API_URL ?? 'http://localhost:5001';
void BACKEND; // kept for potential avatar URLs

interface Event {
  event_id: number;
  name: string;
  event_type: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  capacity: number | null;
  check_in_code: string | null;
  check_in_enabled: boolean;
  points_value: number;
  attendance_count?: number;
}

interface Attendee {
  checkin_id: number;
  checked_in_at: string | null;
  student_id: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  points: number | null;
}

interface AttendanceResponse {
  event_name: string;
  capacity: number | null;
  attendance_count: number;
  attendees: Attendee[];
}

type SortKey = 'date' | 'attendance' | 'fill';
type SortDir = 'asc' | 'desc';
type FilterMode = 'all' | 'past' | 'upcoming';

const cardStyle = {
  background: 'rgba(255,255,255,.04)',
  border: '1px solid rgba(185,28,28,.22)',
  backdropFilter: 'blur(10px)',
} as const;

function StatCard({ label, value, icon: Icon, sublabel }: {
  label: string;
  value: string | number;
  icon: React.FC<{ size?: number; className?: string }>;
  sublabel?: string;
}) {
  return (
    <div className="rounded-xl p-5 flex items-start gap-4" style={cardStyle}>
      <div
        className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: 'rgba(185,28,28,.2)', border: '1px solid rgba(185,28,28,.3)' }}
      >
        <Icon size={18} className="text-red-400" />
      </div>
      <div>
        <p className="text-xs text-white/40 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-white font-['Oxanium'] mt-0.5">{value}</p>
        {sublabel && <p className="text-xs text-white/30 mt-0.5">{sublabel}</p>}
      </div>
    </div>
  );
}

function AttendanceModal({ event, onClose }: { event: Event; onClose: () => void }) {
  const { data, isLoading, isError } = useQuery<AttendanceResponse>({
    queryKey: ['event-attendance', event.event_id],
    queryFn: () => apiGet<AttendanceResponse>(`/admin/events/${event.event_id}/attendance`),
    staleTime: 30_000,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-6 flex flex-col gap-4 max-h-[85vh] overflow-y-auto"
        style={{
          background: 'rgba(10,0,0,.97)',
          border: '1px solid rgba(185,28,28,.3)',
          boxShadow: '0 20px 60px rgba(0,0,0,.6)',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white font-['Oxanium']">{event.name}</h2>
            <p className="text-xs text-white/40 mt-0.5">
              {formatDate(event.starts_at)}
            </p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors shrink-0">
            <X size={18} />
          </button>
        </div>

        {isLoading && (
          <div className="py-12 text-center text-white/40 text-sm">Loading attendance…</div>
        )}

        {isError && (
          <div className="py-12 text-center text-red-400 text-sm">Failed to load attendance data.</div>
        )}

        {data && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div
                className="rounded-lg p-3 text-center"
                style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(185,28,28,.15)' }}
              >
                <p className="text-xl font-bold text-white font-['Oxanium']">{data.attendance_count}</p>
                <p className="text-xs text-white/40">Attended</p>
              </div>
              <div
                className="rounded-lg p-3 text-center"
                style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(185,28,28,.15)' }}
              >
                <p className="text-xl font-bold text-white font-['Oxanium']">
                  {data.capacity
                    ? `${Math.round((data.attendance_count / data.capacity) * 100)}%`
                    : '—'}
                </p>
                <p className="text-xs text-white/40">
                  {data.capacity ? `of ${data.capacity} capacity` : 'No capacity set'}
                </p>
              </div>
            </div>

            {/* Attendee list */}
            {data.attendees.length === 0 ? (
              <p className="text-xs text-white/30 py-4 text-center">No check-ins recorded.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {data.attendees.map((a) => (
                  <div
                    key={a.checkin_id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg"
                    style={{ background: 'rgba(255,255,255,.03)' }}
                  >
                    <div
                      className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: 'rgba(185,28,28,.3)', color: 'rgba(248,113,113,.9)' }}
                    >
                      {a.first_name?.[0] ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">
                        {a.first_name && a.last_name
                          ? `${a.first_name} ${a.last_name}`
                          : a.student_id ?? 'Unknown'}
                      </p>
                      {a.student_id && (
                        <p className="text-xs text-white/30">ID: {a.student_id}</p>
                      )}
                    </div>
                    {a.points !== null && (
                      <span className="text-xs text-white/50 shrink-0">+{a.points} pts</span>
                    )}
                    {a.checked_in_at && (
                      <span className="text-xs text-white/30 shrink-0">
                        {formatTime(a.checked_in_at)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronDown size={12} className="text-white/20" />;
  return dir === 'asc'
    ? <ChevronUp size={12} className="text-red-400" />
    : <ChevronDown size={12} className="text-red-400" />;
}

export default function AdminEventStatsTab() {
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [attendanceEvent, setAttendanceEvent] = useState<Event | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data: eventsData, isLoading } = useQuery<{ events: Event[] }>({
    queryKey: ['admin-events-stats', startDate, endDate],
    queryFn: () => {
      const params = new URLSearchParams();
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      const qs = params.toString();
      return apiGet<{ events: Event[] }>(`/admin/events-stats${qs ? `?${qs}` : ''}`);
    },
    staleTime: 60_000,
  });

  const now = new Date();
  const allEvents = eventsData?.events ?? [];

  const filtered = allEvents.filter((e) => {
    const start = new Date(e.starts_at);
    if (filterMode === 'past')     return start < now;
    if (filterMode === 'upcoming') return start >= now;
    return true;
  });

  // Compute summary stats
  const totalEvents = filtered.length;
  const eventsWithCount = filtered.filter((e) => typeof e.attendance_count === 'number');
  const totalCheckins = eventsWithCount.reduce((s, e) => s + (e.attendance_count ?? 0), 0);
  const avgAttendance = eventsWithCount.length > 0
    ? (totalCheckins / eventsWithCount.length).toFixed(1)
    : null;

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let diff = 0;
    if (sortKey === 'date') {
      diff = new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
    } else if (sortKey === 'attendance') {
      diff = (a.attendance_count ?? 0) - (b.attendance_count ?? 0);
    } else if (sortKey === 'fill') {
      const fa = a.capacity ? ((a.attendance_count ?? 0) / a.capacity) : -1;
      const fb = b.capacity ? ((b.attendance_count ?? 0) / b.capacity) : -1;
      diff = fa - fb;
    }
    return sortDir === 'asc' ? diff : -diff;
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'date' ? 'desc' : 'desc');
    }
  }

  const isPast = (e: Event) => new Date(e.starts_at) < now;

  return (
    <>
      {attendanceEvent && (
        <AttendanceModal event={attendanceEvent} onClose={() => setAttendanceEvent(null)} />
      )}

      <div className="flex flex-col gap-5">
        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Total Events"
            value={isLoading ? '…' : totalEvents}
            icon={Calendar}
            sublabel={filterMode !== 'all' ? filterMode : 'all time'}
          />
          <StatCard
            label="Total Check-ins"
            value={isLoading ? '…' : eventsWithCount.length === 0 ? 'N/A' : totalCheckins}
            icon={Users}
            sublabel={eventsWithCount.length === 0 ? 'no attendance data available' : undefined}
          />
          <StatCard
            label="Avg Attendance"
            value={isLoading ? '…' : avgAttendance ?? 'N/A'}
            icon={TrendingUp}
            sublabel={avgAttendance ? 'check-ins per event' : 'no attendance data available'}
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 rounded-lg p-1" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(185,28,28,.15)' }}>
            {(['all', 'past', 'upcoming'] as FilterMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setFilterMode(mode)}
                className="px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all"
                style={
                  filterMode === mode
                    ? { background: 'rgba(185,28,28,.4)', color: '#fff' }
                    : { color: 'rgba(255,255,255,.5)' }
                }
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Date range filter */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg px-2.5 py-1.5 text-xs text-white"
              style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(185,28,28,.2)' }}
            />
            <span className="text-white/30 text-xs">→</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg px-2.5 py-1.5 text-xs text-white"
              style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(185,28,28,.2)' }}
            />
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="p-1 rounded text-white/40 hover:text-white/70 transition-colors"
                title="Clear date filter"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <span className="text-xs text-white/30 ml-auto">{sorted.length} event{sorted.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Table */}
        <div className="rounded-xl overflow-hidden" style={cardStyle}>
          {isLoading ? (
            <div className="p-8 text-center text-white/40 text-sm">Loading events…</div>
          ) : sorted.length === 0 ? (
            <div className="p-8 text-center text-white/40 text-sm">No events found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(185,28,28,.15)' }}>
                    {/* Name */}
                    <th className="text-left px-4 py-3 text-xs text-white/40 uppercase tracking-wide font-medium">
                      Name
                    </th>
                    {/* Date — sortable */}
                    <th
                      className="text-left px-4 py-3 text-xs text-white/40 uppercase tracking-wide font-medium cursor-pointer select-none"
                      onClick={() => toggleSort('date')}
                    >
                      <span className="flex items-center gap-1">
                        Date <SortIcon active={sortKey === 'date'} dir={sortDir} />
                      </span>
                    </th>
                    <th className="text-left px-4 py-3 text-xs text-white/40 uppercase tracking-wide font-medium">Type</th>
                    <th className="text-left px-4 py-3 text-xs text-white/40 uppercase tracking-wide font-medium">Capacity</th>
                    {/* Attendance — sortable */}
                    <th
                      className="text-left px-4 py-3 text-xs text-white/40 uppercase tracking-wide font-medium cursor-pointer select-none"
                      onClick={() => toggleSort('attendance')}
                    >
                      <span className="flex items-center gap-1">
                        Attendance <SortIcon active={sortKey === 'attendance'} dir={sortDir} />
                      </span>
                    </th>
                    {/* Fill % — sortable */}
                    <th
                      className="text-left px-4 py-3 text-xs text-white/40 uppercase tracking-wide font-medium cursor-pointer select-none"
                      onClick={() => toggleSort('fill')}
                    >
                      <span className="flex items-center gap-1">
                        Fill % <SortIcon active={sortKey === 'fill'} dir={sortDir} />
                      </span>
                    </th>
                    <th className="text-left px-4 py-3 text-xs text-white/40 uppercase tracking-wide font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((e) => {
                    const fillPct =
                      e.capacity && typeof e.attendance_count === 'number'
                        ? Math.round((e.attendance_count / e.capacity) * 100)
                        : null;
                    const past = isPast(e);

                    return (
                      <tr
                        key={e.event_id}
                        className="transition-colors hover:bg-white/[0.02]"
                        style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}
                      >
                        <td className="px-4 py-3">
                          <p className="text-white font-medium">{e.name}</p>
                          {e.location && (
                            <p className="text-xs text-white/30">{e.location}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-white/60 whitespace-nowrap">
                          {formatDate(e.starts_at)}
                          {past && (
                            <span className="ml-1 text-white/25">(past)</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(185,28,28,.15)', color: 'rgba(248,113,113,.8)' }}
                          >
                            {e.event_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-white/60">
                          {e.capacity ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-white/70">
                          {typeof e.attendance_count === 'number' ? e.attendance_count : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {fillPct !== null ? (
                            <div className="flex items-center gap-2">
                              <div
                                className="h-1.5 w-16 rounded-full overflow-hidden"
                                style={{ background: 'rgba(255,255,255,.1)' }}
                              >
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${Math.min(fillPct, 100)}%`,
                                    background: fillPct >= 80
                                      ? 'rgba(185,28,28,.8)'
                                      : fillPct >= 50
                                      ? 'rgba(250,204,21,.7)'
                                      : 'rgba(74,222,128,.7)',
                                  }}
                                />
                              </div>
                              <span className="text-white/60 text-xs">{fillPct}%</span>
                            </div>
                          ) : (
                            <span className="text-white/30 text-xs">N/A</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setAttendanceEvent(e)}
                            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-colors text-white/60 hover:text-white whitespace-nowrap"
                            style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)' }}
                          >
                            <BarChart2 size={11} />
                            Attendance
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
