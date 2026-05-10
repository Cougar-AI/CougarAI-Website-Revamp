import React, { useEffect, useMemo, useState } from "react";

const TYPE_OPTIONS = [
  { label: "All Events", value: "all" },
  { label: "Club Events", value: "club" },
  { label: "Meetings", value: "meeting" },
  { label: "Workshops", value: "workshop" },
] as const;

type EventType = (typeof TYPE_OPTIONS)[number]["value"];

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const YEARS = [2026, 2025, 2024, 2023] as const;

const TYPE_COLOR: Record<Exclude<EventType, "all">, string> = {
  club: "#b91c1c",
  meeting: "#4f46e5",
  workshop: "#059669",
};

interface CalendarEvent {
  id: string;
  title: string;
  type: Exclude<EventType, "all">;
  dateKey: string;
}

function inferEventType(summary: string): Exclude<EventType, "all"> {
  const lower = summary.toLowerCase();
  if (lower.includes("workshop")) return "workshop";
  if (lower.includes("meeting")) return "meeting";
  return "club";
}

function toDateKey(year: number, month0: number, day: number) {
  return `${year}-${String(month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isToday(date: Date) {
  const t = new Date();
  return date.getFullYear() === t.getFullYear() && date.getMonth() === t.getMonth() && date.getDate() === t.getDate();
}

function CalendarGrid({ year, month, events }: { year: number; month: number; events: CalendarEvent[] }) {
  const evMap = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const arr = m.get(e.dateKey) ?? [];
      arr.push(e);
      m.set(e.dateKey, arr);
    }
    return m;
  }, [events]);

  const cells = useMemo(() => {
    const arr: { date: Date; cur: boolean }[] = [];
    const first = new Date(year, month, 1);
    const startWd = first.getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevTotal = new Date(year, month, 0).getDate();
    for (let i = startWd - 1; i >= 0; i--) arr.push({ date: new Date(year, month - 1, prevTotal - i), cur: false });
    for (let d = 1; d <= totalDays; d++) arr.push({ date: new Date(year, month, d), cur: true });
    let nd = 1;
    while (arr.length % 7 !== 0 || arr.length < 35) arr.push({ date: new Date(year, month + 1, nd++), cur: false });
    return arr;
  }, [year, month]);

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 6 }}>
        {weekdays.map((w) => (
          <div key={w} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.45)", fontFamily: "Oxanium,sans-serif", padding: "5px 0", letterSpacing: ".05em" }}>{w}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
        {cells.map(({ date, cur }, i) => {
          const dk = toDateKey(date.getFullYear(), date.getMonth(), date.getDate());
          const dayEvs = evMap.get(dk) ?? [];
          const today = cur && isToday(date);
          return (
            <div key={i} style={{
              minHeight: 90, borderRadius: 10,
              background: today ? "rgba(255,248,248,.97)" : "rgba(255,255,255,.93)",
              border: today ? "2px solid #b91c1c" : "1px solid rgba(0,0,0,.08)",
              padding: "7px 6px", opacity: cur ? 1 : .3,
              boxShadow: today ? "0 0 16px rgba(185,28,28,.2)" : "0 1px 4px rgba(0,0,0,.1)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: today ? "#b91c1c" : "#222", fontFamily: "Oxanium,sans-serif" }}>{date.getDate()}</span>
                {today && <span style={{ fontSize: 8, fontWeight: 800, background: "#b91c1c", color: "#fff", borderRadius: 4, padding: "1px 5px", fontFamily: "Oxanium,sans-serif", letterSpacing: ".04em", textTransform: "uppercase" }}>Today</span>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                {dayEvs.slice(0, 3).map((ev) => (
                  <span key={ev.id} title={ev.title} style={{
                    fontSize: 9, fontWeight: 600, padding: "2px 5px", borderRadius: 4,
                    background: TYPE_COLOR[ev.type], color: "#fff",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    fontFamily: "Oxanium,sans-serif", display: "block",
                  }}>{ev.title}</span>
                ))}
                {dayEvs.length > 3 && <span style={{ fontSize: 9, color: "rgba(0,0,0,.4)", fontFamily: "Oxanium,sans-serif" }}>+{dayEvs.length - 3} more</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const API_BASE = import.meta.env.VITE_BACKEND_API_URL ?? "";

export default function Calendar() {
  const now = new Date();
  const [type, setType] = useState<EventType>("all");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/events/google`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          const message =
            typeof data?.error === "string" && data.error.trim()
              ? data.error
              : `Request failed (${r.status})`;
          throw new Error(message);
        }
        return data as unknown[];
      })
      .then((items: unknown[]) => {
        const mapped = (items as Record<string, unknown>[])
          .filter((i) => i.start)
          .map((i) => {
            const start = i.start as Record<string, string>;
            const dateKey = (start.dateTime ?? start.date ?? "").slice(0, 10);
            const summary = (i.summary as string | undefined) ?? "Untitled";
            return { id: i.id as string, title: summary, type: inferEventType(summary), dateKey };
          })
          .filter((e) => e.dateKey.length === 10);
        setEvents(mapped);
      })
      .catch((err: unknown) =>
        setFetchError(err instanceof Error ? err.message : "Could not load events.")
      )
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() =>
    events.filter((e) => {
      const [y, m] = e.dateKey.split("-").map(Number);
      return (type === "all" || e.type === type) && y === year && m - 1 === month;
    }),
  [events, type, year, month]);

  const goPrev = () => { if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1); };
  const goNext = () => { if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1); };
  const reset = () => { setType("all"); setYear(now.getFullYear()); setMonth(now.getMonth()); };

  const panel: React.CSSProperties = {
    borderRadius: 18,
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(185,28,28,.2)",
    backdropFilter: "blur(10px)",
    padding: "20px",
  };
  const sLabel: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase",
    color: "rgba(255,255,255,.35)", fontFamily: "Oxanium,sans-serif", marginBottom: 10, display: "block",
  };
  const filterBtn = (active: boolean): React.CSSProperties => ({
    display: "block", width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 8, border: "none",
    background: active ? "rgba(185,28,28,.85)" : "transparent",
    color: active ? "#fff" : "rgba(255,255,255,.65)",
    fontFamily: "Oxanium,sans-serif", fontWeight: active ? 700 : 500, fontSize: 13, marginBottom: 3, cursor: "pointer",
    transition: "all .15s",
  });
  const navBtn: React.CSSProperties = {
    background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)", color: "#fff",
    padding: "8px 16px", borderRadius: 9, fontWeight: 600, fontSize: 13,
    fontFamily: "Oxanium,sans-serif", cursor: "pointer", transition: "background .15s",
  };

  if (loading) return (
    <main className="relative min-h-screen w-full text-white flex items-center justify-center">
      <p className="font-['Oxanium'] text-white/70">Loading events…</p>
    </main>
  );

  if (fetchError) return (
    <main className="relative min-h-screen w-full text-white flex items-center justify-center">
      <p className="font-['Oxanium'] text-rose-400">{fetchError}</p>
    </main>
  );

  return (
    <main style={{ position: "relative", maxWidth: 1260, margin: "0 auto", padding: "36px 20px 80px" }}>

      <header style={{ textAlign: "center", marginBottom: 32 }}>
        <h1 style={{ fontFamily: "Oxanium,sans-serif", fontSize: "clamp(26px,3.5vw,44px)", fontWeight: 800, letterSpacing: "-.02em", margin: "0 0 8px", color: "#fff" }}>CougarAI Calendar</h1>
        <p style={{ color: "rgba(255,255,255,.55)", fontSize: 14.5, fontFamily: "Oxanium,sans-serif" }}>Browse upcoming meetings, workshops, and club events.</p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, alignItems: "start" }}>

        {/* Sidebar */}
        <aside style={panel}>

          <div style={{ marginBottom: 22 }}>
            <span style={sLabel}>Event Type</span>
            {TYPE_OPTIONS.map(({ label, value }) => (
              <button key={value} style={filterBtn(type === value)} onClick={() => setType(value)}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {value !== "all" && <span style={{ width: 8, height: 8, borderRadius: 2, background: TYPE_COLOR[value as Exclude<EventType, "all">], display: "inline-block", flexShrink: 0 }} />}
                  {label}
                </span>
              </button>
            ))}
          </div>

          <div style={{ marginBottom: 22 }}>
            <span style={sLabel}>Year</span>
            {YEARS.map((y) => (
              <button key={y} style={filterBtn(year === y)} onClick={() => setYear(y)}>{y}</button>
            ))}
          </div>

          <div style={{ marginBottom: 22 }}>
            <span style={sLabel}>Month</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
              {MONTHS.map((name, i) => (
                <button key={i} onClick={() => setMonth(i)} style={{
                  padding: "7px 2px", borderRadius: 7, border: "none",
                  background: month === i ? "rgba(185,28,28,.85)" : "rgba(255,255,255,.06)",
                  color: month === i ? "#fff" : "rgba(255,255,255,.6)",
                  fontFamily: "Oxanium,sans-serif", fontWeight: month === i ? 700 : 400,
                  fontSize: 11, cursor: "pointer", transition: "all .15s", textAlign: "center",
                }}>{name.slice(0, 3)}</button>
              ))}
            </div>
          </div>

          <button onClick={reset} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid rgba(185,28,28,.3)", background: "rgba(185,28,28,.1)", color: "rgba(220,38,38,.85)", fontFamily: "Oxanium,sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "all .15s" }}>
            Reset to Today
          </button>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,.08)" }}>
            <span style={sLabel}>Legend</span>
            {(Object.entries(TYPE_COLOR) as [Exclude<EventType, "all">, string][]).map(([k, c]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7, fontSize: 12.5, color: "rgba(255,255,255,.65)", fontFamily: "Oxanium,sans-serif" }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: c, flexShrink: 0, display: "inline-block" }} />
                {TYPE_OPTIONS.find((o) => o.value === k)?.label ?? k}
              </div>
            ))}
          </div>
        </aside>

        {/* Calendar panel */}
        <section style={panel}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={navBtn} onClick={goPrev}>← Prev</button>
              <button style={navBtn} onClick={goNext}>Next →</button>
            </div>
            <h2 style={{ fontFamily: "Oxanium,sans-serif", fontWeight: 800, fontSize: 22, margin: 0, color: "#fff" }}>
              {MONTHS[month]} {year}
            </h2>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.4)", fontFamily: "Oxanium,sans-serif" }}>
              {filtered.length} event{filtered.length !== 1 ? "s" : ""}
            </div>
          </div>

          <CalendarGrid year={year} month={month} events={filtered} />

          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "28px 20px", marginTop: 12, borderRadius: 12, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", color: "rgba(255,255,255,.4)", fontSize: 14, fontFamily: "Oxanium,sans-serif" }}>
              No events this month. Try a different filter or month.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
