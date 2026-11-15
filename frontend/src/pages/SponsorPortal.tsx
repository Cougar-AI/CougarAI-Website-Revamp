import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText } from 'lucide-react';
import { apiGet, apiGetBlob } from '@/lib/api';

type Sponsor = { sponsor_id: number; name: string };
type Submission = { submission_id: number; submitted_at: string; first_name: string | null; last_name: string | null; email: string; candidate_major: string | null; graduation_date: string | null; top_skills: string[] | null; seeking_roles: string | null };

export default function SponsorPortal() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { data: sponsorsData, isLoading } = useQuery<{ sponsors: Sponsor[] }>({ queryKey: ['my-sponsor-portals'], queryFn: () => apiGet('/resume-review/portal/sponsors') });
  const sponsors = sponsorsData?.sponsors ?? [];
  const sponsorId = selectedId ?? sponsors[0]?.sponsor_id ?? null;
  const { data: submissionsData, isLoading: loadingSubmissions } = useQuery<{ submissions: Submission[] }>({ queryKey: ['sponsor-portal-submissions', sponsorId], queryFn: () => apiGet(`/resume-review/portal/${sponsorId}/submissions`), enabled: sponsorId !== null });

  async function download(submission: Submission) {
    if (!sponsorId) return;
    const blob = await apiGetBlob(`/resume-review/portal/${sponsorId}/submissions/${submission.submission_id}/resume`);
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url;
    link.download = `${`${submission.first_name ?? ''} ${submission.last_name ?? ''}`.trim() || 'candidate'}-resume-review`;
    link.click(); URL.revokeObjectURL(url);
  }

  if (isLoading) return <main className="min-h-screen p-10 text-center text-white/50">Loading sponsor portal…</main>;
  if (!sponsors.length) return <main className="min-h-screen p-10 text-center text-white/50">You do not have access to a sponsor resume portal.</main>;
  return <main className="min-h-screen px-4 py-10 sm:px-8 font-['Oxanium']"><div className="mx-auto max-w-5xl"><div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-bold text-white">Sponsor Portal</h1><p className="mt-1 text-sm text-white/50">Candidate resumes shared directly with your organization.</p></div>{sponsors.length > 1 && <select value={sponsorId ?? ''} onChange={(e) => setSelectedId(Number(e.target.value))} className="rounded-xl px-4 py-2 text-sm text-white" style={{ background: '#250707', border: '1px solid rgba(185,28,28,.35)' }}>{sponsors.map((s) => <option key={s.sponsor_id} value={s.sponsor_id}>{s.name}</option>)}</select>}</div><section className="overflow-hidden rounded-2xl" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(185,28,28,.22)' }}><div className="border-b border-white/10 px-5 py-4"><h2 className="font-semibold text-white">Shared candidates</h2></div>{loadingSubmissions ? <p className="p-6 text-sm text-white/45">Loading…</p> : !(submissionsData?.submissions.length) ? <p className="p-6 text-sm text-white/45">No resumes have been shared with this sponsor yet.</p> : <div className="divide-y divide-white/10">{submissionsData.submissions.map((s) => <div key={s.submission_id} className="flex flex-wrap items-center gap-4 px-5 py-4"><FileText className="text-white/45" size={18} /><div className="min-w-48 flex-1"><p className="font-medium text-white">{`${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || s.email}</p><p className="text-sm text-white/50">{s.email}{s.candidate_major ? ` · ${s.candidate_major}` : ''}{s.graduation_date ? ` · ${s.graduation_date}` : ''}</p>{s.top_skills?.length ? <p className="mt-1 text-xs text-white/45">{s.top_skills.join(' · ')}</p> : null}</div><button onClick={() => download(s)} className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"><Download size={15} /> Download</button></div>)}</div>}</section></div></main>;
}
