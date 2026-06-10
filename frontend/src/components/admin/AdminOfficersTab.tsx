import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { Plus, Edit2, UserMinus, Trash2, X, Search, Upload, Link, Move, Sprout, ChevronDown, ChevronRight, Tags } from 'lucide-react';
import { formatDate } from '@/lib/dates';
import { departments as staticDepartments } from '@/data/officers';

const BACKEND = import.meta.env.VITE_BACKEND_API_URL ?? 'http://localhost:5001';

interface Officer {
  student_id: string;
  officer_role: string;
  join_date: string | null;
  end_date: string | null;
  position_id: number | null;
  position_title: string | null;
  position_department: string | null;
  photo_url: string | null;
  photo_object_position: string;
  linkedin_url: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  user_id: number | null;
  email: string | null;
  is_active: boolean;
  is_unlinked: boolean;
}

interface OfficerPosition {
  position_id: number;
  title: string;
  department: string;
  sort_order?: number;
}

interface AdminUser {
  user_id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  student_id: string | null;
  avatar_url: string | null;
  role: string;
}

const OFFICER_ROLES = ['officer', 'admin'];

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  admin: { bg: 'rgba(185,28,28,.25)', text: 'rgba(248,113,113,.9)' },
  officer: { bg: 'rgba(29,78,216,.2)', text: 'rgba(96,165,250,.9)' },
};

function normalizeOfficerRole(role: string) {
  return OFFICER_ROLES.includes(role) ? role : 'officer';
}

const cardStyle = {
  background: 'rgba(255,255,255,.04)',
  border: '1px solid rgba(185,28,28,.22)',
  backdropFilter: 'blur(10px)',
};

const inputStyle = {
  background: 'rgba(255,255,255,.06)',
  border: '1px solid rgba(185,28,28,.2)',
  color: '#fff',
};

function resolveOfficerPhoto(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('/admin/uploads/')) return `${BACKEND}${url}`;
  return url;
}

function validateLinkedin(url: string): string {
  if (!url) return '';
  if (!url.startsWith('https://linkedin.com') && !url.startsWith('https://www.linkedin.com')) {
    return 'Must be a valid LinkedIn URL (https://linkedin.com/in/...)';
  }
  return '';
}

// Flatten all static officers into a single list for seeding
const allStaticOfficers = staticDepartments.flatMap((d) => d.officers);

