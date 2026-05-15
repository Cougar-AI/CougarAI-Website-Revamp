import { useRef, useState } from "react";
import { Camera, Link2 } from "lucide-react";
import { apiPatch, apiPost, apiUpload } from "@/lib/api";
import type { MeResponse } from "@/pages/Dashboard";

const BACKEND = import.meta.env.VITE_BACKEND_API_URL ?? "http://localhost:5001";

interface Props {
  meData?: MeResponse;
  onRefresh: () => void;
}

export default function ProfileTab({ meData, onRefresh }: Props) {
  if (!meData) return null;

  if (!meData.has_profile) {
    return <LinkAccountPrompt onRefresh={onRefresh} />;
  }

  return <ProfileEditor meData={meData} onRefresh={onRefresh} />;
}

function LinkAccountPrompt({ onRefresh }: { onRefresh: () => void }) {
  const [studentId, setStudentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLink(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await apiPost("/dashboard/profile/link", { student_id: studentId.trim() });
      onRefresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not link account");
      setSaving(false);
    }
  }

  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(185,28,28,.22)" }}
    >
      <div className="mb-4 flex items-center gap-3">
        <Link2 size={20} className="text-red-400" />
        <h2 className="font-['Oxanium'] text-lg font-semibold text-white">Link CougarAI Account</h2>
      </div>
      <p className="mb-5 text-sm text-white/50">
        Enter your UH student ID to connect your event points and check-in history.
      </p>
      <form onSubmit={handleLink} className="space-y-3">
        <input
          className="w-full rounded-xl bg-white/5 px-3 py-2 text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-red-600/60 placeholder:text-white/30"
          placeholder="1234567"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
        />
        {error && (
          <p className="text-sm text-rose-300">{error}</p>
        )}
        <button
          type="submit"
          disabled={saving || !studentId.trim()}
          className="w-full rounded-xl bg-red-700 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50"
          style={{ boxShadow: "0 0 20px rgba(185,28,28,.35)" }}
        >
          {saving ? "Linking…" : "Link Account"}
        </button>
      </form>
      <p className="mt-3 text-xs text-white/30">
        Don't have a student ID? You can still use the dashboard — some features require linking.
      </p>
    </div>
  );
}

