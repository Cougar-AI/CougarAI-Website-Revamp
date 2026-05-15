import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { DashboardShell, type DashboardTab } from "@/components/dashboard/DashboardShell";
import ProfileTab from "@/components/dashboard/ProfileTab";
import MembershipTab from "@/components/dashboard/MembershipTab";
import CheckInTab from "@/components/dashboard/CheckInTab";
import PointsTab from "@/components/dashboard/PointsTab";
import LeaderboardTab from "@/components/dashboard/LeaderboardTab";

export type MeResponse = {
  user_id: number;
  email: string;
  role: string;
  created_at: string;
  has_profile: boolean;
  profile: {
    student_id: string;
    first_name: string;
    last_name: string;
    preferred_email: string | null;
    avatar_url: string | null;
    is_public: boolean;
    grade_level: string | null;
    major: string | null;
    shirt_size: string | null;
    discord_id: string | null;
    notification_settings: Record<string, boolean>;
    current_streak: number;
    max_streak: number;
  } | null;
  membership: {
    status: "active" | "expired" | "none";
    expires_at: string | null;
    plan_id: string | null;
  } | null;
  points_summary: {
    total: number;
    rank: number;
    total_members: number;
  };
};

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-16 rounded-xl"
          style={{ background: "rgba(185,28,28,.08)" }}
        />
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") as DashboardTab) ?? "profile";

  function setTab(t: DashboardTab) {
    setSearchParams({ tab: t }, { replace: true });
  }

  const {
    data: meData,
    isLoading,
    refetch: refetchMe,
  } = useQuery<MeResponse>({
    queryKey: ["dashboard-me"],
    queryFn: () => apiGet<MeResponse>("/dashboard/me"),
    staleTime: 60_000,
  });

  const tabProps = { meData, onRefresh: () => refetchMe() };

  return (
    <DashboardShell activeTab={tab} onTabChange={setTab} meData={meData}>
      {isLoading ? (
        <Skeleton />
      ) : (
        <>
          {tab === "profile" && <ProfileTab {...tabProps} />}
          {tab === "membership" && <MembershipTab {...tabProps} />}
          {tab === "checkin" && <CheckInTab {...tabProps} />}
          {tab === "points" && <PointsTab {...tabProps} />}
          {tab === "leaderboard" && <LeaderboardTab {...tabProps} />}
        </>
      )}
    </DashboardShell>
  );
}
