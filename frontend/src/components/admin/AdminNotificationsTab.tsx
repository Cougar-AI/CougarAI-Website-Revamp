import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Plus, Edit2, Trash2, X, Play, CheckCircle, XCircle, Clock } from 'lucide-react';
import { formatDate, formatDateTimeFull } from '@/lib/dates';

const BACKEND = (import.meta.env.VITE_BACKEND_API_URL ?? 'http://localhost:5001').replace(/\/$/, '');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TYPES = ['progress_report_reminder', 'event_reminder'] as const;
type ScheduleType = typeof TYPES[number];

interface Schedule {
  schedule_id: number;
  name: string;
  type: ScheduleType;
  is_active: boolean;
  send_email: boolean;
  send_in_app: boolean;
  cron_day_of_week: number | null;
  cron_hour: number | null;
  cron_minute: number | null;
  hours_before: number | null;
  target_roles: string[];
  subject: string | null;
  body_template: string | null;
  created_at: string;
  updated_at: string;
  last_sent: string | null;
  last_status: string | null;
}

interface LogEntry {
  log_id: number;
  schedule_id: number | null;
  schedule_name: string | null;
  sent_at: string;
  recipients_count: number;
  status: string;
  error_message: string | null;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${BACKEND}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...opts.headers },
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

const glass = {
  background: 'rgba(255,255,255,.04)',
  border: '1px solid rgba(185,28,28,.22)',
  backdropFilter: 'blur(10px)',
} as const;

function scheduleDescription(s: Schedule) {
  if (s.type === 'progress_report_reminder') {
    const day = DAYS[s.cron_day_of_week ?? 0];
    const h = String(s.cron_hour ?? 9).padStart(2, '0');
    const m = String(s.cron_minute ?? 0).padStart(2, '0');
    const ampm = parseInt(h) < 12 ? 'AM' : 'PM';
    const h12 = parseInt(h) % 12 || 12;
    return `Every ${day} at ${h12}:${m} ${ampm}`;
  }
  if (s.type === 'event_reminder') {
    return `${s.hours_before ?? 2}h before event starts`;
  }
  return s.type;
}

