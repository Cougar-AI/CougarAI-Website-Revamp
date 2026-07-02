import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Trash2, Plus, Eye, EyeOff, Loader2,
  Maximize2, X, ChevronLeft, ChevronRight, Move, Play, Pause,
} from 'lucide-react';

const BACKEND = import.meta.env.VITE_BACKEND_API_URL ?? 'http://localhost:5001';

function parseObjectPosition(pos: string): { x: number; y: number } {
  const named: Record<string, [number, number]> = {
    'top left': [0, 0], 'top': [50, 0], 'top right': [100, 0],
    'left': [0, 50], 'center left': [0, 50],
    'center': [50, 50],
    'right': [100, 50], 'center right': [100, 50],
    'bottom left': [0, 100], 'bottom': [50, 100], 'bottom right': [100, 100],
  };
  if (named[pos]) return { x: named[pos][0], y: named[pos][1] };
  const parts = pos.trim().split(/\s+/);
  if (parts.length >= 2) {
    const x = parseFloat(parts[0]);
    const y = parseFloat(parts[1]);
    if (!isNaN(x) && !isNaN(y)) return { x, y };
  }
  return { x: 50, y: 50 };
}

function getPosFromRect(e: React.MouseEvent, rect: DOMRect): { x: number; y: number } {
  return {
    x: Math.round(Math.max(0, Math.min(100, (e.clientX - rect.left) / rect.width * 100))),
    y: Math.round(Math.max(0, Math.min(100, (e.clientY - rect.top) / rect.height * 100))),
  };
}

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
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [localOrder, setLocalOrder] = useState<number[]>([]);
  const [uploading, setUploading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState('');
  const [openPhotoId, setOpenPhotoId] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const localPreviewObjectUrlRef = useRef<string | null>(null);
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

  const serverPhotos = data?.photos ?? [];

  useEffect(() => {
    setLocalOrder(serverPhotos.map((p) => p.photo_id));
  }, [serverPhotos]);

  const photos = localOrder
    .map((id) => serverPhotos.find((p) => p.photo_id === id))
    .filter(Boolean) as Photo[];

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

  function handleDragOver(e: React.DragEvent, targetId: number) {
    e.preventDefault();
    if (draggedId === null || draggedId === targetId) return;
    setDragOverId(targetId);
    setLocalOrder((prev) => {
      const next = [...prev];
      const from = next.indexOf(draggedId);
      const to = next.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      next.splice(from, 1);
      next.splice(to, 0, draggedId);
      return next;
    });
  }

  function handleDrop() {
    if (draggedId === null) return;
    reorderMutation.mutate(localOrder);
    setDraggedId(null);
    setDragOverId(null);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // create a local preview immediately
    try {
      const localUrl = URL.createObjectURL(file);
      localPreviewObjectUrlRef.current = localUrl;
      setLocalPreviewUrl(localUrl);
    } catch {
      // ignore if createObjectURL fails
    }
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
      // switch preview to the uploaded URL (persisted)
      try {
        if (localPreviewObjectUrlRef.current) {
          URL.revokeObjectURL(localPreviewObjectUrlRef.current);
          localPreviewObjectUrlRef.current = null;
        }
      } catch {}
      setLocalPreviewUrl(`${BACKEND}${uploadJson.url}`);
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

  const currentPhotoIdx = photos.findIndex((p) => p.photo_id === openPhotoId);

  function handleModalNav(dir: 'prev' | 'next') {
    if (currentPhotoIdx === -1) return;
    const newIdx = dir === 'prev'
      ? (currentPhotoIdx - 1 + photos.length) % photos.length
      : (currentPhotoIdx + 1) % photos.length;
    setOpenPhotoId(photos[newIdx].photo_id);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: 'Oxanium,sans-serif', fontWeight: 800, fontSize: 20, color: '#fff', margin: '0 0 4px' }}>Slideshow Photos</h2>
          <p style={{ color: 'rgba(255,255,255,.45)', fontSize: 13, margin: 0 }}>Drag cards to reorder. Click a photo to edit.</p>
        </div>
        <div style={{ display: 'flex', gap: 6, background: 'rgba(0,0,0,.3)', padding: 4, borderRadius: 10 }}>
          {(['home', 'about'] as const).map((p) => (
            <button
              key={p}
              onClick={() => { setActivePage(p); setError(''); }}
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
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            {photos.map((photo, idx) => (
              <PhotoCard
                key={photo.photo_id}
                photo={photo}
                position={idx + 1}
                isDragging={draggedId === photo.photo_id}
                isDragOver={dragOverId === photo.photo_id}
                onDragStart={() => setDraggedId(photo.photo_id)}
                onDragOver={(e) => handleDragOver(e, photo.photo_id)}
                onDragLeave={() => setDragOverId(null)}
                onDragEnd={() => { setDraggedId(null); setDragOverId(null); }}
                onOpen={() => setOpenPhotoId(photo.photo_id)}
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
          {localPreviewUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 72, height: 48, borderRadius: 8, overflow: 'hidden', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)' }}>
                <img src={localPreviewUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <button
                onClick={() => {
                  if (localPreviewObjectUrlRef.current) {
                    try { URL.revokeObjectURL(localPreviewObjectUrlRef.current); } catch {}
                    localPreviewObjectUrlRef.current = null;
                  }
                  setLocalPreviewUrl(null);
                  if (fileRef.current) fileRef.current.value = '';
                }}
                className="text-xs px-3 py-1.5 rounded-lg text-white/70"
                style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)' }}
              >
                Remove
              </button>
            </div>
          )}
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
            <>
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
              <button
                onClick={() => setPreviewOpen((v) => !v)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '9px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,.1)',
                  background: previewOpen ? 'rgba(185,28,28,.15)' : 'rgba(255,255,255,.05)',
                  color: previewOpen ? 'rgba(248,113,113,.9)' : 'rgba(255,255,255,.55)',
                  cursor: 'pointer',
                  fontFamily: 'Oxanium,sans-serif', fontWeight: 600, fontSize: 12,
                  marginLeft: 'auto',
                }}
              >
                <Play size={12} />
                {previewOpen ? 'Hide preview' : 'Preview slideshow'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Live preview strip */}
      {previewOpen && photos.length > 0 && (
        <SlideshowPreview photos={photos.filter((p) => p.is_active)} />
      )}

      {/* Photo detail modal */}
      {openPhotoId !== null && currentPhotoIdx !== -1 && (
        <PhotoDetailModal
          photos={photos}
          currentIdx={currentPhotoIdx}
          onClose={() => setOpenPhotoId(null)}
          onNavigate={handleModalNav}
          onSave={(patch) =>
            updateMutation.mutate({ id: openPhotoId, patch })
          }
          onDelete={() => {
            deleteMutation.mutate(openPhotoId);
            setOpenPhotoId(null);
          }}
        />
      )}
    </div>
  );
}

// --- PhotoCard (simplified — editing moved to detail modal) ---

interface PhotoCardProps {
  photo: Photo;
  position: number;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDragEnd: () => void;
  onOpen: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}

function PhotoCard({
  photo, position, isDragging, isDragOver,
  onDragStart, onDragOver, onDragLeave, onDragEnd,
  onOpen, onToggleActive, onDelete,
}: PhotoCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDragEnd={onDragEnd}
      style={{
        borderRadius: 12,
        background: isDragOver ? 'rgba(185,28,28,.12)' : 'rgba(255,255,255,.05)',
        border: `1px solid ${isDragOver ? 'rgba(185,28,28,.65)' : 'rgba(185,28,28,.2)'}`,
        overflow: 'hidden',
        opacity: isDragging ? 0.4 : 1,
        transition: 'border-color .1s, background .1s, opacity .1s',
        cursor: 'grab',
        outline: isDragOver ? '2px dashed rgba(185,28,28,.5)' : 'none',
        outlineOffset: 2,
      }}
    >
      {/* Photo thumbnail — click to open detail modal */}
      <div
        onClick={onOpen}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ position: 'relative', aspectRatio: '5/3', overflow: 'hidden', cursor: 'pointer' }}
      >
        <img
          src={resolveUrl(photo.url)}
          alt=""
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            objectPosition: photo.object_position,
            opacity: photo.is_active ? 1 : 0.35,
            transition: 'opacity .2s, transform .2s',
            transform: hovered ? 'scale(1.03)' : 'scale(1)',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
          draggable={false}
        />

        {/* Position badge */}
        <div style={{
          position: 'absolute', top: 6, left: 6,
          width: 22, height: 22, borderRadius: 6,
          background: 'rgba(0,0,0,.7)', border: '1px solid rgba(255,255,255,.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Oxanium,sans-serif', fontWeight: 800, fontSize: 11, color: 'rgba(255,255,255,.8)',
          pointerEvents: 'none',
        }}>
          {position}
        </div>

        {/* Expand overlay on hover */}
        {hovered && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(0,0,0,.55)', border: '1px solid rgba(255,255,255,.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Maximize2 size={16} color="rgba(255,255,255,.9)" />
            </div>
          </div>
        )}

        {/* Hidden badge */}
        {!photo.is_active && !hovered && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.3)' }}>
            <span style={{ fontFamily: 'Oxanium,sans-serif', fontWeight: 700, fontSize: 11, color: 'rgba(255,255,255,.55)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Hidden</span>
          </div>
        )}

        {/* Caption preview */}
        {photo.caption && !hovered && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,.65))', padding: '12px 10px 6px' }}>
            <span style={{ fontFamily: 'Oxanium,sans-serif', fontSize: 11, color: 'rgba(255,255,255,.9)', fontWeight: 600 }}>{photo.caption}</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px 10px' }}>
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

