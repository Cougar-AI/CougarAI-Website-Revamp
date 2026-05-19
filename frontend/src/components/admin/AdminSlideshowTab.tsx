import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, GripVertical, Plus, Eye, EyeOff, Crosshair, Loader2 } from 'lucide-react';

const BACKEND = import.meta.env.VITE_BACKEND_API_URL ?? 'http://localhost:5001';

const POSITIONS = [
  ['top left',    'top',    'top right'],
  ['center left', 'center', 'center right'],
  ['bottom left', 'bottom', 'bottom right'],
] as const;

const POS_LABELS: Record<string, string> = {
  'top left': '↖', 'top': '↑', 'top right': '↗',
  'center left': '←', 'center': '●', 'center right': '→',
  'bottom left': '↙', 'bottom': '↓', 'bottom right': '↘',
};

const HP_DEFAULTS = [
  { url: '/hp_gm.JPG',    object_position: 'center' },
  { url: '/hp_nasa.jpg',  object_position: 'center' },
  { url: '/hp_intro.jpg', object_position: 'center' },
  { url: '/hp_mlai.jpg',  object_position: 'center' },
];
const AU_DEFAULTS = [
  { url: '/au_nasav2.jpg',   object_position: 'top' },
  { url: '/au_officer.jpeg', object_position: 'center' },
  { url: '/au_nasav1.jpg',   object_position: 'center' },
  { url: '/au_hctra.jpg',    object_position: 'center' },
  { url: '/au_group.png',    object_position: 'top' },
];

interface Photo {
  photo_id: number;
  page: string;
  url: string;
  object_position: string;
  caption: string | null;
  is_active: boolean;
  display_order: number;
}

function resolveUrl(url: string) {
  return url.startsWith('/admin/uploads/') ? `${BACKEND}${url}` : url;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(options.headers as Record<string, string> ?? {}) },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Request failed');
  return json;
}

const glass: React.CSSProperties = {
  borderRadius: 16,
  background: 'rgba(255,255,255,.04)',
  border: '1px solid rgba(185,28,28,.22)',
  padding: 20,
};

