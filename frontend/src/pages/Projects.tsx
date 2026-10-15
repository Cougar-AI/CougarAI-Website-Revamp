import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, FolderKanban, Github, Search, Users, X } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { PROJECT_STATUS_LABELS, resolveUploadUrl, type Project, type ProjectStatus } from '@/lib/projects';

const glass = { background: 'rgba(255,255,255,.04)', border: '1px solid rgba(185,28,28,.22)', backdropFilter: 'blur(10px)' } as const;

const STATUS_STYLES: Record<ProjectStatus, { background: string; color: string; border: string }> = {
  active: { background: 'rgba(245,158,11,.14)', color: 'rgba(253,230,138,.95)', border: 'rgba(245,158,11,.3)' },
  completed: { background: 'rgba(34,197,94,.14)', color: 'rgba(134,239,172,.95)', border: 'rgba(34,197,94,.3)' },
};

type StatusFilter = 'all' | ProjectStatus;

function StatusBadge({ status }: { status: ProjectStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span className="rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide" style={{ background: style.background, color: style.color, borderColor: style.border }}>
      {PROJECT_STATUS_LABELS[status]}
    </span>
  );
}

function Cover({ project, className }: { project: Project; className: string }) {
  const [failed, setFailed] = useState(false);
  const src = resolveUploadUrl(project.cover_image_url);
  if (!src || failed) {
    return (
      <div className={`${className} flex items-center justify-center`} style={{ background: 'linear-gradient(135deg, rgba(185,28,28,.35), rgba(20,0,0,.6))' }}>
        <FolderKanban size={36} className="text-red-300/60" />
      </div>
    );
  }
  return <img src={src} alt="" onError={() => setFailed(true)} className={`${className} object-cover`} />;
}

function ProjectLinks({ project }: { project: Project }) {
  if (!project.github_url && !project.demo_url) return null;
  const linkCls = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/15';
  return (
    <div className="flex flex-wrap gap-2">
      {project.github_url && <a href={project.github_url} target="_blank" rel="noopener noreferrer" className={linkCls} style={{ background: 'rgba(255,255,255,.08)' }} onClick={(e) => e.stopPropagation()}><Github size={13} /> Code</a>}
      {project.demo_url && <a href={project.demo_url} target="_blank" rel="noopener noreferrer" className={linkCls} style={{ background: 'rgba(185,28,28,.5)' }} onClick={(e) => e.stopPropagation()}><ExternalLink size={13} /> Demo</a>}
    </div>
  );
}

function ProjectModal({ project, onClose }: { project: Project; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto p-4 sm:items-center" style={{ background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(6px)' }} onClick={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label={project.title}>
      <div className="my-6 w-full max-w-2xl overflow-hidden rounded-2xl text-left" style={{ background: 'rgba(12,2,2,.97)', border: '1px solid rgba(185,28,28,.3)' }}>
        <div className="relative">
          <Cover project={project} className="h-48 w-full sm:h-60" />
          <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 rounded-full p-1.5 text-white/80 hover:text-white" style={{ background: 'rgba(0,0,0,.6)' }}><X size={18} /></button>
        </div>
        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={project.status} />
            {project.semester && <span className="text-xs text-white/45">{project.semester}</span>}
          </div>
          <h2 className="font-['Oxanium'] text-2xl font-extrabold text-white">{project.title}</h2>
          {project.summary && <p className="text-white/75">{project.summary}</p>}
          {project.description && <p className="whitespace-pre-line text-sm leading-relaxed text-white/60">{project.description}</p>}
          {project.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {project.tags.map((tag) => <span key={tag} className="rounded-full px-2.5 py-0.5 text-xs text-red-200" style={{ background: 'rgba(185,28,28,.18)' }}>{tag}</span>)}
            </div>
          )}
          {project.team_members.length > 0 && (
            <div>
              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/40"><Users size={12} /> Team</div>
              <p className="text-sm text-white/75">{project.team_members.join(', ')}</p>
            </div>
          )}
          {project.sponsor && (
            <div className="text-sm text-white/60">
              Sponsored by{' '}
              {project.sponsor.website
                ? <a href={project.sponsor.website} target="_blank" rel="noopener noreferrer" className="font-semibold text-red-300 hover:text-red-200">{project.sponsor.name}</a>
                : <span className="font-semibold text-white/85">{project.sponsor.name}</span>}
            </div>
          )}
          <ProjectLinks project={project} />
        </div>
      </div>
    </div>
  );
}

