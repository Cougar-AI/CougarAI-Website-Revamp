import { useQuery } from '@tanstack/react-query';
import { Download, X } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { formatDateTimeFull, formatTime } from '@/lib/dates';
import type { AttendanceResponse, Attendee } from './events.types';

export default function AttendanceDrawer({ eventId, onClose }: { eventId: number; onClose: () => void }) {
  const { data, isLoading } = useQuery<AttendanceResponse>({
    queryKey: ['admin-attendance', eventId],
    queryFn: () => apiGet<AttendanceResponse>(`/admin/events/${eventId}/attendance`),
    staleTime: 30_000,
  });

  function escapeCsvCell(val: string): string {
    // Prefix formula-triggering characters to prevent CSV injection in Excel/Sheets
    const escaped = /^[=+\-@\t\r]/.test(val) ? `'${val}` : val;
    return `"${escaped.replace(/"/g, '""')}"`;
  }

  function downloadCsv() {
    if (!data) return;
    const rows = [
      ['Name', 'Student ID', 'Checked In At', 'Points Awarded'],
      ...data.attendees.map((a: Attendee) => [
        a.first_name && a.last_name ? `${a.first_name} ${a.last_name}` : '',
        a.student_id != null ? String(a.student_id) : '',
        a.checked_in_at ? formatDateTimeFull(a.checked_in_at) : '',
        a.points !== null ? String(a.points) : '',
      ]),
    ];
    const csv = rows.map((r) => r.map(escapeCsvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateSuffix = new Date().toISOString().slice(0, 10);
    a.download = `attendance-${(data.event_name ?? 'event').replace(/[^a-z0-9]/gi, '-')}-${dateSuffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Stats derived from data
  const fillPct = data?.capacity ? Math.min(100, Math.round((data.attendance_count / data.capacity) * 100)) : null;

  // Avg minutes after event start
  let avgMinutes: number | null = null;
  if (data?.starts_at && data.attendees.length > 0) {
    const startMs = new Date(data.starts_at).getTime();
    const offsets = data.attendees
      .filter((a: Attendee) => a.checked_in_at)
      .map((a: Attendee) => (new Date(a.checked_in_at!).getTime() - startMs) / 60000);
    if (offsets.length > 0) avgMinutes = Math.round(offsets.reduce((s: number, v: number) => s + v, 0) / offsets.length);
  }

  // 5-minute bucket timeline
  const timeline = (() => {
    if (!data?.attendees.length) return [];
    const buckets: Record<number, number> = {};
    for (const a of data.attendees) {
      if (!a.checked_in_at) continue;
      const t = new Date(a.checked_in_at);
      const bucket = Math.floor(t.getTime() / (5 * 60 * 1000)) * 5 * 60 * 1000;
      buckets[bucket] = (buckets[bucket] ?? 0) + 1;
    }
    if (!Object.keys(buckets).length) return [];
    const sorted = Object.entries(buckets)
      .map(([ts, count]) => ({ ts: Number(ts), count }))
      .sort((a, b) => a.ts - b.ts);
    const maxCount = Math.max(...sorted.map((b) => b.count));
    return sorted.map((b) => ({ ...b, pct: Math.round((b.count / maxCount) * 100) }));
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md h-full flex flex-col"
        style={{ background: 'rgba(10,0,0,.97)', borderLeft: '1px solid rgba(185,28,28,.3)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(185,28,28,.15)' }}
        >
          <div>
            <h2 className="text-base font-bold text-white font-['Oxanium']">
              {data?.event_name ?? 'Attendance'}
            </h2>
            {data && (
              <p className="text-xs text-white/40">
                {data.attendance_count} checked in
                {data.capacity ? ` / ${data.capacity} capacity` : ''}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {data && data.attendees.length > 0 && (
              <button
                onClick={downloadCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all"
                style={{ background: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.6)', border: '1px solid rgba(255,255,255,.08)' }}
                title="Download CSV"
              >
                <Download size={12} /> CSV
              </button>
            )}
            <button onClick={onClose} className="text-white/40 hover:text-white/80"><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Stats panel */}
          {data && (
            <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(185,28,28,.1)' }}>
              <div className="flex items-center gap-4 mb-3">
                <div className="flex-1">
                  <p className="text-xs text-white/40 mb-1">Fill rate</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.08)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${fillPct ?? (data.attendance_count > 0 ? 100 : 0)}%`,
                          background: fillPct != null && fillPct >= 90
                            ? 'rgba(248,113,113,.8)'
                            : fillPct != null && fillPct >= 60
                            ? 'rgba(251,191,36,.8)'
                            : 'rgba(74,222,128,.7)',
                        }}
                      />
                    </div>
                    <span className="text-xs text-white/60 shrink-0">
                      {fillPct != null ? `${fillPct}%` : `${data.attendance_count}`}
                    </span>
                  </div>
                </div>
                {avgMinutes !== null && (
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-white/40">Avg check-in</p>
                    <p className="text-sm text-white/80">
                      {avgMinutes >= 0 ? `+${avgMinutes}m` : `${avgMinutes}m`}
                    </p>
                  </div>
                )}
              </div>

              {/* Timeline chart */}
              {timeline.length > 1 && (
                <div>
                  <p className="text-xs text-white/30 mb-2">Check-in timeline (5 min)</p>
                  <div className="flex items-end gap-0.5 h-10">
                    {timeline.map((b) => (
                      <div
                        key={b.ts}
                        className="flex-1 rounded-sm relative group"
                        style={{ height: `${Math.max(b.pct, 8)}%`, background: 'rgba(185,28,28,.5)', minWidth: 4 }}
                        title={`${formatTime(new Date(b.ts))}: ${b.count}`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-white/20">
                      {formatTime(new Date(timeline[0].ts))}
                    </span>
                    <span className="text-[10px] text-white/20">
                      {formatTime(new Date(timeline[timeline.length - 1].ts))}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Attendee list */}
          <div className="p-4">
            {isLoading ? (
              <p className="text-white/40 text-sm text-center py-8">Loading…</p>
            ) : !data?.attendees.length ? (
              <p className="text-white/40 text-sm text-center py-8">No attendees yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {data.attendees.map((a: Attendee, i: number) => (
                  <div
                    key={a.checkin_id}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                    style={{ background: 'rgba(255,255,255,.04)' }}
                  >
                    <span className="text-xs text-white/30 w-6 shrink-0 text-right">{i + 1}</span>
                    <div
                      className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: 'rgba(185,28,28,.3)', color: 'rgba(248,113,113,.9)' }}
                    >
                      {a.first_name?.[0] ?? a.student_id?.[0] ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">
                        {a.first_name && a.last_name ? `${a.first_name} ${a.last_name}` : a.student_id ?? 'Unknown'}
                      </p>
                      <p className="text-xs text-white/30">
                        {a.checked_in_at ? formatTime(a.checked_in_at) : ''}
                      </p>
                    </div>
                    {a.points !== null && (
                      <span className="text-xs text-green-400 font-medium">+{a.points}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