export default function AdminSlideshowTab() {
  const [activePage, setActivePage] = useState<'home' | 'about'>('home');
  const [openPickerId, setOpenPickerId] = useState<number | null>(null);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const qKey = ['slideshow-admin', activePage];

  const { data, isLoading } = useQuery<{ photos: Photo[] }>({
    queryKey: qKey,
    queryFn: () =>
      fetch(`${BACKEND}/admin/slideshow-photos?page=${activePage}&include_inactive=true`, {
        headers: authHeaders(),
      }).then((r) => r.json()),
    staleTime: 30_000,
  });

  const photos = data?.photos ?? [];

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: object }) =>
      apiFetch(`${BACKEND}/admin/slideshow-photos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qKey }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`${BACKEND}/admin/slideshow-photos/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qKey }),
  });

  const reorderMutation = useMutation({
    mutationFn: (order: number[]) =>
      apiFetch(`${BACKEND}/admin/slideshow-photos/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ order }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qKey }),
  });

  function handleDrop(targetId: number) {
    if (draggedId === null || draggedId === targetId) return;
    const ids = photos.map((p) => p.photo_id);
    const newOrder = [...ids];
    newOrder.splice(ids.indexOf(draggedId), 1);
    newOrder.splice(ids.indexOf(targetId), 0, draggedId);
    reorderMutation.mutate(newOrder);
    setDraggedId(null);
    setDragOverId(null);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const uploadRes = await fetch(`${BACKEND}/admin/upload-image?category=slideshow`, {
        method: 'POST',
        headers: authHeaders(),
        body: fd,
      });
      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadJson.error ?? 'Upload failed');
      await apiFetch(`${BACKEND}/admin/slideshow-photos`, {
        method: 'POST',
        body: JSON.stringify({ page: activePage, url: uploadJson.url, object_position: 'center' }),
      });
      qc.invalidateQueries({ queryKey: qKey });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleSeed() {
    setSeeding(true);
    setError('');
    const defaults = activePage === 'home' ? HP_DEFAULTS : AU_DEFAULTS;
    try {
      for (const d of defaults) {
        await apiFetch(`${BACKEND}/admin/slideshow-photos`, {
          method: 'POST',
          body: JSON.stringify({ page: activePage, url: d.url, object_position: d.object_position }),
        });
      }
      qc.invalidateQueries({ queryKey: qKey });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Seed failed');
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: 'Oxanium,sans-serif', fontWeight: 800, fontSize: 20, color: '#fff', margin: '0 0 4px' }}>Slideshow Photos</h2>
          <p style={{ color: 'rgba(255,255,255,.45)', fontSize: 13, margin: 0 }}>Upload, reorder, and crop photos for each page's slideshow.</p>
        </div>
        <div style={{ display: 'flex', gap: 6, background: 'rgba(0,0,0,.3)', padding: 4, borderRadius: 10 }}>
          {(['home', 'about'] as const).map((p) => (
            <button
              key={p}
              onClick={() => { setActivePage(p); setError(''); setOpenPickerId(null); }}
              style={{
                padding: '6px 20px', borderRadius: 7, border: 'none', cursor: 'pointer',
                fontFamily: 'Oxanium,sans-serif', fontWeight: 700, fontSize: 13,
                background: activePage === p ? 'rgba(185,28,28,.7)' : 'transparent',
                color: activePage === p ? '#fff' : 'rgba(255,255,255,.5)',
                transition: 'all .15s',
              }}
            >
              {p === 'home' ? 'Home' : 'About'}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(185,28,28,.15)', border: '1px solid rgba(185,28,28,.4)', color: 'rgba(248,113,113,.9)', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={glass}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,.4)', fontSize: 14 }}>Loading...</div>
        ) : photos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 20px' }}>
            <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 14, marginBottom: 16 }}>
              No photos yet for the {activePage === 'home' ? 'Home' : 'About'} page.
            </p>
            <button
              onClick={handleSeed}
              disabled={seeding}
              style={{
                padding: '10px 22px', borderRadius: 10, border: '1px solid rgba(185,28,28,.4)',
                background: 'rgba(185,28,28,.25)', color: '#fff', cursor: 'pointer',
                fontFamily: 'Oxanium,sans-serif', fontWeight: 700, fontSize: 13,
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}
            >
              {seeding && <Loader2 size={14} className="animate-spin" />}
              Seed from defaults
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
            {photos.map((photo) => (
              <PhotoCard
                key={photo.photo_id}
                photo={photo}
                isPickerOpen={openPickerId === photo.photo_id}
                onTogglePicker={() => setOpenPickerId(openPickerId === photo.photo_id ? null : photo.photo_id)}
                isDragOver={dragOverId === photo.photo_id}
                onDragStart={() => setDraggedId(photo.photo_id)}
                onDragOver={(e) => { e.preventDefault(); setDragOverId(photo.photo_id); }}
                onDragLeave={() => setDragOverId(null)}
                onDrop={() => handleDrop(photo.photo_id)}
                onDragEnd={() => { setDraggedId(null); setDragOverId(null); }}
                onUpdatePosition={(pos) => {
                  updateMutation.mutate({ id: photo.photo_id, patch: { object_position: pos } });
                  setOpenPickerId(null);
                }}
                onUpdateCaption={(caption) =>
                  updateMutation.mutate({ id: photo.photo_id, patch: { caption } })
                }
                onToggleActive={() =>
                  updateMutation.mutate({ id: photo.photo_id, patch: { is_active: !photo.is_active } })
                }
                onDelete={() => deleteMutation.mutate(photo.photo_id)}
              />
            ))}
          </div>
        )}

        {/* Bottom actions */}
        <div style={{ marginTop: photos.length === 0 ? 16 : 20, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleFileChange} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '9px 18px', borderRadius: 10, border: '1px solid rgba(185,28,28,.4)',
              background: 'rgba(185,28,28,.2)', color: '#fff', cursor: 'pointer',
              fontFamily: 'Oxanium,sans-serif', fontWeight: 700, fontSize: 13,
            }}
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Upload photo
          </button>
          {photos.length > 0 && (
            <button
              onClick={handleSeed}
              disabled={seeding}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '9px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,.1)',
                background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.55)', cursor: 'pointer',
                fontFamily: 'Oxanium,sans-serif', fontWeight: 600, fontSize: 12,
              }}
            >
              {seeding && <Loader2 size={13} className="animate-spin" />}
              Re-seed defaults
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface PhotoCardProps {
  photo: Photo;
  isPickerOpen: boolean;
  onTogglePicker: () => void;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
  onUpdatePosition: (pos: string) => void;
  onUpdateCaption: (caption: string) => void;
  onToggleActive: () => void;
  onDelete: () => void;
}

function PhotoCard({
  photo, isPickerOpen, onTogglePicker, isDragOver,
  onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
  onUpdatePosition, onUpdateCaption, onToggleActive, onDelete,
}: PhotoCardProps) {
  const [captionDraft, setCaptionDraft] = useState(photo.caption ?? '');

  useEffect(() => {
    setCaptionDraft(photo.caption ?? '');
  }, [photo.caption]);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      style={{
        borderRadius: 12,
        background: 'rgba(255,255,255,.05)',
        border: `1px solid rgba(185,28,28,${isDragOver ? .55 : .2})`,
        overflow: 'hidden',
        transition: 'border-color .15s, transform .15s',
        transform: isDragOver ? 'scale(1.02)' : 'scale(1)',
      }}
    >
      {/* Photo preview */}
      <div style={{ position: 'relative', aspectRatio: '5/3', overflow: 'hidden' }}>
        <img
          src={resolveUrl(photo.url)}
          alt=""
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            objectPosition: photo.object_position,
            opacity: photo.is_active ? 1 : 0.35,
            transition: 'opacity .2s',
          }}
        />
        {/* Hidden overlay */}
        {!photo.is_active && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.3)' }}>
            <span style={{ fontFamily: 'Oxanium,sans-serif', fontWeight: 700, fontSize: 11, color: 'rgba(255,255,255,.55)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Hidden</span>
          </div>
        )}
        {/* Caption preview */}
        {photo.caption && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,.65))', padding: '12px 10px 6px' }}>
            <span style={{ fontFamily: 'Oxanium,sans-serif', fontSize: 11, color: 'rgba(255,255,255,.9)', fontWeight: 600 }}>{photo.caption}</span>
          </div>
        )}
        {/* Focal point trigger */}
        <button
          onClick={onTogglePicker}
          title="Set focal point"
          style={{
            position: 'absolute', top: 6, right: 6, width: 28, height: 28,
            borderRadius: 7, border: 'none',
            background: isPickerOpen ? 'rgba(185,28,28,.85)' : 'rgba(0,0,0,.55)',
            color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Crosshair size={13} />
        </button>
        {/* Focal point popover */}
        {isPickerOpen && (
          <div style={{
            position: 'absolute', top: 38, right: 6, zIndex: 10,
            background: 'rgba(8,0,0,.95)', border: '1px solid rgba(185,28,28,.45)',
            borderRadius: 10, padding: 8,
            display: 'grid', gridTemplateColumns: 'repeat(3, 32px)', gap: 4,
          }}>
            {POSITIONS.flat().map((pos) => (
              <button
                key={pos}
                onClick={() => onUpdatePosition(pos)}
                title={pos}
                style={{
                  width: 32, height: 32, borderRadius: 6, border: 'none',
                  background: photo.object_position === pos ? 'rgba(185,28,28,.8)' : 'rgba(255,255,255,.08)',
                  color: '#fff', cursor: 'pointer', fontSize: 15, fontWeight: 700,
                  transition: 'background .1s',
                }}
              >
                {POS_LABELS[pos]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Caption input */}
      <div style={{ padding: '8px 10px 0' }}>
        <input
          type="text"
          value={captionDraft}
          placeholder="Add caption…"
          onChange={(e) => setCaptionDraft(e.target.value)}
          onBlur={() => {
            if (captionDraft !== (photo.caption ?? '')) onUpdateCaption(captionDraft);
          }}
          style={{
            width: '100%', background: 'rgba(0,0,0,.3)', border: '1px solid rgba(255,255,255,.1)',
            borderRadius: 7, padding: '5px 8px', color: '#fff', fontSize: 12,
            fontFamily: 'Oxanium,sans-serif', outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ color: 'rgba(255,255,255,.25)', cursor: 'grab', lineHeight: 0 }}>
            <GripVertical size={16} />
          </div>
          <button
            onClick={onToggleActive}
            title={photo.is_active ? 'Hide from slideshow' : 'Show in slideshow'}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 9px', borderRadius: 7, border: '1px solid rgba(255,255,255,.12)',
              background: photo.is_active ? 'rgba(185,28,28,.25)' : 'rgba(255,255,255,.06)',
              color: photo.is_active ? 'rgba(248,113,113,.9)' : 'rgba(255,255,255,.45)',
              cursor: 'pointer', fontSize: 11, fontFamily: 'Oxanium,sans-serif', fontWeight: 700,
            }}
          >
            {photo.is_active ? <Eye size={11} /> : <EyeOff size={11} />}
            {photo.is_active ? 'Visible' : 'Hidden'}
          </button>
        </div>
        <button
          onClick={onDelete}
          title="Delete photo"
          style={{
            width: 28, height: 28, borderRadius: 7, border: 'none',
            background: 'rgba(185,28,28,.15)', color: 'rgba(248,113,113,.7)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