export default function Projects() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [openProject, setOpenProject] = useState<Project | null>(null);

  const { data, isLoading, isError } = useQuery<{ projects: Project[] }>({
    queryKey: ['public-projects'],
    queryFn: () => apiGet('/projects/'),
    staleTime: 5 * 60_000,
  });
  const projects = data?.projects ?? [];

  const allTags = useMemo(() => [...new Set(projects.flatMap((p) => p.tags))].sort((a, b) => a.localeCompare(b)), [projects]);
  const counts = useMemo(() => ({
    all: projects.length,
    active: projects.filter((p) => p.status === 'active').length,
    completed: projects.filter((p) => p.status === 'completed').length,
  }), [projects]);

  const query = search.trim().toLowerCase();
  const visible = projects.filter((p) =>
    (statusFilter === 'all' || p.status === statusFilter)
    && (!tagFilter || p.tags.includes(tagFilter))
    && (!query || [p.title, p.summary ?? '', p.team_members.join(' '), p.tags.join(' ')].join(' ').toLowerCase().includes(query)),
  );

  const chip = (active: boolean) => `rounded-full px-3 py-1.5 text-xs font-semibold transition ${active ? 'bg-red-700 text-white' : 'bg-white/5 text-white/65 hover:bg-white/10'}`;

  return (
    <div className="mx-auto max-w-6xl py-2 md:py-6">
      <header className="mx-auto max-w-3xl text-center">
        <h1 className="font-['Oxanium'] text-3xl font-extrabold tracking-tight md:text-5xl">Projects</h1>
        <p className="mx-auto mt-3 max-w-2xl text-white/70 md:text-lg">
          Research and build projects by CougarAI members, from first prototypes to sponsor-backed work.
        </p>
      </header>

      <div className="mt-8 flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center sm:justify-between" style={glass}>
        <div className="flex flex-wrap gap-2">
          {(['all', 'active', 'completed'] as const).map((key) => (
            <button key={key} onClick={() => setStatusFilter(key)} className={chip(statusFilter === key)}>
              {key === 'all' ? 'All' : PROJECT_STATUS_LABELS[key]} <span className="opacity-60">{counts[key]}</span>
            </button>
          ))}
        </div>
        <label className="relative block sm:w-64">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects, people, tags" className="w-full rounded-xl py-2 pl-8 pr-3 text-sm text-white outline-none focus:ring-2 focus:ring-red-500/50" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)' }} />
        </label>
      </div>

      {allTags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {allTags.map((tag) => (
            <button key={tag} onClick={() => setTagFilter(tagFilter === tag ? null : tag)} className={`rounded-full px-2.5 py-1 text-xs transition ${tagFilter === tag ? 'bg-red-700/80 text-white' : 'text-red-200/80 hover:text-red-100'}`} style={tagFilter === tag ? undefined : { background: 'rgba(185,28,28,.14)' }}>
              #{tag}
            </button>
          ))}
        </div>
      )}

      <section className="mt-6">
        {isLoading && <p className="py-16 text-center text-white/40">Loading projects…</p>}
        {isError && <p className="py-16 text-center text-white/40">Projects couldn't be loaded right now. Please try again later.</p>}
        {!isLoading && !isError && projects.length === 0 && (
          <div className="rounded-2xl p-10 text-center" style={glass}>
            <FolderKanban size={32} className="mx-auto text-red-300/60" />
            <p className="mt-3 font-['Oxanium'] text-lg font-bold">Projects are coming soon</p>
            <p className="mt-1 text-sm text-white/55">Want to build something with us? <Link to="/join" className="text-red-300 hover:text-red-200">Become a member</Link>.</p>
          </div>
        )}
        {!isLoading && projects.length > 0 && visible.length === 0 && (
          <p className="py-12 text-center text-white/45">No projects match these filters.</p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((project) => (
            <article
              key={project.project_id}
              onClick={() => setOpenProject(project)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpenProject(project))}
              tabIndex={0}
              role="button"
              aria-label={`Open ${project.title}`}
              className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl text-left transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-red-500/60"
              style={glass}
            >
              <Cover project={project} className="h-40 w-full" />
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={project.status} />
                  {project.semester && <span className="text-xs text-white/40">{project.semester}</span>}
                </div>
                <h2 className="font-['Oxanium'] text-lg font-bold leading-snug text-white">{project.title}</h2>
                {project.summary && <p className="line-clamp-3 text-sm text-white/60">{project.summary}</p>}
                {project.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {project.tags.slice(0, 4).map((tag) => <span key={tag} className="rounded-full px-2 py-0.5 text-[11px] text-red-200/90" style={{ background: 'rgba(185,28,28,.16)' }}>{tag}</span>)}
                    {project.tags.length > 4 && <span className="text-[11px] text-white/35">+{project.tags.length - 4}</span>}
                  </div>
                )}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
                  {project.team_members.length > 0
                    ? <span className="inline-flex items-center gap-1 text-xs text-white/45"><Users size={12} /> {project.team_members.length} member{project.team_members.length === 1 ? '' : 's'}</span>
                    : <span />}
                  <ProjectLinks project={project} />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {openProject && <ProjectModal project={openProject} onClose={() => setOpenProject(null)} />}
    </div>
  );
}