function ProfileEditor({ meData, onRefresh }: { meData: MeResponse; onRefresh: () => void }) {
  const profile = meData.profile!;
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    first_name: profile.first_name ?? "",
    last_name: profile.last_name ?? "",
    preferred_email: profile.preferred_email ?? "",
    grade_level: profile.grade_level ?? "",
    major: profile.major ?? "",
    shirt_size: profile.shirt_size ?? "",
    discord_id: profile.discord_id ?? "",
    is_public: profile.is_public,
    notification_settings: { ...profile.notification_settings } as Record<string, boolean>,
  });

  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const avatarUrl = profile.avatar_url ? `${BACKEND}${profile.avatar_url}` : null;
  const initials = `${(profile.first_name?.[0] ?? "").toUpperCase()}${(profile.last_name?.[0] ?? "").toUpperCase()}` || "?";

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("avatar", file);
    setUploadingAvatar(true);
    try {
      await apiUpload("/dashboard/avatar", fd);
      onRefresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await apiPatch("/dashboard/profile", {
        first_name: form.first_name.trim() || null,
        last_name: form.last_name.trim() || null,
        preferred_email: form.preferred_email.trim() || null,
        grade_level: form.grade_level || null,
        major: form.major.trim() || null,
        shirt_size: form.shirt_size || null,
        discord_id: form.discord_id.trim() || null,
        is_public: form.is_public,
        notification_settings: form.notification_settings,
      });
      onRefresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(185,28,28,.22)" }}
    >
      <h2 className="mb-5 font-['Oxanium'] text-lg font-semibold text-white">Profile</h2>

      {/* Avatar */}
      <div className="mb-6 flex items-center gap-4">
        <div className="relative">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full text-xl font-semibold text-white"
            style={{
              background: avatarUrl ? "transparent" : "rgba(185,28,28,.35)",
              border: "2px solid rgba(185,28,28,.4)",
              overflow: "hidden",
            }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploadingAvatar}
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-red-700 text-white transition hover:bg-red-800 disabled:opacity-60"
            title="Upload photo"
          >
            <Camera size={13} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>
        <div>
          <p className="text-sm font-medium text-white">{profile.first_name} {profile.last_name}</p>
          {profile.student_id && (
            <p className="text-xs text-white/40">UH ID: {profile.student_id}</p>
          )}
          {uploadingAvatar && <p className="text-xs text-red-400">Uploading…</p>}
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First name" value={form.first_name} onChange={(v) => setForm({ ...form, first_name: v })} placeholder="Jane" />
          <Field label="Last name" value={form.last_name} onChange={(v) => setForm({ ...form, last_name: v })} placeholder="Smith" />
        </div>

        <Field label="Preferred email" value={form.preferred_email} onChange={(v) => setForm({ ...form, preferred_email: v })} placeholder="jane@example.com" type="email" />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-white/80">Grade level</label>
            <select
              className="w-full rounded-xl bg-white/5 px-3 py-2 text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-red-600/60"
              value={form.grade_level}
              onChange={(e) => setForm({ ...form, grade_level: e.target.value })}
              style={{ colorScheme: "dark" }}
            >
              <option value="">Select…</option>
              {["freshman","sophomore","junior","senior","graduate","other"].map((g) => (
                <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-white/80">Shirt size</label>
            <select
              className="w-full rounded-xl bg-white/5 px-3 py-2 text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-red-600/60"
              value={form.shirt_size}
              onChange={(e) => setForm({ ...form, shirt_size: e.target.value })}
              style={{ colorScheme: "dark" }}
            >
              <option value="">Select…</option>
              {["XS","S","M","L","XL","XXL"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <Field label="Major" value={form.major} onChange={(v) => setForm({ ...form, major: v })} placeholder="Computer Science" />
        <div>
          <Field label="Discord ID" value={form.discord_id} onChange={(v) => setForm({ ...form, discord_id: v })} placeholder="username#1234" />
          <p className="mt-1 text-xs text-white/30">Discord OAuth coming soon.</p>
        </div>

        {/* Toggles */}
        <div className="space-y-3 border-t border-white/8 pt-4">
          <ToggleRow
            label="Leaderboard visibility"
            description="Show your name on the public points and streak leaderboards"
            checked={form.is_public}
            onChange={(v) => setForm({ ...form, is_public: v })}
          />
        </div>

        <div className="border-t border-white/8 pt-4">
          <p className="mb-3 text-sm font-medium text-white/80">Email notifications</p>
          <div className="space-y-2">
            {[
              { key: "email_events", label: "Event announcements" },
              { key: "email_newsletter", label: "Club newsletter" },
              { key: "email_announcements", label: "Important announcements" },
            ].map(({ key, label }) => (
              <label key={key} className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={!!form.notification_settings[key]}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      notification_settings: { ...form.notification_settings, [key]: e.target.checked },
                    })
                  }
                  className="h-4 w-4 rounded border-white/20 bg-transparent text-red-600 focus:ring-red-600"
                />
                <span className="text-sm text-white/70">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-rose-300">{error}</p>}
        {saved && <p className="text-sm text-emerald-400">Saved!</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-red-700 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50"
          style={{ boxShadow: "0 0 20px rgba(185,28,28,.35)" }}
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-white/80">{label}</label>
      <input
        type={type}
        className="w-full rounded-xl bg-white/5 px-3 py-2 text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-red-600/60 placeholder:text-white/30"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="mt-0.5 text-xs text-white/40">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="relative mt-0.5 h-6 w-11 flex-shrink-0 rounded-full transition-colors"
        style={{ background: checked ? "#b91c1c" : "rgba(255,255,255,.15)" }}
        role="switch"
        aria-checked={checked}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform"
          style={{ transform: checked ? "translateX(22px)" : "translateX(2px)" }}
        />
      </button>
    </div>
  );
}
