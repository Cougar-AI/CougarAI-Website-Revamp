import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { apiGet } from "@/lib/api";
import type { MeResponse } from "@/pages/Dashboard";
import { formatDate } from "@/lib/dates";

interface Props {
  meData?: MeResponse;
  onRefresh: () => void;
}

interface MembershipsResponse {
  current: {
    status: "active" | "expired" | "none";
    expires_at: string | null;
    plan_id: string | null;
  } | null;
  history: {
    payment_id: number;
    date: string;
    amount: string;
    plan_id: string | null;
    stripe_session_id: string | null;
  }[];
}

function StatusCard({ current }: { current: MembershipsResponse["current"] }) {
  const navigate = useNavigate();
  const status = current?.status ?? "none";
  const plan = current?.plan_id === "yearly" ? "yearly" : "semester";

  const colorMap = {
    active: { glow: "0 0 20px rgba(34,197,94,.3)", ring: "rgba(34,197,94,.3)", label: "Active", textColor: "text-emerald-400" },
    expired: { glow: "0 0 20px rgba(185,28,28,.3)", ring: "rgba(185,28,28,.3)", label: "Expired", textColor: "text-red-400" },
    none: { glow: "none", ring: "rgba(255,255,255,.1)", label: "No Membership", textColor: "text-white/40" },
  };

  const { glow, ring, label, textColor } = colorMap[status];

  const planNames: Record<string, string> = {
    semester: "Semester Membership",
    yearly: "Yearly Membership",
  };

  return (
    <div
      className="mb-5 rounded-2xl p-5"
      style={{ background: "rgba(255,255,255,.04)", border: `1px solid ${ring}`, boxShadow: glow }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className={`text-lg font-semibold ${textColor} font-['Oxanium']`}>{label}</p>
          {current?.plan_id && (
            <p className="mt-0.5 text-sm text-white/60">{planNames[current.plan_id] ?? current.plan_id}</p>
          )}
          {current?.expires_at && (
            <p className="mt-1 text-xs text-white/40">
              {status === "active" ? "Expires" : "Expired"}: {formatDate(current.expires_at)}
            </p>
          )}
        </div>
        <button
          onClick={() => navigate(`/join?plan=${plan}`)}
          className="w-full rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 sm:w-auto"
          style={{ boxShadow: "0 0 20px rgba(185,28,28,.35)" }}
        >
          {status === "active" ? "Renew membership" : status === "expired" ? "Renew now" : "Purchase membership"}
        </button>
      </div>
    </div>
  );
}

function getRewardTier(totalPoints: number) {
  if (totalPoints >= 200) return { label: "Elite", nextGoal: null, accent: "text-amber-300" };
  if (totalPoints >= 100) return { label: "Gold", nextGoal: 200, accent: "text-amber-200" };
  if (totalPoints >= 50) return { label: "Silver", nextGoal: 100, accent: "text-slate-200" };
  return { label: "Bronze", nextGoal: 50, accent: "text-white/70" };
}

export default function MembershipTab({ meData }: Props) {
  const { data, isLoading } = useQuery<MembershipsResponse>({
    queryKey: ["dashboard-memberships"],
    queryFn: () => apiGet<MembershipsResponse>("/dashboard/memberships"),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div
        className="rounded-2xl p-6"
        style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(185,28,28,.22)" }}
      >
        <div className="animate-pulse space-y-3">
          <div className="h-20 rounded-xl" style={{ background: "rgba(185,28,28,.08)" }} />
          <div className="h-40 rounded-xl" style={{ background: "rgba(255,255,255,.04)" }} />
        </div>
      </div>
    );
  }

  const current = data?.current ?? meData?.membership ?? null;
  const history = data?.history ?? [];
  const profile = meData?.profile;
  const summary = meData?.points_summary;
  const totalPoints = summary?.total ?? 0;
  const rewardTier = getRewardTier(totalPoints);
  const isActive = current?.status === "active";
  const isExpired = current?.status === "expired";
  const planLabel = current?.plan_id === "yearly" ? "Yearly Membership" : "Semester Membership";

  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(185,28,28,.22)" }}
    >
      <h2 className="mb-5 font-['Oxanium'] text-lg font-semibold text-white">Membership</h2>

      <StatusCard current={current as MembershipsResponse["current"]} />

      <div className="grid gap-4 lg:grid-cols-[1.65fr_1fr]">
        <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" }}>
          <p className="mb-3 text-sm font-medium text-white/60">Your membership benefits</p>
          <p className="text-sm leading-relaxed text-white/75">
            {isActive
              ? `Your ${planLabel.toLowerCase()} is active. Enjoy workshop access, rewards, project priority, and member resources.`
              : isExpired
              ? `Your ${planLabel.toLowerCase()} expired. Renew now to restore access, Discord role, and reward eligibility.`
              : "Purchase a membership today to unlock workshops, projects, Discord access, and points rewards."}
          </p>

          <div className="mt-5 grid gap-2 text-sm text-white/70">
            {[
              "Full access to workshops, events, and member-only sessions",
              "Points rewards, streaks, and reward tiers",
              "Priority consideration for project teams",
              "Knowledge Bar access for project and AI resources",
              "Discord member role, channels, and announcements",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2">
                <span className="mt-1 block h-2 w-2 rounded-full bg-red-500" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link
              to="/join?plan=semester"
              className="rounded-xl bg-white/8 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              Semester plan
            </Link>
            <Link
              to="/join?plan=yearly"
              className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800"
            >
              Yearly plan
            </Link>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            <p className="font-semibold text-white">Discord access</p>
            <p className="mt-2">After payment, join Discord and claim your CougarAI member role for channel access and updates.</p>
            <Link
              to="/join?plan=semester"
              className="mt-3 inline-flex items-center rounded-xl bg-red-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-800"
            >
              How to join Discord
            </Link>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            <p className="font-semibold text-white">Knowledge Bar</p>
            <p className="mt-2">Use the Knowledge Bar for workshop recaps, project advice, and officer insights.</p>
            <Link
              to="/knowledge-base"
              className="mt-3 inline-flex items-center rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              Open Knowledge Bar
            </Link>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" }}>
            <p className="mb-3 text-sm font-medium text-white/60">Points summary</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/5 p-4 text-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">Total points</p>
                <p className="mt-2 text-2xl font-semibold text-white">{totalPoints}</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-4 text-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">Rank</p>
                <p className="mt-2 text-2xl font-semibold text-white">{summary?.rank ? `#${summary.rank}` : "—"}</p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl bg-white/5 p-4 text-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-white/40">Reward tier</p>
              <p className={`mt-2 text-xl font-semibold ${rewardTier.accent}`}>{rewardTier.label}</p>
              {rewardTier.nextGoal ? (
                <p className="mt-2 text-white/60">Earn {rewardTier.nextGoal - totalPoints} more points to reach the next tier.</p>
              ) : (
                <p className="mt-2 text-white/60">You are at the top tier. Keep building!</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" }}>
            <p className="mb-3 text-sm font-medium text-white/60">Member details</p>
            <div className="space-y-3 text-sm text-white/70">
              <div className="rounded-2xl bg-white/5 p-3">
                <p className="font-semibold text-white">Membership status</p>
                <p>{isActive ? "Active" : isExpired ? "Expired" : "Not active"}</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-3">
                <p className="font-semibold text-white">Current plan</p>
                <p>{current?.plan_id ? planLabel : "No plan"}</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-3">
                <p className="font-semibold text-white">Profile name</p>
                <p>{profile?.first_name ? `${profile.first_name} ${profile.last_name ?? ""}`.trim() : "Profile not complete"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="mb-3 text-sm font-medium text-white/60">Payment History</h3>
        {history.length === 0 ? (
          <div className="rounded-xl py-10 text-center" style={{ background: "rgba(255,255,255,.02)" }}>
            <p className="text-sm text-white/30">No payment history yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-left text-xs text-white/40">
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 pr-4 font-medium">Plan</th>
                  <th className="pb-2 pr-4 font-medium">Amount</th>
                  <th className="pb-2 font-medium">Session</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.payment_id} className="border-b border-white/5 text-white/70">
                    <td className="py-2.5 pr-4">{formatDate(row.date)}</td>
                    <td className="py-2.5 pr-4 capitalize">{row.plan_id ?? "—"}</td>
                    <td className="py-2.5 pr-4">${row.amount}</td>
                    <td className="py-2.5 font-mono text-xs text-white/40">
                      {row.stripe_session_id ? row.stripe_session_id.slice(0, 12) + "…" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
