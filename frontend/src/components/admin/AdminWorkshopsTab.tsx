import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import { Activity, Boxes, CheckCircle2, FileText, LoaderCircle, Play, RefreshCw, RotateCcw, Search, Trash2, Wrench } from 'lucide-react';
import { formatDateTimeFull } from '@/lib/dates';

type AnyRecord = Record<string, unknown>;

interface PendingConfirm {
  title: string;
  message: string;
  confirmLabel: string;
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

function formatMaybeDate(value: unknown): string {
  const text = toStringValue(value).trim();
  if (!text) return '';
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : formatDateTimeFull(text);
}

function normalizePackageList(value: unknown): string[] {
  const items = extractArray(value, ['packages', 'requirements', 'items', 'data', 'results']);
  return items.flatMap((item) => {
    if (typeof item === 'string') return [item.trim()];
    if (isRecord(item)) {
      const candidate = pickString(item, ['package', 'name', 'spec', 'value']);
      if (candidate) return [candidate];
      return [stringifyJson(item)];
    }
    if (typeof item === 'number' || typeof item === 'boolean') return [String(item)];
    return [];
  }).filter(Boolean);
}

function normalizeJobList(value: unknown): AnyRecord[] {
  return extractArray(value, ['jobs', 'items', 'data', 'results'])
    .filter(isRecord);
}

function StatusCard({ data }: { data: unknown }) {
  const record = isRecord(data) ? data : null;
  const status = pickString(record, ['status', 'state', 'phase']) ?? 'unknown';
  const message = pickString(record, ['message', 'detail', 'description', 'error']) ?? 'No status message provided.';
  const updated = formatMaybeDate(record?.updated_at ?? record?.last_updated ?? record?.timestamp);
  const activeJobs = pickNumber(record, ['active_jobs', 'jobs_running', 'running_jobs']);
  const queueLength = pickNumber(record, ['queue_length', 'queued_jobs', 'pending_jobs']);
  const containerCount = pickNumber(record, ['container_count']);
  const imageName = pickString(record, ['image']);
  const imageBuiltAt = formatMaybeDate(record?.image_built_at);
  const containers = extractArray(record?.containers, ['containers']);

  return (
    <div className="rounded-2xl p-5 flex flex-col gap-4" style={glass}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg" style={{ background: 'rgba(185,28,28,.15)' }}>
            <Activity size={16} className="text-red-300" />
          </div>
          <div>
            <h3 className="text-white font-semibold font-['Oxanium']">Live Status</h3>
            <p className="text-xs text-white/35">Proxy response from the workshop service</p>
          </div>
        </div>
        <span
          className="text-xs uppercase tracking-wide px-2.5 py-1 rounded-full border"
          style={{ background: 'rgba(185,28,28,.14)', color: 'rgba(248,113,113,.95)', borderColor: 'rgba(185,28,28,.26)' }}
        >
          {status}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
          <div className="text-white/35 text-xs uppercase tracking-wide">Message</div>
          <div className="text-white/85 mt-1 leading-relaxed">{message}</div>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
          <div className="text-white/35 text-xs uppercase tracking-wide">Active Jobs</div>
          <div className="text-white/85 mt-1">{activeJobs ?? 'n/a'}</div>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
          <div className="text-white/35 text-xs uppercase tracking-wide">Queue Length</div>
          <div className="text-white/85 mt-1">{queueLength ?? 'n/a'}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
          <div className="text-white/35 text-xs uppercase tracking-wide">Container Count</div>
          <div className="text-white/85 mt-1">{containerCount ?? 'n/a'}</div>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
          <div className="text-white/35 text-xs uppercase tracking-wide">Image</div>
          <div className="text-white/85 mt-1 break-words">{imageName ?? 'n/a'}</div>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
          <div className="text-white/35 text-xs uppercase tracking-wide">Image Built</div>
          <div className="text-white/85 mt-1">{imageBuiltAt || 'n/a'}</div>
        </div>
      </div>

      {containers.length > 0 && (
        <div className="rounded-xl p-3 space-y-3" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
          <div className="text-white/35 text-xs uppercase tracking-wide">Containers</div>
          <div className="space-y-2 max-h-56 overflow-auto pr-1">
            {containers.map((item, index) => {
              const container = isRecord(item) ? item : null;
              const name = pickString(container, ['name', 'container_name', 'id']) ?? `Container ${index + 1}`;
              const containerStatus = pickString(container, ['status']) ?? '';
              const ports = pickString(container, ['ports']) ?? '';
              return (
                <div key={`${name}-${index}`} className="rounded-lg p-3 flex flex-col gap-1" style={{ background: 'rgba(255,255,255,.03)' }}>
                  <div className="text-white/80 text-sm">{name}</div>
                  <div className="text-white/40 text-xs flex flex-wrap gap-3">
                    {containerStatus && <span>{containerStatus}</span>}
                    {ports && <span>{ports}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {updated && <p className="text-xs text-white/35">Updated {updated}</p>}

      <details className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
        <summary className="cursor-pointer text-xs uppercase tracking-wide text-white/45 flex items-center gap-2">
          <FileText size={13} /> Raw JSON
        </summary>
        <pre className="mt-3 overflow-auto text-xs text-white/70 leading-relaxed max-h-72 whitespace-pre-wrap break-words">
          {stringifyJson(data)}
        </pre>
      </details>
    </div>
  );
}

function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel }: PendingConfirm & { onCancel: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,.82)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="w-full max-w-md rounded-2xl p-6 space-y-5" style={glass}>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg" style={{ background: 'rgba(185,28,28,.15)' }}>
            <Trash2 size={16} className="text-red-300" />
          </div>
          <div>
            <h3 className="text-white font-semibold font-['Oxanium']">{title}</h3>
            <p className="text-xs text-white/35">This action will be sent to the workshop proxy.</p>
          </div>
        </div>

        <p className="text-sm text-white/80 leading-relaxed">{message}</p>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="rounded-xl px-4 py-2 text-sm text-white/65 transition-colors"
            style={{ background: 'rgba(255,255,255,.06)' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all"
            style={{ background: 'rgba(185,28,28,.72)', boxShadow: '0 0 20px rgba(185,28,28,.25)' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function JobCard({ job, onRerun }: { job: AnyRecord; onRerun: (jobId: string) => void }) {
  const jobId = pickString(job, ['job_id', 'id', 'uuid', 'task_id']);
  const title = pickString(job, ['name', 'job_name', 'title', 'task', 'type']) ?? (jobId ? `Job ${jobId}` : 'Job');
  const status = pickString(job, ['status', 'state', 'phase']) ?? 'unknown';
  const started = formatMaybeDate(job.started_at ?? job.created_at);
  const updated = formatMaybeDate(job.updated_at ?? job.finished_at ?? job.completed_at);
  const error = pickString(job, ['error', 'error_message', 'message']);
  const stage = pickString(job, ['stage']);
  const stageIndex = pickNumber(job, ['stage_index']);
  const totalStages = pickNumber(job, ['total_stages']);
  const args = isRecord(job.args) ? job.args : null;

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-white">{title}</h4>
          <p className="text-xs text-white/35 mt-0.5">{jobId ? `ID ${jobId}` : 'No job identifier returned'}</p>
        </div>
        <span
          className="text-[11px] uppercase tracking-wide px-2 py-1 rounded-full border shrink-0"
          style={{ background: 'rgba(185,28,28,.12)', color: 'rgba(248,113,113,.95)', borderColor: 'rgba(185,28,28,.18)' }}
        >
          {status}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
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
          <div className="text-white/75 mt-1">
            {stage || 'n/a'}
            {stageIndex || totalStages ? ` (${stageIndex ?? 'n/a'} / ${totalStages ?? 'n/a'})` : ''}
          </div>
        </div>
      )}

      {args && (
        <details className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.05)' }}>
          <summary className="cursor-pointer text-xs text-white/45 uppercase tracking-wide">Job args</summary>
          <pre className="mt-3 overflow-auto text-[11px] text-white/70 leading-relaxed max-h-48 whitespace-pre-wrap break-words">
            {stringifyJson(args)}
          </pre>
        </details>
      )}

      {error && <p className="text-xs text-rose-300/80">{error}</p>}

      <div className="flex items-center gap-2">
        {jobId && (
          <button
            onClick={() => onRerun(jobId)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all"
            style={{ background: 'rgba(185,28,28,.2)', border: '1px solid rgba(185,28,28,.28)' }}
          >
            <RotateCcw size={12} /> Rerun
          </button>
        )}
      </div>

      <details className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.05)' }}>
        <summary className="cursor-pointer text-xs text-white/45 uppercase tracking-wide">Raw job JSON</summary>
        <pre className="mt-3 overflow-auto text-[11px] text-white/70 leading-relaxed max-h-56 whitespace-pre-wrap break-words">
          {stringifyJson(job)}
        </pre>
      </details>
    </div>
  );
}

export default function AdminWorkshopsTab() {
  const qc = useQueryClient();
  const [containers, setContainers] = useState('1');
  const [students, setStudents] = useState('1');
  const [useAddMode, setUseAddMode] = useState(false);
  const [skipBuild, setSkipBuild] = useState(false);
  const [forceRebuild, setForceRebuild] = useState(false);
  const [useAllForDestructiveActions, setUseAllForDestructiveActions] = useState(false);
  const [packageInput, setPackageInput] = useState('');
  const [requirementsText, setRequirementsText] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [jobLookupInput, setJobLookupInput] = useState('');
  const [previewResult, setPreviewResult] = useState<unknown>(null);
  const [previewLabel, setPreviewLabel] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const statusQuery = useQuery<unknown>({
    queryKey: ['admin-workshops-status'],
    queryFn: () => apiGet('/admin/workshops/status'),
    staleTime: 20_000,
  });

  const jobsQuery = useQuery<unknown>({
    queryKey: ['admin-workshops-jobs'],
    queryFn: () => apiGet('/admin/workshops/jobs'),
    staleTime: 20_000,
  });

  const requirementsQuery = useQuery<unknown>({
    queryKey: ['admin-workshops-requirements'],
    queryFn: () => apiGet('/admin/workshops/requirements'),
    staleTime: 20_000,
  });

  const selectedJobQuery = useQuery<unknown>({
    queryKey: ['admin-workshops-job', selectedJobId],
    queryFn: () => apiGet(`/admin/workshops/jobs/${encodeURIComponent(selectedJobId)}`),
    enabled: selectedJobId.trim().length > 0,
    staleTime: 10_000,
  });

  const workshopMutation = useMutation({
    mutationFn: ({ method, path, body }: { method: 'POST' | 'PUT'; path: string; body?: unknown }) => {
      if (method === 'PUT') {
        return apiPut(path, body ?? {});
      }
      return apiPost(path, body ?? {});
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-workshops-status'] });
      qc.invalidateQueries({ queryKey: ['admin-workshops-jobs'] });
      qc.invalidateQueries({ queryKey: ['admin-workshops-requirements'] });
      if (selectedJobId) qc.invalidateQueries({ queryKey: ['admin-workshops-job', selectedJobId] });
      setNotice(vars.path.includes('/requirements') ? 'Requirements updated.' : 'Workshop action sent successfully.');
    },
  });

  const previewMutation = useMutation({
    mutationFn: (body: unknown) => apiPost('/admin/workshops/requirements/preview', body),
    onSuccess: (data) => {
      setPreviewResult(data);
      setNotice('Preview generated.');
      qc.invalidateQueries({ queryKey: ['admin-workshops-status'] });
    },
  });

  useEffect(() => {
    setRequirementsText(normalizePackageList(requirementsQuery.data).join('\n'));
  }, [requirementsQuery.data]);

  useEffect(() => {
    if (selectedJobId && selectedJobQuery.data) {
      qc.invalidateQueries({ queryKey: ['admin-workshops-jobs'] });
    }
  }, [selectedJobId, selectedJobQuery.data, qc]);

  const requirementList = requirementsText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const jobs = normalizeJobList(jobsQuery.data);
  const selectedJob = isRecord(selectedJobQuery.data) ? selectedJobQuery.data : null;
  const selectedJobError = selectedJobQuery.error instanceof Error ? selectedJobQuery.error.message : null;
  const statusError = statusQuery.error instanceof Error ? statusQuery.error.message : null;
  const jobsError = jobsQuery.error instanceof Error ? jobsQuery.error.message : null;
  const requirementsError = requirementsQuery.error instanceof Error ? requirementsQuery.error.message : null;

  function askConfirm(title: string, message: string, confirmLabel: string, onConfirm: () => void) {
    setPendingConfirm({ title, message, confirmLabel, onConfirm });
  }

  function runAction(path: string, body: unknown, successMessage: string, method: 'POST' | 'PUT' = 'POST') {
    workshopMutation.mutate({ method, path, body }, {
      onSuccess: () => setNotice(successMessage),
    });
  }

  function submitPipeline() {
    const parsedContainers = Number(containers);
    const parsedStudents = Number(students || containers);
    if (!Number.isFinite(parsedContainers) || parsedContainers < 0) {
      setNotice('Enter a valid container count.');
      return;
    }
    if (!Number.isFinite(parsedStudents) || parsedStudents < 0) {
      setNotice('Enter a valid student count.');
      return;
    }
    runAction(
      '/admin/workshops/pipeline/run',
      {
        num_containers: parsedContainers,
        num_students: parsedStudents,
        packages: requirementList.length ? requirementList : undefined,
        skip_build: skipBuild,
      },
      'Pipeline run requested.',
    );
  }

  function submitProvision() {
    const parsedContainers = Number(containers);
    const parsedStudents = Number(students || containers);
    if (!Number.isFinite(parsedContainers) || parsedContainers < 0) {
      setNotice('Enter a valid container count.');
      return;
    }
    if (!Number.isFinite(parsedStudents) || parsedStudents < 0) {
      setNotice('Enter a valid student count.');
      return;
    }
    runAction(
      '/admin/workshops/provision',
      {
        ...(useAddMode ? { add: parsedContainers } : { num_containers: parsedContainers }),
        num_students: parsedStudents,
        packages: requirementList.length ? requirementList : undefined,
        force_rebuild: forceRebuild,
      },
      'Provision requested.',
    );
  }

  function saveRequirements() {
    runAction('/admin/workshops/requirements', { packages: requirementList }, 'Requirements saved.', 'PUT');
  }

  function addRequirement() {
    const packageName = packageInput.trim();
    if (!packageName) return;
    workshopMutation.mutate(
      { method: 'POST', path: '/admin/workshops/requirements/add', body: { package: packageName } },
      {
        onSuccess: () => {
          setNotice(`Added ${packageName}.`);
          setPackageInput('');
        },
      },
    );
  }

  function removeRequirement() {
    const packageName = packageInput.trim();
    if (!packageName) return;
    workshopMutation.mutate(
      { method: 'POST', path: '/admin/workshops/requirements/remove', body: { package: packageName } },
      {
        onSuccess: () => {
          setNotice(`Removed ${packageName}.`);
          setPackageInput('');
        },
      },
    );
  }

  function previewRequirements() {
    const payload = { packages: requirementList };
    previewMutation.mutate(payload, {
      onSuccess: () => setPreviewLabel(`Preview for ${requirementList.length} package${requirementList.length === 1 ? '' : 's'}`),
    });
  }

  function lookupJob() {
    const id = jobLookupInput.trim();
    if (!id) return;
    setSelectedJobId(id);
  }

  const inputCls = 'w-full rounded-xl px-3 py-2 text-sm text-white outline-none transition focus:ring-2 focus:ring-red-500/50';

  return (
    <div className="space-y-6 p-6">
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

      <div className="rounded-2xl p-6 flex flex-col gap-3" style={glass}>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg" style={{ background: 'rgba(185,28,28,.15)' }}>
            <Wrench size={16} className="text-red-300" />
          </div>
          <div>
            <h2 className="font-['Oxanium'] text-xl font-bold text-white">Workshops Control</h2>
            <p className="text-sm text-white/40">Run, inspect, and update the proxy-backed workshop service from the admin panel.</p>
          </div>
        </div>

        {(notice || workshopMutation.error || previewMutation.error || statusError || jobsError || requirementsError || selectedJobError) && (
          <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
            {notice && (
              <div className="flex items-center gap-2 text-emerald-300 text-sm">
                <CheckCircle2 size={15} /> {notice}
              </div>
            )}
            {workshopMutation.error instanceof Error && (
              <p className="text-sm text-rose-300">{workshopMutation.error.message}</p>
            )}
            {previewMutation.error instanceof Error && (
              <p className="text-sm text-rose-300">{previewMutation.error.message}</p>
            )}
            {statusError && <p className="text-sm text-rose-300">Status: {statusError}</p>}
            {jobsError && <p className="text-sm text-rose-300">Jobs: {jobsError}</p>}
            {requirementsError && <p className="text-sm text-rose-300">Requirements: {requirementsError}</p>}
            {selectedJobError && <p className="text-sm text-rose-300">Job detail: {selectedJobError}</p>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="rounded-2xl p-5 space-y-4" style={glass}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg" style={{ background: 'rgba(185,28,28,.15)' }}>
                  <Play size={16} className="text-red-300" />
                </div>
                <div>
                  <h3 className="text-white font-semibold font-['Oxanium']">Instance Actions</h3>
                  <p className="text-xs text-white/35">Use the current container count for provisioning actions.</p>
                </div>
              </div>
              <button
                onClick={() => {
                  qc.invalidateQueries({ queryKey: ['admin-workshops-status'] });
                  qc.invalidateQueries({ queryKey: ['admin-workshops-jobs'] });
                  qc.invalidateQueries({ queryKey: ['admin-workshops-requirements'] });
                }}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-white/60 transition-colors"
                style={{ background: 'rgba(255,255,255,.06)' }}
              >
                <RefreshCw size={13} /> Refresh
              </button>
            </div>

            <label className="block text-xs uppercase tracking-wide text-white/35">Container Count</label>
            <input
              type="number"
              min="0"
              value={containers}
              onChange={(e) => setContainers(e.target.value)}
              className={inputCls}
              style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)' }}
            />

            <label className="block text-xs uppercase tracking-wide text-white/35">Student Count</label>
            <input
              type="number"
              min="0"
              value={students}
              onChange={(e) => setStudents(e.target.value)}
              className={inputCls}
              style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)' }}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-white/65">
              <label className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
                <input type="checkbox" checked={useAddMode} onChange={(e) => setUseAddMode(e.target.checked)} />
                Add containers instead of targeting a total count
              </label>
              <label className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
                <input type="checkbox" checked={skipBuild} onChange={(e) => setSkipBuild(e.target.checked)} />
                Skip image build for pipeline run
              </label>
              <label className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
                <input type="checkbox" checked={forceRebuild} onChange={(e) => setForceRebuild(e.target.checked)} />
                Force image rebuild on provision
              </label>
              <label className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
                <input type="checkbox" checked={useAllForDestructiveActions} onChange={(e) => setUseAllForDestructiveActions(e.target.checked)} />
                Apply destructive actions to all running containers
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={submitPipeline}
                disabled={workshopMutation.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: 'rgba(185,28,28,.78)', boxShadow: '0 0 20px rgba(185,28,28,.25)' }}
              >
                <Boxes size={14} /> Run Pipeline
              </button>
              <button
                onClick={submitProvision}
                disabled={workshopMutation.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.10)' }}
              >
                <Play size={14} /> Provision
              </button>
              <button
                onClick={() => askConfirm(
                  'Reset workshop containers',
                  useAllForDestructiveActions
                    ? 'Reset all running workshop containers? This is destructive and will be sent immediately.'
                    : `Reset ${containers} container${Number(containers) === 1 ? '' : 's'}? This is destructive and will be sent immediately.`,
                  'Reset',
                  () => runAction('/admin/workshops/reset', useAllForDestructiveActions ? { all: true } : { num_containers: Number(containers) }, 'Reset requested.'),
                )}
                disabled={workshopMutation.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.10)' }}
              >
                <RotateCcw size={14} /> Reset
              </button>
              <button
                onClick={() => askConfirm(
                  'Tear down workshop containers',
                  useAllForDestructiveActions
                    ? 'Tear down all running workshop containers? This is destructive and will be sent immediately.'
                    : `Tear down ${containers} container${Number(containers) === 1 ? '' : 's'}? This is destructive and will be sent immediately.`,
                  'Tear Down',
                  () => runAction('/admin/workshops/teardown', useAllForDestructiveActions ? { all: true } : { num_containers: Number(containers) }, 'Teardown requested.'),
                )}
                disabled={workshopMutation.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.10)' }}
              >
                <Trash2 size={14} /> Teardown
              </button>
            </div>

            <button
              onClick={() => askConfirm(
                'Prune workshop images',
                'Prune unused workshop images on the remote host? This cannot be undone.',
                'Prune Images',
                () => workshopMutation.mutate(
                  { method: 'POST', path: '/admin/workshops/image/prune' },
                  { onSuccess: () => setNotice('Image prune requested.') },
                ),
              )}
              disabled={workshopMutation.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.10)' }}
            >
              <Trash2 size={14} /> Prune Images
            </button>
          </div>

          <StatusCard data={statusQuery.data} />
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl p-5 space-y-4" style={glass}>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg" style={{ background: 'rgba(185,28,28,.15)' }}>
                <Search size={16} className="text-red-300" />
              </div>
              <div>
                <h3 className="text-white font-semibold font-['Oxanium']">Job Lookup</h3>
                <p className="text-xs text-white/35">Load a single job by ID, then rerun it from the detail panel.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <input
                type="text"
                value={jobLookupInput}
                onChange={(e) => setJobLookupInput(e.target.value)}
                placeholder="Enter job id"
                className={inputCls}
                style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)' }}
              />
              <button
                onClick={lookupJob}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all"
                style={{ background: 'rgba(185,28,28,.78)', boxShadow: '0 0 20px rgba(185,28,28,.25)' }}
              >
                <Search size={14} /> Load
              </button>
            </div>

            {selectedJobId && (
              <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-white/35">Selected Job</div>
                    <div className="text-sm text-white mt-1">{selectedJobId}</div>
                  </div>
                  <button
                    onClick={() => selectedJobQuery.refetch()}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-white/60 transition-colors"
                    style={{ background: 'rgba(255,255,255,.06)' }}
                  >
                    <RefreshCw size={13} /> Refresh
                  </button>
                </div>

                {selectedJobQuery.isLoading && <p className="text-sm text-white/40">Loading job…</p>}

                {selectedJob && (
                  <details open className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.05)' }}>
                    <summary className="cursor-pointer text-xs uppercase tracking-wide text-white/45">Selected job JSON</summary>
                    <pre className="mt-3 overflow-auto text-[11px] text-white/70 leading-relaxed max-h-56 whitespace-pre-wrap break-words">
                      {stringifyJson(selectedJob)}
                    </pre>
                    {(pickString(selectedJob, ['stage']) || pickNumber(selectedJob, ['stage_index']) || pickNumber(selectedJob, ['total_stages'])) && (
                      <p className="mt-3 text-xs text-white/40">
                        Stage {pickNumber(selectedJob, ['stage_index']) ?? 'n/a'} / {pickNumber(selectedJob, ['total_stages']) ?? 'n/a'}: {pickString(selectedJob, ['stage']) ?? 'n/a'}
                      </p>
                    )}
                  </details>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl p-5 space-y-4" style={glass}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg" style={{ background: 'rgba(185,28,28,.15)' }}>
                  <Boxes size={16} className="text-red-300" />
                </div>
                <div>
                  <h3 className="text-white font-semibold font-['Oxanium']">Recent Jobs</h3>
                  <p className="text-xs text-white/35">Pulled directly from the workshop API proxy.</p>
                </div>
              </div>
              <button
                onClick={() => qc.invalidateQueries({ queryKey: ['admin-workshops-jobs'] })}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-white/60 transition-colors"
                style={{ background: 'rgba(255,255,255,.06)' }}
              >
                <RefreshCw size={13} /> Refresh
              </button>
            </div>

            {jobsQuery.isLoading && <p className="text-sm text-white/40">Loading jobs…</p>}

            {!jobsQuery.isLoading && jobs.length === 0 && (
              <p className="text-sm text-white/40">No jobs returned by the service.</p>
            )}

            {jobs.length > 0 && (
              <div className="space-y-3 max-h-[34rem] overflow-auto pr-1">
                {jobs.map((job, index) => (
                  <JobCard
                    key={pickString(job, ['job_id', 'id', 'uuid', 'task_id']) ?? `${index}`}
                    job={job}
                    onRerun={(jobId) => {
                      workshopMutation.mutate(
                        { method: 'POST', path: `/admin/workshops/jobs/${encodeURIComponent(jobId)}/rerun` },
                        { onSuccess: () => setNotice(`Queued rerun for ${jobId}.`) },
                      );
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="rounded-2xl p-5 space-y-4" style={glass}>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg" style={{ background: 'rgba(185,28,28,.15)' }}>
              <FileText size={16} className="text-red-300" />
            </div>
            <div>
              <h3 className="text-white font-semibold font-['Oxanium']">Requirements Editor</h3>
              <p className="text-xs text-white/35">Edit the package list, add or remove a single package, and preview the install payload.</p>
            </div>
          </div>

          <textarea
            value={requirementsText}
            onChange={(e) => setRequirementsText(e.target.value)}
            rows={12}
            placeholder="One package per line"
            className="w-full rounded-xl px-3 py-3 text-sm text-white outline-none resize-y leading-relaxed"
            style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)' }}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={saveRequirements}
              disabled={workshopMutation.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: 'rgba(185,28,28,.78)', boxShadow: '0 0 20px rgba(185,28,28,.25)' }}
            >
              <CheckCircle2 size={14} /> Save List
            </button>
            <button
              onClick={previewRequirements}
              disabled={previewMutation.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.10)' }}
            >
              {previewMutation.isPending ? <LoaderCircle size={14} className="animate-spin" /> : <FileText size={14} />} Preview
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,.06)' }}>
            <input
              type="text"
              value={packageInput}
              onChange={(e) => setPackageInput(e.target.value)}
              placeholder="Package name"
              className={inputCls}
              style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)' }}
            />
            <button
              onClick={addRequirement}
              disabled={workshopMutation.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.10)' }}
            >
              <Boxes size={14} /> Add
            </button>
            <button
              onClick={() => askConfirm(
                'Remove package',
                `Remove ${packageInput.trim() || 'this package'} from the workshop requirements?`,
                'Remove',
                removeRequirement,
              )}
              disabled={workshopMutation.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.10)' }}
            >
              <Trash2 size={14} /> Remove
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl p-5 space-y-4" style={glass}>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg" style={{ background: 'rgba(185,28,28,.15)' }}>
                <Activity size={16} className="text-red-300" />
              </div>
              <div>
                <h3 className="text-white font-semibold font-['Oxanium']">Requirements Preview</h3>
                <p className="text-xs text-white/35">Shows the payload returned by the remote service after previewing the list.</p>
              </div>
            </div>

            <div className="rounded-xl p-4 text-sm" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
              <div className="flex items-center gap-2 text-white/70">
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs border" style={{ background: 'rgba(185,28,28,.14)', color: 'rgba(248,113,113,.95)', borderColor: 'rgba(185,28,28,.22)' }}>
                  <Boxes size={12} /> {requirementList.length} package{requirementList.length === 1 ? '' : 's'}
                </span>
                {previewLabel && <span className="text-white/40 text-xs">{previewLabel}</span>}
              </div>

              {previewResult ? (
                <pre className="mt-4 overflow-auto text-xs text-white/70 leading-relaxed max-h-80 whitespace-pre-wrap break-words">
                  {stringifyJson(previewResult)}
                </pre>
              ) : (
                <p className="mt-4 text-white/40">Run a preview to inspect the response.</p>
              )}
            </div>
          </div>

          <StatusCard data={requirementsQuery.data} />
        </div>
      </div>

      <div className="text-xs text-white/30 px-1">
        The workshop tab intentionally stays generic because the proxy can return different payloads depending on the upstream service.
      </div>
    </div>
  );
}