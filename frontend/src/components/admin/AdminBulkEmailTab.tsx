import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Send, CheckCircle, XCircle, AlertCircle, Loader2, Paperclip, X } from 'lucide-react';
import { apiGet, apiUpload } from '@/lib/api';
import { formatDateTimeFull } from '@/lib/dates';

type LogStatus = 'sending' | 'sent' | 'partial' | 'failed' | 'interrupted' | 'skipped_unconfigured';

type LogEntry = {
  log_id: number;
  subject: string;
  recipient_filter: string;
  recipients_count: number;
  recipients_total: number | null;
  attachment_names: string[] | null;
  status: LogStatus;
  error_message: string | null;
  sent_at: string;
};

type SendResult = { log_id: number; recipients_total: number };

const FILTER_OPTIONS = [
  { value: 'all',      label: 'All active users' },
  { value: 'members',  label: 'Members, Officers & Admins' },
  { value: 'officers', label: 'Officers & Admins only' },
  { value: 'admins',   label: 'Admins only' },
];

// Mirrors the server's allowlist in backend/app/routes/admin/bulk_email.py.
const ATTACHMENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
const MB = 1024 * 1024;
const MAX_FILES = 10;
const MAX_FILE_BYTES = 10 * MB;
const MAX_TOTAL_BYTES = 18 * MB;

const glass = {
  background: 'rgba(255,255,255,.04)',
  border: '1px solid rgba(185,28,28,.22)',
  borderRadius: 16,
  backdropFilter: 'blur(10px)',
};

