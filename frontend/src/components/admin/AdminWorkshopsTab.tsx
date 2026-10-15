import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import { AlertTriangle, Boxes, Check, CheckCircle2, ChevronRight, Copy, Eraser, FileText, History, KeyRound, LoaderCircle, Play, Plus, RefreshCw, RotateCcw, Save, Search, Settings2, Trash2, Wrench, X } from 'lucide-react';
import { formatDateTimeFull } from '@/lib/dates';

type AnyRecord = Record<string, unknown>;

interface PendingConfirm {
  title: string;
  message: string;
  confirmLabel: string;
  items?: Array<{ label: string; value: string }>;
  note?: string;
  onConfirm: () => void;
}

const glass = {
  background: 'rgba(255,255,255,.04)',
  border: '1px solid rgba(185,28,28,.22)',
  backdropFilter: 'blur(10px)',
} as const;

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toStringValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function pickString(record: AnyRecord | null, keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = toStringValue(record[key]).trim();
    if (value) return value;
  }
  return null;
}

function pickNumber(record: AnyRecord | null, keys: string[]): number | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function extractArray(value: unknown, keys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];
  for (const key of keys) {
    const candidate = value[key];
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function stringifyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
}

function extractStringList(record: AnyRecord | null, keys: string[]): string[] {
  if (!record) return [];
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value.flatMap((item) => (typeof item === 'string' ? [item.trim()] : [])).filter(Boolean);
    }
    if (typeof value === 'string' && value.trim()) {
      return splitLines(value).filter(Boolean);
    }
  }
  return [];
}

function extractSingleText(record: AnyRecord | null, keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = toStringValue(record[key]).trim();
    if (value) return value;
  }
  return null;
}

function formatMaybeDate(value: unknown): string {
  // workshop-provision sends time.time() floats (epoch seconds)
  if (typeof value === 'number' && Number.isFinite(value)) return formatDateTimeFull(new Date(value * 1000));
  const text = toStringValue(value).trim();
  if (!text) return '';
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : formatDateTimeFull(text);
}

function describeWorkshopAction(path: string): string {
  if (path.includes('/pipeline/run')) return 'Full Pipeline';
  if (path.includes('/provision')) return 'Provision';
  if (path.includes('/teardown')) return 'Teardown';
  if (path.includes('/reset')) return 'Reset';
  if (path.includes('/image/prune')) return 'Prune Images';
  if (path.includes('/requirements/preview')) return 'Requirements Preview';
  if (path.includes('/requirements/add')) return 'Add Requirement';
  if (path.includes('/requirements/remove')) return 'Remove Requirement';
  if (path.includes('/requirements')) return 'Requirements';
  if (path.includes('/jobs/') && path.includes('/rerun')) return 'Job Rerun';
  if (path.includes('/jobs/')) return 'Job Lookup';
  if (path.includes('/status')) return 'Live Status';
  return 'Workshop Action';
}

const JOB_TYPE_LABELS = ['Provision', 'Teardown', 'Full Pipeline', 'Reset'] as const;

function normalizeJobType(job: AnyRecord): string {
  const raw = (pickString(job, ['type', 'job_type', 'task', 'action', 'name', 'job_name', 'title']) ?? '').toLowerCase();
  if (raw.includes('pipeline')) return 'Full Pipeline';
  if (raw.includes('provision')) return 'Provision';
  if (raw.includes('teardown')) return 'Teardown';
  if (raw.includes('reset')) return 'Reset';
  return JOB_TYPE_LABELS.find((label) => label.toLowerCase() === raw) ?? (raw ? raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Workshop Job');
}

type JobStatusTone = 'success' | 'failure' | 'pending';

function normalizeJobStatus(status: string): { label: string; tone: JobStatusTone } {
  const raw = status.toLowerCase();
  if (['success', 'succeeded', 'completed', 'complete', 'done', 'ok'].some((s) => raw.includes(s))) {
    return { label: status, tone: 'success' };
  }
  if (['fail', 'error', 'cancelled', 'canceled'].some((s) => raw.includes(s))) {
    return { label: status, tone: 'failure' };
  }
  return { label: status, tone: 'pending' };
}

// Same success/failure/pending hex values used elsewhere in this file
// (StatusPill, CurrentJobCard, JobGroupCard) and across the admin dashboard:
// success = #22c55e / #86efac, failure = #ef4444 / #f87171, pending = #f59e0b / #fde68a
const JOB_STATUS_STYLES: Record<JobStatusTone, { background: string; border: string; color: string }> = {
  success: { background: 'rgba(34,197,94,.14)', border: 'rgba(34,197,94,.24)', color: 'rgba(134,239,172,.95)' },
  failure: { background: 'rgba(239,68,68,.16)', border: 'rgba(239,68,68,.28)', color: 'rgba(248,113,113,.95)' },
  pending: { background: 'rgba(245,158,11,.16)', border: 'rgba(245,158,11,.28)', color: 'rgba(253,230,138,.9)' },
};

function groupJobsById(jobs: AnyRecord[]): Array<{ jobId: string; entries: AnyRecord[] }> {
  const order: string[] = [];
  const groups = new Map<string, AnyRecord[]>();
  jobs.forEach((job, index) => {
    const jobId = pickString(job, ['job_id', 'id', 'uuid', 'task_id']) ?? `unknown-${index}`;
    if (!groups.has(jobId)) {
      order.push(jobId);
      groups.set(jobId, []);
    }
    groups.get(jobId)!.push(job);
  });
  return order.map((jobId) => ({ jobId, entries: groups.get(jobId)! }));
}

function collectLogLines(value: unknown): string[] {
  const record = isRecord(value) ? value : null;
  const candidates = extractStringList(record, ['log', 'logs', 'log_lines', 'log_output', 'stdout', 'stderr', 'history']);

  if (candidates.length > 0) return candidates;

  if (record) {
    for (const key of ['logs', 'log', 'output', 'stdout', 'stderr']) {
      const raw = record[key];
      if (typeof raw === 'string') return splitLines(raw);
    }
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => (typeof item === 'string' ? splitLines(item) : [])).filter(Boolean);
  }

  return [];
}

