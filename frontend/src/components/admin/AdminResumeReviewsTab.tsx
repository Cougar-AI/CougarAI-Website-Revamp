import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Download, FileWarning, Loader2, XCircle } from 'lucide-react';
import { apiGet, apiGetBlob, apiPost } from '@/lib/api';
import { formatDate } from '@/lib/dates';

type Applicant = { name: string; email: string };
type ReviewListItem = { review_id: number; status: string; created_at: string; finished_at: string | null; error_message: string | null; applicant?: Applicant };
type ReviewDetail = ReviewListItem & { report?: { security?: { flags?: string[] }; feedback?: { summary?: string; fit_rationale?: string } } };
const card = { background: 'rgba(255,255,255,.04)', border: '1px solid rgba(185,28,28,.22)', backdropFilter: 'blur(10px)' } as const;
const downloadName = (name?: string) => `${(name || 'cougarai').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}-resume-review`;

export default function AdminResumeReviewsTab() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const { data, isLoading } = useQuery<{ reviews: ReviewListItem[] }>({ queryKey: ['flagged-resume-reviews'], queryFn: () => apiGet('/resume-review/flagged') });
  const { data: detail, isLoading: detailLoading } = useQuery<ReviewDetail>({ queryKey: ['resume-review-detail', selected], queryFn: () => apiGet(`/resume-review/${selected}`), enabled: selected !== null });

  async function clear() {
    if (!selected || !confirm('Clear this resume for sponsor sharing?')) return;
    setError('');
    try { await apiPost(`/resume-review/${selected}/clear`, {}); setSelected(null); qc.invalidateQueries({ queryKey: ['flagged-resume-reviews'] }); }
    catch (e: any) { setError(e?.message ?? 'Could not clear this review.'); }
  }

  async function reject() {
    if (!selected) return;
    const reason = rejectionReason.trim();
    if (!reason) { setError('Include a reason so the member knows what to fix.'); return; }
    if (!confirm('Reject this resume? It cannot be shared with sponsors.')) return;
    setError('');
    try { await apiPost(`/resume-review/${selected}/reject`, { reason }); setSelected(null); setRejectionReason(''); qc.invalidateQueries({ queryKey: ['flagged-resume-reviews'] }); }
    catch (e: any) { setError(e?.message ?? 'Could not reject this review.'); }
  }

  async function downloadResume() {
    if (!selected) return;
    try {
      const blob = await apiGetBlob(`/resume-review/${selected}/resume`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = downloadName(detail?.applicant?.name);
      link.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { setError(e?.message ?? 'Could not download the resume.'); }
  }

  return <div className="space-y-5">
    <div className="rounded-2xl p-6" style={card}><div className="flex items-center gap-3"><FileWarning className="text-amber-300" size={22} /><div><h2 className="font-['Oxanium'] text-xl font-bold text-white">Resume review queue</h2><p className="mt-1 text-sm text-white/50">Only flagged resumes appear here. Confirm the file is appropriate before allowing sponsor access.</p></div></div></div>
    {error && <p className="rounded-xl bg-rose-900/30 px-4 py-3 text-sm text-rose-200">{error}</p>}
    <div className="grid gap-5 lg:grid-cols-[20rem_1fr]">
      <section className="rounded-2xl overflow-hidden" style={card}>{isLoading ? <p className="p-5 text-sm text-white/50">Loading…</p> : !(data?.reviews.length) ? <p className="p-5 text-sm text-white/50">No reviews need officer approval.</p> : <div className="divide-y divide-white/5">{data.reviews.map((r) => <button key={r.review_id} onClick={() => setSelected(r.review_id)} className="w-full px-5 py-4 text-left transition hover:bg-white/[.03]" style={{ background: selected === r.review_id ? 'rgba(185,28,28,.15)' : undefined }}><p className="font-medium text-white">{r.applicant?.name ?? `Review #${r.review_id}`}</p><p className="mt-1 text-xs text-white/45">{r.applicant?.email ?? `Review #${r.review_id}`} · Submitted {formatDate(r.created_at)}</p></button>)}</div>}</section>
      <section className="rounded-2xl p-6" style={card}>{selected === null ? <p className="text-sm text-white/50">Select a flagged review to inspect it.</p> : detailLoading ? <div className="flex items-center gap-2 text-sm text-white/50"><Loader2 className="animate-spin" size={16} /> Loading review…</div> : <div className="space-y-5"><div><p className="text-xs uppercase tracking-wider text-white/40">{detail?.applicant?.email ?? `Review #${detail?.review_id}`}</p><h3 className="mt-1 text-lg font-semibold text-white">{detail?.applicant?.name ?? 'Security review required'}</h3><p className="mt-1 text-sm text-white/50">Security review required</p></div><button onClick={downloadResume} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"><Download size={16} /> Download submitted resume</button><div className="rounded-xl p-4" style={{ background: 'rgba(251,191,36,.08)', border: '1px solid rgba(251,191,36,.18)' }}><p className="text-xs font-medium uppercase tracking-wide text-amber-200">Signals detected</p><ul className="mt-2 list-disc pl-5 text-sm text-amber-100/85">{detail?.report?.security?.flags?.map((flag) => <li key={flag}>{flag}</li>) ?? <li>No details available.</li>}</ul></div>{detail?.report?.feedback?.summary && <div><p className="text-xs uppercase tracking-wide text-white/40">Review summary</p><p className="mt-1 text-sm leading-relaxed text-white/75">{detail.report.feedback.summary}</p></div>}<div className="space-y-2"><label className="block text-xs uppercase tracking-wide text-white/40" htmlFor="resume-rejection-reason">Reason if rejecting</label><textarea id="resume-rejection-reason" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} maxLength={1200} rows={3} placeholder="Explain what the member should correct before trying again." className="w-full rounded-xl px-3 py-2 text-sm text-white" style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(185,28,28,.2)' }} /></div><div className="flex flex-wrap gap-3"><button onClick={clear} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600"><CheckCircle2 size={16} /> Clear for sponsor sharing</button><button onClick={reject} className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600"><XCircle size={16} /> Reject resume</button></div></div>}</section>
    </div>
  </div>;
}