function formatSize(bytes: number) {
  return bytes >= MB ? `${(bytes / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Returns an error message for the first file that would break a limit, else null. */
function attachmentError(current: File[], added: File[]): string | null {
  if (current.length + added.length > MAX_FILES) return `At most ${MAX_FILES} attachments.`;
  let total = current.reduce((sum, f) => sum + f.size, 0);
  for (const f of added) {
    const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
    // '' / octet-stream = the browser doesn't know the type; the server's magic-byte check still decides.
    const typeOk = f.type === ATTACHMENT_TYPES[ext] || f.type === '' || f.type === 'application/octet-stream';
    if (ATTACHMENT_TYPES[ext] === undefined || !typeOk)
      return `${f.name}: only PDF, PNG, JPG, WEBP, GIF, DOCX and PPTX files are allowed.`;
    if (f.size > MAX_FILE_BYTES) return `${f.name} is over the 10 MB per-file limit.`;
    total += f.size;
    if (total > MAX_TOTAL_BYTES) return 'Attachments would exceed the 18 MB total limit.';
  }
  return null;
}

function StatusBadge({ status }: { status: LogStatus }) {
  if (status === 'sending')
    return <span className="inline-flex items-center gap-1 text-xs text-sky-300"><Loader2 size={12} className="animate-spin" /> Sending</span>;
  if (status === 'sent')
    return <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><CheckCircle size={12} /> Sent</span>;
  if (status === 'partial')
    return <span className="inline-flex items-center gap-1 text-xs text-yellow-400"><AlertCircle size={12} /> Partial</span>;
  if (status === 'interrupted')
    return <span className="inline-flex items-center gap-1 text-xs text-orange-400"><AlertCircle size={12} /> Interrupted</span>;
  if (status === 'skipped_unconfigured')
    return <span className="inline-flex items-center gap-1 text-xs text-rose-400"><XCircle size={12} /> Not sent</span>;
  return <span className="inline-flex items-center gap-1 text-xs text-rose-400"><XCircle size={12} /> Failed</span>;
}

function ConfirmModal({ message, files, onConfirm, onCancel }: {
  message: string;
  files: File[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: 'rgba(10,0,0,.95)', border: '1px solid rgba(185,28,28,.3)', boxShadow: '0 20px 60px rgba(0,0,0,.6)' }}
      >
        <Mail size={32} className="text-red-400 mb-3" />
        <p className="text-white text-sm leading-relaxed mb-4">{message}</p>
        {files.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-white/60 mb-1">
              {files.length} attachment{files.length !== 1 ? 's' : ''}
            </p>
            <ul className="max-h-32 space-y-1 overflow-y-auto overscroll-contain">
              {files.map((f, i) => (
                <li key={i} className="flex items-center gap-1.5 text-xs text-white/80">
                  <Paperclip size={12} className="shrink-0 text-white/40" />
                  <span className="truncate">{f.name}</span>
                  <span className="shrink-0 text-white/40">{formatSize(f.size)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 transition"
          >
            Send
          </button>
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl bg-white/8 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-white/15 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminBulkEmailTab() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientFilter, setRecipientFilter] = useState('members');
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [lastLogId, setLastLogId] = useState<number | null>(null);

  const logsQuery = useQuery<LogEntry[]>({
    queryKey: ['bulk-email-logs'],
    queryFn: () => apiGet<LogEntry[]>('/admin/bulk-email/logs').then((d) => d ?? []),
    // Sends run in the background on the server; poll while one is in flight.
    refetchInterval: (query) => (query.state.data?.some((l) => l.status === 'sending') ? 3_000 : false),
  });

  const sendMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('subject', subject);
      fd.append('body', body);
      fd.append('recipient_filter', recipientFilter);
      files.forEach((f) => fd.append('attachments', f));
      return apiUpload<SendResult>('/admin/bulk-email/send', fd);
    },
    onSuccess: (data) => {
      setLastLogId(data.log_id);
      qc.invalidateQueries({ queryKey: ['bulk-email-logs'] });
      setSubject('');
      setBody('');
      setFiles([]);
    },
  });

  function addFiles(list: FileList | null) {
    const added = Array.from(list ?? []);
    if (fileRef.current) fileRef.current.value = ''; // let the same file be picked again after removal
    if (added.length === 0) return;
    const error = attachmentError(files, added);
    setFileError(error);
    if (!error) setFiles((prev) => [...prev, ...added]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setFileError(null);
  }

  function handleSendClick() {
    setLastLogId(null);
    sendMutation.reset();
    setConfirming(true);
  }

  function handleConfirm() {
    setConfirming(false);
    sendMutation.mutate();
  }

  const filterLabel = FILTER_OPTIONS.find((o) => o.value === recipientFilter)?.label ?? recipientFilter;
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const sendInFlight = logsQuery.data?.some((l) => l.status === 'sending') ?? false;
  const canSend = subject.trim().length > 0 && body.trim().length > 0 && !sendInFlight;
  const lastLog = logsQuery.data?.find((l) => l.log_id === lastLogId);

  const inputCls =
    'w-full rounded-xl bg-white/5 px-3 py-2 text-sm text-white ring-1 ring-white/10 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-red-500/60';

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {confirming && (
        <ConfirmModal
          message={`Send “${subject}” to ${filterLabel}? This cannot be undone.`}
          files={files}
          onConfirm={handleConfirm}
          onCancel={() => setConfirming(false)}
        />
      )}

      {/* Compose */}
      <div className="p-4 sm:p-6 space-y-5" style={glass}>
        <div className="flex items-center gap-2 mb-1">
          <Mail size={18} className="text-red-400" />
          <h2 className="font-['Oxanium'] text-lg font-bold text-white">Compose Blast</h2>
        </div>

        <div>
          <label className="block text-xs font-medium text-white/60 mb-1">Recipients</label>
          <select
            value={recipientFilter}
            onChange={(e) => setRecipientFilter(e.target.value)}
            className={inputCls}
            style={{ background: 'rgba(255,255,255,.05)' }}
          >
            {FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} style={{ background: '#1a1a1a' }}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-white/60 mb-1">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Your email subject…"
            className={inputCls}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-white/60 mb-1">
            Message body <span className="text-white/30 font-normal">(plain text; HTML tags are supported)</span>
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            placeholder="Write your message here…"
            className={`${inputCls} resize-y leading-relaxed`}
          />
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={files.length >= MAX_FILES}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'rgba(185,28,28,.75)' }}
            >
              <Paperclip size={14} /> Attach files
            </button>
            <span className="text-xs text-white/50">
              {files.length > 0
                ? `${files.length} file${files.length !== 1 ? 's' : ''} · ${formatSize(totalBytes)} of 18 MB`
                : 'PDF, images, DOCX or PPTX · up to 10 files, 10 MB each, 18 MB total'}
            </span>
          </div>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={Object.keys(ATTACHMENT_TYPES).join(',')}
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          {files.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/8 py-1 pl-3 pr-1 text-xs text-white ring-1 ring-white/15"
                >
                  <span className="truncate max-w-[180px] sm:max-w-[260px]" title={f.name}>{f.name}</span>
                  <span className="shrink-0 text-white/40">{formatSize(f.size)}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    aria-label={`Remove ${f.name}`}
                    className="shrink-0 rounded-full p-1.5 text-white/60 hover:bg-red-900/60 hover:text-white transition"
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {fileError && <p className="mt-2 text-sm text-rose-300">{fileError}</p>}
        </div>

        {sendMutation.isError && (
          <p className="text-sm text-rose-300">{(sendMutation.error as Error).message}</p>
        )}
        {sendMutation.isSuccess && (
          <p role="status" className="text-sm text-emerald-300 flex items-center gap-1">
            {!lastLog || lastLog.status === 'sending' ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Sending to {sendMutation.data.recipients_total} recipient{sendMutation.data.recipients_total !== 1 ? 's' : ''}…
                {lastLog ? ` ${lastLog.recipients_count} done.` : ''}
              </>
            ) : (
              <span className="inline-flex flex-wrap items-center gap-2 text-white/80">
                <StatusBadge status={lastLog.status} />
                {lastLog.recipients_count} of {lastLog.recipients_total ?? sendMutation.data.recipients_total} recipients. Details under Recent Sends.
              </span>
            )}
          </p>
        )}

        <button
          onClick={handleSendClick}
          disabled={!canSend || sendMutation.isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ boxShadow: '0 0 20px rgba(185,28,28,.35)' }}
        >
          <Send size={14} />
          {sendMutation.isPending ? 'Starting…' : sendInFlight ? 'A send is in progress…' : 'Send blast'}
        </button>
      </div>

      {/* Logs */}
      <div className="p-4 sm:p-6" style={glass}>
        <h2 className="font-['Oxanium'] text-lg font-bold text-white mb-4">Recent Sends</h2>

        {logsQuery.isLoading && (
          <p className="text-sm text-white/40">Loading…</p>
        )}

        {logsQuery.isError && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-rose-300">
              Couldn't load recent sends: {(logsQuery.error as Error).message}
            </p>
            <button
              onClick={() => logsQuery.refetch()}
              className="rounded-xl bg-white/8 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/15 hover:bg-white/15 transition"
            >
              Retry
            </button>
          </div>
        )}

        {logsQuery.isSuccess && logsQuery.data.length === 0 && (
          <p className="text-sm text-white/40">No emails sent yet.</p>
        )}

        {logsQuery.data && logsQuery.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-white/40 border-b border-white/8">
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 pr-4 font-medium">Subject</th>
                  <th className="pb-2 pr-4 font-medium">Recipients</th>
                  <th className="pb-2 pr-4 font-medium">Filter</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {logsQuery.data.map((log) => (
                  <tr key={log.log_id} className="border-b border-white/5 hover:bg-white/[.02]">
                    <td className="py-2.5 pr-4 text-white/50 whitespace-nowrap">
                      {formatDateTimeFull(log.sent_at)}
                    </td>
                    <td className="py-2.5 pr-4 text-white max-w-[240px]">
                      <p className="truncate">{log.subject}</p>
                      {log.attachment_names && log.attachment_names.length > 0 && (
                        <p
                          className="mt-0.5 inline-flex items-center gap-1 text-xs text-white/40"
                          title={log.attachment_names.join(', ')}
                        >
                          <Paperclip size={11} /> {log.attachment_names.length} attachment{log.attachment_names.length !== 1 ? 's' : ''}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-white/70 whitespace-nowrap tabular-nums">
                      {log.recipients_total != null ? `${log.recipients_count} / ${log.recipients_total}` : log.recipients_count}
                    </td>
                    <td className="py-2.5 pr-4 text-white/50 capitalize">{log.recipient_filter}</td>
                    <td className="py-2.5">
                      <StatusBadge status={log.status} />
                      {log.error_message && (
                        <p className="text-xs text-rose-300/70 mt-0.5 max-w-[200px] truncate" title={log.error_message}>
                          {log.error_message}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