// ── Schedule Modal ─────────────────────────────────────────────────────────────
function ScheduleModal({ schedule, onClose, onSaved }: {
  schedule: Schedule | null; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: schedule?.name ?? '',
    type: schedule?.type ?? 'progress_report_reminder' as ScheduleType,
    is_active: schedule?.is_active ?? true,
    send_in_app: schedule?.send_in_app ?? true,
    send_email: schedule?.send_email ?? false,
    cron_day_of_week: schedule?.cron_day_of_week?.toString() ?? '0',
    cron_hour: schedule?.cron_hour?.toString() ?? '9',
    cron_minute: schedule?.cron_minute?.toString() ?? '0',
    hours_before: schedule?.hours_before?.toString() ?? '2',
    target_roles: schedule?.target_roles ?? ['officer', 'admin'],
    subject: schedule?.subject ?? '',
    body_template: schedule?.body_template ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function toggleRole(role: string) {
    setForm(f => ({
      ...f,
      target_roles: f.target_roles.includes(role)
        ? f.target_roles.filter(r => r !== role)
        : [...f.target_roles, role],
    }));
  }

  async function save() {
    setSaving(true); setError('');
    try {
      const body = {
        name: form.name.trim(),
        type: form.type,
        is_active: form.is_active,
        send_in_app: form.send_in_app,
        send_email: form.send_email,
        cron_day_of_week: form.type === 'progress_report_reminder' ? parseInt(form.cron_day_of_week) : null,
        cron_hour: form.type === 'progress_report_reminder' ? parseInt(form.cron_hour) : null,
        cron_minute: form.type === 'progress_report_reminder' ? parseInt(form.cron_minute) : null,
        hours_before: form.type === 'event_reminder' ? parseInt(form.hours_before) : null,
        target_roles: form.target_roles,
        subject: form.subject || null,
        body_template: form.body_template || null,
      };
      if (schedule) {
        await apiFetch(`/notifications/schedules/${schedule.schedule_id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await apiFetch('/notifications/schedules', { method: 'POST', body: JSON.stringify(body) });
      }
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error saving');
    } finally {
      setSaving(false);
    }
  }

  const placeholders: Record<ScheduleType, string[]> = {
    progress_report_reminder: ['{officer_name}'],
    event_reminder: ['{recipient_name}', '{event_name}', '{event_date}', '{event_location}'],
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.7)' }}>
      <div className="w-full max-w-xl rounded-2xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
        style={{ ...glass, border: '1px solid rgba(185,28,28,.4)' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold font-['Oxanium']">
            {schedule ? 'Edit Schedule' : 'New Notification Schedule'}
          </h3>
          <button onClick={onClose}><X size={16} className="text-white/50" /></button>
        </div>
        {error && <div className="text-red-400 text-sm">{error}</div>}

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-white/60 text-xs">Name *</label>
            <input className="bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-red-700"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Monday Progress Reminder" />
          </div>

          {!schedule && (
            <div className="flex flex-col gap-1">
              <label className="text-white/60 text-xs">Type</label>
              <select className="bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-red-700"
                value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as ScheduleType }))}>
                <option value="progress_report_reminder">Progress Report Reminder</option>
                <option value="event_reminder">Event Reminder</option>
              </select>
            </div>
          )}

          {/* Type-specific fields */}
          {form.type === 'progress_report_reminder' && (
            <div className="rounded-lg p-3 flex flex-col gap-3" style={{ background: 'rgba(255,255,255,.04)' }}>
              <div className="text-white/50 text-xs font-semibold uppercase tracking-wide">Schedule</div>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-white/60 text-xs">Day of Week</label>
                  <select className="bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-red-700"
                    value={form.cron_day_of_week} onChange={e => setForm(f => ({ ...f, cron_day_of_week: e.target.value }))}>
                    {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-white/60 text-xs">Hour (0–23)</label>
                  <input type="number" min="0" max="23"
                    className="bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-red-700"
                    value={form.cron_hour} onChange={e => setForm(f => ({ ...f, cron_hour: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-white/60 text-xs">Minute (0–59)</label>
                  <input type="number" min="0" max="59"
                    className="bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-red-700"
                    value={form.cron_minute} onChange={e => setForm(f => ({ ...f, cron_minute: e.target.value }))} />
                </div>
              </div>
            </div>
          )}

          {form.type === 'event_reminder' && (
            <div className="rounded-lg p-3 flex flex-col gap-3" style={{ background: 'rgba(255,255,255,.04)' }}>
              <div className="text-white/50 text-xs font-semibold uppercase tracking-wide">Timing</div>
              <div className="flex items-center gap-3">
                <label className="text-white/60 text-xs whitespace-nowrap">Send</label>
                <input type="number" min="1" max="72"
                  className="bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-red-700 w-24"
                  value={form.hours_before} onChange={e => setForm(f => ({ ...f, hours_before: e.target.value }))} />
                <label className="text-white/60 text-xs whitespace-nowrap">hours before event starts</label>
              </div>
            </div>
          )}

          {/* Target roles */}
          <div className="flex flex-col gap-2">
            <label className="text-white/60 text-xs">Notify Roles</label>
            <div className="flex gap-2 flex-wrap">
              {['officer', 'admin', 'member'].map(role => (
                <button key={role} onClick={() => toggleRole(role)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
                  style={form.target_roles.includes(role)
                    ? { background: 'rgba(185,28,28,.3)', color: 'rgba(248,113,113,.9)', borderColor: 'rgba(185,28,28,.5)' }
                    : { background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.5)', borderColor: 'rgba(255,255,255,.1)' }}>
                  {role.charAt(0).toUpperCase() + role.slice(1)}s
                </button>
              ))}
            </div>
          </div>

          {/* Delivery channels */}
          <div className="flex flex-col gap-2">
            <label className="text-white/60 text-xs">Delivery Channels</label>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={form.send_in_app}
                    onChange={e => setForm(f => ({ ...f, send_in_app: e.target.checked }))} />
                  <div className="w-10 h-5 rounded-full transition-colors"
                    style={{ background: form.send_in_app ? 'rgba(185,28,28,.7)' : 'rgba(255,255,255,.15)' }} />
                  <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                    style={{ transform: form.send_in_app ? 'translateX(20px)' : 'none' }} />
                </div>
                <div className="flex flex-col">
                  <span className="text-white/80 text-sm">In-App Notifications</span>
                  <span className="text-white/40 text-xs">Shown in the navbar bell icon</span>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={form.send_email}
                    onChange={e => setForm(f => ({ ...f, send_email: e.target.checked }))} />
                  <div className="w-10 h-5 rounded-full transition-colors"
                    style={{ background: form.send_email ? 'rgba(185,28,28,.7)' : 'rgba(255,255,255,.15)' }} />
                  <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                    style={{ transform: form.send_email ? 'translateX(20px)' : 'none' }} />
                </div>
                <div className="flex flex-col">
                  <span className="text-white/80 text-sm">Email Notifications</span>
                  <span className="text-white/40 text-xs">Requires SMTP configured in backend</span>
                </div>
              </label>
            </div>
          </div>

          {/* Email content */}
          <div className="flex flex-col gap-1">
            <label className="text-white/60 text-xs">Subject / Notification Title</label>
            <input className="bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-red-700"
              value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              placeholder={form.type === 'progress_report_reminder' ? 'Reminder: Progress Report Due' : 'Reminder: {event_name} is coming up!'} />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-white/60 text-xs">Body Template</label>
              <span className="text-white/30 text-xs">
                Placeholders: {placeholders[form.type].join(', ')}
              </span>
            </div>
            <textarea rows={5}
              className="bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-red-700 resize-none font-mono"
              value={form.body_template} onChange={e => setForm(f => ({ ...f, body_template: e.target.value }))}
              placeholder="Leave blank to use the default template." />
          </div>

          {/* Active toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input type="checkbox" className="sr-only" checked={form.is_active}
                onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
              <div className="w-10 h-5 rounded-full transition-colors"
                style={{ background: form.is_active ? 'rgba(185,28,28,.7)' : 'rgba(255,255,255,.15)' }} />
              <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                style={{ transform: form.is_active ? 'translateX(20px)' : 'none' }} />
            </div>
            <span className="text-white/60 text-sm">Active</span>
          </label>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white">Cancel</button>
          <button onClick={save} disabled={saving || !form.name.trim()}
            className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-red-700 hover:bg-red-800 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main tab ───────────────────────────────────────────────────────────────────
export default function AdminNotificationsTab() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testMsg, setTestMsg] = useState<{ id: number; ok: boolean; msg: string } | null>(null);

  const schedulesQuery = useQuery<{ schedules: Schedule[] }>({
    queryKey: ['notification-schedules'],
    queryFn: () => apiFetch('/notifications/schedules'),
  });
  const schedules = schedulesQuery.data?.schedules ?? [];

  const logsQuery = useQuery<{ logs: LogEntry[] }>({
    queryKey: ['notification-logs'],
    queryFn: () => apiFetch('/notifications/logs'),
  });
  const logs = logsQuery.data?.logs ?? [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['notification-schedules'] });
    qc.invalidateQueries({ queryKey: ['notification-logs'] });
  };

  const deleteSchedule = useMutation({
    mutationFn: (id: number) => apiFetch(`/notifications/schedules/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      apiFetch(`/notifications/schedules/${id}`, { method: 'PATCH', body: JSON.stringify({ is_active }) }),
    onSuccess: invalidate,
  });

  async function sendTest(id: number) {
    setTestingId(id); setTestMsg(null);
    try {
      await apiFetch(`/notifications/schedules/${id}/test`, { method: 'POST' });
      setTestMsg({ id, ok: true, msg: 'Test sent! Check the bell icon / email / console logs.' });
    } catch (e: unknown) {
      setTestMsg({ id, ok: false, msg: e instanceof Error ? e.message : 'Error' });
    } finally {
      setTestingId(null);
      invalidate();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Schedules */}
      <div className="rounded-xl p-5 flex flex-col gap-4" style={glass}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-white font-semibold font-['Oxanium'] text-sm flex items-center gap-2">
            <Bell size={16} className="text-red-400" /> Notification Schedules
          </h2>
          <button onClick={() => { setEditSchedule(null); setShowModal(true); }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-red-700 hover:bg-red-800 transition-colors">
            <Plus size={13} /> New Schedule
          </button>
        </div>

        {schedules.length === 0 ? (
          <p className="text-white/30 text-sm text-center py-8">
            No notification schedules yet. Create one to start sending automated emails.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {schedules.map(s => (
              <div key={s.schedule_id} className="rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                style={{ background: 'rgba(255,255,255,.05)' }}>
                <div className="flex-1 flex flex-col gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-medium text-sm">{s.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: s.type === 'progress_report_reminder' ? 'rgba(59,130,246,.2)' : 'rgba(168,85,247,.2)',
                        color: s.type === 'progress_report_reminder' ? 'rgba(147,197,253,.9)' : 'rgba(216,180,254,.9)' }}>
                      {s.type === 'progress_report_reminder' ? 'Progress Report' : 'Event Reminder'}
                    </span>
                    {s.last_status && (
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={s.last_status === 'sent'
                          ? { background: 'rgba(16,185,129,.2)', color: 'rgba(110,231,183,.9)' }
                          : { background: 'rgba(239,68,68,.2)', color: 'rgba(252,165,165,.9)' }}>
                        Last: {s.last_status}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-white/40 text-xs">
                    <Clock size={11} />
                    {scheduleDescription(s)}
                    {s.last_sent && <span>· Sent {formatDate(s.last_sent)}</span>}
                  </div>
                  <div className="flex items-center gap-2 text-white/30 text-xs flex-wrap">
                    <span>Notifies: {(s.target_roles ?? []).join(', ')}</span>
                    {s.send_in_app && (
                      <span className="px-1.5 py-0.5 rounded text-[10px]"
                        style={{ background: 'rgba(99,102,241,.2)', color: 'rgba(165,180,252,.9)' }}>
                        In-App
                      </span>
                    )}
                    {s.send_email && (
                      <span className="px-1.5 py-0.5 rounded text-[10px]"
                        style={{ background: 'rgba(20,184,166,.2)', color: 'rgba(94,234,212,.9)' }}>
                        Email
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Active toggle */}
                  <button onClick={() => toggleActive.mutate({ id: s.schedule_id, is_active: !s.is_active })}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all border"
                    style={s.is_active
                      ? { background: 'rgba(16,185,129,.15)', color: 'rgba(110,231,183,.9)', borderColor: 'rgba(16,185,129,.3)' }
                      : { background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.4)', borderColor: 'rgba(255,255,255,.1)' }}>
                    {s.is_active ? <CheckCircle size={11} /> : <XCircle size={11} />}
                    {s.is_active ? 'Active' : 'Paused'}
                  </button>

                  {/* Test */}
                  <button onClick={() => sendTest(s.schedule_id)} disabled={testingId === s.schedule_id}
                    className="p-1.5 rounded-lg hover:bg-blue-900/30 transition-colors disabled:opacity-50"
                    title="Send test now">
                    <Play size={13} className="text-blue-400" />
                  </button>

                  {/* Edit */}
                  <button onClick={() => { setEditSchedule(s); setShowModal(true); }}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                    <Edit2 size={13} className="text-white/50" />
                  </button>

                  {/* Delete */}
                  <button onClick={() => { if (confirm(`Delete schedule "${s.name}"?`)) deleteSchedule.mutate(s.schedule_id); }}
                    className="p-1.5 rounded-lg hover:bg-red-900/30 transition-colors">
                    <Trash2 size={13} className="text-red-400/60" />
                  </button>
                </div>

                {/* Test result */}
                {testMsg?.id === s.schedule_id && (
                  <div className="w-full text-xs mt-1"
                    style={{ color: testMsg.ok ? 'rgba(110,231,183,.9)' : 'rgba(252,165,165,.9)' }}>
                    {testMsg.msg}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent logs */}
      <div className="rounded-xl p-5 flex flex-col gap-4" style={glass}>
        <h2 className="text-white font-semibold font-['Oxanium'] text-sm flex items-center gap-2">
          <Clock size={16} className="text-red-400" /> Recent Logs
        </h2>
        {logs.length === 0 ? (
          <p className="text-white/30 text-sm text-center py-4">No logs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white/40 uppercase tracking-wide border-b border-white/10">
                  <th className="text-left py-2 font-medium">Time</th>
                  <th className="text-left py-2 font-medium">Schedule</th>
                  <th className="text-left py-2 font-medium">Status</th>
                  <th className="text-right py-2 font-medium">Recipients</th>
                  <th className="text-left py-2 font-medium">Error</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.log_id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-2 text-white/50">{formatDateTimeFull(l.sent_at)}</td>
                    <td className="py-2 text-white/70">{l.schedule_name ?? '(deleted)'}</td>
                    <td className="py-2">
                      <span className="px-2 py-0.5 rounded-full text-xs"
                        style={l.status === 'sent'
                          ? { background: 'rgba(16,185,129,.2)', color: 'rgba(110,231,183,.9)' }
                          : l.status === 'skipped'
                          ? { background: 'rgba(245,158,11,.2)', color: 'rgba(253,230,138,.9)' }
                          : { background: 'rgba(239,68,68,.2)', color: 'rgba(252,165,165,.9)' }}>
                        {l.status}
                      </span>
                    </td>
                    <td className="py-2 text-white/70 text-right">{l.recipients_count}</td>
                    <td className="py-2 text-red-400/70 max-w-[200px] truncate">{l.error_message ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <ScheduleModal schedule={editSchedule} onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); invalidate(); }} />
      )}
    </div>
  );
}
