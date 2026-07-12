import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, BookOpen, FolderKanban, Gift, Lock, Sparkles, Star, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { apiGet } from "@/lib/api";
import type { MeResponse } from "@/pages/Dashboard";
import { formatDate } from "@/lib/dates";

interface Props {
  meData?: MeResponse;
}

interface PointsEntry {
  points_id: number;
  event_name: string | null;
  event_type: string | null;
  points: number;
  date: string;
}

interface PointsResponse {
  total: number;
  rank: number;
  total_members: number;
  entries: PointsEntry[];
}

interface KnowledgeEntry {
  entry_id: number;
  content_type: string;
  title: string;
  summary: string;
  source_url: string | null;
  published_at: string | null;
  is_featured: boolean;
}

interface KnowledgeEntriesResponse {
  entries: KnowledgeEntry[];
}

interface EventSummary {
  event_id: number;
  name: string;
  event_type: string | null;
  description: string | null;
  location: string | null;
  starts_at: string | null;
  points_value: number | null;
}

function getRewardTier(totalPoints: number) {
  if (totalPoints >= 200) return { label: "Elite", nextGoal: null, accent: "text-amber-300" };
  if (totalPoints >= 100) return { label: "Gold", nextGoal: 200, accent: "text-amber-200" };
  if (totalPoints >= 50) return { label: "Silver", nextGoal: 100, accent: "text-slate-200" };
  return { label: "Bronze", nextGoal: 50, accent: "text-white/70" };
}

