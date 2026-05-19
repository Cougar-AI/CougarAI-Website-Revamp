import { useState, useEffect, useRef } from 'react';
import { formatDate, formatTime, formatDateTimeFull } from '@/lib/dates';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { Plus, Edit2, Trash2, Users, Copy, RefreshCw, X, CheckCircle, XCircle, QrCode, Files, Link, Calendar, CalendarX, Download, Radio, ChevronUp, ChevronDown, MapPin, Navigation } from 'lucide-react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerIconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';
const leafletIcon = L.icon({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIconRetinaUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export interface Event {
  event_id: number;
  name: string;
  event_type: string;
  description: string | null;
  location: string | null;
  location_url: string | null;
  starts_at: string;
  ends_at: string | null;
  capacity: number | null;
  check_in_code: string | null;
  check_in_enabled: boolean;
  check_in_expires_at: string | null;
  points_value: number;
  google_event_id: string | null;
  require_location: boolean;
  latitude: number | null;
  longitude: number | null;
  checkin_radius_m: number;
  rsvp_enabled: boolean;
  rsvp_count?: number;
}

interface Attendee {
  checkin_id: number;
  checked_in_at: string | null;
  student_id: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  points: number | null;
}

interface AttendanceResponse {
  event_id: number;
  event_name: string;
  capacity: number | null;
  starts_at: string | null;
  attendance_count: number;
  attendees: Attendee[];
}

export interface EventTypeOption {
  type_id: number;
  name: string;
  default_points: number;
  color: string;
  is_active: boolean;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function typeColors(color: string) {
  return { bg: hexToRgba(color, 0.2), text: hexToRgba(color, 0.9) };
}

const cardStyle = {
  background: 'rgba(255,255,255,.04)',
  border: '1px solid rgba(185,28,28,.22)',
  backdropFilter: 'blur(10px)',
};

export interface PartnerOption {
  partner_id: number;
  name: string;
  type: string;
  logo_url?: string | null;
}

export interface SponsorOption {
  sponsor_id: number;
  name: string;
  tier: string;
  logo_url?: string | null;
}

function generateOccurrences(
  startsAt: string,
  expiresAt: string,
  until: string,
  freq: 'weekly' | 'monthly',
): Array<{ starts_at: string; check_in_expires_at: string }> {
  const occurrences = [];
  const untilDate = new Date(until + 'T23:59:59');
  const current = new Date(startsAt);
  const currentEnd = new Date(expiresAt || startsAt);

  const advance = (d: Date) => {
    if (freq === 'weekly') d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
  };

  advance(current);
  advance(currentEnd);

  while (current <= untilDate) {
    occurrences.push({
      starts_at: current.toISOString().slice(0, 16),
      check_in_expires_at: currentEnd.toISOString().slice(0, 16),
    });
    advance(current);
    advance(currentEnd);
  }
  return occurrences;
}

// UH campus default center
const UH_CENTER: [number, number] = [29.7199, -95.3422];

function parseGoogleMapsCoords(url: string): { lat: number; lng: number } | null {
  function validCoords(lat: number, lng: number) {
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }
  const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]), lng = parseFloat(atMatch[2]);
    if (validCoords(lat, lng)) return { lat, lng };
  }
  const qMatch = url.match(/[?&](?:q|ll)=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]), lng = parseFloat(qMatch[2]);
    if (validCoords(lat, lng)) return { lat, lng };
  }
  return null;
}

function MapPanner({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(center, 17); }, [center[0], center[1]]);
  return null;
}