function isJobActive(job: AnyRecord | null): boolean {
  const status = (pickString(job, ['status']) ?? '').toLowerCase();
  return status === 'queued' || status === 'running';
}

function trimLogs(lines: string[], maxLines = 40): string[] {
  return lines.slice(-maxLines);
}

function normalizePackageList(value: unknown): string[] {
  const items = extractArray(value, ['packages', 'requirements', 'items', 'data', 'results']);
  return items
    .flatMap((item) => {
      if (typeof item === 'string') return [item.trim()];
      if (isRecord(item)) {
        const candidate = pickString(item, ['package', 'name', 'spec', 'value']);
        if (candidate) return [candidate];
        return [stringifyJson(item)];
      }
      if (typeof item === 'number' || typeof item === 'boolean') return [String(item)];
      return [];
    })
    .filter(Boolean);
}

function normalizeJobList(value: unknown): AnyRecord[] {
  return extractArray(value, ['jobs', 'items', 'data', 'results']).filter(isRecord);
}

function ConfirmModal({ title, message, confirmLabel, items, note, onConfirm, onCancel }: PendingConfirm & { onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.82)', backdropFilter: 'blur(6px)' }} onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="w-full max-w-md rounded-2xl p-6 space-y-5" style={glass}>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg" style={{ background: 'rgba(185,28,28,.15)' }}><Trash2 size={16} className="text-red-300" /></div>
          <div>
            <h3 className="text-white font-semibold font-['Oxanium']">{title}</h3>
            <p className="text-xs text-white/35">This action will be sent to the workshop proxy.</p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-white/80 leading-relaxed">{message}</p>
          {items && items.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {items.map((item) => (
                <div key={item.label} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
                  <div className="text-white/35 text-[11px] uppercase tracking-wide">{item.label}</div>
                  <div className="text-white/90 mt-1 text-sm break-words">{item.value}</div>
                </div>
              ))}
            </div>
          )}
          {note && <p className="text-xs text-white/40 leading-relaxed">{note}</p>}
        </div>

        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="rounded-xl px-4 py-2 text-sm text-white/65 transition-colors" style={{ background: 'rgba(255,255,255,.06)' }}>Cancel</button>
          <button onClick={onConfirm} className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all" style={{ background: 'rgba(185,28,28,.72)', boxShadow: '0 0 20px rgba(185,28,28,.25)' }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// One collapsible dropdown per Job ID. Only the summary row (Job ID, Job Type,
