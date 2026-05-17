import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { Megaphone, X } from "lucide-react";
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

interface PinnedAnnouncement {
  id: number;
  message: string;
  created_at: string;
  expires_at: string | null;
}

function AnnouncementBanner() {
  const { data } = useQuery<{ announcement: PinnedAnnouncement | null }>({
    queryKey: ["pinned-announcement"],
    queryFn: () => apiGet("/announcements/pinned"),
    staleTime: 120_000,
  });

  const ann = data?.announcement;
  const dismissKey = ann ? `ann-dismissed-${ann.id}` : null;
  const [dismissed, setDismissed] = useState(() =>
    dismissKey ? sessionStorage.getItem(dismissKey) === "1" : false
  );

  if (!ann || dismissed) return null;

  function dismiss() {
    if (dismissKey) sessionStorage.setItem(dismissKey, "1");
    setDismissed(true);
  }

  return (
    <div
      className="flex items-start gap-3 rounded-xl px-4 py-3 mb-4"
      style={{
        background: 'linear-gradient(135deg, rgba(180,83,9,.18) 0%, rgba(217,119,6,.12) 100%)',
        border: '1px solid rgba(251,191,36,.25)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <Megaphone size={16} className="shrink-0 mt-0.5" style={{ color: 'rgba(251,191,36,.9)' }} />
      <p className="flex-1 text-sm" style={{ color: 'rgba(251,191,36,.85)' }}>{ann.message}</p>
      <button onClick={dismiss} className="shrink-0 transition-opacity hover:opacity-70" style={{ color: 'rgba(251,191,36,.6)' }}>
        <X size={14} />
      </button>
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
      <AnnouncementBanner />
      {isLoading ? (
        <Skeleton />
      ) : (
        <>
          {tab === "profile" && <ProfileTab {...tabProps} />}
          {tab === "membership" && <MembershipTab {...tabProps} />}
          {tab === "checkin" && <CheckInTab {...tabProps} userId={meData?.user_id} />}
          {tab === "points" && <PointsTab {...tabProps} />}
          {tab === "leaderboard" && <LeaderboardTab {...tabProps} />}
        </>
      )}
    </DashboardShell>
  );
}
