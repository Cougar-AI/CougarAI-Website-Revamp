import React, { useEffect, useMemo, useState } from "react";

// ----- Types & Data -----
const TYPE_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Club events", value: "club" },
  { label: "Meetings", value: "meeting" },
  { label: "Workshops", value: "workshop" },
] as const;

type EventType = (typeof TYPE_OPTIONS)[number]["value"];

const MONTH_OPTIONS = [
  { label: "January", value: 0 },
  { label: "February", value: 1 },
  { label: "March", value: 2 },
  { label: "April", value: 3 },
  { label: "May", value: 4 },
  { label: "June", value: 5 },
  { label: "July", value: 6 },
  { label: "August", value: 7 },
  { label: "September", value: 8 },
  { label: "October", value: 9 },
  { label: "November", value: 10 },
  { label: "December", value: 11 },
] as const;

const YEAR_OPTIONS = [2025, 2024, 2023, 2022] as const;

interface CalendarEvent {
  id: string;
  title: string;
  type: Exclude<EventType, "all">;
  /** ISO-like local date key: YYYY-MM-DD (local time, not UTC) */
  dateKey: string;
}

function inferEventType(summary: string): Exclude<EventType, "all"> {
  const lower = summary.toLowerCase();
  if (lower.includes("workshop")) return "workshop";
  if (lower.includes("meeting")) return "meeting";
  return "club";
}