function MapClickHandler({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  const map = useMap();
  useEffect(() => {
    const handler = (e: L.LeafletMouseEvent) => onChange(e.latlng.lat, e.latlng.lng);
    map.on('click', handler);
    return () => { map.off('click', handler); };
  }, [map, onChange]);
  return null;
}

function DraggableMarker({ position, onChange }: { position: [number, number]; onChange: (lat: number, lng: number) => void }) {
  return (
    <Marker
      icon={leafletIcon}
      draggable
      position={position}
      eventHandlers={{ dragend: (e) => { const ll = e.target.getLatLng(); onChange(ll.lat, ll.lng); } }}
    />
  );
}

function ConfirmModal({ message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }: {
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-5"
        style={{ background: 'rgba(10,0,0,.97)', border: '1px solid rgba(185,28,28,.35)', boxShadow: '0 30px 80px rgba(0,0,0,.7)' }}
      >
        <p className="text-sm text-white/80 leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white transition-colors"
            style={{ background: 'rgba(255,255,255,.06)' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all"
            style={danger
              ? { background: 'rgba(185,28,28,.7)', boxShadow: '0 0 16px rgba(185,28,28,.3)' }
              : { background: 'rgba(255,255,255,.12)' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const BACKEND = import.meta.env.VITE_BACKEND_API_URL ?? 'http://localhost:5001';

const _pad = (n: number) => String(n).padStart(2, '0');

function toLocalISO(d: Date): string {
  return `${d.getFullYear()}-${_pad(d.getMonth() + 1)}-${_pad(d.getDate())}T${_pad(d.getHours())}:${_pad(d.getMinutes())}`;
}

function toDatetimeLocal(ts: string | null | undefined): string {
  if (!ts) return '';
  const d = new Date(ts);
  return isNaN(d.getTime()) ? '' : toLocalISO(d);
}

function addMinutes(dtLocal: string, m: number): string {
  const d = new Date(dtLocal);
  d.setMinutes(d.getMinutes() + m);
  return toLocalISO(d);
}

function defaultStartTime(): string {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return toLocalISO(d);
}

interface PickerItem {
  id: number;
  name: string;
  logo_url?: string | null;
  subtitle?: string;
}

function MultiSelectDropdown({
  label,
  items,
  selectedIds,
  onToggle,
}: {
  label: string;
  items: PickerItem[];
  selectedIds: number[];
  onToggle: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const selected = items.filter((i) => selectedIds.includes(i.id));

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      <label className="text-xs text-white/50">{label}</label>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all"
        style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(185,28,28,.2)', color: selected.length ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.35)' }}
      >
        <span>{selected.length === 0 ? `Select ${label}…` : `${selected.length} selected`}</span>
        <ChevronDown
          size={13}
          className="transition-transform shrink-0"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
              style={{ background: 'rgba(185,28,28,.25)', border: '1px solid rgba(185,28,28,.4)' }}
            >
              {item.logo_url && (
                <img src={item.logo_url.startsWith('http') ? item.logo_url : `${BACKEND}${item.logo_url}`} alt="" className="h-3.5 w-3.5 rounded-full object-cover" />
              )}
              <span style={{ color: 'rgba(248,113,113,.9)' }}>{item.name}</span>
              <button type="button" onClick={() => onToggle(item.id)} className="text-white/30 hover:text-white/70 ml-0.5 flex items-center">
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div
          className="flex flex-col rounded-lg overflow-hidden"
          style={{ background: 'rgba(8,0,0,.98)', border: '1px solid rgba(185,28,28,.2)', maxHeight: 180, overflowY: 'auto' }}
        >
          {items.length === 0 && (
            <p className="text-xs text-white/30 px-3 py-2">No options available</p>
          )}
          {items.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onToggle(item.id)}
                className="flex items-center gap-2.5 px-3 py-2 text-left transition-all hover:bg-white/5"
                style={isSelected ? { background: 'rgba(185,28,28,.12)' } : {}}
              >
                {item.logo_url ? (
                  <img src={item.logo_url.startsWith('http') ? item.logo_url : `${BACKEND}${item.logo_url}`} alt="" className="h-6 w-6 rounded object-cover shrink-0" />
                ) : (
                  <div
                    className="h-6 w-6 rounded shrink-0 flex items-center justify-center text-[10px] font-bold"
                    style={{ background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.4)' }}
                  >
                    {item.name[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs text-white/85 truncate">{item.name}</span>
                  {item.subtitle && <span className="text-[10px] text-white/35 truncate">{item.subtitle}</span>}
                </div>
                {isSelected && <CheckCircle size={12} className="shrink-0" style={{ color: 'rgba(248,113,113,.8)' }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function EventModal({
  event,
  types,
  allPartners,
  allSponsors,
  onClose,
  onSaved,
}: {
  event: Event | null;
  types: EventTypeOption[];
  allPartners: PartnerOption[];
  allSponsors: SponsorOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const defaultType = types.find((t) => t.is_active)?.name ?? 'workshop';
  const [form, setForm] = useState({
    name: event?.name ?? '',
    event_type: event?.event_type ?? defaultType,
    description: event?.description ?? '',
    location: event?.location ?? '',
    location_url: event?.location_url ?? '',
    starts_at: toDatetimeLocal(event?.starts_at) || defaultStartTime(),
    ends_at: toDatetimeLocal(event?.ends_at) || addMinutes(defaultStartTime(), 90),
    capacity: event?.capacity?.toString() ?? '',
    points_value: event?.points_value?.toString() ?? '10',
    check_in_enabled: event?.check_in_enabled ?? false,
    check_in_expires_at: toDatetimeLocal(event?.check_in_expires_at),
    require_location: event?.require_location ?? false,
    latitude: event?.latitude?.toString() ?? '',
    longitude: event?.longitude?.toString() ?? '',
    checkin_radius_m: event?.checkin_radius_m?.toString() ?? '400',
    rsvp_enabled: event?.rsvp_enabled ?? false,
  });
  const [expiryTouched, setExpiryTouched] = useState(false);
  const [endsTouched, setEndsTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [syncToGoogle, setSyncToGoogle] = useState(!!event?.google_event_id);
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<number[]>([]);
  const [selectedSponsorIds, setSelectedSponsorIds] = useState<number[]>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurFrequency, setRecurFrequency] = useState<'weekly' | 'monthly'>('weekly');
  const [recurUntil, setRecurUntil] = useState('');
  const [mapUrlInput, setMapUrlInput] = useState('');
  const [mapUrlError, setMapUrlError] = useState('');
  const [mapCenter, setMapCenter] = useState<[number, number]>(() => {
    if (event?.latitude && event?.longitude) return [event.latitude, event.longitude];
    return UH_CENTER;
  });

  // Load existing partner tags when editing
  const { data: existingPartnersData } = useQuery<{ partners: Array<{ partner_id: number }> }>({
    queryKey: ['event-partners', event?.event_id],
    queryFn: () => apiGet(`/events/${event!.event_id}/partners`),
    enabled: !!(event && event.event_id > 0),
  });

  useEffect(() => {
    if (existingPartnersData?.partners) {
      setSelectedPartnerIds(existingPartnersData.partners.map((p) => p.partner_id));
    }
  }, [existingPartnersData]);

  // Load existing sponsor tags when editing
  const { data: existingSponsorsData } = useQuery<{ sponsors: Array<{ sponsor_id: number }> }>({
    queryKey: ['event-sponsors', event?.event_id],
    queryFn: () => apiGet(`/events/${event!.event_id}/sponsors`),
    enabled: !!(event && event.event_id > 0),
  });

  useEffect(() => {
    if (existingSponsorsData?.sponsors) {
      setSelectedSponsorIds(existingSponsorsData.sponsors.map((s) => s.sponsor_id));
    }
  }, [existingSponsorsData]);

  const [syncWarning, setSyncWarning] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.ends_at && form.starts_at && form.ends_at < form.starts_at) {
      setError('Ends At cannot be before Starts At.');
      return;
    }
    setSaving(true);
    setError('');
    setSyncWarning('');
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        event_type: form.event_type,
        description: form.description || null,
        location: form.location || null,
        location_url: form.location_url || null,
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
        capacity: form.capacity ? Number(form.capacity) : null,
        points_value: Number(form.points_value) || 10,
        check_in_enabled: form.check_in_enabled,
        check_in_expires_at: form.check_in_expires_at || null,
        require_location: form.require_location,
        latitude: form.require_location && form.latitude ? Number(form.latitude) : null,
        longitude: form.require_location && form.longitude ? Number(form.longitude) : null,
        checkin_radius_m: form.require_location ? Number(form.checkin_radius_m) || 400 : 400,
        rsvp_enabled: form.rsvp_enabled,
      };

      let savedEventId: number;
      if (event && event.event_id > 0) {
        await apiPatch(`/events/${event.event_id}`, payload);
        savedEventId = event.event_id;
      } else {
        const res = await apiPost<{ event_id: number }>('/events/', payload);
        savedEventId = res.event_id;
      }

      // Sync partner tags: compute adds/removes relative to existing
      const existingPartners = existingPartnersData?.partners?.map((p) => p.partner_id) ?? [];
      const partnersToAdd = selectedPartnerIds.filter((id) => !existingPartners.includes(id));
      const partnersToRemove = existingPartners.filter((id) => !selectedPartnerIds.includes(id));
      await Promise.all([
        ...partnersToAdd.map((pid) => apiPost(`/events/${savedEventId}/partners`, { partner_id: pid })),
        ...partnersToRemove.map((pid) => apiDelete(`/events/${savedEventId}/partners/${pid}`)),
      ]).catch(() => {});

      // Sync sponsor tags
      const existingSponsors = existingSponsorsData?.sponsors?.map((s) => s.sponsor_id) ?? [];
      const sponsorsToAdd = selectedSponsorIds.filter((id) => !existingSponsors.includes(id));
      const sponsorsToRemove = existingSponsors.filter((id) => !selectedSponsorIds.includes(id));
      await Promise.all([
        ...sponsorsToAdd.map((sid) => apiPost(`/events/${savedEventId}/sponsors`, { sponsor_id: sid })),
        ...sponsorsToRemove.map((sid) => apiDelete(`/events/${savedEventId}/sponsors/${sid}`)),
      ]).catch(() => {});

      // Create recurring occurrences (new events only)
      if (isRecurring && recurUntil && !(event && event.event_id > 0)) {
        const occurrences = generateOccurrences(
          form.starts_at,
          form.check_in_expires_at,
          recurUntil,
          recurFrequency,
        );
        await Promise.all(
          occurrences.map((occ) =>
            apiPost('/events/', {
              ...payload,
              starts_at: occ.starts_at,
              check_in_expires_at: occ.check_in_expires_at,
            }),
          ),
        ).catch(() => {});
      }

      if (syncToGoogle) {
        try {
          await apiPost(`/events/${savedEventId}/sync-to-google`, {});
        } catch (syncErr: any) {
          setSyncWarning(`Event saved, but Google Calendar sync failed: ${syncErr?.message ?? 'unknown error'}`);
          onSaved();
          return;
        }
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save event');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    background: 'rgba(255,255,255,.06)',
    border: '1px solid rgba(185,28,28,.2)',
    color: '#fff',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-2xl rounded-2xl p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto"
        style={{ background: 'rgba(10,0,0,.95)', border: '1px solid rgba(185,28,28,.3)', boxShadow: '0 20px 60px rgba(0,0,0,.6)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white font-['Oxanium']">
            {(event && event.event_id > 0) ? 'Edit Event' : event ? 'Duplicate Event' : 'Create Event'}
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/80"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Event Name */}
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-xs text-white/50">Event Name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="rounded-lg px-3 py-2 text-sm"
                style={inputStyle}
              />
            </div>

            {/* Type | Points Value */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/50">Type *</label>
              <select
                value={form.event_type}
                onChange={(e) => {
                  const chosen = types.find((t) => t.name === e.target.value);
                  setForm({
                    ...form,
                    event_type: e.target.value,
                    ...(chosen && !event ? { points_value: chosen.default_points.toString() } : {}),
                  });
                }}
                className="rounded-lg px-3 py-2 text-sm"
                style={inputStyle}
              >
                {(types.length > 0 ? types.filter((t) => t.is_active) : [{ name: form.event_type, type_id: 0, default_points: 10, color: '#b91c1c', is_active: true }]).map((t) => (
                  <option key={t.type_id || t.name} value={t.name} style={{ background: '#1a0000' }}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/50">Points Value</label>
              <input
                type="number"
                min="0"
                value={form.points_value}
                onChange={(e) => setForm({ ...form, points_value: e.target.value })}
                className="rounded-lg px-3 py-2 text-sm"
                style={inputStyle}
              />
            </div>

            {/* Location | Location URL */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/50">Location</label>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="rounded-lg px-3 py-2 text-sm"
                style={inputStyle}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/50 flex items-center gap-1">
                <Link size={12} className="text-white/40 shrink-0" />
                Location URL
              </label>
              <input
                type="url"
                placeholder="https://maps.google.com/…"
                value={form.location_url}
                onChange={(e) => setForm({ ...form, location_url: e.target.value })}
                className="rounded-lg px-3 py-2 text-sm"
                style={inputStyle}
              />
            </div>

            {/* Starts At | Ends At */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/50">Starts At *</label>
              <input
                type="datetime-local"
                required
                value={form.starts_at}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    starts_at: val,
                    ...(!endsTouched && !prev.ends_at && val ? { ends_at: addMinutes(val, 90) } : {}),
                    ...(!expiryTouched && val ? { check_in_expires_at: addMinutes(val, 90) } : {}),
                  }));
                }}
                className="rounded-lg px-3 py-2 text-sm"
                style={inputStyle}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/50">Ends At</label>
              <input
                type="datetime-local"
                value={form.ends_at}
                onChange={(e) => { setEndsTouched(true); setForm({ ...form, ends_at: e.target.value }); }}
                className="rounded-lg px-3 py-2 text-sm"
                style={inputStyle}
              />
            </div>

            {/* Capacity */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/50">Capacity</label>
              <input
                type="number"
                min="1"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                className="rounded-lg px-3 py-2 text-sm"
                style={inputStyle}
              />
            </div>

            {/* Description */}
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-xs text-white/50">Description</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="rounded-lg px-3 py-2 text-sm resize-none"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Partner Orgs | Sponsors — side-by-side dropdown pickers */}
          {(allPartners.length > 0 || allSponsors.length > 0) && (
            <div className="grid grid-cols-2 gap-3">
              {allPartners.length > 0 && (
                <MultiSelectDropdown
                  label="Partner Orgs"
                  items={allPartners.map((p) => ({ id: p.partner_id, name: p.name, logo_url: p.logo_url, subtitle: p.type }))}
                  selectedIds={selectedPartnerIds}
                  onToggle={(id) => setSelectedPartnerIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])}
                />
              )}
              {allSponsors.length > 0 && (
                <MultiSelectDropdown
                  label="Sponsors"
                  items={allSponsors.map((s) => ({ id: s.sponsor_id, name: s.name, logo_url: s.logo_url, subtitle: s.tier }))}
                  selectedIds={selectedSponsorIds}
                  onToggle={(id) => setSelectedSponsorIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])}
                />
              )}
            </div>
          )}

          {/* Recurring events (new events only) */}
          {!(event && event.event_id > 0) && (
            <div
              className="rounded-xl p-4 flex flex-col gap-3"
              style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(185,28,28,.12)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white/70">Recurring Event</span>
                <div
                  onClick={() => setIsRecurring((r) => !r)}
                  className="relative w-9 h-5 rounded-full transition-colors cursor-pointer"
                  style={{ background: isRecurring ? 'rgba(185,28,28,.7)' : 'rgba(255,255,255,.15)' }}
                >
                  <div
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                    style={{ left: isRecurring ? '18px' : '2px' }}
                  />
                </div>
              </div>
              {isRecurring && (
                <div className="flex flex-col gap-3">
                  <div className="flex gap-3">
                    <div className="flex flex-col gap-1 flex-1">
                      <label className="text-xs text-white/50">Frequency</label>
                      <select
                        value={recurFrequency}
                        onChange={(e) => setRecurFrequency(e.target.value as 'weekly' | 'monthly')}
                        className="rounded-lg px-3 py-2 text-sm"
                        style={inputStyle}
                      >
                        <option value="weekly" style={{ background: '#1a0000' }}>Weekly</option>
                        <option value="monthly" style={{ background: '#1a0000' }}>Monthly</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                      <label className="text-xs text-white/50">Repeat Until *</label>
                      <input
                        type="date"
                        required={isRecurring}
                        value={recurUntil}
                        min={new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)}
                        onChange={(e) => setRecurUntil(e.target.value)}
                        className="rounded-lg px-3 py-2 text-sm"
                        style={inputStyle}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-white/40">
                    Creates one event per {recurFrequency === 'weekly' ? 'week' : 'month'} from the start date until the chosen date.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Check-in section */}
          <div
            className="rounded-xl p-4 flex flex-col gap-3"
            style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(185,28,28,.12)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white/70">Check-in Settings</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-white/50">Enable check-in</span>
                <div
                  onClick={() => setForm({ ...form, check_in_enabled: !form.check_in_enabled })}
                  className="relative w-9 h-5 rounded-full transition-colors cursor-pointer"
                  style={{ background: form.check_in_enabled ? 'rgba(185,28,28,.7)' : 'rgba(255,255,255,.15)' }}
                >
                  <div
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                    style={{ left: form.check_in_enabled ? '18px' : '2px' }}
                  />
                </div>
              </label>
            </div>

            {form.check_in_enabled && event?.check_in_code && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/40">Current code:</span>
                <code
                  className="text-sm font-mono px-2 py-0.5 rounded"
                  style={{ background: 'rgba(185,28,28,.2)', color: 'rgba(248,113,113,.9)' }}
                >
                  {event.check_in_code}
                </code>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/50">Check-in Expires At</label>
              <input
                type="datetime-local"
                value={form.check_in_expires_at}
                onChange={(e) => {
                  setExpiryTouched(true);
                  setForm({ ...form, check_in_expires_at: e.target.value });
                }}
                className="rounded-lg px-3 py-2 text-sm"
                style={inputStyle}
              />
            </div>

            {/* Geolocation check-in */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer">
                <MapPin size={13} className="text-white/30" />
                Require location check-in
              </label>
              <div
                onClick={() => {
                  const enabling = !form.require_location;
                  setForm((f) => ({
                    ...f,
                    require_location: enabling,
                    ...(enabling && !f.latitude ? { latitude: mapCenter[0].toFixed(6), longitude: mapCenter[1].toFixed(6) } : {}),
                  }));
                }}
                className="relative w-9 h-5 rounded-full transition-colors cursor-pointer"
                style={{ background: form.require_location ? 'rgba(185,28,28,.7)' : 'rgba(255,255,255,.15)' }}
              >
                <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all" style={{ left: form.require_location ? '18px' : '2px' }} />
              </div>
            </div>

            {form.require_location && (
              <div className="flex flex-col gap-3">
                {/* Buttons row */}
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          const lat = pos.coords.latitude.toFixed(6);
                          const lng = pos.coords.longitude.toFixed(6);
                          setForm((f) => ({ ...f, latitude: lat, longitude: lng }));
                          setMapCenter([pos.coords.latitude, pos.coords.longitude]);
                        },
                        () => alert('Could not get your location. Check browser permissions.'),
                        { timeout: 8000 },
                      );
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all"
                    style={{ background: 'rgba(185,28,28,.2)', color: 'rgba(248,113,113,.9)', border: '1px solid rgba(185,28,28,.3)' }}
                  >
                    <Navigation size={12} /> Use My Location
                  </button>
                  <div className="flex flex-1 gap-1 min-w-0">
                    <input
                      type="text"
                      placeholder="Paste Google Maps URL…"
                      value={mapUrlInput}
                      onChange={(e) => { setMapUrlInput(e.target.value); setMapUrlError(''); }}
                      className="flex-1 rounded-lg px-3 py-1.5 text-xs min-w-0"
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const coords = parseGoogleMapsCoords(mapUrlInput);
                        if (!coords) { setMapUrlError('Could not extract coordinates from this URL. Try a Google Maps link with visible lat/lng.'); return; }
                        setMapUrlError('');
                        const lat = coords.lat.toFixed(6);
                        const lng = coords.lng.toFixed(6);
                        setForm((f) => ({ ...f, latitude: lat, longitude: lng }));
                        setMapCenter([coords.lat, coords.lng]);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs text-white/80 transition-all shrink-0"
                      style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.1)' }}
                    >
                      Parse
                    </button>
                  </div>
                </div>
                {mapUrlError && <p className="text-red-400 text-xs">{mapUrlError}</p>}

                {/* Map */}
                <div className="rounded-xl overflow-hidden" style={{ height: 280, border: '1px solid rgba(185,28,28,.2)' }}>
                  <MapContainer
                    center={mapCenter}
                    zoom={17}
                    style={{ height: '100%', width: '100%' }}
                    scrollWheelZoom
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
                    />
                    <MapPanner center={mapCenter} />
                    <MapClickHandler onChange={(lat, lng) => setForm((f) => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }))} />
                    <DraggableMarker
                      position={[parseFloat(form.latitude) || mapCenter[0], parseFloat(form.longitude) || mapCenter[1]]}
                      onChange={(lat, lng) => setForm((f) => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }))}
                    />
                  </MapContainer>
                </div>

                {/* Coords + radius */}
                <div className="flex items-center gap-3 text-xs text-white/50 flex-wrap">
                  <span>Lat: <span className="text-white/80 font-mono">{form.latitude || '—'}</span></span>
                  <span>Lng: <span className="text-white/80 font-mono">{form.longitude || '—'}</span></span>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <label className="text-white/50">Radius (m):</label>
                    <input
                      type="number"
                      min="50"
                      max="5000"
                      value={form.checkin_radius_m}
                      onChange={(e) => setForm((f) => ({ ...f, checkin_radius_m: e.target.value }))}
                      className="w-20 rounded-lg px-2 py-1 text-xs"
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RSVP */}
          <div
            className="rounded-xl p-4 flex items-center justify-between"
            style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(185,28,28,.12)' }}
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-white/70">Enable RSVP</span>
              <span className="text-xs text-white/30">Members can RSVP before the event. Optional.</span>
            </div>
            <div
              onClick={() => setForm({ ...form, rsvp_enabled: !form.rsvp_enabled })}
              className="relative w-9 h-5 rounded-full transition-colors cursor-pointer"
              style={{ background: form.rsvp_enabled ? 'rgba(185,28,28,.7)' : 'rgba(255,255,255,.15)' }}
            >
              <div
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                style={{ left: form.rsvp_enabled ? '18px' : '2px' }}
              />
            </div>
          </div>

          {/* Google Calendar sync */}
          <div
            className="rounded-xl p-4 flex items-center justify-between"
            style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(185,28,28,.12)' }}
          >
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-white/40" />
              <span className="text-sm text-white/70">Sync to Google Calendar</span>
              {event?.google_event_id && (
                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(21,128,61,.2)', color: 'rgba(74,222,128,.8)' }}>
                  Synced
                </span>
              )}
            </div>
            <div
              onClick={() => setSyncToGoogle((s) => !s)}
              className="relative w-9 h-5 rounded-full transition-colors cursor-pointer"
              style={{ background: syncToGoogle ? 'rgba(185,28,28,.7)' : 'rgba(255,255,255,.15)' }}
            >
              <div
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                style={{ left: syncToGoogle ? '18px' : '2px' }}
              />
            </div>
          </div>

          {syncWarning && <p className="text-yellow-400 text-xs">{syncWarning}</p>}
          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white transition-colors"
              style={{ background: 'rgba(255,255,255,.06)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50"
              style={{ background: 'rgba(185,28,28,.7)', boxShadow: '0 0 20px rgba(185,28,28,.25)' }}
            >
              {saving ? 'Saving…' : (event && event.event_id > 0) ? 'Save Changes' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL ?? 'http://localhost:5173';

function QRPresentModal({ event, onClose }: { event: Event; onClose: () => void }) {
  const checkInUrl = `${FRONTEND_URL}/checkin?code=${event.check_in_code}`;
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  function copyUrl() {
    navigator.clipboard.writeText(checkInUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function copyCode() {
    navigator.clipboard.writeText(event.check_in_code!);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  function downloadPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-${event.name.replace(/[^a-z0-9]/gi, '-')}.png`;
    a.click();
  }

  function downloadSvg() {
    const svg = svgRef.current;
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-${event.name.replace(/[^a-z0-9]/gi, '-')}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const logoSettings = { src: '/logo.png', height: 56, width: 56, excavate: true };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,.92)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-3xl p-8 flex flex-col items-center gap-6"
        style={{ background: 'rgba(10,0,0,.97)', border: '1px solid rgba(185,28,28,.4)', boxShadow: '0 40px 120px rgba(0,0,0,.8)' }}
      >
        <div className="flex items-center justify-between w-full">
          <div>
            <h2 className="text-xl font-bold text-white font-['Oxanium']">{event.name}</h2>
            <p className="text-xs text-white/40 mt-0.5">Scan to check in</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/70 transition-colors"><X size={20} /></button>
        </div>

        {/* Large QR for display */}
        <div className="rounded-2xl p-5" style={{ background: '#fff' }}>
          <QRCodeSVG
            ref={svgRef}
            value={checkInUrl}
            size={360}
            level="H"
            includeMargin={false}
            imageSettings={logoSettings}
          />
        </div>

        {/* Hidden canvas for PNG download */}
        <div className="sr-only">
          <QRCodeCanvas
            ref={canvasRef}
            value={checkInUrl}
            size={600}
            level="H"
            includeMargin={false}
            imageSettings={logoSettings}
          />
        </div>

        {/* Code display — click to copy */}
        <button
          onClick={copyCode}
          title="Click to copy code"
          className="text-2xl font-mono tracking-[0.25em] px-5 py-2 rounded-xl transition-all cursor-pointer"
          style={codeCopied
            ? { background: 'rgba(21,128,61,.2)', color: 'rgba(74,222,128,.9)' }
            : { background: 'rgba(185,28,28,.2)', color: 'rgba(248,113,113,.9)' }}
        >
          {codeCopied ? 'Copied!' : event.check_in_code}
        </button>

        {/* URL */}
        <p className="text-xs text-white/25 truncate max-w-full px-2">{checkInUrl}</p>

        {/* Actions */}
        <div className="flex items-center gap-2 w-full">
          <button
            onClick={copyUrl}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all"
            style={copied
              ? { background: 'rgba(21,128,61,.2)', color: 'rgba(74,222,128,.8)', border: '1px solid rgba(74,222,128,.2)' }
              : { background: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.7)', border: '1px solid rgba(255,255,255,.08)' }}
          >
            <Link size={13} />
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          <button
            onClick={downloadPng}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm transition-all"
            style={{ background: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.7)', border: '1px solid rgba(255,255,255,.08)' }}
            title="Download PNG"
          >
            <Download size={13} /> PNG
          </button>
          <button
            onClick={downloadSvg}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm transition-all"
            style={{ background: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.7)', border: '1px solid rgba(255,255,255,.08)' }}
            title="Download SVG"
          >
            <Download size={13} /> SVG
          </button>
        </div>
      </div>
    </div>
  );
}

function AttendanceDrawer({
  eventId,
  onClose,
}: {
  eventId: number;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery<AttendanceResponse>({
    queryKey: ['admin-attendance', eventId],
    queryFn: () => apiGet<AttendanceResponse>(`/admin/events/${eventId}/attendance`),
    staleTime: 30_000,
  });

  function escapeCsvCell(val: string): string {
    // Prefix formula-triggering characters to prevent CSV injection in Excel/Sheets
    const escaped = /^[=+\-@\t\r]/.test(val) ? `'${val}` : val;
    return `"${escaped.replace(/"/g, '""')}"`;
  }

  function downloadCsv() {
    if (!data) return;
    const rows = [
      ['Name', 'Student ID', 'Checked In At', 'Points Awarded'],
      ...data.attendees.map((a) => [
        a.first_name && a.last_name ? `${a.first_name} ${a.last_name}` : '',
        a.student_id != null ? String(a.student_id) : '',
        a.checked_in_at ? formatDateTimeFull(a.checked_in_at) : '',
        a.points !== null ? String(a.points) : '',
      ]),
    ];
    const csv = rows.map((r) => r.map(escapeCsvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateSuffix = new Date().toISOString().slice(0, 10);
    a.download = `attendance-${(data.event_name ?? 'event').replace(/[^a-z0-9]/gi, '-')}-${dateSuffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Stats derived from data
  const fillPct = data?.capacity ? Math.min(100, Math.round((data.attendance_count / data.capacity) * 100)) : null;

  // Avg minutes after event start
  let avgMinutes: number | null = null;
  if (data?.starts_at && data.attendees.length > 0) {
    const startMs = new Date(data.starts_at).getTime();
    const offsets = data.attendees
      .filter((a) => a.checked_in_at)
      .map((a) => (new Date(a.checked_in_at!).getTime() - startMs) / 60000);
    if (offsets.length > 0) avgMinutes = Math.round(offsets.reduce((s, v) => s + v, 0) / offsets.length);
  }

  // 5-minute bucket timeline
  const timeline = (() => {
    if (!data?.attendees.length) return [];
    const buckets: Record<number, number> = {};
    for (const a of data.attendees) {
      if (!a.checked_in_at) continue;
      const t = new Date(a.checked_in_at);
      const bucket = Math.floor(t.getTime() / (5 * 60 * 1000)) * 5 * 60 * 1000;
      buckets[bucket] = (buckets[bucket] ?? 0) + 1;
    }
    if (!Object.keys(buckets).length) return [];
    const sorted = Object.entries(buckets)
      .map(([ts, count]) => ({ ts: Number(ts), count }))
      .sort((a, b) => a.ts - b.ts);
    const maxCount = Math.max(...sorted.map((b) => b.count));
    return sorted.map((b) => ({ ...b, pct: Math.round((b.count / maxCount) * 100) }));
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md h-full flex flex-col"
        style={{ background: 'rgba(10,0,0,.97)', borderLeft: '1px solid rgba(185,28,28,.3)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(185,28,28,.15)' }}
        >
          <div>
            <h2 className="text-base font-bold text-white font-['Oxanium']">
              {data?.event_name ?? 'Attendance'}
            </h2>
            {data && (
              <p className="text-xs text-white/40">
                {data.attendance_count} checked in
                {data.capacity ? ` / ${data.capacity} capacity` : ''}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {data && data.attendees.length > 0 && (
              <button
                onClick={downloadCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all"
                style={{ background: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.6)', border: '1px solid rgba(255,255,255,.08)' }}
                title="Download CSV"
              >
                <Download size={12} /> CSV
              </button>
            )}
            <button onClick={onClose} className="text-white/40 hover:text-white/80"><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Stats panel */}
          {data && (
            <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(185,28,28,.1)' }}>
              <div className="flex items-center gap-4 mb-3">
                <div className="flex-1">
                  <p className="text-xs text-white/40 mb-1">Fill rate</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.08)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${fillPct ?? (data.attendance_count > 0 ? 100 : 0)}%`,
                          background: fillPct != null && fillPct >= 90
                            ? 'rgba(248,113,113,.8)'
                            : fillPct != null && fillPct >= 60
                            ? 'rgba(251,191,36,.8)'
                            : 'rgba(74,222,128,.7)',
                        }}
                      />
                    </div>
                    <span className="text-xs text-white/60 shrink-0">
                      {fillPct != null ? `${fillPct}%` : `${data.attendance_count}`}
                    </span>
                  </div>
                </div>
                {avgMinutes !== null && (
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-white/40">Avg check-in</p>
                    <p className="text-sm text-white/80">
                      {avgMinutes >= 0 ? `+${avgMinutes}m` : `${avgMinutes}m`}
                    </p>
                  </div>
                )}
              </div>

              {/* Timeline chart */}
              {timeline.length > 1 && (
                <div>
                  <p className="text-xs text-white/30 mb-2">Check-in timeline (5 min)</p>
                  <div className="flex items-end gap-0.5 h-10">
                    {timeline.map((b) => (
                      <div
                        key={b.ts}
                        className="flex-1 rounded-sm relative group"
                        style={{ height: `${Math.max(b.pct, 8)}%`, background: 'rgba(185,28,28,.5)', minWidth: 4 }}
                        title={`${formatTime(b.ts)}: ${b.count}`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-white/20">
                      {formatTime(timeline[0].ts)}
                    </span>
                    <span className="text-[10px] text-white/20">
                      {formatTime(timeline[timeline.length - 1].ts)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Attendee list */}
          <div className="p-4">
            {isLoading ? (
              <p className="text-white/40 text-sm text-center py-8">Loading…</p>
            ) : !data?.attendees.length ? (
              <p className="text-white/40 text-sm text-center py-8">No attendees yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {data.attendees.map((a, i) => (
                  <div
                    key={a.checkin_id}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                    style={{ background: 'rgba(255,255,255,.04)' }}
                  >
                    <span className="text-xs text-white/30 w-6 shrink-0 text-right">{i + 1}</span>
                    <div
                      className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: 'rgba(185,28,28,.3)', color: 'rgba(248,113,113,.9)' }}
                    >
                      {a.first_name?.[0] ?? a.student_id?.[0] ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">
                        {a.first_name && a.last_name ? `${a.first_name} ${a.last_name}` : a.student_id ?? 'Unknown'}
                      </p>
                      <p className="text-xs text-white/30">
                        {a.checked_in_at ? formatTime(a.checked_in_at) : ''}
                      </p>
                    </div>
                    {a.points !== null && (
                      <span className="text-xs text-green-400 font-medium">+{a.points}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckInStatusBadge({ event }: { event: Event }) {
  if (!event.check_in_enabled) {
    return <span className="text-xs text-white/30">Disabled</span>;
  }
  const now = new Date();
  const expired = event.check_in_expires_at && new Date(event.check_in_expires_at) < now;
  if (expired) {
    return (
      <span className="flex items-center gap-1 text-xs" style={{ color: 'rgba(248,113,113,.7)' }}>
        <XCircle size={12} /> Expired
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs" style={{ color: 'rgba(74,222,128,.8)' }}>
      <CheckCircle size={12} /> Active
    </span>
  );
}

function LiveEventModal({ event, onClose }: { event: Event; onClose: () => void }) {
  const { data, isLoading } = useQuery<AttendanceResponse>({
    queryKey: ['admin-attendance', event.event_id],
    queryFn: () => apiGet<AttendanceResponse>(`/admin/events/${event.event_id}/attendance`),
    refetchInterval: 5000,
    staleTime: 0,
  });

  const fillPct = data?.capacity ? Math.min(100, Math.round((data.attendance_count / data.capacity) * 100)) : null;
  const totalPoints = data?.attendees.reduce((s, a) => s + (a.points ?? 0), 0) ?? 0;
  const recent = data?.attendees.slice().reverse().slice(0, 10) ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,.92)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-3xl p-8 flex flex-col gap-6"
        style={{ background: 'rgba(8,0,0,.98)', border: '1px solid rgba(185,28,28,.4)', boxShadow: '0 40px 120px rgba(0,0,0,.8)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full animate-pulse"
                style={{ background: 'rgba(185,28,28,.25)', color: 'rgba(248,113,113,.9)' }}
              >
                <Radio size={10} /> LIVE
              </span>
            </div>
            <h2 className="text-xl font-bold text-white font-['Oxanium']">{event.name}</h2>
            <p className="text-xs text-white/40 mt-0.5">Refreshing every 5 seconds</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/70 transition-colors mt-1">
            <X size={20} />
          </button>
        </div>

        {/* Big count */}
        <div className="text-center">
          <p className="text-7xl font-black text-white font-['Oxanium'] leading-none">
            {isLoading ? '—' : data?.attendance_count ?? 0}
          </p>
          <p className="text-sm text-white/40 mt-2">
            {data?.capacity ? `of ${data.capacity} capacity` : 'checked in'}
          </p>
          {fillPct !== null && (
            <div className="mt-3 mx-auto max-w-xs">
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.08)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${fillPct}%`,
                    background: fillPct >= 90 ? 'rgba(248,113,113,.8)' : fillPct >= 60 ? 'rgba(251,191,36,.8)' : 'rgba(74,222,128,.7)',
                  }}
                />
              </div>
              <p className="text-xs text-white/30 mt-1">{fillPct}% full</p>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(185,28,28,.15)' }}>
            <p className="text-2xl font-bold text-white font-['Oxanium']">{totalPoints}</p>
            <p className="text-xs text-white/40">Points awarded</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(185,28,28,.15)' }}>
            <p className="text-2xl font-bold text-white font-['Oxanium']">{data?.attendees.length ?? 0}</p>
            <p className="text-xs text-white/40">Total attendees</p>
          </div>
        </div>

        {/* Recent check-ins */}
        <div>
          <p className="text-xs text-white/40 uppercase tracking-wide mb-2">Most recent check-ins</p>
          {!recent.length ? (
            <p className="text-xs text-white/30 text-center py-4">No check-ins yet</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {recent.map((a, i) => (
                <div
                  key={a.checkin_id}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2"
                  style={{ background: i === 0 ? 'rgba(185,28,28,.12)' : 'rgba(255,255,255,.03)', border: i === 0 ? '1px solid rgba(185,28,28,.2)' : '1px solid transparent' }}
                >
                  <div
                    className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: 'rgba(185,28,28,.25)', color: 'rgba(248,113,113,.8)' }}
                  >
                    {a.first_name?.[0] ?? a.student_id?.[0] ?? '?'}
                  </div>
                  <span className="flex-1 text-sm text-white/80 truncate">
                    {a.first_name && a.last_name ? `${a.first_name} ${a.last_name}` : a.student_id ?? 'Unknown'}
                  </span>
                  <span className="text-xs text-white/30">
                    {a.checked_in_at ? formatTime(a.checked_in_at) : ''}
                  </span>
                  {a.points !== null && <span className="text-xs text-green-400">+{a.points}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminEventsTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortDesc, setSortDesc] = useState(true);
  const [confirmState, setConfirmState] = useState<{ message: string; confirmLabel: string; onConfirm: () => void } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [attendanceEventId, setAttendanceEventId] = useState<number | null>(null);
  const [copiedCode, setCopiedCode] = useState<number | null>(null);
  const [qrEvent, setQrEvent] = useState<Event | null>(null);
  const [liveEvent, setLiveEvent] = useState<Event | null>(null);
  const [revealedCodes, setRevealedCodes] = useState<Set<number>>(new Set());

  const [modalEvent, setModalEvent] = useState<Event | null>(null);
  const [modalKey, setModalKey] = useState(0);

  function openModal(ev: Event | null) {
    setModalEvent(ev);
    setModalKey((k) => k + 1);
    setShowModal(true);
  }

  function openDuplicate(ev: Event) {
    openModal({
      ...ev,
      event_id: 0,
      name: ev.name + ' (Copy)',
      starts_at: '',
      ends_at: null,
      check_in_enabled: false,
      check_in_code: null,
      check_in_expires_at: null,
    });
  }

  const { data: eventTypesData } = useQuery<{ event_types: EventTypeOption[] }>({
    queryKey: ['admin-event-types'],
    queryFn: () => apiGet('/admin/event-types'),
    staleTime: 60_000,
  });
  const eventTypes = eventTypesData?.event_types ?? [];

  const { data: partnersData } = useQuery<{ partners: PartnerOption[] }>({
    queryKey: ['admin-partners-list'],
    queryFn: () => apiGet('/partners/'),
    staleTime: 120_000,
  });
  const allPartners = partnersData?.partners ?? [];

  const { data: sponsorsData } = useQuery<{ sponsors: SponsorOption[] }>({
    queryKey: ['admin-sponsors-list'],
    queryFn: () => apiGet('/sponsors/'),
    staleTime: 120_000,
  });
  const allSponsors = sponsorsData?.sponsors ?? [];

  const { data: events, isLoading } = useQuery<Event[]>({
    queryKey: ['admin-events'],
    queryFn: async () => {
      const res = await apiGet<Event[] | { error: string }>('/events/');
      if (Array.isArray(res)) return res;
      return [];
    },
    staleTime: 30_000,
  });

  const deleteEvent = useMutation({
    mutationFn: (id: number) => apiDelete(`/events/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-events'] }),
  });

  const regenCode = useMutation({
    mutationFn: (id: number) => apiPost<{ check_in_code: string }>(`/admin/events/${id}/regenerate-code`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-events'] }),
  });

  const toggleCheckin = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      apiPatch(`/events/${id}`, { check_in_enabled: enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-events'] }),
  });

  const removeFromCalendar = useMutation({
    mutationFn: (id: number) => apiDelete(`/events/${id}/sync-to-google`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-events'] }),
  });

  function copyCode(event: Event) {
    if (event.check_in_code) {
      navigator.clipboard.writeText(event.check_in_code);
      setCopiedCode(event.event_id);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  }

  const filtered = (events ?? []).filter((e) => {
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase());
    const matchType = !typeFilter || e.event_type === typeFilter;
    const matchFrom = !dateFrom || new Date(e.starts_at) >= new Date(dateFrom);
    const matchTo = !dateTo || new Date(e.starts_at) <= new Date(dateTo + 'T23:59:59');
    return matchSearch && matchType && matchFrom && matchTo;
  });

  const sorted = [...filtered].sort((a, b) => {
    const diff = new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
    return sortDesc ? -diff : diff;
  });

  return (
    <>
      {showModal && (
        <EventModal
          key={modalKey}
          event={modalEvent}
          types={eventTypes}
          allPartners={allPartners}
          allSponsors={allSponsors}
          onClose={() => { setShowModal(false); setModalEvent(null); }}
          onSaved={() => qc.invalidateQueries({ queryKey: ['admin-events'] })}
        />
      )}
      {attendanceEventId !== null && (
        <AttendanceDrawer eventId={attendanceEventId} onClose={() => setAttendanceEventId(null)} />
      )}
      {qrEvent && (
        <QRPresentModal event={qrEvent} onClose={() => setQrEvent(null)} />
      )}
      {liveEvent && (
        <LiveEventModal event={liveEvent} onClose={() => setLiveEvent(null)} />
      )}
      {confirmState && (
        <ConfirmModal
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          danger
          onConfirm={() => { confirmState.onConfirm(); setConfirmState(null); }}
          onCancel={() => setConfirmState(null)}
        />
      )}

      <div className="flex flex-col gap-4">
        {/* Filter bar */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              placeholder="Search events…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm text-white placeholder:text-white/30"
              style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(185,28,28,.2)' }}
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm text-white"
            style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(185,28,28,.2)' }}
          >
            <option value="" style={{ background: '#1a0000' }}>All types</option>
            {eventTypes.map((t) => (
              <option key={t.type_id} value={t.name} style={{ background: '#1a0000' }}>{t.name}</option>
            ))}
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            title="From date"
            className="rounded-lg px-3 py-2 text-sm text-white"
            style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(185,28,28,.2)', colorScheme: 'dark' }}
          />
          <span className="text-white/30 text-xs">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            title="To date"
            className="rounded-lg px-3 py-2 text-sm text-white"
            style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(185,28,28,.2)', colorScheme: 'dark' }}
          />

          <button
            onClick={() => openModal(null)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all ml-auto"
            style={{ background: 'rgba(185,28,28,.6)', boxShadow: '0 0 20px rgba(185,28,28,.2)' }}
          >
            <Plus size={14} /> Create Event
          </button>
        </div>

        {/* Table */}
        <div className="rounded-xl overflow-hidden" style={cardStyle}>
          {isLoading ? (
            <div className="p-8 text-center text-white/40 text-sm">Loading events…</div>
          ) : !sorted.length ? (
            <div className="p-8 text-center text-white/40 text-sm">No events found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(185,28,28,.15)' }}>
                    {(['Event', 'Date', 'Location', 'Check-in', 'RSVP', 'Pts', 'Actions'] as const).map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs text-white/40 uppercase tracking-wide font-medium">
                        {h === 'Date' ? (
                          <button
                            onClick={() => setSortDesc((d) => !d)}
                            className="flex items-center gap-1 hover:text-white/70 transition-colors"
                          >
                            Date
                            {sortDesc ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                          </button>
                        ) : h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((ev) => {
                    const matchedType = eventTypes.find((t) => t.name === ev.event_type);
                    const typeColor = matchedType
                      ? typeColors(matchedType.color)
                      : { bg: 'rgba(185,28,28,.2)', text: 'rgba(248,113,113,.9)' };
                    return (
                      <tr
                        key={ev.event_id}
                        className="transition-colors hover:bg-white/[0.02]"
                        style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <p className="text-white font-medium">{ev.name}</p>
                            {ev.google_event_id && (
                              <span title="Synced to Google Calendar">
                                <Calendar size={12} style={{ color: 'rgba(74,222,128,.7)' }} />
                              </span>
                            )}
                          </div>
                          <span
                            className="text-xs px-1.5 py-0.5 rounded-full"
                            style={{ background: typeColor.bg, color: typeColor.text }}
                          >
                            {ev.event_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-white/50">
                          {formatDate(ev.starts_at)}
                          <br />
                          {formatTime(ev.starts_at)}
                        </td>
                        <td className="px-4 py-3 text-xs text-white/50">
                          {ev.location ? (
                            ev.location_url && /^https?:\/\//i.test(ev.location_url) ? (
                              <a
                                href={ev.location_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 hover:text-white/80 transition-colors"
                              >
                                <Link size={10} className="shrink-0" />
                                {ev.location}
                              </a>
                            ) : ev.location
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <CheckInStatusBadge event={ev} />
                          {ev.check_in_code && (
                            <button
                              type="button"
                              title="Click to reveal full code"
                              onClick={() => setRevealedCodes((s) => {
                                const next = new Set(s);
                                next.has(ev.event_id) ? next.delete(ev.event_id) : next.add(ev.event_id);
                                return next;
                              })}
                              className="text-xs text-white/30 font-mono mt-0.5 hover:text-white/60 transition-colors cursor-pointer block"
                            >
                              {revealedCodes.has(ev.event_id)
                                ? ev.check_in_code
                                : `${ev.check_in_code.slice(0, 2)}${'•'.repeat(ev.check_in_code.length - 4)}${ev.check_in_code.slice(-2)}`}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {ev.rsvp_enabled ? (
                            <span className="text-white/70">{ev.rsvp_count ?? 0}</span>
                          ) : (
                            <span className="text-white/20">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-white/60">{ev.points_value}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 flex-wrap">
                            {/* Primary actions — labeled */}
                            <button
                              onClick={() => openModal(ev)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-white/60 hover:text-white transition-colors"
                              style={{ background: 'rgba(255,255,255,.06)' }}
                            >
                              <Edit2 size={13} /> Edit
                            </button>
                            <button
                              onClick={() => openDuplicate(ev)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-white/60 hover:text-white transition-colors"
                              style={{ background: 'rgba(255,255,255,.06)' }}
                            >
                              <Files size={13} /> Duplicate
                            </button>
                            <button
                              onClick={() => setAttendanceEventId(ev.event_id)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-white/60 hover:text-white transition-colors"
                              style={{ background: 'rgba(255,255,255,.06)' }}
                            >
                              <Users size={13} /> Attendance
                            </button>
                            <button
                              onClick={() => setConfirmState({
                                message: `Delete "${ev.name}"? This cannot be undone.`,
                                confirmLabel: 'Delete',
                                onConfirm: () => deleteEvent.mutate(ev.event_id),
                              })}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors"
                              style={{ background: 'rgba(185,28,28,.12)', color: 'rgba(248,113,113,.7)' }}
                            >
                              <Trash2 size={13} /> Delete
                            </button>

                            {/* Divider */}
                            <div className="w-px h-5 mx-0.5" style={{ background: 'rgba(255,255,255,.1)' }} />

                            {/* Check-in cluster — icon only */}
                            <button
                              onClick={async () => {
                                const enabling = !ev.check_in_enabled;
                                await toggleCheckin.mutateAsync({ id: ev.event_id, enabled: enabling });
                                // Auto-generate a check-in code if enabling and none exists yet
                                if (enabling && !ev.check_in_code) {
                                  regenCode.mutate(ev.event_id);
                                }
                              }}
                              title={ev.check_in_enabled ? 'Disable check-in' : 'Enable check-in'}
                              className="p-1.5 rounded-lg transition-colors"
                              style={
                                ev.check_in_enabled
                                  ? { background: 'rgba(21,128,61,.15)', color: 'rgba(74,222,128,.8)' }
                                  : { background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.4)' }
                              }
                            >
                              <CheckCircle size={15} />
                            </button>
                            <button
                              onClick={() => regenCode.mutate(ev.event_id)}
                              title="Generate / regenerate check-in code"
                              className="p-1.5 rounded-lg text-white/50 hover:text-white transition-colors"
                              style={{ background: 'rgba(255,255,255,.06)' }}
                            >
                              <RefreshCw size={15} />
                            </button>
                            {ev.check_in_code && (
                              <button
                                onClick={() => copyCode(ev)}
                                title="Copy check-in code"
                                className="p-1.5 rounded-lg transition-colors"
                                style={
                                  copiedCode === ev.event_id
                                    ? { background: 'rgba(21,128,61,.2)', color: 'rgba(74,222,128,.9)' }
                                    : { background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.5)' }
                                }
                              >
                                <Copy size={15} />
                              </button>
                            )}
                            {ev.check_in_code && (
                              <button
                                onClick={() => setQrEvent(ev)}
                                title="Show QR code"
                                className="p-1.5 rounded-lg text-white/50 hover:text-white transition-colors"
                                style={{ background: 'rgba(255,255,255,.06)' }}
                              >
                                <QrCode size={15} />
                              </button>
                            )}
                            {ev.check_in_enabled && (
                              <button
                                onClick={() => setLiveEvent(ev)}
                                title="Live event stats"
                                className="p-1.5 rounded-lg transition-colors"
                                style={{ background: 'rgba(185,28,28,.15)', color: 'rgba(248,113,113,.8)' }}
                              >
                                <Radio size={15} />
                              </button>
                            )}
                            {ev.google_event_id && (
                              <button
                                onClick={() => setConfirmState({
                                  message: `Remove "${ev.name}" from Google Calendar?`,
                                  confirmLabel: 'Remove',
                                  onConfirm: () => removeFromCalendar.mutate(ev.event_id),
                                })}
                                title="Remove from Google Calendar"
                                className="p-1.5 rounded-lg transition-colors"
                                style={{ background: 'rgba(21,128,61,.1)', color: 'rgba(74,222,128,.7)' }}
                              >
                                <CalendarX size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// Make Search available (used inline above but not imported)
function Search({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