// --- PhotoDetailModal ---

interface PhotoDetailModalProps {
  photos: Photo[];
  currentIdx: number;
  onClose: () => void;
  onNavigate: (dir: 'prev' | 'next') => void;
  onSave: (patch: Partial<Pick<Photo, 'object_position' | 'caption' | 'is_active'>>) => void;
  onDelete: () => void;
}

function PhotoDetailModal({
  photos, currentIdx, onClose, onNavigate, onSave, onDelete,
}: PhotoDetailModalProps) {
  const photo = photos[currentIdx];
  const [cropMode, setCropMode] = useState(false);
  const [livePos, setLivePos] = useState(() => parseObjectPosition(photo.object_position));
  const [posModified, setPosModified] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(photo.caption ?? '');
  const [pendingActive, setPendingActive] = useState(photo.is_active);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const imgContainerRef = useRef<HTMLDivElement>(null);

  // Sync state when navigating to a different photo
  useEffect(() => {
    setLivePos(parseObjectPosition(photo.object_position));
    setPosModified(false);
    setCaptionDraft(photo.caption ?? '');
    setPendingActive(photo.is_active);
    setCropMode(false);
    setConfirmDelete(false);
  }, [photo.photo_id]);

  const captionChanged = captionDraft !== (photo.caption ?? '');
  const activeChanged = pendingActive !== photo.is_active;
  const isDirty = posModified || captionChanged || activeChanged;

  function handleSave() {
    const patch: Partial<Pick<Photo, 'object_position' | 'caption' | 'is_active'>> = {};
    if (posModified) patch.object_position = `${livePos.x}% ${livePos.y}%`;
    if (captionChanged) patch.caption = captionDraft;
    if (activeChanged) patch.is_active = pendingActive;
    onSave(patch);
    setPosModified(false);
  }

  function handleDiscard() {
    setLivePos(parseObjectPosition(photo.object_position));
    setPosModified(false);
    setCaptionDraft(photo.caption ?? '');
    setPendingActive(photo.is_active);
    setCropMode(false);
  }

  // Keyboard: Escape closes/cancels crop, arrows navigate (blocked when dirty to avoid accidental nav)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { if (cropMode) setCropMode(false); else onClose(); }
      if (!cropMode && !isDirty) {
        if (e.key === 'ArrowLeft') onNavigate('prev');
        if (e.key === 'ArrowRight') onNavigate('next');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cropMode, isDirty, onClose, onNavigate]);

  function handleCropClick(e: React.MouseEvent) {
    if (!cropMode || !imgContainerRef.current) return;
    const pos = getPosFromRect(e, imgContainerRef.current.getBoundingClientRect());
    setLivePos(pos);
    setPosModified(true);
    setCropMode(false);
  }

  function handleCropMouseMove(e: React.MouseEvent) {
    if (!cropMode || !(e.buttons & 1) || !imgContainerRef.current) return;
    setLivePos(getPosFromRect(e, imgContainerRef.current.getBoundingClientRect()));
  }

  const posStr = `${livePos.x}% ${livePos.y}%`;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,.82)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 820,
          borderRadius: 20,
          background: 'rgba(8,0,0,.9)',
          border: '1px solid rgba(185,28,28,.35)',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 24px 80px rgba(0,0,0,.75)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Modal header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '1px solid rgba(185,28,28,.18)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'Oxanium,sans-serif', fontWeight: 800, fontSize: 14, color: '#fff' }}>
              Photo {currentIdx + 1} of {photos.length}
            </span>
            {!photo.is_active && (
              <span style={{
                fontFamily: 'Oxanium,sans-serif', fontSize: 11, fontWeight: 700,
                padding: '2px 8px', borderRadius: 5,
                background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.4)',
                letterSpacing: '0.05em', textTransform: 'uppercase',
              }}>Hidden</span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8, border: 'none',
              background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.7)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Image area with prev/next arrows */}
        <div style={{ position: 'relative' }}>
          {photos.length > 1 && (
            <button
              onClick={() => onNavigate('prev')}
              style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                zIndex: 10, width: 36, height: 36, borderRadius: 10,
                border: '1px solid rgba(255,255,255,.15)',
                background: 'rgba(0,0,0,.6)', color: '#fff',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <ChevronLeft size={18} />
            </button>
          )}

          <div
            ref={imgContainerRef}
            onClick={handleCropClick}
            onMouseMove={handleCropMouseMove}
            style={{
              position: 'relative',
              height: 420,
              overflow: 'hidden',
              cursor: cropMode ? 'crosshair' : 'default',
              background: '#000',
            }}
          >
            <img
              src={resolveUrl(photo.url)}
              alt=""
              style={{
                width: '100%', height: '100%',
                objectFit: 'cover',
                objectPosition: posStr,
                opacity: photo.is_active ? 1 : 0.4,
                transition: cropMode ? 'none' : 'object-position .15s, opacity .2s',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
              draggable={false}
            />

            {/* Crop overlay */}
            {cropMode && (
              <>
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'rgba(0,0,0,.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  pointerEvents: 'none',
                }}>
                  <span style={{
                    fontFamily: 'Oxanium,sans-serif', fontSize: 14, fontWeight: 700,
                    color: 'rgba(255,255,255,.9)', letterSpacing: '0.05em',
                    textShadow: '0 1px 6px rgba(0,0,0,.9)',
                    background: 'rgba(0,0,0,.5)', padding: '8px 16px', borderRadius: 8,
                  }}>
                    Click to set focus point
                  </span>
                </div>
                <div style={{
                  position: 'absolute',
                  left: `${livePos.x}%`, top: `${livePos.y}%`,
                  transform: 'translate(-50%, -50%)',
                  width: 20, height: 20, borderRadius: '50%',
                  border: '2.5px solid #fff',
                  boxShadow: '0 0 0 2px rgba(185,28,28,.9), 0 0 10px rgba(0,0,0,.7)',
                  pointerEvents: 'none',
                }} />
              </>
            )}

            {/* Hidden overlay */}
            {!photo.is_active && !cropMode && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{
                  fontFamily: 'Oxanium,sans-serif', fontWeight: 700, fontSize: 13,
                  color: 'rgba(255,255,255,.5)', letterSpacing: '0.1em', textTransform: 'uppercase',
                  background: 'rgba(0,0,0,.4)', padding: '6px 14px', borderRadius: 8,
                }}>Hidden from slideshow</span>
              </div>
            )}

            {/* Slide dots */}
            {photos.length > 1 && (
              <div style={{
                position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
                display: 'flex', gap: 6, zIndex: 10,
              }}>
                {photos.map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: i === currentIdx ? 18 : 6, height: 6, borderRadius: 3, border: 'none',
                      background: i === currentIdx ? 'rgba(248,113,113,.9)' : 'rgba(255,255,255,.3)',
                      transition: 'all .2s',
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {photos.length > 1 && (
            <button
              onClick={() => onNavigate('next')}
              style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                zIndex: 10, width: 36, height: 36, borderRadius: 10,
                border: '1px solid rgba(255,255,255,.15)',
                background: 'rgba(0,0,0,.6)', color: '#fff',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <ChevronRight size={18} />
            </button>
          )}
        </div>

        {/* Controls */}
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Caption */}
          <div>
            <label style={{
              fontFamily: 'Oxanium,sans-serif', fontSize: 11, fontWeight: 700,
              color: 'rgba(255,255,255,.4)', letterSpacing: '0.05em', textTransform: 'uppercase',
              display: 'block', marginBottom: 6,
            }}>
              Caption
            </label>
            <input
              type="text"
              value={captionDraft}
              placeholder="Add a caption…"
              onChange={(e) => setCaptionDraft(e.target.value)}
              style={{
                width: '100%', background: 'rgba(0,0,0,.4)', border: `1px solid ${captionChanged ? 'rgba(185,28,28,.5)' : 'rgba(255,255,255,.12)'}`,
                borderRadius: 9, padding: '8px 12px', color: '#fff', fontSize: 13,
                fontFamily: 'Oxanium,sans-serif', outline: 'none', boxSizing: 'border-box',
                transition: 'border-color .15s',
              }}
            />
          </div>

          {/* Editing tools row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => { setCropMode((v) => !v); if (cropMode) setLivePos(parseObjectPosition(photo.object_position)); }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '8px 14px', borderRadius: 9,
                border: `1px solid ${cropMode ? 'rgba(185,28,28,.6)' : posModified ? 'rgba(185,28,28,.4)' : 'rgba(255,255,255,.15)'}`,
                background: cropMode ? 'rgba(185,28,28,.25)' : posModified ? 'rgba(185,28,28,.12)' : 'rgba(255,255,255,.06)',
                color: cropMode || posModified ? 'rgba(248,113,113,.9)' : 'rgba(255,255,255,.7)',
                cursor: 'pointer', fontFamily: 'Oxanium,sans-serif', fontWeight: 700, fontSize: 12,
              }}
            >
              <Move size={13} />
              {cropMode ? 'Cancel reposition' : posModified ? 'Repositioned ✓' : 'Reposition'}
            </button>

            <button
              onClick={() => setPendingActive((v) => !v)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '8px 14px', borderRadius: 9,
                border: `1px solid ${activeChanged ? 'rgba(185,28,28,.4)' : 'rgba(255,255,255,.12)'}`,
                background: pendingActive ? 'rgba(185,28,28,.25)' : 'rgba(255,255,255,.06)',
                color: pendingActive ? 'rgba(248,113,113,.9)' : 'rgba(255,255,255,.45)',
                cursor: 'pointer', fontFamily: 'Oxanium,sans-serif', fontWeight: 700, fontSize: 12,
              }}
            >
              {pendingActive ? <Eye size={13} /> : <EyeOff size={13} />}
              {pendingActive ? 'Visible' : 'Hidden'}
            </button>

            {/* Delete with inline confirmation */}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              {confirmDelete ? (
                <>
                  <span style={{ fontFamily: 'Oxanium,sans-serif', fontSize: 12, color: 'rgba(248,113,113,.8)' }}>Delete this photo?</span>
                  <button
                    onClick={onDelete}
                    style={{
                      padding: '7px 14px', borderRadius: 9, border: 'none',
                      background: 'rgba(185,28,28,.6)', color: '#fff',
                      cursor: 'pointer', fontFamily: 'Oxanium,sans-serif', fontWeight: 700, fontSize: 12,
                    }}
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    style={{
                      padding: '7px 14px', borderRadius: 9, border: '1px solid rgba(255,255,255,.1)',
                      background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.6)',
                      cursor: 'pointer', fontFamily: 'Oxanium,sans-serif', fontWeight: 700, fontSize: 12,
                    }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    padding: '8px 14px', borderRadius: 9, border: 'none',
                    background: 'rgba(185,28,28,.15)', color: 'rgba(248,113,113,.7)',
                    cursor: 'pointer', fontFamily: 'Oxanium,sans-serif', fontWeight: 700, fontSize: 12,
                  }}
                >
                  <Trash2 size={13} />
                  Delete
                </button>
              )}
            </div>
          </div>

          {/* Save / Discard bar — only shown when there are unsaved changes */}
          {isDirty && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px', borderRadius: 10,
              background: 'rgba(185,28,28,.08)', border: '1px solid rgba(185,28,28,.3)',
            }}>
              <span style={{ fontFamily: 'Oxanium,sans-serif', fontSize: 12, color: 'rgba(255,255,255,.5)', flex: 1 }}>
                Unsaved changes
              </span>
              <button
                onClick={handleDiscard}
                style={{
                  padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.12)',
                  background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.6)',
                  cursor: 'pointer', fontFamily: 'Oxanium,sans-serif', fontWeight: 700, fontSize: 12,
                }}
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                style={{
                  padding: '6px 18px', borderRadius: 8, border: 'none',
                  background: 'rgba(185,28,28,.7)', color: '#fff',
                  cursor: 'pointer', fontFamily: 'Oxanium,sans-serif', fontWeight: 700, fontSize: 12,
                  boxShadow: '0 0 12px rgba(185,28,28,.35)',
                }}
              >
                Save
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- SlideshowPreview ---