// ----- Utils -----
function toDateKey(year: number, monthIndex0: number, day: number) {
  const y = String(year);
  const m = String(monthIndex0 + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysInMonth(year: number, monthIndex0: number) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

function firstWeekdayOfMonth(year: number, monthIndex0: number) {
  // 0 = Sunday ... 6 = Saturday
  return new Date(year, monthIndex0, 1).getDay();
}

function isSameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Map event types to chip styles (kept brand-forward with rose accents)
const TYPE_BADGE: Record<Exclude<EventType, "all">, string> = {
  club: "bg-rose-700 text-white",
  meeting: "bg-indigo-600 text-white",
  workshop: "bg-emerald-600 text-white",
};

// ----- Filter List Component (generic) -----
interface Option<T> { label: string; value: T }

function FilterList<T extends string | number>({
  title,
  items,
  value,
  onChange,
}: {
  title: string;
  items: readonly Option<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-black text-sm font-semibold font-['Oxanium']">{title}</p>
      <ul role="listbox" aria-label={title} className="space-y-1">
        {items.map((opt) => {
          const active = value === opt.value;
          return (
            <li key={String(opt.value)}>
              <button
                type="button"
                role="option"
                aria-selected={active}
                data-active={active}
                onClick={() => onChange(opt.value)}
                className="w-full text-left text-sm px-2 py-1 rounded-md transition font-['Oxanium'] data-[active=true]:bg-rose-700 data-[active=true]:text-white text-black hover:text-rose-700 hover:bg-gray-100"
              >
                {opt.label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ----- Calendar Grid -----
function CalendarGrid({
  year,
  monthIndex0,
  events,
}: {
  year: number;
  monthIndex0: number; // 0..11
  events: CalendarEvent[];
}) {
  const today = new Date();
  const days = daysInMonth(year, monthIndex0);
  const startWeekday = firstWeekdayOfMonth(year, monthIndex0); // 0..6
  const prevMonthDays = daysInMonth(year, (monthIndex0 + 11) % 12 + (monthIndex0 === 0 ? -12 : 0));

  // Build 6x7 grid (42 cells) with leading & trailing days
  const cells: { date: Date; inCurrent: boolean }[] = [];

  // Leading days from previous month
  for (let i = startWeekday - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    const date = new Date(year, monthIndex0 - 1, day);
    cells.push({ date, inCurrent: false });
  }

  // Current month days
  for (let d = 1; d <= days; d++) {
    cells.push({ date: new Date(year, monthIndex0, d), inCurrent: true });
  }

  // Trailing days for next month to fill 42
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const last = cells[cells.length - 1].date;
    const next = new Date(last);
    next.setDate(last.getDate() + 1);
    const inCurrent = next.getMonth() === monthIndex0;
    cells.push({ date: next, inCurrent });
  }

  // Group events by dateKey for quick lookup
  const map = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const arr = m.get(e.dateKey) ?? [];
      arr.push(e);
      m.set(e.dateKey, arr);
    }
    return m;
  }, [events]);

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="w-full">
      {/* Weekday headings */}
      <div className="grid grid-cols-7 gap-2 px-1">
        {weekdays.map((w) => (
          <div key={w} className="text-center text-xs md:text-sm font-semibold text-black/80 font-['Oxanium']">
            {w}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="mt-2 grid grid-cols-7 gap-2">
        {cells.map(({ date, inCurrent }, idx) => {
          const dateKey = toDateKey(date.getFullYear(), date.getMonth(), date.getDate());
          const dayEvents = map.get(dateKey) ?? [];
          const isToday = isSameLocalDay(date, today);
          return (
            <div
              key={`${dateKey}-${idx}`}
              className={[
                "min-h-24 rounded-xl border border-black/10 bg-white/90 p-2 shadow-sm",
                inCurrent ? "" : "opacity-50",
                isToday ? "ring-2 ring-rose-700" : "",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs md:text-sm font-semibold text-black font-['Oxanium']">
                  {date.getDate()}
                </span>
                {isToday && (
                  <span className="text-[10px] md:text-xs rounded px-1 font-semibold bg-rose-700 text-white font-['Oxanium']">
                    Today
                  </span>
                )}
              </div>

              {/* Events */}
              <ul className="mt-1 space-y-1">
                {dayEvents.slice(0, 3).map((ev) => (
                  <li key={ev.id} className="truncate">
                    <span
                      title={`${ev.title}`}
                      className={`inline-block max-w-full truncate rounded px-2 py-0.5 text-[10px] md:text-xs font-semibold ${TYPE_BADGE[ev.type]}`}
                    >
                      {ev.title}
                    </span>
                  </li>
                ))}
                {dayEvents.length > 3 && (
                  <li className="text-[10px] md:text-xs text-black/70 font-['Oxanium']">+{dayEvents.length - 3} more</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ----- Page -----
export default function Calendar() {
  const now = new Date();
  const [type, setType] = useState<EventType>("all");
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth()); // 0..11
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    fetch("http://localhost:5001/events/google")
      .then((res) => res.json())
      .then((items: unknown[]) => {
        const mapped: CalendarEvent[] = (items as Record<string, unknown>[])
          .filter((item) => item.start)
          .map((item) => {
            const start = item.start as Record<string, string>;
            const dateKey = (start.dateTime ?? start.date ?? "").slice(0, 10);
            const summary = (item.summary as string | undefined) ?? "Untitled";
            return {
              id: item.id as string,
              title: summary,
              type: inferEventType(summary),
              dateKey,
            };
          })
          .filter((e) => e.dateKey.length === 10);
        setEvents(mapped);
      })
      .catch(() => setFetchError("Could not load events."))
      .finally(() => setLoading(false));
  }, []);

  // Filter data (simple client-side filter)
  const filtered = useMemo(() => {
    return events.filter((e) => {
      const [y, m, d] = e.dateKey.split("-").map((n) => parseInt(n, 10));
      const matchesType = type === "all" ? true : e.type === type;
      const matchesYear = y === year;
      const matchesMonth = m - 1 === month;
      return matchesType && matchesYear && matchesMonth;
    });
  }, [type, year, month]);

  const monthLabel = MONTH_OPTIONS.find((m) => m.value === month)?.label ?? "";

  const resetFilters = () => {
    setType("all");
    setYear(now.getFullYear());
    setMonth(now.getMonth());
  };

  const goPrevMonth = () => {
    const newMonth = month - 1;
    if (newMonth < 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth(newMonth);
  };

  const goNextMonth = () => {
    const newMonth = month + 1;
    if (newMonth > 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth(newMonth);
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
    <main className="relative min-h-screen w-full text-white">
      {/* Title */}
      <header className="px-4 pt-10">
        <h1 className="text-center text-4xl md:text-5xl font-semibold tracking-wide font-['Oxanium']">
          CougarAI Calendar
        </h1>
        <p className="mt-2 text-center text-sm text-white/70 font-['Oxanium']">
          Browse upcoming meetings, workshops, and club events.
        </p>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[300px_1fr]">
          {/* Filters */}
          <aside className="border-[12px] border-rose-700 rounded-3xl p-3">
            <div className="rounded-2xl bg-zinc-300 p-5">
              <div className="space-y-6">
                <FilterList
                  title="Sort by:"
                  items={TYPE_OPTIONS}
                  value={type}
                  onChange={setType}
                />

                <FilterList
                  title="Year:"
                  items={YEAR_OPTIONS.map((y) => ({ label: String(y), value: y }))}
                  value={year}
                  onChange={setYear}
                />

                <FilterList
                  title="Month:"
                  items={MONTH_OPTIONS}
                  value={month}
                  onChange={setMonth}
                />

                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="rounded-xl bg-rose-700 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:brightness-110 transition font-['Oxanium']"
                  >
                    Reset to Today
                  </button>
                </div>

                <div className="border-t border-black/10 pt-4">
                  <p className="text-xs font-semibold text-black/80 font-['Oxanium']">Legend</p>
                  <ul className="mt-2 space-y-1 text-xs font-['Oxanium']">
                    <li className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-sm bg-rose-700" />Club events</li>
                    <li className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-sm bg-indigo-600" />Meetings</li>
                    <li className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-sm bg-emerald-600" />Workshops</li>
                  </ul>
                </div>
              </div>
            </div>
          </aside>

          {/* Calendar */}
          <section className="border-[12px] border-rose-700 rounded-3xl p-4">
            <div className="rounded-2xl bg-zinc-300 min-h-[560px] md:min-h-[640px]">
              {/* Header controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={goPrevMonth}
                    aria-label="Previous month"
                    className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-black border border-black/10 hover:bg-gray-50"
                  >
                    ← Prev
                  </button>
                  <button
                    type="button"
                    onClick={goNextMonth}
                    aria-label="Next month"
                    className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-black border border-black/10 hover:bg-gray-50"
                  >
                    Next →
                  </button>
                </div>
                <h2 className="text-xl md:text-2xl font-semibold text-black font-['Oxanium']" aria-live="polite">
                  {monthLabel} {year}
                </h2>
                <div className="text-sm text-black/70 font-['Oxanium']">
                  Showing {filtered.length} event{filtered.length === 1 ? "" : "s"}
                </div>
              </div>

              <div className="px-3 pb-4">
                <CalendarGrid year={year} monthIndex0={month} events={filtered} />

                {/* Empty state if no events */}
                {filtered.length === 0 && (
                  <div className="mt-6 rounded-xl bg-white/70 p-4 text-center text-sm text-black/70 font-['Oxanium']">
                    No events match these filters. Try a different type or month.
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