function PositionSelect({ positions, value, onChange }: { positions: OfficerPosition[]; value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={inputStyle}>
      <option value="" style={{ background: '#1a0000' }}>— None —</option>
      {Object.entries(
        positions.reduce<Record<string, OfficerPosition[]>>((acc, p) => {
          (acc[p.department] ??= []).push(p);
          return acc;
        }, {})
      ).map(([dept, deptPositions]) => (
        <optgroup key={dept} label={dept}>
          {deptPositions.map((p) => (
            <option key={p.position_id} value={p.position_id} style={{ background: '#1a0000' }}>
              {p.title}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function AddOfficerModal({ onClose, onSaved, positions }: { onClose: () => void; onSaved: () => void; positions: OfficerPosition[] }) {
  const [mode, setMode] = useState<'user' | 'name'>('user');
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [officerRole, setOfficerRole] = useState('officer');
  const [positionId, setPositionId] = useState('');
  const [joinDate, setJoinDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: searchResults } = useQuery<{ users: AdminUser[] }>({
    queryKey: ['admin-user-search', search],
    queryFn: () => apiGet(`/admin/users?search=${encodeURIComponent(search)}&limit=8`),
    enabled: mode === 'user' && search.length >= 2,
    staleTime: 10_000,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (mode === 'user') {
        if (!selectedUser) return;
        await apiPost('/admin/officers', {
          user_id: selectedUser.user_id,
          officer_role: officerRole,
          join_date: joinDate,
          position_id: positionId ? Number(positionId) : null,
        });
      } else {
        await apiPost('/admin/officers', {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          officer_role: officerRole,
          join_date: joinDate,
          position_id: positionId ? Number(positionId) : null,
        });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to add officer');
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = mode === 'user'
    ? !!selectedUser && !!selectedUser.student_id
    : firstName.trim().length > 0 && lastName.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-5"
        style={{ background: 'rgba(10,0,0,.95)', border: '1px solid rgba(185,28,28,.3)', boxShadow: '0 20px 60px rgba(0,0,0,.6)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white font-['Oxanium']">Add Officer</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/80"><X size={18} /></button>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(185,28,28,.2)' }}>
          {(['user', 'name'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(''); }}
              className="flex-1 py-2 text-xs font-medium transition-colors"
              style={{
                background: mode === m ? 'rgba(185,28,28,.35)' : 'transparent',
                color: mode === m ? 'rgba(248,113,113,.9)' : 'rgba(255,255,255,.4)',
              }}
            >
              {m === 'user' ? 'Link User Account' : 'Name Only (no account yet)'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'user' ? (
            <div className="flex flex-col gap-2">
              <label className="text-xs text-white/50">Search user by name or email</label>
              {selectedUser ? (
                <div
                  className="flex items-center justify-between rounded-lg px-3 py-2"
                  style={{ background: 'rgba(185,28,28,.15)', border: '1px solid rgba(185,28,28,.3)' }}
                >
                  <div>
                    <p className="text-sm text-white">{selectedUser.first_name} {selectedUser.last_name}</p>
                    <p className="text-xs text-white/40">{selectedUser.email}</p>
                    {!selectedUser.student_id && (
                      <p className="text-xs text-red-400">⚠ No linked student ID — cannot assign officer</p>
                    )}
                  </div>
                  <button type="button" onClick={() => setSelectedUser(null)} className="text-white/40 hover:text-white/80">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                    <input
                      type="text"
                      placeholder="Type to search…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-lg text-sm"
                      style={inputStyle}
                    />
                  </div>
                  {searchResults?.users && search.length >= 2 && (
                    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(185,28,28,.2)' }}>
                      {searchResults.users.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-white/40">No users found</p>
                      ) : (
                        searchResults.users.map((u) => (
                          <button
                            key={u.user_id}
                            type="button"
                            onClick={() => { setSelectedUser(u); setSearch(''); }}
                            className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-white/[0.04] transition-colors"
                            style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}
                          >
                            <div
                              className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                              style={{ background: 'rgba(185,28,28,.3)', color: 'rgba(248,113,113,.9)' }}
                            >
                              {(u.first_name ?? u.email)[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm text-white">
                                {u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.email}
                              </p>
                              <p className="text-xs text-white/40">{u.email}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-white/40">
                This officer will appear publicly right away. You can link their account later once they sign up.
              </p>
              <div className="flex gap-2">
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-xs text-white/50">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jane"
                    className="rounded-lg px-3 py-2 text-sm"
                    style={inputStyle}
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-xs text-white/50">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Smith"
                    className="rounded-lg px-3 py-2 text-sm"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Officer role */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50">System Role</label>
            <select value={officerRole} onChange={(e) => setOfficerRole(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={inputStyle}>
              {OFFICER_ROLES.map((r) => (
                <option key={r} value={r} style={{ background: '#1a0000' }}>{r}</option>
              ))}
            </select>
          </div>

          {/* Position / Title */}
          {positions.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/50">Position / Title</label>
              <PositionSelect positions={positions} value={positionId} onChange={setPositionId} />
            </div>
          )}

          {/* Join date */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50">Join Date</label>
            <input type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,.06)' }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !canSubmit}
              className="px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40 transition-all"
              style={{ background: 'rgba(185,28,28,.7)' }}
            >
              {saving ? 'Adding…' : 'Add Officer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditOfficerModal({
  officer,
  onClose,
  onSaved,
  positions,
}: {
  officer: Officer;
  onClose: () => void;
  onSaved: () => void;
  positions: OfficerPosition[];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [officerRole, setOfficerRole] = useState(normalizeOfficerRole(officer.officer_role));
  const [positionId, setPositionId] = useState(officer.position_id?.toString() ?? '');
  const [joinDate, setJoinDate] = useState(officer.join_date?.slice(0, 10) ?? '');
  const [endDate, setEndDate] = useState(officer.end_date?.slice(0, 10) ?? '');
  const [photoUrl, setPhotoUrl] = useState<string | null>(officer.photo_url);
  const [photoObjectPosition, setPhotoObjectPosition] = useState(officer.photo_object_position ?? '50% 50%');
  const [linkedinUrl, setLinkedinUrl] = useState(officer.linkedin_url ?? '');
  const [cropMode, setCropMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [linkSearch, setLinkSearch] = useState('');
  const [linkUser, setLinkUser] = useState<AdminUser | null>(null);
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState('');

  const { data: linkSearchResults } = useQuery<{ users: AdminUser[] }>({
    queryKey: ['admin-user-search-link', linkSearch],
    queryFn: () => apiGet(`/admin/users?search=${encodeURIComponent(linkSearch)}&limit=8`),
    enabled: officer.is_unlinked && linkSearch.length >= 2,
    staleTime: 10_000,
  });

  async function handleLinkAccount() {
    if (!linkUser) return;
    setLinking(true);
    setLinkError('');
    try {
      await apiPost(`/admin/officers/${officer.student_id}/link-account`, { user_id: linkUser.user_id });
      onSaved();
      onClose();
    } catch (err: any) {
      setLinkError(err?.message ?? 'Failed to link account');
    } finally {
      setLinking(false);
    }
  }

  const linkedinError = validateLinkedin(linkedinUrl);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${BACKEND}/admin/upload-image?category=officers`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Upload failed');
      setPhotoUrl(json.url);
      setPhotoObjectPosition('50% 50%');
      setCropMode(true);
    } catch (err: any) {
      setError(err.message ?? 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function handleCropClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    setPhotoObjectPosition(`${x}% ${y}%`);
  }

  const focalX = parseFloat(photoObjectPosition.split(' ')[0]);
  const focalY = parseFloat(photoObjectPosition.split(' ')[1]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (linkedinError) return;
    setSaving(true);
    setError('');
    try {
      await apiPatch(`/admin/officers/${officer.student_id}`, {
        officer_role: normalizeOfficerRole(officerRole),
        join_date: joinDate || null,
        end_date: endDate || null,
        position_id: positionId ? Number(positionId) : null,
        photo_url: photoUrl ?? null,
        photo_object_position: photoObjectPosition,
        linkedin_url: linkedinUrl || null,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to update officer');
    } finally {
      setSaving(false);
    }
  }

  const resolvedPhoto = resolveOfficerPhoto(photoUrl);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto"
        style={{ background: 'rgba(10,0,0,.95)', border: '1px solid rgba(185,28,28,.3)', boxShadow: '0 20px 60px rgba(0,0,0,.6)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white font-['Oxanium']">
            Edit Officer — {officer.first_name ?? officer.student_id}
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/80"><X size={18} /></button>
        </div>

        {/* Link Account section — only for unlinked (name-only) officers */}
        {officer.is_unlinked && (
          <div
            className="flex flex-col gap-3 rounded-xl p-4"
            style={{ background: 'rgba(185,28,28,.08)', border: '1px solid rgba(185,28,28,.25)' }}
          >
            <p className="text-xs font-semibold text-red-300 font-['Oxanium']">Link User Account</p>
            <p className="text-xs text-white/40">
              This officer was added without an account. Search for their account once they've signed up.
            </p>
            {linkUser ? (
              <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'rgba(185,28,28,.15)', border: '1px solid rgba(185,28,28,.3)' }}>
                <div>
                  <p className="text-sm text-white">{linkUser.first_name} {linkUser.last_name}</p>
                  <p className="text-xs text-white/40">{linkUser.email}</p>
                  {!linkUser.student_id && <p className="text-xs text-red-400">⚠ No student ID — cannot link</p>}
                </div>
                <button type="button" onClick={() => setLinkUser(null)} className="text-white/40 hover:text-white/80"><X size={14} /></button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="text"
                    placeholder="Search by name or email…"
                    value={linkSearch}
                    onChange={(e) => setLinkSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg text-sm"
                    style={inputStyle}
                  />
                </div>
                {linkSearchResults?.users && linkSearch.length >= 2 && (
                  <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(185,28,28,.2)' }}>
                    {linkSearchResults.users.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-white/40">No users found</p>
                    ) : (
                      linkSearchResults.users.map((u) => (
                        <button
                          key={u.user_id}
                          type="button"
                          onClick={() => { setLinkUser(u); setLinkSearch(''); }}
                          className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-white/[0.04] transition-colors"
                          style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}
                        >
                          <div className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'rgba(185,28,28,.3)', color: 'rgba(248,113,113,.9)' }}>
                            {(u.first_name ?? u.email)[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm text-white">{u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.email}</p>
                            <p className="text-xs text-white/40">{u.email}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
            {linkError && <p className="text-red-400 text-xs">{linkError}</p>}
            <button
              type="button"
              onClick={handleLinkAccount}
              disabled={linking || !linkUser || !linkUser.student_id}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40 w-fit"
              style={{ background: 'rgba(185,28,28,.6)' }}
            >
              {linking ? 'Linking…' : 'Link Account'}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Photo section */}
          <div className="flex flex-col gap-2">
            <label className="text-xs text-white/50">Officer Photo</label>
            {resolvedPhoto ? (
              <div className="flex gap-4 items-start">
                {/* Photo preview with crop mode */}
                <div
                  className="relative rounded-xl overflow-hidden shrink-0"
                  style={{
                    width: 120, height: 120,
                    cursor: cropMode ? 'crosshair' : 'default',
                    border: cropMode ? '2px solid rgba(248,113,113,.6)' : '1px solid rgba(185,28,28,.3)',
                  }}
                  onClick={cropMode ? handleCropClick : undefined}
                >
                  <img
                    src={resolvedPhoto}
                    alt=""
                    draggable={false}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: photoObjectPosition }}
                  />
                  {cropMode && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${focalX}%`, top: `${focalY}%`,
                        transform: 'translate(-50%, -50%)',
                        width: 10, height: 10,
                        borderRadius: '50%',
                        background: '#fff',
                        border: '2px solid rgba(0,0,0,.5)',
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                  {cropMode && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'rgba(248,113,113,.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      pointerEvents: 'none',
                    }}>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,.6)', fontFamily: 'Oxanium,sans-serif' }}>
                        Click to reposition
                      </span>
                    </div>
                  )}
                </div>

                {/* Controls */}
                <div className="flex flex-col gap-2 flex-1">
                  <button
                    type="button"
                    onClick={() => setCropMode((v) => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                    style={{
                      background: cropMode ? 'rgba(185,28,28,.3)' : 'rgba(255,255,255,.07)',
                      color: cropMode ? 'rgba(248,113,113,.9)' : 'rgba(255,255,255,.6)',
                      border: '1px solid rgba(255,255,255,.08)',
                    }}
                  >
                    <Move size={11} />
                    {cropMode ? 'Done Repositioning' : 'Reposition Focal Point'}
                  </button>
                  <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer"
                    style={{ background: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.6)', border: '1px solid rgba(255,255,255,.08)' }}>
                    <Upload size={11} />
                    {uploading ? 'Uploading…' : 'Replace Photo'}
                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleFileChange} />
                  </label>
                  <button
                    type="button"
                    onClick={() => { setPhotoUrl(null); setPhotoObjectPosition('50% 50%'); setCropMode(false); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                    style={{ background: 'rgba(185,28,28,.1)', color: 'rgba(248,113,113,.6)', border: '1px solid rgba(185,28,28,.2)' }}
                  >
                    <X size={11} /> Remove Photo
                  </button>
                  <p className="text-xs text-white/25">
                    {photoObjectPosition}
                  </p>
                </div>
              </div>
            ) : (
              <label
                className="flex items-center gap-2 px-4 py-3 rounded-xl cursor-pointer w-fit"
                style={{ background: 'rgba(255,255,255,.05)', border: '1px dashed rgba(185,28,28,.3)', color: 'rgba(255,255,255,.5)' }}
              >
                <Upload size={14} />
                <span className="text-sm">{uploading ? 'Uploading…' : 'Upload Photo'}</span>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleFileChange} />
              </label>
            )}
          </div>

          {/* LinkedIn URL */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50 flex items-center gap-1">
              <Link size={11} /> LinkedIn URL
            </label>
            <input
              type="url"
              placeholder="https://linkedin.com/in/username"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm"
              style={inputStyle}
            />
            {linkedinError && <p className="text-red-400 text-xs">{linkedinError}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50">System Role</label>
            <select
              value={officerRole}
              onChange={(e) => setOfficerRole(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm"
              style={inputStyle}
            >
              {OFFICER_ROLES.map((r) => (
                <option key={r} value={r} style={{ background: '#1a0000' }}>{r}</option>
              ))}
            </select>
          </div>
          {positions.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/50">Position / Title</label>
              <PositionSelect positions={positions} value={positionId} onChange={setPositionId} />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50">Join Date</label>
            <input type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50">End Date (leave blank if active)</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-white/60" style={{ background: 'rgba(255,255,255,.06)' }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !!linkedinError}
              className="px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
              style={{ background: 'rgba(185,28,28,.7)' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminOfficersTab() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editingOfficer, setEditingOfficer] = useState<Officer | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [positionsOpen, setPositionsOpen] = useState(false);
  const [newPosTitle, setNewPosTitle] = useState('');
  const [newPosDept, setNewPosDept] = useState('');
  const [newPosSortOrder, setNewPosSortOrder] = useState('');
  const [addingPos, setAddingPos] = useState(false);
  const [posError, setPosError] = useState('');
  const [editingPos, setEditingPos] = useState<OfficerPosition | null>(null);
  const [editPosTitle, setEditPosTitle] = useState('');
  const [editPosDept, setEditPosDept] = useState('');
  const [editPosSortOrder, setEditPosSortOrder] = useState('');
  const [savingPos, setSavingPos] = useState(false);
  const [editPosError, setEditPosError] = useState('');

  const { data, isLoading, error } = useQuery<{ officers: Officer[] }>({
    queryKey: ['admin-officers'],
    queryFn: () => apiGet('/admin/officers'),
    staleTime: 30_000,
  });

  const { data: positionsData } = useQuery<{ positions: OfficerPosition[] }>({
    queryKey: ['admin-officer-positions'],
    queryFn: () => apiGet('/admin/officer-positions'),
    staleTime: 300_000,
  });
  const positions = positionsData?.positions ?? [];

  const removeOfficer = useMutation({
    mutationFn: (studentId: string) => apiDelete(`/admin/officers/${studentId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-officers'] }),
  });

  const deleteOfficer = useMutation({
    mutationFn: (studentId: string) => apiDelete(`/admin/officers/${studentId}?hard=1`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-officers'] }),
  });

  const officers = data?.officers ?? [];
  const active = officers.filter((o) => o.is_active);
  const inactive = officers.filter((o) => !o.is_active);

  async function handleSeedFromStatic() {
    if (!confirm('This will fill in missing photos and LinkedIn URLs from the built-in officer data (officers with existing photos will be skipped). Continue?')) return;
    setSeeding(true);
    let seeded = 0;
    try {
      for (const o of active) {
        if (o.photo_url && o.linkedin_url) continue;
        const fullName = `${o.first_name ?? ''} ${o.last_name ?? ''}`.trim();
        const match = allStaticOfficers.find((s) => s.name === fullName);
        if (!match) continue;
        const updates: Record<string, string | null> = {};
        if (!o.photo_url && match.photo && match.photo !== '/officer_photo_blank.png') {
          updates.photo_url = match.photo;
        }
        if (!o.linkedin_url && match.linkedin && match.linkedin !== 'https://linkedin.com') {
          updates.linkedin_url = match.linkedin;
        }
        if (Object.keys(updates).length === 0) continue;
        await apiPatch(`/admin/officers/${o.student_id}`, updates);
        seeded++;
      }
      qc.invalidateQueries({ queryKey: ['admin-officers'] });
      alert(`Seeded ${seeded} officer${seeded !== 1 ? 's' : ''} from static data.`);
    } catch {
      alert('Seeding partially failed — check console.');
    } finally {
      setSeeding(false);
    }
  }

  function OfficerRow({ o }: { o: Officer }) {
    const normalizedRole = normalizeOfficerRole(o.officer_role);
    const roleColor = ROLE_COLORS[normalizedRole] ?? ROLE_COLORS.officer;
    const normalizedPositionTitle = o.position_title ?? (!OFFICER_ROLES.includes(o.officer_role) ? o.officer_role : null);
    const photoSrc = resolveOfficerPhoto(o.photo_url) ?? (o.avatar_url ? `${BACKEND}${o.avatar_url}` : null);
    const initials = [o.first_name, o.last_name].filter(Boolean).map((n) => n![0]).join('') || (o.student_id?.[0] ?? '?');
    return (
      <tr
        className="transition-colors hover:bg-white/[0.02]"
        style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            {photoSrc ? (
              <img
                src={photoSrc}
                alt=""
                className="h-8 w-8 rounded-full object-cover shrink-0"
                style={{ objectPosition: o.photo_url ? o.photo_object_position : 'center' }}
              />
            ) : (
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: 'rgba(185,28,28,.3)', color: 'rgba(248,113,113,.9)' }}
              >
                {initials.toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm text-white font-medium">
                  {o.first_name && o.last_name ? `${o.first_name} ${o.last_name}` : <span className="text-white/40 italic">No profile</span>}
                </p>
                {o.is_unlinked && (
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(234,179,8,.12)', color: 'rgba(234,179,8,.8)', border: '1px solid rgba(234,179,8,.2)' }}>
                    no account
                  </span>
                )}
              </div>
              <p className="text-xs text-white/40">{o.email ?? (o.is_unlinked ? 'not signed up yet' : o.student_id)}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: roleColor.bg, color: roleColor.text }}>
            {normalizedRole}
          </span>
        </td>
        <td className="px-4 py-3">
          {normalizedPositionTitle ? (
            <div>
              <p className="text-xs text-white/80">{normalizedPositionTitle}</p>
              <p className="text-xs text-white/30">{o.position_department}</p>
            </div>
          ) : (
            <span className="text-xs text-white/20">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-xs text-white/50">
          {o.join_date ? formatDate(o.join_date) : '—'}
        </td>
        <td className="px-4 py-3 text-xs text-white/50">
          {o.end_date ? formatDate(o.end_date) : '—'}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setEditingOfficer(o)}
              className="p-1.5 rounded-lg text-white/50 hover:text-white transition-colors"
              style={{ background: 'rgba(255,255,255,.06)' }}
              title="Edit"
            >
              <Edit2 size={13} />
            </button>
            {o.is_active && (
              <button
                onClick={() => {
                  if (confirm(`Remove ${o.first_name ?? o.student_id} as officer? Their end_date will be set to today.`)) {
                    removeOfficer.mutate(o.student_id);
                  }
                }}
                className="p-1.5 rounded-lg transition-colors"
                style={{ background: 'rgba(185,28,28,.12)', color: 'rgba(248,113,113,.7)' }}
                title="Remove officer"
              >
                <UserMinus size={13} />
              </button>
            )}
            <button
              onClick={() => {
                if (confirm(`Permanently delete ${o.first_name ?? o.student_id} from the officers table? This cannot be undone.`)) {
                  deleteOfficer.mutate(o.student_id);
                }
              }}
              className="p-1.5 rounded-lg transition-colors"
              style={{ background: 'rgba(185,28,28,.08)', color: 'rgba(248,113,113,.5)' }}
              title="Delete record"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <>
      {showAdd && (
        <AddOfficerModal
          onClose={() => setShowAdd(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['admin-officers'] })}
          positions={positions}
        />
      )}
      {editingOfficer && (
        <EditOfficerModal
          officer={editingOfficer}
          onClose={() => setEditingOfficer(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['admin-officers'] })}
          positions={positions}
        />
      )}

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white font-['Oxanium']">Officers</h2>
            <p className="text-xs text-white/40">{active.length} active, {inactive.length} past</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSeedFromStatic}
              disabled={seeding || isLoading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-40"
              style={{ background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.6)', border: '1px solid rgba(255,255,255,.08)' }}
              title="Pre-fill missing photos & LinkedIn from built-in officer data"
            >
              <Sprout size={13} />
              {seeding ? 'Seeding…' : 'Seed from static data'}
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ background: 'rgba(185,28,28,.6)', boxShadow: '0 0 20px rgba(185,28,28,.2)' }}
            >
              <Plus size={14} /> Add Officer
            </button>
          </div>
        </div>

        <div className="rounded-xl overflow-hidden" style={cardStyle}>
          {isLoading ? (
            <div className="p-8 text-center text-white/40 text-sm">Loading…</div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-red-400">
              Failed to load officers{(error as { status?: number })?.status ? ` (${(error as { status?: number }).status})` : ''}: {error instanceof Error ? error.message : 'Unknown error'}
            </div>
          ) : !officers.length ? (
            <div className="p-8 text-center text-white/40 text-sm">No officers found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(185,28,28,.15)' }}>
                    {['Officer', 'Role', 'Position', 'Joined', 'End Date', 'Actions'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs text-white/40 uppercase tracking-wide font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {active.map((o) => <OfficerRow key={o.student_id} o={o} />)}
                  {inactive.length > 0 && (
                    <>
                      <tr>
                        <td colSpan={6} className="px-4 py-2 text-xs text-white/30 uppercase tracking-wide bg-white/[0.01]">
                          Past Officers
                        </td>
                      </tr>
                      {inactive.map((o) => <OfficerRow key={o.student_id} o={o} />)}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Position Titles Management */}
        <div className="rounded-xl overflow-hidden" style={cardStyle}>
          <button
            onClick={() => setPositionsOpen((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Tags size={15} className="text-red-400" />
              <span className="text-sm font-semibold text-white font-['Oxanium']">Position Titles</span>
              <span className="text-xs text-white/30">{positions.length} titles</span>
            </div>
            {positionsOpen ? <ChevronDown size={15} className="text-white/40" /> : <ChevronRight size={15} className="text-white/40" />}
          </button>

          {positionsOpen && (
            <div className="border-t px-5 pb-5 pt-4 flex flex-col gap-4" style={{ borderColor: 'rgba(185,28,28,.15)' }}>
              {/* Add new position form */}
              <div className="flex flex-col gap-2">
                <p className="text-xs text-white/40 font-medium">Add new position</p>
                <div className="flex gap-2 flex-wrap">
                  <input
                    type="text"
                    placeholder="Title (e.g. Marketing Director)"
                    value={newPosTitle}
                    onChange={(e) => setNewPosTitle(e.target.value)}
                    className="flex-1 min-w-[180px] rounded-lg px-3 py-2 text-sm"
                    style={inputStyle}
                  />
                  <input
                    type="text"
                    placeholder="Department (e.g. Marketing)"
                    value={newPosDept}
                    onChange={(e) => setNewPosDept(e.target.value)}
                    className="flex-1 min-w-[150px] rounded-lg px-3 py-2 text-sm"
                    style={inputStyle}
                  />
                  <input
                    type="number"
                    placeholder="Sort order"
                    value={newPosSortOrder}
                    onChange={(e) => setNewPosSortOrder(e.target.value)}
                    className="w-28 rounded-lg px-3 py-2 text-sm"
                    style={inputStyle}
                  />
                  <button
                    onClick={async () => {
                      if (!newPosTitle.trim()) return;
                      setAddingPos(true);
                      setPosError('');
                      try {
                        await apiPost('/admin/officer-positions', {
                          title: newPosTitle.trim(),
                          department: newPosDept.trim(),
                          sort_order: newPosSortOrder ? Number(newPosSortOrder) : 0,
                        });
                        setNewPosTitle('');
                        setNewPosDept('');
                        setNewPosSortOrder('');
                        qc.invalidateQueries({ queryKey: ['admin-officer-positions'] });
                      } catch (err: any) {
                        setPosError(err?.message ?? 'Failed to create position');
                      } finally {
                        setAddingPos(false);
                      }
                    }}
                    disabled={addingPos || !newPosTitle.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
                    style={{ background: 'rgba(185,28,28,.6)' }}
                  >
                    <Plus size={13} />
                    {addingPos ? 'Adding…' : 'Add'}
                  </button>
                </div>
                {posError && <p className="text-red-400 text-xs">{posError}</p>}
              </div>

              {/* Existing positions list */}
              <div className="flex flex-col divide-y" style={{ borderColor: 'rgba(255,255,255,.04)' }}>
                {Object.entries(
                  positions.reduce<Record<string, OfficerPosition[]>>((acc, p) => {
                    (acc[p.department || 'Ungrouped'] ??= []).push(p);
                    return acc;
                  }, {})
                ).map(([dept, deptPositions]) => (
                  <div key={dept} className="py-3 first:pt-0">
                    <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-2">{dept || 'Ungrouped'}</p>
                    <div className="flex flex-col gap-1">
                      {deptPositions.map((p) => (
                        <div key={p.position_id} className="flex items-center justify-between gap-3 group">
                          {editingPos?.position_id === p.position_id ? (
                            <div className="flex gap-2 flex-1 flex-wrap">
                              <input
                                type="text"
                                value={editPosTitle}
                                onChange={(e) => setEditPosTitle(e.target.value)}
                                className="flex-1 min-w-[140px] rounded-lg px-2 py-1 text-sm"
                                style={inputStyle}
                              />
                              <input
                                type="text"
                                value={editPosDept}
                                onChange={(e) => setEditPosDept(e.target.value)}
                                className="flex-1 min-w-[120px] rounded-lg px-2 py-1 text-sm"
                                style={inputStyle}
                              />
                              <input
                                type="number"
                                value={editPosSortOrder}
                                onChange={(e) => setEditPosSortOrder(e.target.value)}
                                className="w-20 rounded-lg px-2 py-1 text-sm"
                                style={inputStyle}
                              />
                              <div className="flex gap-1">
                                <button
                                  onClick={async () => {
                                    setSavingPos(true);
                                    setEditPosError('');
                                    try {
                                      await apiPatch(`/admin/officer-positions/${p.position_id}`, {
                                        title: editPosTitle.trim(),
                                        department: editPosDept.trim(),
                                        sort_order: Number(editPosSortOrder),
                                      });
                                      setEditingPos(null);
                                      qc.invalidateQueries({ queryKey: ['admin-officer-positions'] });
                                    } catch (err: any) {
                                      setEditPosError(err?.message ?? 'Save failed');
                                    } finally {
                                      setSavingPos(false);
                                    }
                                  }}
                                  disabled={savingPos}
                                  className="px-3 py-1 rounded-lg text-xs font-medium text-white disabled:opacity-40"
                                  style={{ background: 'rgba(185,28,28,.6)' }}
                                >
                                  {savingPos ? '…' : 'Save'}
                                </button>
                                <button
                                  onClick={() => setEditingPos(null)}
                                  className="px-2 py-1 rounded-lg text-xs text-white/50"
                                  style={{ background: 'rgba(255,255,255,.06)' }}
                                >
                                  Cancel
                                </button>
                              </div>
                              {editPosError && <p className="text-red-400 text-xs w-full">{editPosError}</p>}
                            </div>
                          ) : (
                            <>
                              <span className="text-sm text-white/80">{p.title}</span>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => {
                                    setEditingPos(p);
                                    setEditPosTitle(p.title);
                                    setEditPosDept(p.department);
                                    setEditPosSortOrder(String(p.sort_order ?? 0));
                                    setEditPosError('');
                                  }}
                                  className="p-1 rounded text-white/40 hover:text-white transition-colors"
                                  title="Edit"
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!confirm(`Delete position "${p.title}"?`)) return;
                                    try {
                                      await apiDelete(`/admin/officer-positions/${p.position_id}`);
                                      qc.invalidateQueries({ queryKey: ['admin-officer-positions'] });
                                    } catch (err: any) {
                                      alert(err?.message ?? 'Delete failed');
                                    }
                                  }}
                                  className="p-1 rounded transition-colors"
                                  style={{ color: 'rgba(248,113,113,.5)' }}
                                  title="Delete"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
