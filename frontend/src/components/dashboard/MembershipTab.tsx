import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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
          onClick={() => navigate("/join")}
          className="w-full rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 sm:w-auto"
          style={{ boxShadow: "0 0 20px rgba(185,28,28,.35)" }}
        >
          {status === "active" ? "Renew" : "Get Membership"}
        </button>
      </div>
    </div>
  );
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

  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(185,28,28,.22)" }}
    >
      <h2 className="mb-5 font-['Oxanium'] text-lg font-semibold text-white">Membership</h2>

      <StatusCard current={current as MembershipsResponse["current"]} />

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
  );
}
