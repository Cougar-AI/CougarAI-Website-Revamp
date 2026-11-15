import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, FileText, FileUp, Send, ShieldCheck, Upload, X } from 'lucide-react';
import { apiDelete, apiGet, apiPost, apiUpload } from '@/lib/api';
import type { MeResponse } from '@/pages/Dashboard';

type Review = { review_id: number; status: 'queued' | 'processing' | 'done' | 'rejected' | 'failed'; filename_ext: string; display_filename?: string; needs_review: boolean; reviewed_by: number | null; error_message: string | null; rejection_reason?: string | null; created_at: string; finished_at: string | null };
type ReviewDetail = { report?: { ats_view?: { parsed?: { education?: { field_of_study?: string; graduation_date?: string }[]; skills?: string[] } } } };
type Sponsor = { sponsor_id: number; name: string; accepting_submissions: boolean };
type Submission = { submission_id: number; review_id: number; sponsor_id: number; sponsor_name: string; submitted_at: string; withdrawn_at: string | null; first_viewed_at: string | null };
const card = { background: 'rgba(255,255,255,.04)', border: '1px solid rgba(185,28,28,.22)', backdropFilter: 'blur(10px)' };

export default function ResumeTab({ meData }: { meData?: MeResponse }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [jd, setJd] = useState('');
  const [sponsorId, setSponsorId] = useState('');
  const [sharingReview, setSharingReview] = useState<number | null>(null);
  const [prefilledReview, setPrefilledReview] = useState<number | null>(null);
  const [selectedReadyReview, setSelectedReadyReview] = useState('');
  const [readyDropdownOpen, setReadyDropdownOpen] = useState(false);
  const [sponsorDropdownOpen, setSponsorDropdownOpen] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [recruiterProfile, setRecruiterProfile] = useState({ major: meData?.profile?.major ?? '', graduation_date: '', top_skills: '', portfolio_url: '', github_url: '', linkedin_url: '', seeking_roles: '', availability: '', contact_preference: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isPaid = meData?.membership?.status === 'active';
  const { data: reviewsData, isLoading: reviewsLoading, isError: reviewsError } = useQuery<{ reviews: Review[] }>({
    queryKey: ['resume-reviews'],
    queryFn: () => apiGet('/resume-review/'),
    // A worker completes outside this browser, so check the authoritative API
    // until that asynchronous job leaves the queue.
    refetchInterval: (q) => q.state.data?.reviews.some((r) => r.status === 'queued' || r.status === 'processing') ? 5000 : false,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    staleTime: 0,
  });
  const { data: sponsorsData } = useQuery<{ sponsors: Sponsor[] }>({ queryKey: ['resume-sponsors'], queryFn: () => apiGet('/sponsors/') });
  const { data: submissionsData } = useQuery<{ submissions: Submission[] }>({ queryKey: ['resume-submissions'], queryFn: () => apiGet('/resume-review/submissions') });
  const { data: selectedReview } = useQuery<ReviewDetail>({ queryKey: ['resume-review', sharingReview], queryFn: () => apiGet(`/resume-review/${sharingReview}`), enabled: sharingReview !== null });
  const reviews = reviewsData?.reviews ?? [];
  const sponsors = sponsorsData?.sponsors ?? [];
  const acceptingSponsors = sponsors.filter((sponsor) => sponsor.accepting_submissions);
  const readyReviews = reviews.filter((review) => review.status === 'done' && (!review.needs_review || review.reviewed_by));
  const requestedReadyReviewId = Number(selectedReadyReview);
  const currentReadyReviewId = readyReviews.some((review) => review.review_id === requestedReadyReviewId)
    ? requestedReadyReviewId
    : (readyReviews[0]?.review_id ?? 0);

  useEffect(() => {
    if (!sharingReview || !selectedReview || prefilledReview === sharingReview) return;
    const parsed = selectedReview.report?.ats_view?.parsed;
    const education = parsed?.education?.[0];
    setRecruiterProfile((current) => ({ ...current, major: current.major || meData?.profile?.major || education?.field_of_study || '', graduation_date: current.graduation_date || education?.graduation_date || '', top_skills: current.top_skills || (parsed?.skills ?? []).slice(0, 10).join(', ') }));
    setPrefilledReview(sharingReview);
  }, [sharingReview, selectedReview, prefilledReview, meData?.profile?.major]);

  async function upload() {
    if (!file) return;
    setBusy(true); setError('');
    try { const body = new FormData(); body.append('file', file); body.append('job_description', jd); await apiUpload('/resume-review/', body); setFile(null); setJd(''); if (fileRef.current) fileRef.current.value = ''; qc.invalidateQueries({ queryKey: ['resume-reviews'] }); }
    catch (e: any) { setError(e?.message ?? 'Could not submit resume'); } finally { setBusy(false); }
  }
  async function share() {
    if (!sharingReview || !sponsorId) return;
    setBusy(true); setError('');
    try { await apiPost(`/resume-review/${sharingReview}/submissions`, { sponsor_id: Number(sponsorId), consent: true, recruiter_profile: { ...recruiterProfile, top_skills: recruiterProfile.top_skills.split(',').map((skill) => skill.trim()).filter(Boolean) } }); setSharingReview(null); setSponsorId(''); qc.invalidateQueries({ queryKey: ['resume-submissions'] }); }
    catch (e: any) { setError(e?.message ?? 'Could not share resume'); } finally { setBusy(false); }
  }
  async function withdraw(id: number) { try { await apiDelete(`/resume-review/submissions/${id}`); qc.invalidateQueries({ queryKey: ['resume-submissions'] }); } catch (e: any) { setError(e?.message ?? 'Could not withdraw submission'); } }
  async function cancelReview(id: number, name: string, queued: boolean) {
    const message = queued
      ? `Cancel the queued review for ${name}? The uploaded resume will be permanently removed.`
      : `Cancel this review for ${name}? It will be permanently removed and will no longer be available to share.`;
    if (!confirm(message)) return;
    setError('');
    try { await apiDelete(`/resume-review/${id}`); qc.invalidateQueries({ queryKey: ['resume-reviews'] }); }
    catch (e: any) { setError(e?.message ?? 'Could not cancel this review.'); }
  }

  if (!isPaid) return <section className="rounded-2xl p-6" style={card}><h2 className="text-lg font-semibold text-white">Resume portal</h2><p className="mt-2 text-sm text-white/60">An active paid membership is required to review and share a resume with sponsors.</p></section>;
  return <section className="space-y-5">
    <div className="rounded-2xl p-6" style={card}><div className="flex items-center gap-2"><ShieldCheck size={18} className="text-red-300" /><h2 className="text-lg font-semibold text-white">Private resume review</h2></div><p className="mt-1 text-sm text-white/55">Your resume is only shared after you choose a sponsor. Flagged files require officer review first.</p>
      {readyReviews.length > 0 && !showUploadForm && <div className="mt-4 rounded-xl p-4" style={{ background: 'rgba(16,185,129,.08)', border: '1px solid rgba(52,211,153,.18)' }}>
        <p className="text-sm font-medium text-white">A reviewed resume is ready to share</p>
        <p className="mt-1 text-xs text-white/55">Choose an existing review, or upload a different file only when you want a new review.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="relative min-w-52">
            <button type="button" onClick={() => setReadyDropdownOpen((open) => !open)} aria-haspopup="listbox" aria-expanded={readyDropdownOpen} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-white transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-emerald-300" style={{ background: '#250707', border: '1px solid rgba(52,211,153,.38)' }}>
              <span className="truncate">{readyReviews.find((review) => review.review_id === currentReadyReviewId)?.display_filename || `Resume review #${currentReadyReviewId}`}</span><ChevronDown size={16} className={`shrink-0 transition ${readyDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {readyDropdownOpen && <div role="listbox" className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl p-1 shadow-2xl" style={{ background: '#200707', border: '1px solid rgba(52,211,153,.32)' }}>
              {readyReviews.map((review) => { const active = review.review_id === currentReadyReviewId; return <button type="button" role="option" aria-selected={active} key={review.review_id} onClick={() => { setSelectedReadyReview(String(review.review_id)); setReadyDropdownOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-white transition hover:bg-emerald-700/30" style={active ? { background: 'rgba(16,185,129,.18)' } : undefined}>{active && <Check size={15} className="shrink-0 text-emerald-300" />}<span className="truncate">{review.display_filename || `Resume review #${review.review_id}`}</span></button>; })}
            </div>}
          </div>
          <button type="button" onClick={() => { setPrefilledReview(null); setSharingReview(currentReadyReviewId); }} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600">Share selected resume</button>
          <button type="button" onClick={() => setShowUploadForm(true)} className="text-sm text-white/65 underline underline-offset-4 hover:text-white">Upload a different resume</button>
        </div>
      </div>}
      {(readyReviews.length === 0 || showUploadForm) && <div className="mt-4 grid gap-3">
        {readyReviews.length > 0 && <div className="flex items-center justify-between gap-3"><p className="text-sm text-white/65">Upload a different file to start a new review.</p><button type="button" onClick={() => { setShowUploadForm(false); setFile(null); if (fileRef.current) fileRef.current.value = ''; }} className="text-xs text-white/60 underline underline-offset-4 hover:text-white">Use an existing review</button></div>}
        <input ref={fileRef} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="hidden" />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 focus:ring-2 focus:ring-red-300" style={{ background: 'rgba(185,28,28,.72)', border: '1px solid rgba(254,202,202,.35)' }}><FileUp size={17} /> Choose resume</button>
          {file ? <><span className="max-w-full truncate text-sm text-white/85" title={file.name}>{file.name}</span><button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }} className="text-xs text-rose-200 underline underline-offset-4 hover:text-white">Remove</button></> : <span className="text-sm text-white/55">PDF or DOCX, up to 5 MB</span>}
        </div>
        <textarea value={jd} onChange={(e) => setJd(e.target.value)} maxLength={6000} rows={3} placeholder="Optional job description for tailored feedback" className="rounded-xl p-3 text-sm text-white" style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(185,28,28,.2)' }} />
        <button disabled={!file || busy} onClick={upload} className="flex w-fit items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: 'rgba(185,28,28,.65)' }}><Upload size={15} />{busy ? 'Uploading…' : 'Upload resume'}</button>
      </div>}
    </div>
    {error && <p className="rounded-xl px-4 py-3 text-sm text-rose-300" style={{ background: 'rgba(190,24,93,.12)' }}>{error}</p>}
    <div className="rounded-2xl overflow-hidden" style={card}><div className="px-5 py-4 border-b border-white/10"><h3 className="font-medium text-white">Your reviews</h3></div>{reviewsLoading ? <p className="p-6 text-sm text-white/45">Loading your resume reviews…</p> : reviewsError ? <p className="p-6 text-sm text-rose-300">We couldn’t load your resume reviews. Please refresh and try again.</p> : !reviews.length ? <p className="p-6 text-sm text-white/45">No resume reviews yet.</p> : <div className="divide-y divide-white/5">{reviews.map((r) => { const name = r.display_filename || `Resume review #${r.review_id}`; const canCancel = ['queued', 'done', 'failed', 'rejected'].includes(r.status); return <div key={r.review_id} className="flex flex-wrap items-center gap-3 px-5 py-4"><FileText size={17} className="text-white/50" /><div className="min-w-40 flex-1"><p className="text-sm text-white">{name}</p><p className="text-xs text-white/45">{r.status === 'done' ? 'Ready to share' : r.status === 'queued' ? 'Queued — waiting to be processed' : r.status}{r.needs_review && !r.reviewed_by ? ' · officer review required' : ''}</p>{r.status === 'rejected' && r.rejection_reason && <p className="mt-2 text-xs leading-relaxed text-rose-200">Officer feedback: {r.rejection_reason}</p>}</div>{r.error_message && <p className="text-xs text-rose-300">{r.error_message}</p>}{canCancel && <button onClick={() => cancelReview(r.review_id, name, r.status === 'queued')} className="rounded-lg border border-rose-400/30 px-3 py-2 text-xs text-rose-200 transition hover:bg-rose-900/30">{r.status === 'queued' ? 'Cancel upload' : 'Cancel review'}</button>}{r.status === 'done' && (!r.needs_review || r.reviewed_by) && <button onClick={() => { setPrefilledReview(null); setSharingReview(r.review_id); }} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-white" style={{ background: 'rgba(185,28,28,.5)' }}><Send size={13} /> Share</button>}</div>; })}</div>}</div>
    {sharingReview && <div className="rounded-2xl p-5" style={card}>
      <div className="flex justify-between gap-3"><div><h3 className="font-medium text-white">Share with a sponsor</h3><p className="mt-1 text-xs text-white/50">Add any details you want this sponsor to see. Your resume is shared only after you consent.</p></div><button onClick={() => setSharingReview(null)} className="text-white/50"><X size={16} /></button></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input value={recruiterProfile.major} onChange={(e) => setRecruiterProfile({ ...recruiterProfile, major: e.target.value })} placeholder="Major" className="rounded-lg px-3 py-2 text-sm text-white" style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(185,28,28,.2)' }} />
        <input value={recruiterProfile.graduation_date} onChange={(e) => setRecruiterProfile({ ...recruiterProfile, graduation_date: e.target.value })} placeholder="Expected graduation (e.g. May 2027)" className="rounded-lg px-3 py-2 text-sm text-white" style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(185,28,28,.2)' }} />
        <input value={recruiterProfile.top_skills} onChange={(e) => setRecruiterProfile({ ...recruiterProfile, top_skills: e.target.value })} placeholder="Top skills (comma separated)" className="rounded-lg px-3 py-2 text-sm text-white sm:col-span-2" style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(185,28,28,.2)' }} />
        <input value={recruiterProfile.portfolio_url} onChange={(e) => setRecruiterProfile({ ...recruiterProfile, portfolio_url: e.target.value })} placeholder="Portfolio URL" className="rounded-lg px-3 py-2 text-sm text-white" style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(185,28,28,.2)' }} />
        <input value={recruiterProfile.github_url} onChange={(e) => setRecruiterProfile({ ...recruiterProfile, github_url: e.target.value })} placeholder="GitHub URL" className="rounded-lg px-3 py-2 text-sm text-white" style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(185,28,28,.2)' }} />
        <input value={recruiterProfile.linkedin_url} onChange={(e) => setRecruiterProfile({ ...recruiterProfile, linkedin_url: e.target.value })} placeholder="LinkedIn URL" className="rounded-lg px-3 py-2 text-sm text-white" style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(185,28,28,.2)' }} />
        <input value={recruiterProfile.seeking_roles} onChange={(e) => setRecruiterProfile({ ...recruiterProfile, seeking_roles: e.target.value })} placeholder="Roles you are seeking" className="rounded-lg px-3 py-2 text-sm text-white" style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(185,28,28,.2)' }} />
        <input value={recruiterProfile.availability} onChange={(e) => setRecruiterProfile({ ...recruiterProfile, availability: e.target.value })} placeholder="Availability" className="rounded-lg px-3 py-2 text-sm text-white" style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(185,28,28,.2)' }} />
        <input value={recruiterProfile.contact_preference} onChange={(e) => setRecruiterProfile({ ...recruiterProfile, contact_preference: e.target.value })} placeholder="Contact preference" className="rounded-lg px-3 py-2 text-sm text-white sm:col-span-2" style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(185,28,28,.2)' }} />
      </div>
      <div className="mt-4 flex flex-wrap items-start gap-3"><div className="relative min-w-56"><button type="button" onClick={() => setSponsorDropdownOpen((open) => !open)} aria-haspopup="listbox" aria-expanded={sponsorDropdownOpen} disabled={!acceptingSponsors.length} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-white transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-red-300 disabled:cursor-not-allowed disabled:opacity-50" style={{ background: '#250707', border: '1px solid rgba(185,28,28,.45)' }}><span className="truncate">{acceptingSponsors.find((sponsor) => sponsor.sponsor_id === Number(sponsorId))?.name ?? (acceptingSponsors.length ? 'Choose sponsor' : 'No sponsors available')}</span><ChevronDown size={16} className={`shrink-0 transition ${sponsorDropdownOpen ? 'rotate-180' : ''}`} /></button>{sponsorDropdownOpen && acceptingSponsors.length > 0 && <div role="listbox" className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl p-1 shadow-2xl" style={{ background: '#200707', border: '1px solid rgba(185,28,28,.4)' }}>{acceptingSponsors.map((sponsor) => { const active = sponsor.sponsor_id === Number(sponsorId); return <button type="button" role="option" aria-selected={active} key={sponsor.sponsor_id} onClick={() => { setSponsorId(String(sponsor.sponsor_id)); setSponsorDropdownOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-white transition hover:bg-red-900/40" style={active ? { background: 'rgba(185,28,28,.3)' } : undefined}>{active && <Check size={15} className="shrink-0 text-red-200" />}<span className="truncate">{sponsor.name}</span></button>; })}</div>}</div><button disabled={!sponsorId || busy} onClick={share} className="rounded-lg px-4 py-2 text-sm text-white disabled:opacity-50" style={{ background: 'rgba(185,28,28,.65)' }}>I consent to share</button></div>{!acceptingSponsors.length && <p className="mt-3 text-xs text-amber-200/80">No sponsors are accepting resume submissions right now. Check back soon.</p>}</div>}
    <div className="rounded-2xl overflow-hidden" style={card}><div className="px-5 py-4 border-b border-white/10"><h3 className="font-medium text-white">Sponsor submissions</h3></div>{!(submissionsData?.submissions.length) ? <p className="p-6 text-sm text-white/45">Nothing has been shared yet.</p> : <div className="divide-y divide-white/5">{submissionsData.submissions.map((s) => <div key={s.submission_id} className="flex items-center gap-3 px-5 py-4"><div className="flex-1"><p className="text-sm text-white">{s.sponsor_name}</p><p className="text-xs text-white/45">{s.withdrawn_at ? 'Withdrawn' : s.first_viewed_at ? 'Viewed by sponsor' : 'Submitted'}</p></div>{!s.withdrawn_at && <button onClick={() => withdraw(s.submission_id)} className="text-xs text-rose-300">Withdraw</button>}</div>)}</div>}</div>
  </section>;
}
