import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText } from 'lucide-react';
import { apiGet, apiGetBlob } from '@/lib/api';

type Sponsor = { sponsor_id: number; name: string };
type Submission = {
  submission_id: number;
  first_name: string | null;
  last_name: string | null;
  email: string;
  candidate_major: string | null;
  graduation_date: string | null;
  top_skills: string[] | null;
  portfolio_url: string | null;
  github_url: string | null;
  linkedin_url: string | null;
};

const panel = {
  background: 'rgba(24, 24, 27, .86)',
  border: '1px solid rgba(185,28,28,.32)',
  backdropFilter: 'blur(12px)',
};

export default function SponsorPortal() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { data, isLoading } = useQuery<{ sponsors: Sponsor[] }>({
    queryKey: ['my-sponsor-portals'],
    queryFn: () => apiGet('/resume-review/portal/sponsors'),
  });
  const sponsors = data?.sponsors ?? [];
  const sponsorId = selectedId ?? sponsors[0]?.sponsor_id ?? null;
  const { data: submissionsData, isLoading: loadingSubmissions } = useQuery<{ submissions: Submission[] }>({
    queryKey: ['sponsor-portal-submissions', sponsorId],
    queryFn: () => apiGet(`/resume-review/portal/${sponsorId}/submissions`),
    enabled: sponsorId !== null,
  });

  async function download(submission: Submission) {
    if (!sponsorId) return;
    const blob = await apiGetBlob(`/resume-review/portal/${sponsorId}/submissions/${submission.submission_id}/resume`);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${`${submission.first_name ?? ''} ${submission.last_name ?? ''}`.trim() || 'candidate'}-resume-review`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) return <main className="min-h-screen p-10 text-center text-white/50">Loading sponsor portal…</main>;
  if (!sponsors.length) return <main className="min-h-screen p-10 text-center text-white/50">You do not have access to a sponsor resume portal.</main>;

  return <main className="min-h-screen px-4 py-10 font-['Oxanium'] sm:px-8"><div className="mx-auto max-w-5xl">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-3xl font-bold text-white">Sponsor Portal</h1><p className="mt-1 text-sm text-white/60">Candidate resumes shared directly with your organization.</p></div>
      {sponsors.length > 1 && <select value={sponsorId ?? ''} onChange={(e) => setSelectedId(Number(e.target.value))} className="rounded-xl px-4 py-2 text-sm text-white" style={panel}>{sponsors.map((s) => <option key={s.sponsor_id} value={s.sponsor_id}>{s.name}</option>)}</select>}
    </div>
    <section className="overflow-hidden rounded-2xl" style={panel}>
      <div className="border-b border-white/15 px-6 py-5"><h2 className="text-xl font-semibold text-white">Shared candidates</h2></div>
      {loadingSubmissions ? <p className="p-6 text-sm text-white/55">Loading…</p> : !(submissionsData?.submissions.length) ? <p className="p-6 text-sm text-white/55">No resumes have been shared with this sponsor yet.</p> : <div className="divide-y divide-white/10">{submissionsData.submissions.map((s) => <div key={s.submission_id} className="flex flex-wrap items-center gap-4 px-6 py-5">
        <FileText className="text-white/65" size={20} />
        <div className="min-w-52 flex-1"><p className="text-lg font-semibold text-white">{`${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || s.email}</p><p className="text-sm text-white/70">{s.email}{s.candidate_major ? ` · ${s.candidate_major}` : ''}{s.graduation_date ? ` · ${s.graduation_date}` : ''}</p>{s.top_skills?.length ? <p className="mt-2 text-sm text-white/65">{s.top_skills.join(' · ')}</p> : null}{(s.portfolio_url || s.github_url || s.linkedin_url) && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">{s.portfolio_url && <a href={s.portfolio_url} target="_blank" rel="noreferrer" className="text-red-200 underline underline-offset-4 hover:text-white">Portfolio</a>}{s.github_url && <a href={s.github_url} target="_blank" rel="noreferrer" className="text-red-200 underline underline-offset-4 hover:text-white">GitHub</a>}{s.linkedin_url && <a href={s.linkedin_url} target="_blank" rel="noreferrer" className="text-red-200 underline underline-offset-4 hover:text-white">LinkedIn</a>}</div>}</div>
        <button onClick={() => download(s)} className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-600"><Download size={16} /> Download</button>
      </div>)}</div>}
    </section>
  </div></main>;
}
