import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star, Trophy, Flame, Calendar } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { MeResponse } from "@/pages/Dashboard";
import { formatDate } from "@/lib/dates";

interface Props {
  meData?: MeResponse;
  onRefresh: () => void;
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
  page: number;
  has_more: boolean;
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  workshop: "text-green-400",
  meeting: "text-blue-400",
};

function eventTypeColor(type: string | null): string {
  return type ? (EVENT_TYPE_COLORS[type.toLowerCase()] ?? "text-red-400") : "text-red-400";
}

function SummaryCard({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon: React.ElementType }) {
  return (
    <div
      className="flex flex-col gap-1 rounded-xl p-4"
      style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" }}
    >
      <div className="flex items-center gap-2 text-white/50">
        <Icon size={14} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="font-['Oxanium'] text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

export default function PointsTab({ meData }: Props) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<PointsResponse>({
    queryKey: ["dashboard-points", page],
    queryFn: () => apiGet<PointsResponse>(`/dashboard/points?page=${page}&limit=10`),
    staleTime: 60_000,
  });

  const profile = meData?.profile;
  const summary = meData?.points_summary;

  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(185,28,28,.22)" }}
    >
      <h2 className="mb-5 font-['Oxanium'] text-lg font-semibold text-white">Points</h2>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Total Points" value={data?.total ?? summary?.total ?? 0} icon={Star} />
        <SummaryCard
          label="Rank"
          value={summary?.rank ? `#${summary.rank}` : "—"}
          icon={Trophy}
        />
        <SummaryCard
          label="Current Streak"
          value={profile ? `${profile.current_streak} 🔥` : "—"}
          icon={Flame}
        />
        <SummaryCard
          label="Max Streak"
          value={profile?.max_streak ?? "—"}
          icon={Calendar}
        />
      </div>

      {/* Activity feed */}
      <h3 className="mb-3 text-sm font-medium text-white/60">Activity</h3>

      {isLoading ? (
        <div className="animate-pulse space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 rounded-xl" style={{ background: "rgba(255,255,255,.04)" }} />
          ))}
        </div>
      ) : !data?.entries?.length ? (
        <div className="rounded-xl py-10 text-center" style={{ background: "rgba(255,255,255,.02)" }}>
          <p className="text-sm text-white/30">No activity yet. Attend events to earn points!</p>
        </div>
      ) : (
        <>
          <div className="space-y-1">
            {data.entries.map((entry) => (
              <div
                key={entry.points_id}
                className="flex items-center justify-between rounded-xl px-4 py-3"
                style={{ background: "rgba(255,255,255,.03)" }}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">
                    {entry.event_name ?? "Event"}
                  </p>
                  <p className={`text-xs ${eventTypeColor(entry.event_type)}`}>
                    {entry.event_type ?? "other"} · {formatDate(entry.date)}
                  </p>
                </div>
                <span className="ml-4 flex-shrink-0 text-sm font-semibold text-white">
                  +{entry.points}
                </span>
              </div>
            ))}
          </div>

          {data.has_more && (
            <button
              onClick={() => setPage((p) => p + 1)}
              className="mt-4 w-full rounded-xl bg-white/5 py-2.5 text-sm font-medium text-white/60 ring-1 ring-white/10 transition hover:bg-white/10"
            >
              Load more
            </button>
          )}
        </>
      )}
    </div>
  );
}
