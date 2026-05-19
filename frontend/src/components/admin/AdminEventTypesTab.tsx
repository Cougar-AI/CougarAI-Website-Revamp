import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { Plus, Edit2, X, Tag } from 'lucide-react';

interface EventType {
  type_id: number;
  name: string;
  default_points: number;
  color: string;
  description: string | null;
  is_active: boolean;
  created_at: string | null;
}

interface EventTypesResponse {
  event_types: EventType[];
}

const cardStyle = {
  background: 'rgba(255,255,255,.04)',
  border: '1px solid rgba(185,28,28,.22)',
  backdropFilter: 'blur(10px)',
} as const;

const inputStyle = {
  background: 'rgba(255,255,255,.06)',
  border: '1px solid rgba(185,28,28,.2)',
  color: '#fff',
} as const;

function EventTypeModal({
  type,
  onClose,
  onSaved,
}: {
  type: EventType | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: type?.name ?? '',
    default_points: type?.default_points?.toString() ?? '10',
    color: type?.color ?? '#b91c1c',
    description: type?.description ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        default_points: Number(form.default_points) || 10,
        color: form.color,
        description: form.description.trim() || null,
      };
      if (type) {
        await apiPatch(`/admin/event-types/${type.type_id}`, payload);
      } else {
        await apiPost('/admin/event-types', payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-5"
        style={{ background: 'rgba(10,0,0,.95)', border: '1px solid rgba(185,28,28,.3)', boxShadow: '0 20px 60px rgba(0,0,0,.6)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white font-['Oxanium']">
            {type ? 'Edit Event Type' : 'Add Event Type'}
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/80"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50">Name *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. workshop"
              className="rounded-lg px-3 py-2 text-sm"
              style={inputStyle}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/50">Default Points</label>
              <input
                type="number"
                min="0"
                value={form.default_points}
                onChange={(e) => setForm({ ...form, default_points: e.target.value })}
                className="rounded-lg px-3 py-2 text-sm"
                style={inputStyle}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/50">Color</label>
              <div className="flex items-center gap-2">
                {/* Live swatch — click to open picker */}
                <label
                  htmlFor="event-type-color-picker"
                  className="h-8 w-8 rounded-lg shrink-0 cursor-pointer border border-white/10 hover:ring-2 hover:ring-white/20 transition-all"
                  style={{ background: form.color }}
                  title="Click to pick color"
                />
                <input
                  id="event-type-color-picker"
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="sr-only"
                />
                <input
                  type="text"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="w-24 rounded-lg px-2 py-2 text-xs font-mono"
                  style={inputStyle}
                  maxLength={7}
                  placeholder="#b91c1c"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50">Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="rounded-lg px-3 py-2 text-sm resize-none"
              style={inputStyle}
            />
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-white/60"
              style={{ background: 'rgba(255,255,255,.06)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.name.trim()}
              className="px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
              style={{ background: 'rgba(185,28,28,.7)' }}
            >
              {saving ? 'Saving…' : type ? 'Save Changes' : 'Add Type'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminEventTypesTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<EventType | null | 'new'>(null);

  const { data, isLoading, error } = useQuery<EventTypesResponse>({
    queryKey: ['admin-event-types'],
    queryFn: () => apiGet<EventTypesResponse>('/admin/event-types'),
    staleTime: 60_000,
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      apiPatch(`/admin/event-types/${id}`, { is_active: active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-event-types'] }),
  });

  const deleteType = useMutation({
    mutationFn: (id: number) => apiDelete(`/admin/event-types/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-event-types'] }),
  });

  const types = data?.event_types ?? [];

  return (
    <>
      {editing !== null && (
        <EventTypeModal
          type={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['admin-event-types'] })}
        />
      )}

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white font-['Oxanium']">Event Types</h2>
            <p className="text-xs text-white/40">
              Define categories, default point values, and colors for events
            </p>
          </div>
          <button
            onClick={() => setEditing('new')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: 'rgba(185,28,28,.6)', boxShadow: '0 0 20px rgba(185,28,28,.2)' }}
          >
            <Plus size={14} /> Add Type
          </button>
        </div>

        <div className="rounded-xl overflow-hidden" style={cardStyle}>
          {isLoading ? (
            <div className="p-8 text-center text-white/40 text-sm">Loading…</div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-red-400">
              Failed to load event types{(error as { status?: number })?.status ? ` (${(error as { status?: number }).status})` : ''}: {error instanceof Error ? error.message : 'Unknown error'}
            </div>
          ) : !types.length ? (
            <div className="p-8 text-center text-white/40 text-sm">No event types found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(185,28,28,.15)' }}>
                    {['Type', 'Default Points', 'Description', 'Status', 'Actions'].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-xs text-white/40 uppercase tracking-wide font-medium"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {types.map((t) => (
                    <tr
                      key={t.type_id}
                      className="transition-colors hover:bg-white/[0.02]"
                      style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full shrink-0"
                            style={{ background: t.color }}
                          />
                          <span className="text-white font-medium">{t.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-sm font-mono px-2 py-0.5 rounded"
                          style={{ background: 'rgba(185,28,28,.15)', color: 'rgba(248,113,113,.9)' }}
                        >
                          {t.default_points} pts
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-white/50 max-w-xs truncate">
                        {t.description ?? <span className="text-white/20">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={
                            t.is_active
                              ? { background: 'rgba(21,128,61,.2)', color: 'rgba(74,222,128,.9)' }
                              : { background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.4)' }
                          }
                        >
                          {t.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditing(t)}
                            className="p-1.5 rounded-lg text-white/50 hover:text-white transition-colors"
                            style={{ background: 'rgba(255,255,255,.06)' }}
                            title="Edit"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => toggleActive.mutate({ id: t.type_id, active: !t.is_active })}
                            className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                            style={
                              t.is_active
                                ? { background: 'rgba(185,28,28,.12)', color: 'rgba(248,113,113,.7)', border: '1px solid rgba(185,28,28,.15)' }
                                : { background: 'rgba(21,128,61,.12)', color: 'rgba(74,222,128,.8)', border: '1px solid rgba(21,128,61,.15)' }
                            }
                          >
                            {t.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-white/25 px-1">
          <Tag size={10} className="inline mr-1" />
          Event types define default point values and badge colors used across the site.
          Deactivating a type hides it from dropdowns but preserves existing events.
        </p>
      </div>
    </>
  );
}
