import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { MeResponse } from "@/pages/Dashboard";

const BACKEND = import.meta.env.VITE_BACKEND_API_URL ?? "http://localhost:5001";

interface Props {
  meData?: MeResponse;
  onRefresh: () => void;
}

interface LeaderboardEntry {
  rank: number;
  student_id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  total_points: number;
  current_streak: number;
  max_streak: number;
  is_public: boolean;
}

interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  caller_rank: number | null;
  caller_total: number | null;
}

interface StreakEntry {
  student_id: string;
  first_name: string;
  last_name: string;
  current_streak: number;
  max_streak: number;
}

type Filter = "all" | "monthly" | "weekly";
type SubTab = "points" | "streaks";
type SortBy = "rank" | "name" | "points" | "streak";

function getDateRange(filter: Filter): { start_date?: string; end_date?: string } {
  if (filter === "all") return {};
  const now = new Date();
  const end_date = now.toISOString().split("T")[0];
  const start = new Date(now);
  if (filter === "weekly") start.setDate(start.getDate() - 7);
  if (filter === "monthly") start.setDate(start.getDate() - 30);
  return { start_date: start.toISOString().split("T")[0], end_date };
}

function Avatar({ url, name, size = 32 }: { url: string | null; name: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((n) => n[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
      style={{
        width: size,
        height: size,
        background: url ? "transparent" : "rgba(185,28,28,.35)",
        border: "1.5px solid rgba(185,28,28,.3)",
        overflow: "hidden",
      }}
    >
      {url ? (
        <img src={`${BACKEND}${url}`} alt={name} className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}

function sortEntries(entries: LeaderboardEntry[], sortBy: SortBy): LeaderboardEntry[] {
  if (sortBy === "rank") return entries;
  return [...entries].sort((a, b) => {
    if (sortBy === "name") return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
    if (sortBy === "streak") return b.current_streak - a.current_streak;
    return b.total_points - a.total_points;
  });
}

export default function LeaderboardTab({ meData }: Props) {
  const [subTab, setSubTab] = useState<SubTab>("points");
  const [filter, setFilter] = useState<Filter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("rank");

  const dateRange = getDateRange(filter);
  const params = new URLSearchParams(
    Object.fromEntries(Object.entries(dateRange).filter(([, v]) => v !== undefined))
  ).toString();

  const { data: pointsData, isLoading: pointsLoading } = useQuery<LeaderboardResponse>({
    queryKey: ["leaderboard-points", filter],
    queryFn: () => apiGet<LeaderboardResponse>(`/points/leaderboard${params ? `?${params}` : ""}`),
    staleTime: 300_000,
    enabled: subTab === "points",
  });

  const { data: streakData, isLoading: streakLoading } = useQuery<StreakEntry[]>({
    queryKey: ["leaderboard-streaks"],
    queryFn: () => apiGet<StreakEntry[]>("/points/streak-leaderboard"),
    staleTime: 300_000,
    enabled: subTab === "streaks",
  });

  const callerRank = pointsData?.caller_rank;
  const callerTotal = pointsData?.caller_total;

  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(185,28,28,.22)" }}
    >
      <h2 className="mb-5 font-['Oxanium'] text-lg font-semibold text-white">Leaderboard</h2>

      {/* Sub-tab toggle */}
      <div className="mb-4 flex gap-2">
        {(["points", "streaks"] as SubTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className="rounded-xl px-4 py-1.5 text-sm font-medium transition"
            style={{
              background: subTab === t ? "rgba(185,28,28,.3)" : "rgba(255,255,255,.05)",
              color: subTab === t ? "#fff" : "rgba(255,255,255,.5)",
              border: `1px solid ${subTab === t ? "rgba(185,28,28,.4)" : "transparent"}`,
            }}
          >
            {t === "points" ? "Points" : "Streaks 🔥"}
          </button>
        ))}
      </div>

      {/* Points filter pills */}
      {subTab === "points" && (
        <div className="mb-4 flex gap-2">
          {(["all", "monthly", "weekly"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="rounded-xl px-3 py-1 text-xs font-medium transition"
              style={{
                background: filter === f ? "rgba(185,28,28,.2)" : "rgba(255,255,255,.05)",
                color: filter === f ? "#fca5a5" : "rgba(255,255,255,.4)",
              }}
            >
              {f === "all" ? "All-time" : f === "monthly" ? "Monthly" : "Weekly"}
            </button>
          ))}
        </div>
      )}

      {/* Caller rank card */}
      {subTab === "points" && callerRank !== null && callerRank !== undefined && (
        <div
          className="mb-4 flex items-center justify-between rounded-xl px-4 py-3"
          style={{ background: "rgba(185,28,28,.12)", border: "1px solid rgba(185,28,28,.25)" }}
        >
          <span className="text-sm text-white/70">Your rank</span>
          <span className="font-['Oxanium'] text-lg font-bold text-white">
            #{callerRank}
            {callerTotal !== null && callerTotal !== undefined && (
              <span className="ml-1 text-sm font-normal text-white/40">· {callerTotal} pts</span>
            )}
          </span>
        </div>
      )}

      {/* Points table */}
      {subTab === "points" && (
        <>
          {pointsLoading ? (
            <div className="animate-pulse space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 rounded-xl" style={{ background: "rgba(255,255,255,.04)" }} />
              ))}
            </div>
          ) : !pointsData?.entries?.length ? (
            <div className="rounded-xl py-10 text-center" style={{ background: "rgba(255,255,255,.02)" }}>
              <p className="text-sm text-white/30">No entries yet.</p>
            </div>
          ) : (
            <>
              {/* Sortable column headers */}
              <div className="mb-1 flex items-center gap-3 px-4">
                <span className="w-6 flex-shrink-0" />
                <span className="w-7 flex-shrink-0" />
                {(["name", "streak", "points"] as const).map((col) => (
                  <button
                    key={col}
                    onClick={() => setSortBy(col)}
                    className="text-xs font-medium transition-colors"
                    style={{
                      color: sortBy === col ? "#fca5a5" : "rgba(255,255,255,.3)",
                      flex: col === "name" ? 1 : undefined,
                      textAlign: col === "name" ? "left" : "right",
                      borderBottom: sortBy === col ? "1px solid rgba(252,165,165,.4)" : "none",
                    }}
                  >
                    {col === "streak" ? "Streak 🔥" : col.charAt(0).toUpperCase() + col.slice(1)}
                  </button>
                ))}
              </div>
              <div className="space-y-1">
                {sortEntries(pointsData.entries, sortBy).map((entry, i) => {
                  const isMe = meData?.profile?.student_id === entry.student_id;
                  const displayName = entry.is_public
                    ? `${entry.first_name} ${entry.last_name}`
                    : "Anonymous Member";

                  return (
                    <div
                      key={entry.student_id}
                      className="flex items-center gap-3 rounded-xl px-4 py-2.5 transition"
                      style={{
                        background: isMe ? "rgba(185,28,28,.08)" : "rgba(255,255,255,.02)",
                        borderLeft: isMe ? "2px solid #b91c1c" : "2px solid transparent",
                      }}
                    >
                      <span className="w-6 flex-shrink-0 text-center text-xs font-medium text-white/40">
                        {sortBy === "rank" ? entry.rank : i + 1}
                      </span>
                      {entry.is_public && (
                        <Avatar url={entry.avatar_url} name={displayName} size={28} />
                      )}
                      <span className="flex-1 truncate text-sm text-white/80">{displayName}</span>
                      <span className="flex-shrink-0 text-xs text-white/40 font-['Oxanium']">
                        {entry.current_streak}🔥
                      </span>
                      <span className="flex-shrink-0 font-['Oxanium'] text-sm font-semibold text-white">
                        {entry.total_points}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* Streaks table */}
      {subTab === "streaks" && (
        <>
          {streakLoading ? (
            <div className="animate-pulse space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded-xl" style={{ background: "rgba(255,255,255,.04)" }} />
              ))}
            </div>
          ) : !streakData?.length ? (
            <div className="rounded-xl py-10 text-center" style={{ background: "rgba(255,255,255,.02)" }}>
              <p className="text-sm text-white/30">No streak data yet.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {streakData.map((entry, i) => {
                const isMe = meData?.profile?.student_id === entry.student_id;
                return (
                  <div
                    key={entry.student_id}
                    className="flex items-center gap-3 rounded-xl px-4 py-2.5"
                    style={{
                      background: isMe ? "rgba(185,28,28,.08)" : "rgba(255,255,255,.02)",
                      borderLeft: isMe ? "2px solid #b91c1c" : "2px solid transparent",
                    }}
                  >
                    <span className="w-6 flex-shrink-0 text-center text-xs font-medium text-white/40">
                      {i + 1}
                    </span>
                    <span className="flex-1 truncate text-sm text-white/80">
                      {entry.first_name} {entry.last_name}
                    </span>
                    <span className="flex-shrink-0 font-['Oxanium'] text-sm font-semibold text-white">
                      {entry.current_streak} 🔥
                    </span>
                    <span className="flex-shrink-0 text-xs text-white/40">
                      max {entry.max_streak}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
