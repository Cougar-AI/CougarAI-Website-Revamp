import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import {
  parseIso,
  formatEventTimeRange,
  formatTimeRange,
  formatWeekdayShort,
  todayKeyCT,
} from "@/lib/dates";
import { EventModal } from "@/components/admin/AdminEventsTab";
import type {
  Event as AdminEvent,
  EventTypeOption,
  PartnerOption,
  SponsorOption,
} from "@/components/admin/AdminEventsTab";

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const YEARS = [2026, 2025, 2024, 2023] as const;
const RSVP_ROLES = ["member", "officer", "admin", "partner"];
const OFFICER_ROLES = ["officer", "admin"];
const FALLBACK_COLOR = "#b91c1c";

// ── Types ─────────────────────────────────────────────────────────────────────

type TypeColorMap = Record<string, string>; // key: name.toLowerCase()

interface MergedEvent {
  key: string;
  title: string;
  type: string;       // raw DB type name, lowercased
  typeColor: string | null;  // DB-resolved color (null for GCal-only events)
  dateKey: string;    // "YYYY-MM-DD"
  startDt: string | null;
  endDt: string | null;
  description: string | null;
  location: string | null;
  locationUrl: string | null;
  dbEventId: number | null;
  rsvpEnabled: boolean;
  rsvpCount: number;
  pointsValue: number | null;
  isPast: boolean;
}