// Status, Timestamp) renders when collapsed — full details (stage, args, logs,
// rerun, raw JSON) only render once expanded, so the list stays scannable as
// jobs accumulate instead of turning into a wall of always-open logs.
function JobGroupCard({ jobId, entries, onRerun }: { jobId: string; entries: AnyRecord[]; onRerun: (jobId: string) => void }) {
  const job = entries[0];
  const jobType = normalizeJobType(job);
  const rawStatus = pickString(job, ['status', 'state', 'phase']) ?? 'unknown';
  const { tone } = normalizeJobStatus(rawStatus);
  const statusStyle = JOB_STATUS_STYLES[tone];
  const started = formatMaybeDate(job.started_at ?? job.created_at);
  const updated = formatMaybeDate(job.updated_at ?? job.finished_at ?? job.completed_at);
  const error = pickString(job, ['error', 'error_message', 'message']);
  const stage = pickString(job, ['stage']);
  const stageIndex = pickNumber(job, ['stage_index']);
  const totalStages = pickNumber(job, ['total_stages']);
  const args = isRecord(job.args) ? job.args : null;
  const extraEntries = entries.slice(1);

  return (
    <details className="rounded-xl group" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
      <summary className="cursor-pointer list-none p-4 flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          <span className="text-[11px] uppercase tracking-wide px-2 py-1 rounded-full border shrink-0" style={{ background: 'rgba(185,28,28,.12)', color: 'rgba(248,113,113,.95)', borderColor: 'rgba(185,28,28,.18)' }}>{jobType}</span>
          <span className="text-sm font-semibold text-white truncate">Job {jobId}</span>
          <span className="text-[11px] uppercase tracking-wide px-2 py-1 rounded-full border shrink-0" style={{ background: statusStyle.background, color: statusStyle.color, borderColor: statusStyle.border }}>{rawStatus}</span>
        </div>
        <span className="text-xs text-white/35 shrink-0">{started || updated || 'n/a'}</span>
      </summary>

      <div className="px-4 pb-4 pt-1 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,.05)' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-3">
          <div>
            <div className="text-white/30 uppercase tracking-wide">Started</div>
            <div className="text-white/75 mt-1">{started || 'n/a'}</div>
          </div>
          <div>
            <div className="text-white/30 uppercase tracking-wide">Updated</div>
            <div className="text-white/75 mt-1">{updated || 'n/a'}</div>
          </div>
        </div>

        {(stage || stageIndex || totalStages) && (
          <div className="rounded-lg p-3 text-xs" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.05)' }}>
            <div className="text-white/30 uppercase tracking-wide">Stage</div>
            <div className="text-white/75 mt-1">{stage || 'n/a'}{stageIndex || totalStages ? ` (${stageIndex ?? 'n/a'} / ${totalStages ?? 'n/a'})` : ''}</div>
          </div>
        )}

        {trimLogs(collectLogLines(job)).length > 0 && (
          <div className="rounded-lg p-3" style={{ background: 'rgba(0,0,0,.25)', border: '1px solid rgba(255,255,255,.06)' }}>
            <div className="text-white/30 uppercase tracking-wide text-xs">Logs</div>
            <pre className="mt-2 overflow-auto text-[11px] text-white/70 leading-relaxed max-h-56 whitespace-pre-wrap break-words">{trimLogs(collectLogLines(job)).join('\n')}</pre>
          </div>
        )}

        {args && (
          <details className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.05)' }}>
            <summary className="cursor-pointer text-xs text-white/45 uppercase tracking-wide">Job args</summary>
            <pre className="mt-3 overflow-auto text-[11px] text-white/70 leading-relaxed max-h-48 whitespace-pre-wrap break-words">{stringifyJson(args)}</pre>
          </details>
        )}

        {error && <p className="text-xs text-rose-300/80">{error}</p>}

        <div className="flex items-center gap-2">
          <button onClick={() => onRerun(jobId)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all" style={{ background: 'rgba(185,28,28,.2)', border: '1px solid rgba(185,28,28,.28)' }}>
            <RotateCcw size={12} /> Rerun
          </button>
        </div>

        <details className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.05)' }}>
          <summary className="cursor-pointer text-xs text-white/45 uppercase tracking-wide">Raw job JSON</summary>
          <pre className="mt-3 overflow-auto text-[11px] text-white/70 leading-relaxed max-h-56 whitespace-pre-wrap break-words">{stringifyJson(job)}</pre>
        </details>

        {extraEntries.length > 0 && (
          <details className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.05)' }}>
            <summary className="cursor-pointer text-xs text-white/45 uppercase tracking-wide">{extraEntries.length} earlier {extraEntries.length === 1 ? 'entry' : 'entries'} for this Job ID</summary>
            <pre className="mt-3 overflow-auto text-[11px] text-white/70 leading-relaxed max-h-56 whitespace-pre-wrap break-words">{stringifyJson(extraEntries)}</pre>
          </details>
        )}
      </div>
    </details>
  );
}

const panel = { background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' } as const;
const inputStyle = { background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)' } as const;
const inputCls = 'w-full rounded-xl px-3 py-2 text-sm text-white outline-none transition focus:ring-2 focus:ring-red-500/50';
const primaryBtn = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed';
const primaryStyle = { background: 'rgba(185,28,28,.78)', boxShadow: '0 0 20px rgba(185,28,28,.25)' } as const;
const secondaryStyle = { background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.10)' } as const;

// Numbered, collapsible step. `summary` is what you see while it's collapsed.
function Section({ step, icon, title, summary, defaultOpen, children }: { step?: string; icon: ReactNode; title: string; summary?: ReactNode; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details open={defaultOpen} className="group rounded-2xl" style={glass}>
      <summary className="cursor-pointer list-none p-4 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2.5 text-white font-semibold font-['Oxanium']">
          <ChevronRight size={15} className="text-white/40 transition-transform group-open:rotate-90" />
          {step && <span className="text-[11px] rounded-md px-1.5 py-0.5 text-red-300" style={{ background: 'rgba(185,28,28,.18)' }}>{step}</span>}
          {icon}
          {title}
        </span>
        {summary && <span className="text-xs text-white/40 text-right truncate">{summary}</span>}
      </summary>
      <div className="px-4 pb-4 space-y-4">{children}</div>
    </details>
  );
}

function StatusPill({ tone, label, spinning }: { tone: JobStatusTone; label: string; spinning?: boolean }) {
  const style = JOB_STATUS_STYLES[tone];
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide px-2 py-1 rounded-full border shrink-0" style={{ background: style.background, color: style.color, borderColor: style.border }}>
      {spinning && <LoaderCircle size={11} className="animate-spin" />}
      {label}
    </span>
  );
}

function CopyValue({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl p-3 flex items-start justify-between gap-2" style={panel}>
      <div className="min-w-0">
        <div className="text-white/35 text-[11px] uppercase tracking-wide">{label}</div>
        <div className="text-white/90 mt-1 text-sm break-all">{value}</div>
      </div>
      <button
        type="button"
        onClick={() => { navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }}
        className="shrink-0 rounded-lg p-1.5 text-white/50 hover:text-white transition-colors"
        style={{ background: 'rgba(255,255,255,.06)' }}
        title={`Copy ${label.toLowerCase()}`}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
    </div>
  );
}