function formatDateTime(value?: string | null) {
  if (!value) return "TBA";
  const date = new Date(value);
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <section
      className="rounded-2xl p-5"
      style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" }}
    >
      <div className="mb-4 flex items-center gap-2">
        <Icon size={16} className="text-red-400" />
        <h3 className="font-['Oxanium'] text-base font-semibold text-white">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export default function OverviewTab({ meData }: Props) {
  const membership = meData?.membership;
  const totalPoints = meData?.points_summary?.total ?? 0;
  const rewardTier = getRewardTier(totalPoints);
  const hasActiveMembership = membership?.status === "active";

  const { data: pointsData } = useQuery<PointsResponse>({
    queryKey: ["dashboard-overview-points"],
    queryFn: () => apiGet<PointsResponse>("/dashboard/points?limit=6"),
    staleTime: 60_000,
  });

  const { data: projectData } = useQuery<KnowledgeEntriesResponse>({
    queryKey: ["dashboard-overview-projects"],
    queryFn: async () => {
      try {
        return await apiGet<KnowledgeEntriesResponse>("/knowledge-base/entries?type=project");
      } catch {
        return { entries: [] };
      }
    },
    staleTime: 120_000,
  });

  const { data: workshopData } = useQuery<EventSummary[]>({
    queryKey: ["dashboard-overview-workshops"],
    queryFn: async () => {
      try {
        return await apiGet<EventSummary[]>("/events?limit=12");
      } catch {
        return [];
      }
    },
    staleTime: 120_000,
  });

  const upcomingWorkshops = useMemo(() => {
    const now = Date.now();
    return (workshopData ?? [])
      .filter((event) => {
        if (!event.starts_at) return false;
        const type = (event.event_type || "").toLowerCase();
        return new Date(event.starts_at).getTime() >= now && type.includes("workshop");
      })
      .sort((a, b) => new Date(a.starts_at || 0).getTime() - new Date(b.starts_at || 0).getTime())
      .slice(0, 3);
  }, [workshopData]);

  const featuredProjects = useMemo(() => {
    return [...(projectData?.entries ?? [])]
      .sort((a, b) => Number(b.is_featured) - Number(a.is_featured))
      .slice(0, 3);
  }, [projectData]);

  const quickActions = [
    {
      title: "Attend a workshop",
      body: "See the next hands-on sessions and earn points while you build.",
      to: "/calendar",
      cta: "Open events",
    },
    {
      title: "Explore projects",
      body: "Browse project recaps and find ideas for your next CAI build.",
      to: "/knowledge-base",
      cta: "View projects",
    },
    {
      title: "Climb the leaderboard",
      body: "Track your points, streak, and progress toward the next tier.",
      to: "/dashboard?tab=points",
      cta: "See points",
    },
    {
      title: "Use your membership",
      body: hasActiveMembership
        ? "Your membership is active, so you can jump into workshops, resources, and project opportunities."
        : "Activate a membership to unlock workshops, project priority, and member rewards.",
      to: hasActiveMembership ? "/dashboard?tab=membership" : "/join",
      cta: hasActiveMembership ? "See benefits" : "Become a member",
    },
  ];

  const accessItems = [
    "All workshops and events",
    "Knowledge Bar access for project and AI resources",
    "Project team consideration and showcase opportunities",
    "Discord member channels and club updates",
    "Points, streaks, and semester reward eligibility",
  ];

  const rewardSteps = [
    { threshold: 0, label: "Bronze", description: "Start building your streak and begin earning points through events and check-ins." },
    { threshold: 50, label: "Silver", description: "Reach a stronger standing for recognition and end-of-semester reward announcements." },
    { threshold: 100, label: "Gold", description: "Push into the top tier of active members and stay competitive for club perks." },
    { threshold: 200, label: "Elite", description: "Finish as a high-impact member with top-level points momentum for the semester." },
  ];

  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(185,28,28,.22)" }}
    >
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-['Oxanium'] text-lg font-semibold text-white">CAI Overview</h2>
          <p className="mt-1 text-sm text-white/55">
            A quick view of what to do next, what you can access, and how your points are moving.
          </p>
        </div>
        <div className="rounded-xl bg-white/5 px-4 py-3 text-sm text-white/70 ring-1 ring-white/10">
          <p className="text-xs uppercase tracking-[0.18em] text-white/35">Current tier</p>
          <p className={`mt-1 font-['Oxanium'] text-xl font-semibold ${rewardTier.accent}`}>{rewardTier.label}</p>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {quickActions.map((action) => (
          <Link
            key={action.title}
            to={action.to}
            className="rounded-2xl p-4 no-underline transition hover:bg-white/[0.06]"
            style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)" }}
          >
            <p className="font-['Oxanium'] text-base font-semibold text-white">{action.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-white/60">{action.body}</p>
            <p className="mt-4 text-sm font-medium text-red-400">{action.cta} →</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <div className="grid gap-4">
          <SectionCard title="Points Timeline" icon={Star}>
            {!pointsData?.entries?.length ? (
              <p className="text-sm text-white/45">No point activity yet. Attend an event to start your timeline.</p>
            ) : (
              <div className="space-y-3">
                {pointsData.entries.map((entry) => (
                  <div key={entry.points_id} className="flex gap-3">
                    <div className="flex w-16 flex-shrink-0 flex-col items-center">
                      <span className="mt-1 h-2.5 w-2.5 rounded-full bg-red-500" />
                      <span className="mt-2 h-full w-px bg-white/10" />
                    </div>
                    <div className="min-w-0 flex-1 rounded-xl bg-white/5 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">{entry.event_name ?? "Event activity"}</p>
                          <p className="mt-1 text-xs text-white/45">
                            {(entry.event_type || "event").toUpperCase()} · {formatDate(entry.date)}
                          </p>
                        </div>
                        <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-semibold text-red-300">
                          +{entry.points}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Available Projects" icon={FolderKanban}>
            {!featuredProjects.length ? (
              <p className="text-sm text-white/45">No projects are listed yet in the Knowledge Bar.</p>
            ) : (
              <div className="space-y-3">
                {featuredProjects.map((project) => (
                  <div key={project.entry_id} className="rounded-xl bg-white/5 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-white">{project.title}</p>
                        <p className="mt-1 text-sm leading-relaxed text-white/60">{project.summary}</p>
                      </div>
                      {project.is_featured && (
                        <span className="rounded-full bg-red-500/15 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-red-300">
                          Featured
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Link to="/knowledge-base" className="mt-4 inline-flex text-sm font-medium text-red-400">
              Open Knowledge Bar →
            </Link>
          </SectionCard>
        </div>

        <div className="grid gap-4">
          <SectionCard title="Upcoming Workshops" icon={CalendarDays}>
            {!upcomingWorkshops.length ? (
              <p className="text-sm text-white/45">No upcoming workshops are posted right now.</p>
            ) : (
              <div className="space-y-3">
                {upcomingWorkshops.map((event) => (
                  <div key={event.event_id} className="rounded-xl bg-white/5 p-4">
                    <p className="font-medium text-white">{event.name}</p>
                    <p className="mt-1 text-sm text-white/55">{formatDateTime(event.starts_at)}</p>
                    <p className="mt-1 text-sm text-white/45">{event.location || "Location TBA"}</p>
                    {event.points_value ? (
                      <p className="mt-2 text-xs font-medium text-red-300">Worth {event.points_value} points</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
            <Link to="/calendar" className="mt-4 inline-flex text-sm font-medium text-red-400">
              View all events →
            </Link>
          </SectionCard>

          <SectionCard title="What You Have Access To" icon={hasActiveMembership ? Sparkles : Lock}>
            <div className="space-y-2">
              {accessItems.map((item) => (
                <div key={item} className="flex items-start gap-2 rounded-xl bg-white/5 px-3 py-2.5 text-sm text-white/70">
                  <span className={`mt-1 block h-2 w-2 rounded-full ${hasActiveMembership ? "bg-emerald-400" : "bg-white/25"}`} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-white/40">
              {hasActiveMembership
                ? "Your membership is active, so these member resources are open to you."
                : "Purchase a membership to unlock the full CAI member experience."}
            </p>
          </SectionCard>

          <SectionCard title="Point Reward Ladder" icon={Gift}>
            <div className="space-y-3">
              {rewardSteps.map((step) => {
                const reached = totalPoints >= step.threshold;
                return (
                  <div
                    key={step.label}
                    className="rounded-xl p-4"
                    style={{ background: reached ? "rgba(185,28,28,.10)" : "rgba(255,255,255,.04)", border: `1px solid ${reached ? "rgba(185,28,28,.25)" : "rgba(255,255,255,.08)"}` }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-white">{step.label}</p>
                      <span className="text-xs font-semibold uppercase tracking-wide text-white/45">{step.threshold}+ pts</span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-white/60">{step.description}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 rounded-xl bg-white/5 p-3 text-sm text-white/60">
              <div className="flex items-center gap-2">
                <Trophy size={14} className="text-amber-300" />
                <span>
                  {rewardTier.nextGoal
                    ? `You need ${rewardTier.nextGoal - totalPoints} more points to reach ${rewardTier.nextGoal === 50 ? "Silver" : rewardTier.nextGoal === 100 ? "Gold" : "Elite"}.`
                    : "You are already in the top points tier."}
                </span>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="CAI Resources" icon={BookOpen}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Link to="/knowledge-base" className="rounded-xl bg-white/5 p-4 transition hover:bg-white/10">
                <p className="font-medium text-white">Knowledge Bar</p>
                <p className="mt-1 text-sm text-white/55">Workshop recaps, officer advice, project notes, and AI updates.</p>
              </Link>
              <Link to="/dashboard?tab=leaderboard" className="rounded-xl bg-white/5 p-4 transition hover:bg-white/10">
                <p className="font-medium text-white">Leaderboard</p>
                <p className="mt-1 text-sm text-white/55">Track where you stand and use your points momentum to climb higher.</p>
              </Link>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