// Full shape matching what the backend /events/ endpoint actually returns
interface DbEvent {
  event_id: number;
  name: string;
  event_type: string;
  description: string | null;
  location: string | null;
  location_url: string | null;
  starts_at: string;
  ends_at: string | null;
  rsvp_enabled: boolean;
  rsvp_count: number;
  points_value: number;
  google_event_id: string | null;
  type_color: string | null;   // resolved by backend JOIN with event_types
  // Admin-visible fields
  capacity: number | null;
  check_in_code: string | null;
  check_in_enabled: boolean;
  check_in_expires_at: string | null;
  require_location: boolean;
  latitude: number | null;
  longitude: number | null;
  checkin_radius_m: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTypeColor(typeName: string, colorMap: TypeColorMap, override?: string | null): string {
  if (override) return override;
  const key = typeName.toLowerCase().trim();
  if (colorMap[key]) return colorMap[key];
  // Fuzzy fallback: match if one key starts with the other (handles "workshop" → "workshops", etc.)
  const fuzzy = Object.entries(colorMap).find(([k]) => k.startsWith(key) || key.startsWith(k));
  return fuzzy ? fuzzy[1] : FALLBACK_COLOR;
}

// For GCal-only events where we must infer the type from the title
function inferTypeFromTitle(title: string): string {
  const l = title.toLowerCase();
  if (l.includes("workshop")) return "workshop";
  if (l.includes("meeting")) return "meeting";
  if (l.includes("social")) return "social";
  if (l.includes("hackathon")) return "hackathon";
  return "other";
}

function toDateKey(year: number, month0: number, day: number) {
  return `${year}-${String(month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isToday(date: Date) {
  const t = new Date();
  return date.getFullYear() === t.getFullYear() && date.getMonth() === t.getMonth() && date.getDate() === t.getDate();
}

function computeIsPast(startDt: string | null, endDt: string | null, dateKey: string): boolean {
  const ref = endDt ?? startDt;
  if (ref) {
    const d = parseIso(ref);
    if (d) return d < new Date();
  }
  return dateKey < todayKeyCT();
}

function buildGCalUrl(ev: MergedEvent): string {
  const p = new URLSearchParams({ action: "TEMPLATE", text: ev.title });
  if (ev.startDt) {
    const fmt = (d: Date) => d.toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
    const start = parseIso(ev.startDt);
    if (start) {
      const end = ev.endDt ? (parseIso(ev.endDt) ?? new Date(start.getTime() + 3_600_000)) : new Date(start.getTime() + 3_600_000);
      p.set("dates", `${fmt(start)}/${fmt(end)}`);
    }
  } else {
    const dk = ev.dateKey.replace(/-/g, "");
    p.set("dates", `${dk}/${dk}`);
  }
  if (ev.description) p.set("details", ev.description);
  if (ev.location) p.set("location", ev.location);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

function dbToMerged(db: DbEvent): MergedEvent {
  const startDt = db.starts_at ? db.starts_at.replace(" ", "T") : null;
  const endDt = db.ends_at ? db.ends_at.replace(" ", "T") : null;
  const dateKey = (startDt ?? db.starts_at).slice(0, 10);
  return {
    key: `db-${db.event_id}`,
    title: db.name,
    type: db.event_type.toLowerCase().trim(),
    typeColor: db.type_color ?? null,
    dateKey,
    startDt,
    endDt,
    description: db.description,
    location: db.location,
    locationUrl: db.location_url,
    dbEventId: db.event_id,
    rsvpEnabled: db.rsvp_enabled,
    rsvpCount: db.rsvp_count,
    pointsValue: db.points_value,
    isPast: computeIsPast(startDt, endDt, dateKey),
  };
}

function mergeEvents(gcalRaw: Record<string, unknown>[], dbEvents: DbEvent[]): MergedEvent[] {
  const dbByGcalId = new Map<string, DbEvent>();
  const dbNoGcal: DbEvent[] = [];
  for (const db of dbEvents) {
    if (db.google_event_id) dbByGcalId.set(db.google_event_id, db);
    else dbNoGcal.push(db);
  }

  const gcalIds = new Set(gcalRaw.map((g) => g.id as string));
  const merged: MergedEvent[] = [];

  for (const g of gcalRaw) {
    const start = g.start as Record<string, string> | undefined;
    if (!start) continue;
    const startRaw = start.dateTime ?? start.date ?? "";
    const dateKey = startRaw.slice(0, 10);
    if (dateKey.length < 10) continue;
    const db = dbByGcalId.get(g.id as string) ?? null;
    const end = g.end as Record<string, string> | undefined;
    const title = (g.summary as string | undefined) ?? "Untitled";
    const startDt = start.dateTime ?? null;
    const endDt = end?.dateTime ?? null;
    merged.push({
      key: `gcal-${g.id}`,
      title,
      // DB type takes priority; fall back to title inference for GCal-only events
      type: db ? db.event_type.toLowerCase().trim() : inferTypeFromTitle(title),
      typeColor: db?.type_color ?? null,
      dateKey,
      startDt,
      endDt,
      description: db?.description ?? (g.description as string | undefined) ?? null,
      location: db?.location ?? (g.location as string | undefined) ?? null,
      locationUrl: db?.location_url ?? null,
      dbEventId: db?.event_id ?? null,
      rsvpEnabled: db?.rsvp_enabled ?? false,
      rsvpCount: db?.rsvp_count ?? 0,
      pointsValue: db ? db.points_value : null,
      isPast: computeIsPast(startDt, endDt, dateKey),
    });
  }

  for (const [gcalId, db] of dbByGcalId) {
    if (!gcalIds.has(gcalId)) {
      if (db.starts_at.slice(0, 10).length >= 10) merged.push(dbToMerged(db));
    }
  }

  for (const db of dbNoGcal) {
    if (db.starts_at.slice(0, 10).length >= 10) merged.push(dbToMerged(db));
  }

  return merged;
}

// ── CalendarGrid ──────────────────────────────────────────────────────────────

function CalendarGrid({ year, month, events, onSelect, showRsvpCount, typeColorMap }: {
  year: number; month: number; events: MergedEvent[];
  onSelect: (ev: MergedEvent) => void;
  showRsvpCount: boolean;
  typeColorMap: TypeColorMap;
}) {
  const evMap = useMemo(() => {
    const m = new Map<string, MergedEvent[]>();
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

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 6 }}>
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((w) => (
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
                {dayEvs.slice(0, 3).map((ev) => {
                  const color = getTypeColor(ev.type, typeColorMap, ev.typeColor);
                  return (
                    <button key={ev.key} onClick={() => onSelect(ev)} title={ev.title} style={{
                      fontSize: 9, fontWeight: 600, padding: "2px 5px", borderRadius: 4,
                      background: color, color: "#fff",
                      overflow: "hidden", whiteSpace: "nowrap",
                      fontFamily: "Oxanium,sans-serif", display: "flex", alignItems: "center",
                      width: "100%", border: "none", cursor: "pointer", gap: 3,
                      opacity: ev.isPast ? 0.6 : 1,
                    }}>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</span>
                      {ev.pointsValue != null && ev.pointsValue > 0 && (
                        <span style={{ background: "rgba(0,0,0,.25)", borderRadius: 3, padding: "0 3px", flexShrink: 0, fontSize: 7, fontFamily: "Oxanium,sans-serif" }}>{ev.pointsValue}pt</span>
                      )}
                      {showRsvpCount && ev.rsvpEnabled && ev.rsvpCount > 0 && (
                        <span style={{ background: "rgba(0,0,0,.3)", borderRadius: 3, padding: "0 3px", flexShrink: 0, fontSize: 8 }}>{ev.rsvpCount}</span>
                      )}
                    </button>
                  );
                })}
                {dayEvs.length > 3 && (
                  <button onClick={() => onSelect(dayEvs[3])} style={{ fontSize: 9, color: "rgba(0,0,0,.45)", fontFamily: "Oxanium,sans-serif", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                    +{dayEvs.length - 3} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── AgendaView ────────────────────────────────────────────────────────────────

function AgendaView({ events, onSelect, showRsvpCount, typeColorMap, emptyMessage }: {
  events: MergedEvent[]; onSelect: (ev: MergedEvent) => void;
  showRsvpCount: boolean; typeColorMap: TypeColorMap;
  emptyMessage?: string;
}) {
  const byMonth = useMemo(() => {
    const m = new Map<string, MergedEvent[]>();
    for (const ev of events) {
      const k = ev.dateKey.slice(0, 7);
      const arr = m.get(k) ?? [];
      arr.push(ev);
      m.set(k, arr);
    }
    return m;
  }, [events]);

  if (events.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "28px 20px", borderRadius: 12, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", color: "rgba(255,255,255,.4)", fontSize: 14, fontFamily: "Oxanium,sans-serif" }}>
        {emptyMessage ?? "No events found."}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {Array.from(byMonth.entries()).map(([monthKey, evs]) => {
        const [y, mo] = monthKey.split("-").map(Number);
        return (
          <div key={monthKey}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.38)", letterSpacing: ".14em", textTransform: "uppercase", fontFamily: "Oxanium,sans-serif" }}>
                {MONTHS[mo - 1]} {y}
              </span>
              <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 10, background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.3)", fontFamily: "Oxanium,sans-serif" }}>
                {evs.length} event{evs.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {evs.map((ev) => {
                const dayNum = Number(ev.dateKey.slice(8, 10));
                const weekday = ev.startDt
                  ? formatWeekdayShort(parseIso(ev.startDt))
                  : formatWeekdayShort(parseIso(`${ev.dateKey}T12:00:00`));
                const color = getTypeColor(ev.type, typeColorMap, ev.typeColor);
                const typeLabel = ev.type.charAt(0).toUpperCase() + ev.type.slice(1);
                const timeStr = formatTimeRange(ev.startDt, ev.endDt);
                return (
                  <button key={ev.key} onClick={() => onSelect(ev)} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                    borderRadius: 10, border: "1px solid rgba(255,255,255,.06)",
                    background: "rgba(255,255,255,.04)", cursor: "pointer",
                    opacity: ev.isPast ? 0.5 : 1, textAlign: "left", width: "100%",
                    transition: "background .15s",
                  }}>
                    <div style={{ minWidth: 44, textAlign: "center", flexShrink: 0 }}>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,.38)", fontFamily: "Oxanium,sans-serif", textTransform: "uppercase", letterSpacing: ".08em" }}>{weekday}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: "Oxanium,sans-serif", lineHeight: 1.05 }}>{dayNum}</div>
                    </div>
                    <div style={{ width: 3, height: 36, borderRadius: 2, background: color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "Oxanium,sans-serif", fontWeight: 700, fontSize: 13.5, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.title}</div>
                      {(timeStr || ev.location) && (
                        <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.45)", fontFamily: "Oxanium,sans-serif", marginTop: 1 }}>
                          {timeStr}{ev.location && ` · ${ev.location}`}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                      {ev.pointsValue != null && ev.pointsValue > 0 && (
                        <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4, background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.5)", fontFamily: "Oxanium,sans-serif" }}>
                          {ev.pointsValue}pt
                        </span>
                      )}
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: color, color: "#fff", fontFamily: "Oxanium,sans-serif", textTransform: "uppercase", letterSpacing: ".06em" }}>
                        {typeLabel}
                      </span>
                      {ev.rsvpEnabled && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
                          background: `${color}22`, color, border: `1px solid ${color}55`,
                          fontFamily: "Oxanium,sans-serif", letterSpacing: ".05em",
                          display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0,
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
                          {showRsvpCount && ev.rsvpCount > 0 ? `${ev.rsvpCount} RSVPs` : "RSVP"}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── EventDetailModal ──────────────────────────────────────────────────────────

function EventDetailModal({
  ev, onClose, user, typeColorMap, onRsvpChange, onEdit,
}: {
  ev: MergedEvent;
  onClose: () => void;
  user: { user_id: number; email: string; role?: string } | null;
  typeColorMap: TypeColorMap;
  onRsvpChange: (eventId: number, rsvped: boolean) => void;
  onEdit: (ev: MergedEvent) => void;
}) {
  const canRsvp = user && RSVP_ROLES.includes(user.role ?? "");
  const isOfficerAdmin = user && OFFICER_ROLES.includes(user.role ?? "");

  const [rsvpStatus, setRsvpStatus] = useState<"loading" | "yes" | "no" | "unavailable">("loading");
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    if (!ev.rsvpEnabled || !ev.dbEventId || !canRsvp) { setRsvpStatus("unavailable"); return; }
    setRsvpStatus("loading");
    apiGet<{ rsvped: boolean }>(`/events/${ev.dbEventId}/my-rsvp`)
      .then((d) => setRsvpStatus(d.rsvped ? "yes" : "no"))
      .catch(() => setRsvpStatus("no"));
  }, [ev.dbEventId, ev.rsvpEnabled, canRsvp]);

  const toggleRsvp = async () => {
    if (!ev.dbEventId || rsvpBusy) return;
    setRsvpBusy(true);
    try {
      if (rsvpStatus === "yes") {
        await apiDelete(`/events/${ev.dbEventId}/rsvp`);
        setRsvpStatus("no");
        onRsvpChange(ev.dbEventId, false);
      } else {
        await apiPost(`/events/${ev.dbEventId}/rsvp`, {});
        setRsvpStatus("yes");
        onRsvpChange(ev.dbEventId, true);
      }
    } catch { /* ignore */ }
    setRsvpBusy(false);
  };

  const color = getTypeColor(ev.type, typeColorMap, ev.typeColor);
  const typeLabel = ev.type.charAt(0).toUpperCase() + ev.type.slice(1);

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px", backdropFilter: "blur(5px)" }}
    >
      <div style={{ maxWidth: 520, width: "100%", borderRadius: 20, background: "rgba(10,1,1,.97)", border: `1px solid ${color}44`, boxShadow: "0 28px 70px rgba(0,0,0,.85)", overflow: "hidden" }}>
        {/* Type accent bar */}
        <div style={{ height: 4, background: color }} />

        <div style={{ padding: "22px 24px 26px" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, gap: 12 }}>
            <div>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color, fontFamily: "Oxanium,sans-serif", display: "block", marginBottom: 5 }}>
                {typeLabel}
              </span>
              <h2 style={{ fontFamily: "Oxanium,sans-serif", fontWeight: 800, fontSize: 20, color: "#fff", margin: 0, lineHeight: 1.3 }}>{ev.title}</h2>
            </div>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,.08)", border: "none", color: "rgba(255,255,255,.55)", borderRadius: 8, width: 30, height: 30, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>×</button>
          </div>

          {/* Date/time */}
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.62)", fontFamily: "Oxanium,sans-serif", marginBottom: 9, display: "flex", gap: 8 }}>
            <span style={{ flexShrink: 0 }}>📅</span>
            <span>{formatEventTimeRange(ev.startDt, ev.endDt, ev.dateKey)}</span>
          </div>

          {/* Location */}
          {ev.location && (
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.62)", fontFamily: "Oxanium,sans-serif", marginBottom: 9, display: "flex", gap: 8 }}>
              <span style={{ flexShrink: 0 }}>📍</span>
              {ev.locationUrl && /^https?:\/\//.test(ev.locationUrl) ? (
                <a href={ev.locationUrl} target="_blank" rel="noopener noreferrer" style={{ color: "rgba(248,113,113,.9)", textDecoration: "none" }}>{ev.location}</a>
              ) : (
                <span>{ev.location}</span>
              )}
            </div>
          )}

          {/* Points */}
          {ev.pointsValue != null && ev.pointsValue > 0 && (
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.62)", fontFamily: "Oxanium,sans-serif", marginBottom: 9, display: "flex", gap: 8 }}>
              <span>🎯</span>
              <span>{ev.pointsValue} point{ev.pointsValue !== 1 ? "s" : ""} for attending</span>
            </div>
          )}

          {/* Description */}
          {ev.description && (
            <p style={{ fontSize: 13.5, color: "rgba(255,255,255,.55)", fontFamily: "Oxanium,sans-serif", lineHeight: 1.65, margin: "16px 0 0", borderTop: "1px solid rgba(255,255,255,.07)", paddingTop: 14, whiteSpace: "pre-line" }}>
              {ev.description}
            </p>
          )}

          {/* RSVP section — button left, officer count right */}
          {ev.rsvpEnabled && (
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,.07)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {!user ? (
                <a href="/login" style={{ display: "inline-block", padding: "9px 22px", borderRadius: 10, background: `${color}a0`, color: "#fff", fontFamily: "Oxanium,sans-serif", fontWeight: 700, fontSize: 13, textDecoration: "none", boxShadow: `0 0 20px ${color}50` }}>
                  Log in to RSVP
                </a>
              ) : !canRsvp ? (
                <span style={{ fontSize: 13, color: "rgba(255,255,255,.38)", fontFamily: "Oxanium,sans-serif" }}>Members only</span>
              ) : rsvpStatus === "loading" ? (
                <span style={{ fontSize: 13, color: "rgba(255,255,255,.38)", fontFamily: "Oxanium,sans-serif" }}>…</span>
              ) : (
                <button onClick={toggleRsvp} disabled={rsvpBusy} style={{
                  padding: "9px 22px", borderRadius: 10, border: "none", cursor: rsvpBusy ? "default" : "pointer",
                  background: rsvpStatus === "yes" ? "rgba(255,255,255,.1)" : `${color}a0`,
                  color: "#fff", fontFamily: "Oxanium,sans-serif", fontWeight: 700, fontSize: 13,
                  boxShadow: rsvpStatus === "yes" ? "none" : `0 0 20px ${color}50`,
                  opacity: rsvpBusy ? 0.6 : 1, transition: "all .2s",
                }}>
                  {rsvpStatus === "yes" ? "✓ Cancel RSVP" : "RSVP"}
                </button>
              )}
              {rsvpStatus === "yes" && (
                <span style={{ fontSize: 12, color: "rgba(134,239,172,.85)", fontFamily: "Oxanium,sans-serif" }}>You're going!</span>
              )}
              {isOfficerAdmin && (
                <span style={{ fontSize: 12, color: "rgba(255,255,255,.38)", fontFamily: "Oxanium,sans-serif", marginLeft: "auto" }}>
                  {ev.rsvpCount} RSVP{ev.rsvpCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}

          {/* Footer: Edit (officers/admins) + Add to Google Calendar */}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,.07)", display: "flex", justifyContent: isOfficerAdmin && ev.dbEventId ? "space-between" : "flex-end", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {isOfficerAdmin && ev.dbEventId && (
              <button
                onClick={() => { onClose(); onEdit(ev); }}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "rgba(248,113,113,.9)", fontFamily: "Oxanium,sans-serif", padding: "7px 14px", borderRadius: 8, border: `1px solid ${color}55`, background: `${color}1a`, cursor: "pointer", transition: "all .15s" }}
              >
                ✏️ Edit Event
              </button>
            )}
            <a href={buildGCalUrl(ev)} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "rgba(255,255,255,.45)", fontFamily: "Oxanium,sans-serif", textDecoration: "none", padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)", transition: "all .15s" }}>
              📅 Add to Google Calendar
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

const API_BASE = (import.meta.env.VITE_BACKEND_API_URL ?? "").replace(/\/$/, "");

export default function Calendar() {
  const now = new Date();
  const { user } = useAuth();
  const isOfficerAdmin = !!(user && OFFICER_ROLES.includes(user.role ?? ""));
  const showRsvpCount = isOfficerAdmin;

  const [type, setType] = useState<string>("all");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [viewMode, setViewMode] = useState<"calendar" | "list">(() => {
    if (typeof window === "undefined") return "calendar";
    return window.matchMedia("(max-width: 767px)").matches ? "list" : "calendar";
  });
  const [selectedEvent, setSelectedEvent] = useState<MergedEvent | null>(null);
  const [showMyRsvpsOnly, setShowMyRsvpsOnly] = useState(false);
  const [showPastInList, setShowPastInList] = useState(false);
  const [listSearch, setListSearch] = useState("");

  const [gcalRaw, setGcalRaw] = useState<Record<string, unknown>[]>([]);
  const [dbEvents, setDbEvents] = useState<DbEvent[]>([]);
  const [eventTypes, setEventTypes] = useState<EventTypeOption[]>([]);
  const [userRsvpIds, setUserRsvpIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [refetchKey, setRefetchKey] = useState(0);

  // Edit modal state (officer/admin only)
  const [editModalEvent, setEditModalEvent] = useState<AdminEvent | null>(null);
  const [editModalKey, setEditModalKey] = useState(0);
  const [showEditModal, setShowEditModal] = useState(false);
  const [allPartners, setAllPartners] = useState<PartnerOption[]>([]);
  const [allSponsors, setAllSponsors] = useState<SponsorOption[]>([]);

  // Load events + event types in parallel
  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/events/google`).then((r) => r.json()).catch(() => []),
      fetch(`${API_BASE}/events/`).then(async (r) => { const d = await r.json(); return Array.isArray(d) ? d : []; }).catch(() => []),
      fetch(`${API_BASE}/events/event-types`).then(async (r) => { const d = await r.json(); return Array.isArray(d.event_types) ? d.event_types : []; }).catch(() => []),
    ])
      .then(([gcal, db, types]) => {
        setGcalRaw(Array.isArray(gcal) ? gcal : []);
        setDbEvents(Array.isArray(db) ? db : []);
        // Public endpoint only returns active types; mark them so EventModal's filter works
        setEventTypes(Array.isArray(types) ? types.map((t: EventTypeOption) => ({ ...t, is_active: true })) : []);
      })
      .catch(() => setFetchError("Could not load events."))
      .finally(() => setLoading(false));
  }, [refetchKey]);

  // Fetch user RSVPs when authenticated
  useEffect(() => {
    if (!user) { setUserRsvpIds(new Set()); return; }
    apiGet<{ rsvped_event_ids: number[] }>("/events/my-rsvps")
      .then((d) => setUserRsvpIds(new Set(d.rsvped_event_ids)))
      .catch(() => setUserRsvpIds(new Set()));
  }, [user]);

  // Fetch partners/sponsors for the edit modal — officer/admin only
  useEffect(() => {
    if (!isOfficerAdmin) return;
    Promise.all([
      fetch(`${API_BASE}/partners/`).then((r) => r.json()).catch(() => ({ partners: [] })),
      fetch(`${API_BASE}/sponsors/`).then((r) => r.json()).catch(() => ({ sponsors: [] })),
    ]).then(([pd, sd]) => {
      setAllPartners(pd.partners ?? []);
      setAllSponsors(sd.sponsors ?? []);
    });
  }, [isOfficerAdmin]);

  const typeColorMap = useMemo<TypeColorMap>(() => {
    const m: TypeColorMap = {};
    for (const t of eventTypes) m[t.name.toLowerCase()] = t.color;
    return m;
  }, [eventTypes]);

  const typeFilterOptions = useMemo(() => [
    { label: "All Events", value: "all" },
    ...eventTypes.map((t) => ({
      label: t.name.charAt(0).toUpperCase() + t.name.slice(1),
      value: t.name.toLowerCase(),
    })),
  ], [eventTypes]);

  const allEvents = useMemo(() => mergeEvents(gcalRaw, dbEvents), [gcalRaw, dbEvents]);

  const filteredEvents = useMemo(() => {
    let evs = type === "all" ? allEvents : allEvents.filter((e) => e.type === type);
    if (showMyRsvpsOnly && user) {
      evs = evs.filter((e) => e.dbEventId !== null && userRsvpIds.has(e.dbEventId));
    }
    return evs;
  }, [allEvents, type, showMyRsvpsOnly, user, userRsvpIds]);

  const calendarEvents = useMemo(() =>
    filteredEvents.filter((e) => {
      const [y, m] = e.dateKey.split("-").map(Number);
      return y === year && m - 1 === month;
    }),
  [filteredEvents, year, month]);

  const agendaEvents = useMemo(() => {
    const todayKey = todayKeyCT();
    let evs = showPastInList
      ? [...filteredEvents].sort((a, b) => a.dateKey.localeCompare(b.dateKey))
      : [...filteredEvents].filter((e) => e.dateKey >= todayKey).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    if (listSearch.trim()) {
      const q = listSearch.trim().toLowerCase();
      evs = evs.filter((e) => e.title.toLowerCase().includes(q));
    }
    return evs;
  }, [filteredEvents, showPastInList, listSearch]);

  const handleRsvpChange = (eventId: number, rsvped: boolean) => {
    setUserRsvpIds((prev) => {
      const next = new Set(prev);
      if (rsvped) next.add(eventId);
      else next.delete(eventId);
      return next;
    });
  };

  function handleEditEvent(ev: MergedEvent) {
    if (!ev.dbEventId) return;
    const dbEv = dbEvents.find((d) => d.event_id === ev.dbEventId);
    if (!dbEv) return;
    // DbEvent is a superset of AdminEvent fields
    setEditModalEvent(dbEv as unknown as AdminEvent);
    setEditModalKey((k) => k + 1);
    setShowEditModal(true);
  }

  const goToday = () => { const t = new Date(); setYear(t.getFullYear()); setMonth(t.getMonth()); };
  const goPrev = () => { if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1); };
  const goNext = () => { if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1); };

  // Shared styles
  const panel: React.CSSProperties = { borderRadius: 18, background: "rgba(255,255,255,.04)", border: "1px solid rgba(185,28,28,.2)", backdropFilter: "blur(10px)", padding: "20px" };
  const sLabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", fontFamily: "Oxanium,sans-serif", marginBottom: 10, display: "block" };
  const filterBtn = (active: boolean): React.CSSProperties => ({
    display: "block", width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 8, border: "none",
    background: active ? "rgba(185,28,28,.85)" : "transparent",
    color: active ? "#fff" : "rgba(255,255,255,.65)",
    fontFamily: "Oxanium,sans-serif", fontWeight: active ? 700 : 500, fontSize: 13, marginBottom: 3, cursor: "pointer", transition: "all .15s",
  });
  const navBtn: React.CSSProperties = {
    background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)", color: "#fff",
    padding: "8px 16px", borderRadius: 9, fontWeight: 600, fontSize: 13,
    fontFamily: "Oxanium,sans-serif", cursor: "pointer", transition: "background .15s",
  };
  const viewBtn = (active: boolean): React.CSSProperties => ({
    ...navBtn,
    background: active ? "rgba(185,28,28,.7)" : "rgba(255,255,255,.08)",
    border: active ? "1px solid rgba(185,28,28,.5)" : "1px solid rgba(255,255,255,.12)",
  });

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

  const displayCount = viewMode === "calendar" ? calendarEvents.length : agendaEvents.length;

  return (
    <main className="overflow-x-hidden" style={{ position: "relative", maxWidth: 1260, margin: "0 auto", padding: "28px 16px 72px" }}>
      {selectedEvent && (
        <EventDetailModal
          ev={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          user={user}
          typeColorMap={typeColorMap}
          onRsvpChange={handleRsvpChange}
          onEdit={handleEditEvent}
        />
      )}

      {showEditModal && editModalEvent && (
        <EventModal
          key={editModalKey}
          event={editModalEvent}
          types={eventTypes}
          allPartners={allPartners}
          allSponsors={allSponsors}
          onClose={() => { setShowEditModal(false); setEditModalEvent(null); }}
          onSaved={() => setRefetchKey((k) => k + 1)}
        />
      )}

      <header style={{ textAlign: "center", marginBottom: 32 }}>
        <h1 style={{ fontFamily: "Oxanium,sans-serif", fontSize: "clamp(26px,3.5vw,44px)", fontWeight: 800, letterSpacing: "-.02em", margin: "0 0 8px", color: "#fff" }}>CougarAI Calendar</h1>
        <p style={{ color: "rgba(255,255,255,.55)", fontSize: 14.5, fontFamily: "Oxanium,sans-serif" }}>Browse upcoming meetings, workshops, and club events.</p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[260px_minmax(0,1fr)] md:items-start">

        {/* Sidebar */}
        <aside className="min-w-0" style={panel}>
          {/* Event Type filter */}
          <div style={{ marginBottom: 22 }}>
            <span style={sLabel}>Event Type</span>
            {typeFilterOptions.length > 0 ? typeFilterOptions.map(({ label, value }) => (
              <button key={value} style={filterBtn(type === value)} onClick={() => setType(value)}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {value !== "all" && (
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: getTypeColor(value, typeColorMap), display: "inline-block", flexShrink: 0 }} />
                  )}
                  {label}
                </span>
              </button>
            )) : (
              <button style={filterBtn(true)}>All Events</button>
            )}
          </div>

          {/* My RSVPs toggle — only shown when logged in */}
          {user && (
            <div style={{ marginBottom: 22 }}>
              <span style={sLabel}>Filter</span>
              <button style={filterBtn(showMyRsvpsOnly)} onClick={() => setShowMyRsvpsOnly((v) => !v)}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: showMyRsvpsOnly ? "#fff" : "rgba(255,255,255,.4)", display: "inline-block", flexShrink: 0 }} />
                  My RSVPs
                </span>
              </button>
            </div>
          )}

          {viewMode === "calendar" && (
            <>
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

            </>
          )}

        </aside>

        {/* Main panel */}
        <section className="min-w-0" style={panel}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
            {/* Left: nav arrows (calendar mode) / search (list mode) */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
              {viewMode === "calendar" ? (
                <>
                  <button style={navBtn} onClick={goPrev}>← Prev</button>
                  <button style={navBtn} onClick={goNext}>Next →</button>
                  <button style={{ ...navBtn, padding: "8px 12px", fontSize: 12, color: "rgba(255,255,255,.6)" }} onClick={goToday} title="Jump to today">Today</button>
                </>
              ) : null}
            </div>

            {/* Center: title */}
            <h2 style={{ fontFamily: "Oxanium,sans-serif", fontWeight: 800, fontSize: 22, margin: 0, color: "#fff", flex: "1 1 100%", textAlign: "center" }}>
              {viewMode === "calendar" ? `${MONTHS[month]} ${year}` : "Upcoming Events"}
            </h2>

            {/* Right: view toggle */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", minWidth: 0, justifyContent: "flex-end" }}>
              <button style={viewBtn(viewMode === "calendar")} onClick={() => setViewMode("calendar")}>📅 Month</button>
              <button style={viewBtn(viewMode === "list")} onClick={() => setViewMode("list")}>☰ List</button>
            </div>
          </div>

          {/* List view controls */}
          {viewMode === "list" && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 180, position: "relative" }}>
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,.3)", fontSize: 14, pointerEvents: "none" }}>🔍</span>
                <input
                  type="text"
                  placeholder="Search events…"
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  style={{ width: "100%", paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 9, border: "1px solid rgba(185,28,28,.2)", background: "rgba(255,255,255,.05)", color: "#fff", fontFamily: "Oxanium,sans-serif", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <button
                onClick={() => setShowPastInList((v) => !v)}
                style={{
                  padding: "8px 14px", borderRadius: 9, border: `1px solid ${showPastInList ? "rgba(185,28,28,.5)" : "rgba(255,255,255,.12)"}`,
                  background: showPastInList ? "rgba(185,28,28,.2)" : "rgba(255,255,255,.05)",
                  color: showPastInList ? "rgba(248,113,113,.9)" : "rgba(255,255,255,.5)",
                  fontFamily: "Oxanium,sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all .15s", whiteSpace: "nowrap",
                }}
              >
                {showPastInList ? "✓ " : ""}Past Events
              </button>
            </div>
          )}

          <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.38)", fontFamily: "Oxanium,sans-serif", marginBottom: 16, textAlign: "right", wordBreak: "break-word" }}>
            {displayCount} event{displayCount !== 1 ? "s" : ""}
            {showMyRsvpsOnly && " · My RSVPs only"}
            {viewMode === "list" && showPastInList && " · Incl. past"}
          </div>

          {viewMode === "calendar" ? (
            <>
              <CalendarGrid
                year={year} month={month} events={calendarEvents}
                onSelect={setSelectedEvent} showRsvpCount={showRsvpCount}
                typeColorMap={typeColorMap}
              />
              {calendarEvents.length === 0 && (
                <div style={{ textAlign: "center", padding: "28px 20px", marginTop: 12, borderRadius: 12, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", color: "rgba(255,255,255,.4)", fontSize: 14, fontFamily: "Oxanium,sans-serif" }}>
                  No events this month. Try a different filter or month.
                </div>
              )}
            </>
          ) : (
            <AgendaView
              events={agendaEvents}
              onSelect={setSelectedEvent}
              showRsvpCount={showRsvpCount}
              typeColorMap={typeColorMap}
              emptyMessage={listSearch ? "No events match your search." : showPastInList ? "No events found." : "No upcoming events. Toggle 'Past Events' to see older ones."}
            />
          )}
        </section>
      </div>
    </main>
  );
}