// The job currently being followed: progress, live logs, and — once a provision/pipeline
// succeeds — the student login details the workshop API attaches as `access`.
function CurrentJobCard({ job, jobId, loading, error }: { job: AnyRecord | null; jobId: string; loading: boolean; error: string | null }) {
  const logRef = useRef<HTMLPreElement>(null);
  const lines = trimLogs(collectLogLines(job), 200);
  const lastLine = lines[lines.length - 1];

  // Keep the newest log line in view while it streams.
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [lines.length, lastLine]);

  if (!jobId) {
    return <div className="rounded-xl p-4 text-sm text-white/40" style={panel}>No workshop jobs yet. Start one above and its progress and logs will show here.</div>;
  }
  if (!job) {
    return <div className="rounded-xl p-4 text-sm text-white/40" style={panel}>{error ? `Could not load job ${jobId}: ${error}` : loading ? `Loading job ${jobId}…` : `Job ${jobId}`}</div>;
  }

  const active = isJobActive(job);
  const rawStatus = pickString(job, ['status']) ?? 'unknown';
  const { tone } = normalizeJobStatus(rawStatus);
  const stage = pickString(job, ['stage']);
  const stageIndex = pickNumber(job, ['stage_index']) ?? 0;
  const totalStages = pickNumber(job, ['total_stages']) ?? 0;
  const progress = totalStages > 0 ? Math.min(100, Math.round(((tone === 'success' ? totalStages : Math.max(stageIndex - 1, 0)) / totalStages) * 100)) : 0;
  const started = formatMaybeDate(job.started_at ?? job.created_at);
  const finished = formatMaybeDate(job.finished_at);
  const exitCode = pickNumber(job, ['exit_code']);
  const access = isRecord(job.access) ? job.access : null;
  const loginUrl = pickString(access, ['login_url']);
  const username = pickString(access, ['username']);
  const password = pickString(access, ['password']);
  const connectionGroup = pickString(access, ['connection_group']);
  const instructions = pickString(access, ['access_instructions']);

  return (
    <div className="rounded-xl p-4 space-y-3" style={panel}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-white">{normalizeJobType(job)}</span>
          <span className="text-xs text-white/40 font-mono">{jobId}</span>
          <StatusPill tone={tone} label={rawStatus} spinning={active} />
        </div>
        <span className="text-xs text-white/35">{finished ? `Finished ${finished}` : started ? `Started ${started}` : ''}</span>
      </div>

      {totalStages > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-white/50">
            <span>{active ? `Stage ${stageIndex}/${totalStages}: ${stage ?? 'starting'}` : tone === 'success' ? `All ${totalStages} stage${totalStages === 1 ? '' : 's'} done` : `Stopped at stage ${stageIndex}/${totalStages}: ${stage ?? 'n/a'}${exitCode !== null ? ` (exit code ${exitCode})` : ''}`}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.06)' }}>
            <div className={`h-full rounded-full transition-all duration-500 ${active ? 'animate-pulse' : ''}`} style={{ width: `${active ? Math.max(progress, 5) : progress}%`, background: tone === 'failure' ? 'rgba(239,68,68,.8)' : tone === 'success' ? 'rgba(34,197,94,.8)' : 'rgba(245,158,11,.8)' }} />
          </div>
        </div>
      )}

      {access && tone === 'success' && (
        <div className="rounded-xl p-3 space-y-3" style={{ background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.2)' }}>
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-200"><KeyRound size={14} /> Student login details</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {loginUrl && <CopyValue label="Login URL" value={loginUrl} />}
            {username && <CopyValue label="Usernames" value={username} />}
            {password && <CopyValue label="Password" value={password} />}
          </div>
          <ol className="text-xs text-white/65 leading-relaxed list-decimal pl-4 space-y-0.5">
            <li>Open {loginUrl ? <a href={loginUrl} target="_blank" rel="noreferrer" className="text-red-300 underline">{loginUrl}</a> : 'the workshop login page'}.</li>
            <li>Sign in with an assigned account ({username ?? 'studentN'}) and the shared password.</li>
            <li>Click <span className="text-white/85">{connectionGroup ?? 'the workshop connection group'}</span>; you are routed to a free virtual machine desktop in the browser.</li>
          </ol>
          {instructions && !connectionGroup && <p className="text-xs text-white/45">{instructions}</p>}
        </div>
      )}

      <div className="rounded-lg" style={{ background: 'rgba(0,0,0,.3)', border: '1px solid rgba(255,255,255,.06)' }}>
        <div className="flex items-center justify-between px-3 pt-2 text-[11px] uppercase tracking-wide text-white/35">
          <span>Logs{active ? ' · live' : ''}</span>
          <span>{lines.length ? `last ${lines.length} lines` : ''}</span>
        </div>
        {lines.length > 0
          ? <pre ref={logRef} className="px-3 pb-3 pt-2 overflow-auto max-h-72 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-white/75">{lines.join('\n')}</pre>
          : <p className="px-3 pb-3 pt-2 text-xs text-white/35">{active ? 'Waiting for output…' : 'No log output.'}</p>}
      </div>
    </div>
  );
}

