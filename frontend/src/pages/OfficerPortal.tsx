import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserCheck, Clock } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";

interface Event {
  event_id: number;
  event_name: string;
  event_date: string;
  event_type: string;
}

interface CheckInRecord {
  student_id: string;
  event_name: string;
  points_awarded: number;
  timestamp: string;
}

export default function OfficerPortal() {
  const [selectedEventId, setSelectedEventId] = useState<number | "">("");
  const [studentId, setStudentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentCheckIns, setRecentCheckIns] = useState<CheckInRecord[]>([]);

  const { data: events, isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ["events"],
    queryFn: () => apiGet<Event[]>("/events/"),
    staleTime: 60_000,
  });

  async function handleCheckIn(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEventId || !studentId.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const result = await apiPost<{ student_id: string; event_name: string; points_awarded: number }>(
        "/events/officer-checkin",
        { student_id: studentId.trim(), event_id: selectedEventId }
      );

      setRecentCheckIns((prev) => [
        {
          student_id: result.student_id,
          event_name: result.event_name,
          points_awarded: result.points_awarded,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 9),
      ]);
      setStudentId("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Check-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div
        className="rounded-2xl p-6"
        style={{
          background: "rgba(255,255,255,.04)",
          border: "1px solid rgba(185,28,28,.22)",
          backdropFilter: "blur(10px)",
        }}
      >
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <UserCheck size={22} className="text-red-400" />
          <div>
            <h1 className="font-['Oxanium'] text-xl font-bold text-white">Officer Check-In Portal</h1>
            <p className="text-xs text-white/40">Manually check in walk-in attendees</p>
          </div>
        </div>

        <form onSubmit={handleCheckIn} className="space-y-4">
          {/* Event selector */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/80">Select event</label>
            <select
              className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-red-600/60 disabled:opacity-50"
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value ? Number(e.target.value) : "")}
              disabled={eventsLoading}
              style={{ colorScheme: "dark" }}
            >
              <option value="">
                {eventsLoading ? "Loading events…" : "Choose an event…"}
              </option>
              {events?.map((ev) => (
                <option key={ev.event_id} value={ev.event_id}>
                  {ev.event_name} — {new Date(ev.event_date).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>

          {/* Student ID */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/80">Student ID</label>
            <input
              className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-red-600/60 placeholder:text-white/30"
              placeholder="1234567"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="rounded-lg bg-rose-900/40 px-3 py-2 text-sm text-rose-200 ring-1 ring-inset ring-rose-500/20">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !selectedEventId || !studentId.trim()}
            className="w-full rounded-xl bg-red-700 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50"
            style={{ boxShadow: "0 0 20px rgba(185,28,28,.35)" }}
          >
            {loading ? "Checking in…" : "Check In"}
          </button>
        </form>
      </div>

      {/* Recent check-ins */}
      {recentCheckIns.length > 0 && (
        <div
          className="mt-4 rounded-2xl p-5"
          style={{
            background: "rgba(255,255,255,.04)",
            border: "1px solid rgba(185,28,28,.22)",
          }}
        >
          <div className="mb-3 flex items-center gap-2 text-white/50">
            <Clock size={14} />
            <span className="text-xs font-medium">Recent check-ins (this session)</span>
          </div>
          <div className="space-y-1">
            {recentCheckIns.map((rec, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-xl px-4 py-2.5"
                style={{ background: "rgba(34,197,94,.05)", border: "1px solid rgba(34,197,94,.12)" }}
              >
                <div>
                  <span className="text-sm font-medium text-white">ID: {rec.student_id}</span>
                  <span className="ml-2 text-xs text-white/40">{rec.event_name}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-emerald-400">+{rec.points_awarded} pts</span>
                  <p className="text-xs text-white/30">{rec.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
