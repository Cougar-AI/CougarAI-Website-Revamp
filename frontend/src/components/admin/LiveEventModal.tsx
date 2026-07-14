import { useQuery } from '@tanstack/react-query';
import { Radio, X } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { formatTime } from '@/lib/dates';
import type { Event, AttendanceResponse } from './events.types';

export default function LiveEventModal({ event, onClose }: { event: Event; onClose: () => void }) {
  const { data, isLoading } = useQuery<AttendanceResponse>({
    queryKey: ['admin-attendance', event.event_id],
    queryFn: () => apiGet<AttendanceResponse>(`/admin/events/${event.event_id}/attendance`),
    refetchInterval: 5000,
    staleTime: 0,
  });

  const fillPct = data?.capacity ? Math.min(100, Math.round((data.attendance_count / data.capacity) * 100)) : null;
  const totalPoints = data?.attendees.reduce((s, a) => s + (a.points ?? 0), 0) ?? 0;
  const recent = data?.attendees.slice().reverse().slice(0, 10) ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,.92)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-3xl p-8 flex flex-col gap-6"
        style={{ background: 'rgba(8,0,0,.98)', border: '1px solid rgba(185,28,28,.4)', boxShadow: '0 40px 120px rgba(0,0,0,.8)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full animate-pulse"
                style={{ background: 'rgba(185,28,28,.25)', color: 'rgba(248,113,113,.9)' }}
              >
                <Radio size={10} /> LIVE
              </span>
            </div>
            <h2 className="text-xl font-bold text-white font-['Oxanium']">{event.name}</h2>
            <p className="text-xs text-white/40 mt-0.5">Refreshing every 5 seconds</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/70 transition-colors mt-1">
            <X size={20} />
          </button>
        </div>

        {/* Big count */}
        <div className="text-center">
          <p className="text-7xl font-black text-white font-['Oxanium'] leading-none">
            {isLoading ? '—' : data?.attendance_count ?? 0}
          </p>
          <p className="text-sm text-white/40 mt-2">
            {data?.capacity ? `of ${data.capacity} capacity` : 'checked in'}
          </p>
          {fillPct !== null && (
            <div className="mt-3 mx-auto max-w-xs">
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.08)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${fillPct}%`,
                    background: fillPct >= 90 ? 'rgba(248,113,113,.8)' : fillPct >= 60 ? 'rgba(251,191,36,.8)' : 'rgba(74,222,128,.7)',
                  }}
                />
              </div>
              <p className="text-xs text-white/30 mt-1">{fillPct}% full</p>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(185,28,28,.15)' }}>
            <p className="text-2xl font-bold text-white font-['Oxanium']">{totalPoints}</p>
            <p className="text-xs text-white/40">Points awarded</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(185,28,28,.15)' }}>
            <p className="text-2xl font-bold text-white font-['Oxanium']">{data?.attendees.length ?? 0}</p>
            <p className="text-xs text-white/40">Total attendees</p>
          </div>
        </div>

        {/* Recent check-ins */}
        <div>
          <p className="text-xs text-white/40 uppercase tracking-wide mb-2">Most recent check-ins</p>
          {!recent.length ? (
            <p className="text-xs text-white/30 text-center py-4">No check-ins yet</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {recent.map((a, i) => (
                <div
                  key={a.checkin_id}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2"
                  style={{ background: i === 0 ? 'rgba(185,28,28,.12)' : 'rgba(255,255,255,.03)', border: i === 0 ? '1px solid rgba(185,28,28,.2)' : '1px solid transparent' }}
                >
                  <div
                    className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: 'rgba(185,28,28,.25)', color: 'rgba(248,113,113,.8)' }}
                  >
                    {a.first_name?.[0] ?? a.student_id?.[0] ?? '?'}
                  </div>
                  <span className="flex-1 text-sm text-white/80 truncate">
                    {a.first_name && a.last_name ? `${a.first_name} ${a.last_name}` : a.student_id ?? 'Unknown'}
                  </span>
                  <span className="text-xs text-white/30">
                    {a.checked_in_at ? formatTime(a.checked_in_at) : ''}
                  </span>
                  {a.points !== null && <span className="text-xs text-green-400">+{a.points}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
