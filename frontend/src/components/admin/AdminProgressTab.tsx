import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDate } from '@/lib/dates';

interface ProgressReport {
  report_id: number;
  user_id: number;
  week_of: string;
  summary: string | null;
  tasks_completed: string | null;
  tasks_in_progress: string | null;
  tasks_on_hold: string | null;
  upcoming_tasks: string | null;
  comments: string | null;
  feedback: string | null;
  questions: string | null;
  submitted_at: string | null;
  updated_at: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

interface OfficerStatus {
  user_id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  submitted: boolean;
  submitted_at: string | null;
  overdue: boolean;
}

interface StatusResponse {
  week_of: string;
  deadline: string;
  is_overdue: boolean;
  officers: OfficerStatus[];
}

const REPORT_FIELDS = [
  { key: 'summary', label: 'Summary' },
  { key: 'tasks_completed', label: 'Tasks Completed' },
  { key: 'tasks_in_progress', label: 'Tasks In Progress' },
  { key: 'tasks_on_hold', label: 'Tasks On Hold' },
  { key: 'upcoming_tasks', label: 'Upcoming Tasks' },
  { key: 'comments', label: 'Comments' },
  { key: 'feedback', label: 'Feedback' },
  { key: 'questions', label: 'Questions' },
] as const;

type FieldKey = typeof REPORT_FIELDS[number]['key'];

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

function mondayOf(d: Date): Date {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  return mon;
}

function fmtDate(iso: string) {
  return formatDate(iso);
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

const DRAFT_KEY = (weekOf: string, userId: number) => `progress_draft_${userId}_${weekOf}`;

// --------------------------------------------------------------------------
// My Report view
// --------------------------------------------------------------------------
function MyReport({ userId }: { userId: number }) {
  const qc = useQueryClient();
  const [currentWeek, setCurrentWeek] = useState(() => mondayOf(new Date()));
  const weekIso = isoDate(currentWeek);

  const [form, setForm] = useState<Record<FieldKey, string>>({
    summary: '', tasks_completed: '', tasks_in_progress: '', tasks_on_hold: '',
    upcoming_tasks: '', comments: '', feedback: '', questions: '',
  });
  const [editing, setEditing] = useState(false);

  // Fetch my reports list
  const { data: myData } = useQuery<{ reports: ProgressReport[] }>({
    queryKey: ['my-progress-reports'],
    queryFn: () => apiGet('/progress-reports/mine'),
    staleTime: 60_000,
  });

  const existingReport = myData?.reports.find((r) => r.week_of === weekIso) ?? null;

  // Load draft from localStorage or existing report
  useEffect(() => {
    const draft = localStorage.getItem(DRAFT_KEY(weekIso, userId));
    if (draft) {
      try { setForm(JSON.parse(draft)); } catch {}
    } else if (existingReport) {
      const loaded: Record<FieldKey, string> = {} as any;
      REPORT_FIELDS.forEach(({ key }) => { loaded[key] = existingReport[key] ?? ''; });
      setForm(loaded);
    } else {
      setForm({ summary: '', tasks_completed: '', tasks_in_progress: '', tasks_on_hold: '',
        upcoming_tasks: '', comments: '', feedback: '', questions: '' });
    }
    setEditing(!existingReport);
  }, [weekIso, existingReport?.report_id]);

  function updateField(key: FieldKey, val: string) {
    const updated = { ...form, [key]: val };
    setForm(updated);
    localStorage.setItem(DRAFT_KEY(weekIso, userId), JSON.stringify(updated));
  }

  const submitMutation = useMutation({
    mutationFn: () => apiPost('/progress-reports/', { week_of: weekIso, ...form }),
    onSuccess: () => {
      localStorage.removeItem(DRAFT_KEY(weekIso, userId));
      qc.invalidateQueries({ queryKey: ['my-progress-reports'] });
      qc.invalidateQueries({ queryKey: ['progress-status'] });
      setEditing(false);
    },
  });

  const prevWeek = () => { const d = new Date(currentWeek); d.setDate(d.getDate() - 7); setCurrentWeek(d); };
  const nextWeek = () => { const d = new Date(currentWeek); d.setDate(d.getDate() + 7); setCurrentWeek(d); };

  const deadline = new Date(currentWeek);
  deadline.setDate(deadline.getDate() + 7); // next Monday
  const isOverdue = new Date() >= deadline;
  const isCurrentWeek = isoDate(mondayOf(new Date())) === weekIso;

  return (
    <div className="flex flex-col gap-4">
      {/* Week nav */}
      <div className="flex items-center gap-3">
        <button onClick={prevWeek} className="p-1.5 rounded-lg text-white/50 hover:text-white" style={{ background: 'rgba(255,255,255,.06)' }}>
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1 text-center">
          <p className="text-sm font-medium text-white font-['Oxanium']">Week of {fmtDate(weekIso)}</p>
          {isCurrentWeek && (
            <p className={`text-xs ${isOverdue ? 'text-red-400' : 'text-white/40'}`}>
              {isOverdue ? 'Overdue — deadline passed' : `Due ${fmtDate(isoDate(deadline))}`}
            </p>
          )}
        </div>
        <button onClick={nextWeek} disabled={isCurrentWeek} className="p-1.5 rounded-lg text-white/50 hover:text-white disabled:opacity-30" style={{ background: 'rgba(255,255,255,.06)' }}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Status banner */}
      {existingReport && !editing && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl"
          style={{ background: 'rgba(21,128,61,.12)', border: '1px solid rgba(21,128,61,.2)' }}>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-green-400" />
            <span className="text-xs text-green-400">Submitted {existingReport.submitted_at ? fmtDate(existingReport.submitted_at) : ''}</span>
          </div>
          <button onClick={() => setEditing(true)} className="text-xs text-white/50 hover:text-white transition-colors">Edit</button>
        </div>
      )}

      {/* Form */}
      {editing ? (
        <div className="flex flex-col gap-3">
          {REPORT_FIELDS.map(({ key, label }) => (
            <div key={key} className="flex flex-col gap-1">
              <label className="text-xs text-white/50">{label}</label>
              <textarea
                rows={3}
                value={form[key]}
                onChange={(e) => updateField(key, e.target.value)}
                placeholder={`Enter ${label.toLowerCase()}…`}
                className="rounded-lg px-3 py-2 text-sm resize-y min-h-[60px]"
                style={inputStyle}
              />
            </div>
          ))}
          {submitMutation.isError && (
            <p className="text-red-400 text-xs">{(submitMutation.error as any)?.message ?? 'Failed to save'}</p>
          )}
          <div className="flex gap-3 justify-end">
            {existingReport && (
              <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-lg text-sm text-white/60" style={{ background: 'rgba(255,255,255,.06)' }}>
                Cancel
              </button>
            )}
            <button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
              className="px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
              style={{ background: 'rgba(185,28,28,.7)' }}
            >
              {submitMutation.isPending ? 'Saving…' : existingReport ? 'Save Changes' : 'Submit Report'}
            </button>
          </div>
        </div>
      ) : existingReport ? (
        <div className="flex flex-col gap-3">
          {REPORT_FIELDS.map(({ key, label }) =>
            existingReport[key] ? (
              <div key={key} className="rounded-xl p-4" style={cardStyle}>
                <p className="text-xs text-white/40 uppercase tracking-wide mb-2">{label}</p>
                <p className="text-sm text-white/80 whitespace-pre-wrap">{existingReport[key]}</p>
              </div>
            ) : null
          )}
          {REPORT_FIELDS.every(({ key }) => !existingReport[key]) && (
            <p className="text-sm text-white/30 text-center py-4">No content submitted.</p>
          )}
        </div>
      ) : (
        <div className="p-8 text-center rounded-xl" style={cardStyle}>
          <p className="text-white/30 text-sm mb-3">No report submitted for this week yet.</p>
          <button onClick={() => setEditing(true)} className="px-4 py-2 rounded-lg text-sm text-white" style={{ background: 'rgba(185,28,28,.6)' }}>
            Write Report
          </button>
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Team Reports view
// --------------------------------------------------------------------------
function TeamReports() {
  const qc = useQueryClient();
  const [currentWeek, setCurrentWeek] = useState(() => mondayOf(new Date()));
  const weekIso = isoDate(currentWeek);
  const [expandedUser, setExpandedUser] = useState<number | null>(null);

  const { data: statusData, isLoading: statusLoading } = useQuery<StatusResponse>({
    queryKey: ['progress-status', weekIso],
    queryFn: () => apiGet(`/progress-reports/status?week_of=${weekIso}`),
    staleTime: 60_000,
  });

  const { data: reportsData } = useQuery<{ reports: ProgressReport[] }>({
    queryKey: ['progress-reports-week', weekIso],
    queryFn: () => apiGet(`/progress-reports/?week_of=${weekIso}&limit=50`),
    staleTime: 60_000,
  });

  const prevWeek = () => { const d = new Date(currentWeek); d.setDate(d.getDate() - 7); setCurrentWeek(d); };
  const nextWeek = () => { const d = new Date(currentWeek); d.setDate(d.getDate() + 7); setCurrentWeek(d); };
  const isCurrentWeek = isoDate(mondayOf(new Date())) === weekIso;

  function getReport(userId: number): ProgressReport | null {
    return reportsData?.reports.find((r) => r.user_id === userId) ?? null;
  }

  const officers = statusData?.officers ?? [];
  const submitted = officers.filter((o) => o.submitted).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Week nav */}
      <div className="flex items-center gap-3">
        <button onClick={prevWeek} className="p-1.5 rounded-lg text-white/50 hover:text-white" style={{ background: 'rgba(255,255,255,.06)' }}>
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1 text-center">
          <p className="text-sm font-medium text-white font-['Oxanium']">Week of {fmtDate(weekIso)}</p>
          {!statusLoading && (
            <p className="text-xs text-white/40">{submitted} / {officers.length} submitted</p>
          )}
        </div>
        <button onClick={nextWeek} disabled={isCurrentWeek} className="p-1.5 rounded-lg text-white/50 hover:text-white disabled:opacity-30" style={{ background: 'rgba(255,255,255,.06)' }}>
          <ChevronRight size={16} />
        </button>
      </div>

      {statusLoading ? (
        <div className="p-8 text-center text-white/40 text-sm rounded-xl" style={cardStyle}>Loading…</div>
      ) : officers.length === 0 ? (
        <div className="p-8 text-center text-white/40 text-sm rounded-xl" style={cardStyle}>No active officers found.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {officers.map((o) => {
            const isExpanded = expandedUser === o.user_id;
            const report = getReport(o.user_id);
            const name = o.first_name ? `${o.first_name} ${o.last_name ?? ''}`.trim() : o.email;
            return (
              <div key={o.user_id} className="rounded-xl overflow-hidden" style={cardStyle}>
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpandedUser(isExpanded ? null : o.user_id)}
                  disabled={!o.submitted}
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{name}</p>
                    <p className="text-xs text-white/40">{o.email}</p>
                  </div>
                  {o.submitted ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-green-400 flex items-center gap-1">
                        <CheckCircle2 size={12} /> Submitted
                      </span>
                      {isExpanded ? <ChevronUp size={14} className="text-white/40" /> : <ChevronDown size={14} className="text-white/40" />}
                    </div>
                  ) : o.overdue ? (
                    <span className="text-xs text-red-400 flex items-center gap-1 shrink-0">
                      <XCircle size={12} /> Overdue
                    </span>
                  ) : (
                    <span className="text-xs text-white/30 flex items-center gap-1 shrink-0">
                      <Clock size={12} /> Not yet
                    </span>
                  )}
                </button>

                {isExpanded && report && (
                  <div className="px-4 pb-4 flex flex-col gap-3 border-t border-white/5 pt-3">
                    {REPORT_FIELDS.map(({ key, label }) =>
                      report[key] ? (
                        <div key={key}>
                          <p className="text-xs text-white/40 uppercase tracking-wide mb-1">{label}</p>
                          <p className="text-sm text-white/75 whitespace-pre-wrap">{report[key]}</p>
                        </div>
                      ) : null
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Main tab
// --------------------------------------------------------------------------
export default function AdminProgressTab() {
  const [view, setView] = useState<'my' | 'team'>('my');
  const user = getStoredUser();

  if (!user) return null;

  return (
    <div className="flex flex-col gap-4">
      {/* Header + sub-tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-white font-['Oxanium']">Progress Reports</h2>
          <p className="text-xs text-white/40">Weekly officer reports — due every Monday at 11:59pm</p>
        </div>
        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(185,28,28,.2)' }}>
          {(['my', 'team'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-4 py-1.5 text-xs font-medium transition-colors"
              style={view === v
                ? { background: 'rgba(185,28,28,.5)', color: '#fff' }
                : { background: 'transparent', color: 'rgba(255,255,255,.5)' }
              }
            >
              {v === 'my' ? 'My Report' : 'Team Reports'}
            </button>
          ))}
        </div>
      </div>

      {view === 'my' ? <MyReport userId={user.user_id} /> : <TeamReports />}
    </div>
  );
}
