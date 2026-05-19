import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Send, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { formatDateTimeFull } from '@/lib/dates';

const BACKEND = import.meta.env.VITE_BACKEND_API_URL ?? 'http://localhost:5001';

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem('access_token') ?? sessionStorage.getItem('access_token') ?? '';
  const res = await fetch(`${BACKEND}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || `Request failed (${res.status})`);
  }
  return res.json();
}

type LogEntry = {
  log_id: number;
  subject: string;
  recipient_filter: string;
  recipients_count: number;
  status: 'sent' | 'partial' | 'failed';
  error_message: string | null;
  sent_at: string;
};

const FILTER_OPTIONS = [
  { value: 'all',      label: 'All active users' },
  { value: 'members',  label: 'Members, Officers & Admins' },
  { value: 'officers', label: 'Officers & Admins only' },
  { value: 'admins',   label: 'Admins only' },
];

const glass = {
  background: 'rgba(255,255,255,.04)',
  border: '1px solid rgba(185,28,28,.22)',
  borderRadius: 16,
  backdropFilter: 'blur(10px)',
};

function StatusBadge({ status }: { status: LogEntry['status'] }) {
  if (status === 'sent')
    return <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><CheckCircle size={12} /> Sent</span>;
  if (status === 'partial')
    return <span className="inline-flex items-center gap-1 text-xs text-yellow-400"><AlertCircle size={12} /> Partial</span>;
  return <span className="inline-flex items-center gap-1 text-xs text-rose-400"><XCircle size={12} /> Failed</span>;
}

function ConfirmModal({ message, onConfirm, onCancel }: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm rounded-2xl p-6" style={glass}>
        <Mail size={32} className="text-red-400 mb-3" />
        <p className="text-white text-sm leading-relaxed mb-6">{message}</p>
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

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientFilter, setRecipientFilter] = useState('members');
  const [confirming, setConfirming] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const logsQuery = useQuery<LogEntry[]>({
    queryKey: ['bulk-email-logs'],
    queryFn: () => apiFetch('/admin/bulk-email/logs').then((d) => d ?? []),
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      apiFetch('/admin/bulk-email/send', {
        method: 'POST',
        body: JSON.stringify({ subject, body, recipient_filter: recipientFilter }),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['bulk-email-logs'] });
      setSuccessMsg(`Sent to ${data.recipients_count} recipient${data.recipients_count !== 1 ? 's' : ''}.`);
      setSubject('');
      setBody('');
    },
  });

  function handleSendClick() {
    setSuccessMsg(null);
    sendMutation.reset();
    setConfirming(true);
  }

  function handleConfirm() {
    setConfirming(false);
    sendMutation.mutate();
  }

  const filterLabel = FILTER_OPTIONS.find((o) => o.value === recipientFilter)?.label ?? recipientFilter;
  const canSend = subject.trim().length > 0 && body.trim().length > 0;

  const inputCls =
    'w-full rounded-xl bg-white/5 px-3 py-2 text-sm text-white ring-1 ring-white/10 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-red-500/60';

  return (
    <div className="space-y-6 p-6">
      {confirming && (
        <ConfirmModal
          message={`Send "${subject}" to ${filterLabel}? This cannot be undone.`}
          onConfirm={handleConfirm}
          onCancel={() => setConfirming(false)}
        />
      )}

      {/* Compose */}
      <div className="p-6 space-y-5" style={glass}>
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

        {sendMutation.isError && (
          <p className="text-sm text-rose-300">{(sendMutation.error as Error).message}</p>
        )}
        {successMsg && (
          <p className="text-sm text-emerald-300 flex items-center gap-1">
            <CheckCircle size={14} /> {successMsg}
          </p>
        )}

        <button
          onClick={handleSendClick}
          disabled={!canSend || sendMutation.isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ boxShadow: '0 0 20px rgba(185,28,28,.35)' }}
        >
          <Send size={14} />
          {sendMutation.isPending ? 'Sending…' : 'Send blast'}
        </button>
      </div>

      {/* Logs */}
      <div className="p-6" style={glass}>
        <h2 className="font-['Oxanium'] text-lg font-bold text-white mb-4">Recent Sends</h2>

        {logsQuery.isLoading && (
          <p className="text-sm text-white/40">Loading…</p>
        )}

        {!logsQuery.isLoading && (!logsQuery.data || logsQuery.data.length === 0) && (
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
                    <td className="py-2.5 pr-4 text-white max-w-[240px] truncate">{log.subject}</td>
                    <td className="py-2.5 pr-4 text-white/70">{log.recipients_count}</td>
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