function SlideshowPreview({ photos }: { photos: Photo[] }) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => { setIdx(0); }, [photos.length]);

  useEffect(() => {
    if (!playing || photos.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % photos.length), 3000);
    return () => clearInterval(t);
  }, [playing, photos.length]);

  if (photos.length === 0) {
    return (
      <div style={{ ...glass, textAlign: 'center', padding: '24px 20px', color: 'rgba(255,255,255,.35)', fontSize: 13 }}>
        No active photos to preview.
      </div>
    );
  }

  const photo = photos[idx];

  return (
    <div style={glass}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontFamily: 'Oxanium,sans-serif', fontWeight: 700, fontSize: 13, color: 'rgba(255,255,255,.7)' }}>
          Live Preview — {photos.length} active photo{photos.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => setPlaying((v) => !v)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,.1)',
            background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.55)',
            cursor: 'pointer', fontFamily: 'Oxanium,sans-serif', fontWeight: 700, fontSize: 11,
          }}
        >
          {playing ? <Pause size={11} /> : <Play size={11} />}
          {playing ? 'Pause' : 'Play'}
        </button>
      </div>

      <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', aspectRatio: '16/7' }}>
        {photos.length > 1 && (
          <>
            <button
              onClick={() => { setIdx((idx - 1 + photos.length) % photos.length); setPlaying(false); }}
              style={{
                position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'rgba(0,0,0,.45)', border: 'none', borderRadius: 6,
                color: '#fff', cursor: 'pointer', padding: '5px 7px', zIndex: 2,
                display: 'flex', alignItems: 'center',
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => { setIdx((idx + 1) % photos.length); setPlaying(false); }}
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'rgba(0,0,0,.45)', border: 'none', borderRadius: 6,
                color: '#fff', cursor: 'pointer', padding: '5px 7px', zIndex: 2,
                display: 'flex', alignItems: 'center',
              }}
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}
        <img
          src={resolveUrl(photo.url)}
          alt=""
          style={{
            width: '100%', height: '100%',
            objectFit: 'cover',
            objectPosition: photo.object_position,
          }}
          draggable={false}
        />
        {photo.caption && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(transparent, rgba(0,0,0,.7))',
            padding: '24px 18px 12px',
          }}>
            <span style={{ fontFamily: 'Oxanium,sans-serif', fontSize: 14, color: '#fff', fontWeight: 600 }}>
              {photo.caption}
            </span>
          </div>
        )}
        <div style={{
          position: 'absolute', top: 10, right: 12,
          fontFamily: 'Oxanium,sans-serif', fontSize: 11, fontWeight: 700,
          color: 'rgba(255,255,255,.7)',
          background: 'rgba(0,0,0,.5)', padding: '3px 8px', borderRadius: 6,
        }}>
          {idx + 1} / {photos.length}
        </div>
      </div>

      {/* Dot nav */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 }}>
        {photos.map((_, i) => (
          <button
            key={i}
            onClick={() => { setIdx(i); setPlaying(false); }}
            style={{
              width: i === idx ? 20 : 7, height: 7, borderRadius: 4, border: 'none',
              background: i === idx ? 'rgba(248,113,113,.9)' : 'rgba(255,255,255,.25)',
              cursor: 'pointer', padding: 0, transition: 'all .2s',
            }}
          />
        ))}
      </div>
    </div>
  );
}