export default function AdminWorkshopsTab() {
  const qc = useQueryClient();
  const [students, setStudents] = useState('1');
  const [skipBuild, setSkipBuild] = useState(false);
  const [forceRebuild, setForceRebuild] = useState(false);
  const [pipelineRepoUrl, setPipelineRepoUrl] = useState('');
  const [cleanupScope, setCleanupScope] = useState<'all' | 'count'>('all');
  const [cleanupCount, setCleanupCount] = useState('1');
  const [packageInput, setPackageInput] = useState('');
  const [requirementsText, setRequirementsText] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [jobLookupInput, setJobLookupInput] = useState('');
  const [previewResult, setPreviewResult] = useState<unknown>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  // Poll fast while any job is queued/running so status + logs update without a manual refresh.
  const jobsQuery = useQuery<unknown>({
    queryKey: ['admin-workshops-jobs'],
    queryFn: () => apiGet('/admin/workshops/jobs'),
    staleTime: 2_000,
    refetchInterval: (query) => (normalizeJobList(query.state.data).some(isJobActive) ? 3_000 : 15_000),
  });
  const jobs = normalizeJobList(jobsQuery.data);
  const activeJobInList = jobs.find(isJobActive) ?? null;
  const statusQuery = useQuery<unknown>({
    queryKey: ['admin-workshops-status'],
    queryFn: () => apiGet('/admin/workshops/status'),
    staleTime: 2_000,
    refetchInterval: activeJobInList ? 5_000 : 30_000,
  });
  const requirementsQuery = useQuery<unknown>({ queryKey: ['admin-workshops-requirements'], queryFn: () => apiGet('/admin/workshops/requirements'), staleTime: 20_000 });
  // Only /jobs/<id> returns the log; the list endpoint strips it. Poll it until the job finishes.
  const selectedJobQuery = useQuery<unknown>({
    queryKey: ['admin-workshops-job', selectedJobId],
    queryFn: () => apiGet(`/admin/workshops/jobs/${encodeURIComponent(selectedJobId)}`),
    enabled: selectedJobId.trim().length > 0,
    staleTime: 1_000,
    refetchInterval: (query) => {
      if (query.state.error) return false;
      const job = isRecord(query.state.data) ? query.state.data : null;
      return !job || isJobActive(job) ? 2_000 : false;
    },
  });

  const selectedJob = isRecord(selectedJobQuery.data) ? selectedJobQuery.data : null;
  const selectedJobActive = isJobActive(selectedJob);
  const status = isRecord(statusQuery.data) ? statusQuery.data : null;
  const containerCount = pickNumber(status, ['container_count']) ?? (status ? extractArray(status.containers, ['containers']).length : null);
  const imageBuiltAt = formatMaybeDate(status?.image_built_at);
  const loadErrors = [
    statusQuery.error instanceof Error ? `Status: ${statusQuery.error.message}` : null,
    jobsQuery.error instanceof Error ? `Jobs: ${jobsQuery.error.message}` : null,
    requirementsQuery.error instanceof Error ? `Requirements: ${requirementsQuery.error.message}` : null,
  ].filter(Boolean) as string[];

  const requirementList = requirementsText.split('\n').map((line) => line.trim()).filter(Boolean);
  // The workshop API rebuilds the image whenever `packages` is sent, so only send it when the list was edited.
  const savedRequirementList = normalizePackageList(requirementsQuery.data);
  const requirementsChanged = requirementList.join('\n') !== savedRequirementList.join('\n');
  const changedPackages = requirementsChanged && requirementList.length ? requirementList : undefined;

  const studentCount = Math.floor(Number(students));
  const validStudentCount = Number.isFinite(studentCount) && studentCount > 0;
  const cleanupN = Math.floor(Number(cleanupCount));
  const validCleanupCount = cleanupScope === 'all' || (Number.isFinite(cleanupN) && cleanupN > 0);

  // The workshop API runs one container job at a time (409 otherwise); mirror that in the UI.
  const runningJob = selectedJobActive ? selectedJob : activeJobInList;
  const jobRunning = runningJob !== null;
  const runningJobLabel = runningJob ? `${normalizeJobType(runningJob)} job ${pickString(runningJob, ['job_id']) ?? ''} is ${pickString(runningJob, ['status']) ?? 'running'}` : '';

  useEffect(() => {
    setRequirementsText(normalizePackageList(requirementsQuery.data).join('\n'));
  }, [requirementsQuery.data]);

  // Resume on page load / tab switch: follow whatever job is running on the workshop host (even one
  // another officer started); if nothing is running, show the most recent job. A job the user looked
  // up by hand is kept until a new job starts.
  useEffect(() => {
    if (selectedJobActive) return;
    const target = activeJobInList ?? (selectedJobId ? null : jobs[0] ?? null);
    const targetId = target ? pickString(target, ['job_id']) : null;
    if (targetId && targetId !== selectedJobId) setSelectedJobId(targetId);
  }, [activeJobInList, jobs, selectedJobActive, selectedJobId]);

  // When the followed job finishes, pull fresh container status + job list once.
  const wasSelectedJobActive = useRef(false);
  useEffect(() => {
    if (wasSelectedJobActive.current && !selectedJobActive && selectedJob) {
      qc.invalidateQueries({ queryKey: ['admin-workshops-status'] });
      qc.invalidateQueries({ queryKey: ['admin-workshops-jobs'] });
    }
    wasSelectedJobActive.current = selectedJobActive;
  }, [selectedJobActive, selectedJob, qc]);

  const workshopMutation = useMutation({
    mutationFn: ({ method, path, body }: { method: 'POST' | 'PUT'; path: string; body?: unknown }) => (method === 'PUT' ? apiPut(path, body ?? {}) : apiPost(path, body ?? {})),
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-workshops-status'] });
      qc.invalidateQueries({ queryKey: ['admin-workshops-jobs'] });
      qc.invalidateQueries({ queryKey: ['admin-workshops-requirements'] });
      const record = isRecord(data) ? data : null;
      const actionTitle = describeWorkshopAction(vars.path);
      // Start following the job this action just queued so its logs stream into the Run section.
      const queuedJobId = pickString(record, ['job_id']);
      if (queuedJobId) setSelectedJobId(queuedJobId);
      setNotice({ kind: 'success', text: extractSingleText(record, ['message', 'detail']) ?? (queuedJobId ? `${actionTitle} started (job ${queuedJobId}).` : `${actionTitle} done.`) });
    },
    onError: (error, vars) => {
      setNotice({ kind: 'error', text: `${describeWorkshopAction(vars?.path ?? '')}: ${error instanceof Error ? error.message : 'request failed.'}` });
    },
  });

  const previewMutation = useMutation({
    mutationFn: (body: unknown) => apiPost('/admin/workshops/requirements/preview', body),
    onSuccess: (data) => setPreviewResult(data),
    onError: (error) => setNotice({ kind: 'error', text: `Preview: ${error instanceof Error ? error.message : 'request failed.'}` }),
  });

  const actionBusy = workshopMutation.isPending;

  function askConfirm(title: string, message: string, confirmLabel: string, onConfirm: () => void, items?: Array<{ label: string; value: string }>, note?: string) {
    setPendingConfirm({ title, message, confirmLabel, onConfirm, items, note });
  }

  function run(path: string, body?: unknown, method: 'POST' | 'PUT' = 'POST') {
    setNotice(null);
    workshopMutation.mutate({ method, path, body });
  }

  const sizePayload = { num_students: studentCount, num_containers: studentCount };
  const packagesLabel = changedPackages ? `${changedPackages.length} package${changedPackages.length === 1 ? '' : 's'} (edited, will be saved)` : `${savedRequirementList.length} saved package${savedRequirementList.length === 1 ? '' : 's'}`;

  function reviewPipeline() {
    if (!validStudentCount) return setNotice({ kind: 'error', text: 'Enter a student count of at least 1 in Setup.' });
    const repoUrl = pipelineRepoUrl.trim();
    askConfirm(
      'Run full pipeline',
      `Build the image and provision ${studentCount} VM${studentCount === 1 ? '' : 's'}. This usually takes about 10 minutes.`,
      'Start Pipeline',
      () => run('/admin/workshops/pipeline/run', { ...sizePayload, packages: changedPackages, skip_build: skipBuild, ...(repoUrl ? { repo_url: repoUrl } : {}) }),
      [
        { label: 'Students / VMs', value: String(studentCount) },
        { label: 'Image build', value: skipBuild ? 'Skipped' : 'Yes' },
        { label: 'GitHub repo', value: repoUrl || 'Default repo' },
        { label: 'Packages', value: packagesLabel },
      ],
    );
  }

  function submitProvision() {
    if (!validStudentCount) return setNotice({ kind: 'error', text: 'Enter a student count of at least 1 in Setup.' });
    if (containerCount !== null && studentCount <= containerCount) {
      return setNotice({ kind: 'error', text: `Provision adds VMs: the target (${studentCount}) must be more than the ${containerCount} already running. Use Full Pipeline to rebuild from scratch.` });
    }
    run('/admin/workshops/provision', { ...sizePayload, packages: changedPackages, force_rebuild: forceRebuild });
  }

  function confirmCleanup(kind: 'reset' | 'teardown') {
    if (!validCleanupCount) return setNotice({ kind: 'error', text: 'Enter how many VMs to include (at least 1).' });
    const verb = kind === 'reset' ? 'Reset' : 'Tear down';
    const scope = cleanupScope === 'all' ? (containerCount !== null ? `all ${containerCount} running VMs` : 'all running VMs') : `VMs workshop-1 to workshop-${cleanupN}`;
    askConfirm(
      `${verb} workshop VMs`,
      kind === 'reset' ? `Reset ${scope} to a clean state? Student work inside them is lost.` : `Remove ${scope} and their Guacamole connections? Students are disconnected.`,
      verb,
      () => run(`/admin/workshops/${kind}`, cleanupScope === 'all' ? { all: true } : { num_students: cleanupN, num_containers: cleanupN }),
      [{ label: 'Scope', value: scope }],
    );
  }

  function lookupJob() {
    const id = jobLookupInput.trim();
    if (id) setSelectedJobId(id);
  }

  function refreshAll() {
    qc.invalidateQueries({ queryKey: ['admin-workshops-status'] });
    qc.invalidateQueries({ queryKey: ['admin-workshops-jobs'] });
    qc.invalidateQueries({ queryKey: ['admin-workshops-requirements'] });
    if (selectedJobId) qc.invalidateQueries({ queryKey: ['admin-workshops-job', selectedJobId] });
  }

  const preview = isRecord(previewResult) ? previewResult : null;
  const blockedNote = jobRunning && <p className="text-xs text-amber-200/80">{runningJobLabel}. Wait for it to finish before starting another workshop job.</p>;

  return (
    <div className="space-y-4 p-6">
      {pendingConfirm && (
        <ConfirmModal
          {...pendingConfirm}
          onCancel={() => setPendingConfirm(null)}
          onConfirm={() => {
            pendingConfirm.onConfirm();
            setPendingConfirm(null);
          }}
        />
      )}

      {/* Header + live status strip */}
      <div className="rounded-2xl p-4 space-y-3" style={glass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg" style={{ background: 'rgba(185,28,28,.15)' }}><Wrench size={16} className="text-red-300" /></div>
            <div>
              <h2 className="font-['Oxanium'] text-xl font-bold text-white leading-tight">Workshops</h2>
              <p className="text-xs text-white/35">1. Set up · 2. Run and watch logs · 3. Reset or tear down when done</p>
            </div>
          </div>
          <button onClick={refreshAll} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-white/70 transition-colors" style={{ background: 'rgba(255,255,255,.06)' }}>
            <RefreshCw size={13} className={jobsQuery.isFetching || statusQuery.isFetching ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          <div className="rounded-xl px-3 py-2" style={panel}>
            <div className="text-white/35 text-[11px] uppercase tracking-wide">Workshop</div>
            <div className="mt-1">{runningJob ? <StatusPill tone="pending" label={`${normalizeJobType(runningJob)} running`} spinning /> : <StatusPill tone="success" label="Idle" />}</div>
          </div>
          <div className="rounded-xl px-3 py-2" style={panel}>
            <div className="text-white/35 text-[11px] uppercase tracking-wide">VMs running</div>
            <div className="text-white font-semibold font-['Oxanium'] text-lg leading-tight mt-0.5">{containerCount ?? '—'}</div>
          </div>
          <div className="rounded-xl px-3 py-2" style={panel}>
            <div className="text-white/35 text-[11px] uppercase tracking-wide">Image built</div>
            <div className="text-white/80 text-xs mt-1">{imageBuiltAt || 'Not built'}</div>
          </div>
          <div className="rounded-xl px-3 py-2" style={panel}>
            <div className="text-white/35 text-[11px] uppercase tracking-wide">Status checked</div>
            <div className="text-white/80 text-xs mt-1">{statusQuery.dataUpdatedAt ? new Date(statusQuery.dataUpdatedAt).toLocaleTimeString() : '—'}</div>
          </div>
        </div>

        {notice && (
          <div className={`flex items-start justify-between gap-3 rounded-xl px-3 py-2 text-sm ${notice.kind === 'error' ? 'text-rose-300' : 'text-emerald-300'}`} style={panel}>
            <span className="inline-flex items-start gap-2">{notice.kind === 'error' ? <AlertTriangle size={15} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={15} className="mt-0.5 shrink-0" />}{notice.text}</span>
            <button onClick={() => setNotice(null)} className="text-white/40 hover:text-white/80" aria-label="Dismiss"><X size={14} /></button>
          </div>
        )}
        {loadErrors.map((error) => <p key={error} className="text-xs text-rose-300">{error}</p>)}
      </div>

      {/* 1 · Setup */}
      <Section
        step="1"
        icon={<Settings2 size={15} className="text-red-300" />}
        title="Setup"
        summary={`${validStudentCount ? studentCount : '?'} student${studentCount === 1 ? '' : 's'} · ${pipelineRepoUrl.trim() ? 'custom repo' : 'default repo'} · ${packagesLabel}`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-3">
          <label className="block">
            <span className="block text-[11px] uppercase tracking-wide text-white/35 mb-1.5">Students (1 VM each)</span>
            <input type="number" min="1" value={students} onChange={(e) => setStudents(e.target.value)} className={inputCls} style={inputStyle} />
          </label>
          <label className="block">
            <span className="block text-[11px] uppercase tracking-wide text-white/35 mb-1.5">GitHub repo cloned into each VM (pipeline only)</span>
            <input type="url" value={pipelineRepoUrl} onChange={(e) => setPipelineRepoUrl(e.target.value)} placeholder="Default repo, or https://github.com/owner/repo" className={inputCls} style={inputStyle} />
          </label>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] uppercase tracking-wide text-white/35">Python requirements (one per line)</span>
            {requirementsChanged && <span className="text-[11px] text-amber-200/80">Edited: save now, or it is sent with the next run (and triggers an image build).</span>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_15rem] gap-3">
            <textarea value={requirementsText} onChange={(e) => { setRequirementsText(e.target.value); setPreviewResult(null); }} rows={7} placeholder="numpy&#10;pandas==2.2" className="w-full rounded-xl px-3 py-2 text-sm text-white outline-none resize-y leading-relaxed font-mono" style={inputStyle} />
            <div className="space-y-2">
              <div className="flex gap-2">
                <input type="text" value={packageInput} onChange={(e) => setPackageInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && packageInput.trim()) run('/admin/workshops/requirements/add', { package: packageInput.trim() }); }} placeholder="Add package" className={inputCls} style={inputStyle} />
                <button onClick={() => packageInput.trim() && run('/admin/workshops/requirements/add', { package: packageInput.trim() })} disabled={actionBusy || !packageInput.trim()} className={primaryBtn} style={secondaryStyle} title="Add to saved list"><Plus size={14} /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => run('/admin/workshops/requirements', { packages: requirementList }, 'PUT')} disabled={actionBusy || !requirementsChanged} className={primaryBtn} style={primaryStyle}><Save size={14} /> Save</button>
                <button onClick={() => previewMutation.mutate({ packages: requirementList })} disabled={previewMutation.isPending} className={primaryBtn} style={secondaryStyle}>{previewMutation.isPending ? <LoaderCircle size={14} className="animate-spin" /> : <FileText size={14} />} Diff</button>
              </div>
              {requirementsChanged && <button onClick={() => setRequirementsText(savedRequirementList.join('\n'))} className="w-full text-xs text-white/45 hover:text-white/75">Discard edits</button>}
              {preview && (
                <div className="rounded-xl p-2.5 text-xs space-y-1" style={panel}>
                  {(['added', 'removed', 'unchanged'] as const).map((key) => {
                    const items = extractArray(preview[key], []).map(String);
                    return <div key={key}><span className="text-white/40 capitalize">{key}:</span> <span className={key === 'added' ? 'text-emerald-300' : key === 'removed' ? 'text-rose-300' : 'text-white/60'}>{items.length ? items.join(', ') : 'none'}</span></div>;
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* 2 · Run + live job */}
      <Section
        step="2"
        icon={<Play size={15} className="text-red-300" />}
        title="Run"
        defaultOpen
        summary={runningJob ? <StatusPill tone="pending" label={runningJobLabel} spinning /> : undefined}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl p-3 space-y-2.5" style={panel}>
            <div>
              <div className="text-sm font-medium text-white">Full pipeline</div>
              <div className="text-xs text-white/40">Build the image, then create {validStudentCount ? studentCount : 'N'} VM{studentCount === 1 ? '' : 's'} and student logins. About 10 min.</div>
            </div>
            <label className="flex items-center gap-2 text-xs text-white/60"><input type="checkbox" checked={skipBuild} onChange={(e) => setSkipBuild(e.target.checked)} /> Skip image build (reuse current image)</label>
            <button onClick={reviewPipeline} disabled={actionBusy || jobRunning} className={`${primaryBtn} w-full`} style={primaryStyle}><Boxes size={14} /> Review &amp; Run</button>
          </div>
          <div className="rounded-xl p-3 space-y-2.5" style={panel}>
            <div>
              <div className="text-sm font-medium text-white">Add VMs</div>
              <div className="text-xs text-white/40">Grow from {containerCount ?? '?'} to {validStudentCount ? studentCount : 'N'} VM{studentCount === 1 ? '' : 's'} without a rebuild (unless packages changed).</div>
            </div>
            <label className="flex items-center gap-2 text-xs text-white/60"><input type="checkbox" checked={forceRebuild} onChange={(e) => setForceRebuild(e.target.checked)} /> Force image rebuild</label>
            <button onClick={submitProvision} disabled={actionBusy || jobRunning} className={`${primaryBtn} w-full`} style={secondaryStyle}><Play size={14} /> Provision</button>
          </div>
        </div>
        {blockedNote}

        <CurrentJobCard job={selectedJob} jobId={selectedJobId} loading={selectedJobQuery.isLoading} error={selectedJobQuery.error instanceof Error ? selectedJobQuery.error.message : null} />
      </Section>

      {/* 3 · Teardown / Reset */}
      <Section
        step="3"
        icon={<Trash2 size={15} className="text-red-300" />}
        title="Teardown / Reset"
        summary="after the workshop"
      >
        <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
          <span className="text-[11px] uppercase tracking-wide text-white/35">Apply to</span>
          <label className="inline-flex items-center gap-2"><input type="radio" name="cleanup-scope" checked={cleanupScope === 'all'} onChange={() => setCleanupScope('all')} /> All VMs{containerCount !== null ? ` (${containerCount})` : ''}</label>
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="cleanup-scope" checked={cleanupScope === 'count'} onChange={() => setCleanupScope('count')} /> First
            <input type="number" min="1" value={cleanupCount} onFocus={() => setCleanupScope('count')} onChange={(e) => setCleanupCount(e.target.value)} className="w-20 rounded-lg px-2 py-1 text-sm text-white outline-none" style={inputStyle} />
            VMs
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button onClick={() => confirmCleanup('reset')} disabled={actionBusy || jobRunning} className={primaryBtn} style={secondaryStyle} title="Wipe VMs back to a clean state, keep them running"><RotateCcw size={14} /> Reset</button>
          <button onClick={() => confirmCleanup('teardown')} disabled={actionBusy || jobRunning} className={primaryBtn} style={{ background: 'rgba(185,28,28,.35)', border: '1px solid rgba(185,28,28,.45)' }} title="Delete VMs and their Guacamole connections"><Trash2 size={14} /> Teardown</button>
          <button onClick={() => askConfirm('Prune workshop images', 'Remove unused Docker images on the workshop host? This cannot be undone.', 'Prune Images', () => run('/admin/workshops/image/prune'), [{ label: 'Effect', value: 'Remove unused workshop images' }])} disabled={actionBusy} className={primaryBtn} style={secondaryStyle} title="Free disk space on the workshop host"><Eraser size={14} /> Prune images</button>
        </div>
        <p className="text-xs text-white/35"><span className="text-white/55">Reset</span> wipes VMs back to a clean state and keeps them running. <span className="text-white/55">Teardown</span> deletes them. <span className="text-white/55">Prune</span> frees disk space from old images.</p>
        {blockedNote}
      </Section>

      {/* Job history */}
      <Section
        icon={<History size={15} className="text-red-300" />}
        title="Job history"
        summary={`${jobs.length} job${jobs.length === 1 ? '' : 's'}`}
      >
        <div className="flex gap-2">
          <input type="text" value={jobLookupInput} onChange={(e) => setJobLookupInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && lookupJob()} placeholder="Show a job by ID in the Run section" className={inputCls} style={inputStyle} />
          <button onClick={lookupJob} className={primaryBtn} style={secondaryStyle}><Search size={14} /></button>
        </div>
        <div className="space-y-2 max-h-[28rem] overflow-auto pr-1">
          {jobsQuery.isLoading && <p className="text-sm text-white/40">Loading jobs…</p>}
          {!jobsQuery.isLoading && jobs.length === 0 && <p className="text-sm text-white/40">No jobs yet. The workshop host keeps history until it restarts.</p>}
          {groupJobsById(jobs).map(({ jobId, entries }) => (
            <JobGroupCard
              key={jobId}
              jobId={jobId}
              entries={entries}
              onRerun={(id) => run(`/admin/workshops/jobs/${encodeURIComponent(id)}/rerun`)}
            />
          ))}
        </div>
      </Section>
    </div>
  );
}
