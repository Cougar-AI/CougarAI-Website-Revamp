import { User, CreditCard, QrCode, Star, Trophy } from "lucide-react";
import type { MeResponse } from "@/pages/Dashboard";

const BACKEND = import.meta.env.VITE_BACKEND_API_URL ?? "http://localhost:5001";

export type DashboardTab = "profile" | "membership" | "checkin" | "points" | "leaderboard";

const TABS: { id: DashboardTab; label: string; icon: React.ElementType }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "membership", label: "Membership", icon: CreditCard },
  { id: "checkin", label: "Check In", icon: QrCode },
  { id: "points", label: "Points", icon: Star },
  { id: "leaderboard", label: "Leaderboard", icon: Trophy },
];

interface Props {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  meData?: MeResponse;
  children: React.ReactNode;
}

export function DashboardShell({ activeTab, onTabChange, meData, children }: Props) {
  const profile = meData?.profile;
  const avatarUrl = profile?.avatar_url ? `${BACKEND}${profile.avatar_url}` : null;
  const initials = profile
    ? `${(profile.first_name?.[0] ?? "").toUpperCase()}${(profile.last_name?.[0] ?? "").toUpperCase()}`
    : meData?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-6 sm:px-6">
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex md:w-60 md:flex-shrink-0 md:flex-col"
        style={{
          background: "rgba(255,255,255,.04)",
          border: "1px solid rgba(185,28,28,.22)",
          borderRadius: 16,
          backdropFilter: "blur(10px)",
          alignSelf: "flex-start",
          position: "sticky",
          top: 24,
        }}
      >
        {/* User header */}
        <div className="flex items-center gap-3 border-b border-white/8 p-4">
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
            style={{
              background: avatarUrl ? "transparent" : "rgba(185,28,28,.4)",
              border: "2px solid rgba(185,28,28,.4)",
              overflow: "hidden",
            }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="min-w-0">
            {profile ? (
              <>
                <p className="truncate text-sm font-medium text-white">
                  {profile.first_name} {profile.last_name}
                </p>
                <p className="truncate text-xs text-white/40">{meData?.email}</p>
              </>
            ) : (
              <p className="truncate text-sm text-white/60">{meData?.email}</p>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 p-2">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors text-left"
              style={{
                background: activeTab === id ? "rgba(185,28,28,.25)" : "transparent",
                color: activeTab === id ? "#fff" : "rgba(255,255,255,.55)",
                border: activeTab === id ? "1px solid rgba(185,28,28,.35)" : "1px solid transparent",
              }}
            >
              <Icon size={16} className="flex-shrink-0" />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Mobile top tabs */}
      <div className="flex w-full flex-col md:hidden">
        <nav
          className="mb-4 flex gap-1 overflow-x-auto rounded-xl p-1"
          style={{
            background: "rgba(255,255,255,.04)",
            border: "1px solid rgba(185,28,28,.22)",
            scrollbarWidth: "none",
          }}
        >
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className="flex flex-shrink-0 flex-col items-center gap-0.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors"
              style={{
                background: activeTab === id ? "rgba(185,28,28,.25)" : "transparent",
                color: activeTab === id ? "#fff" : "rgba(255,255,255,.5)",
                minWidth: 56,
              }}
            >
              <Icon size={18} />
              {activeTab === id && <span>{label}</span>}
            </button>
          ))}
        </nav>
        <main>{children}</main>
      </div>

      {/* Desktop main */}
      <main className="hidden min-w-0 flex-1 md:block">{children}</main>
    </div>
  );
}
