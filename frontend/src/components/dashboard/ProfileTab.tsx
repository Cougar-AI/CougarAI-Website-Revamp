import { useEffect, useRef, useState } from "react";
import { Camera, ChevronDown, ChevronUp, Link2, Upload, Move, X as XIcon, Link } from "lucide-react";
import { apiPatch, apiPost, apiUpload } from "@/lib/api";
import type { MeResponse } from "@/pages/Dashboard";

const BACKEND = import.meta.env.VITE_BACKEND_API_URL ?? "http://localhost:5001";
const GRADE_LEVEL_OPTIONS = ["freshman", "sophomore", "junior", "senior", "graduate", "alumni", "other"] as const;

function normalizeGradeLevel(value?: string | null) {
  const normalized = (value || "").trim().toLowerCase();
  return GRADE_LEVEL_OPTIONS.includes(normalized as (typeof GRADE_LEVEL_OPTIONS)[number]) ? normalized : "";
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.014.043.03.055a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

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
    grade_level: normalizeGradeLevel(profile.grade_level),
    major: profile.major ?? "",
    shirt_size: profile.shirt_size ?? "",
    is_public: profile.is_public,
    notification_settings: { ...profile.notification_settings } as Record<string, boolean>,
  });

  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discordBanner, setDiscordBanner] = useState(false);
  const [connectingDiscord, setConnectingDiscord] = useState(false);
  const [disconnectingDiscord, setDisconnectingDiscord] = useState(false);

  // Change password state
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwSent, setPwSent] = useState(false);
  const [pwConfirmBanner, setPwConfirmBanner] = useState<"success" | "error" | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("discord_connected") === "1") {
      setDiscordBanner(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("discord_connected");
      window.history.replaceState({}, "", url.toString());
      setTimeout(() => setDiscordBanner(false), 5000);
    }
    const pwToken = params.get("change_pw_token");
    if (pwToken) {
      const url = new URL(window.location.href);
      url.searchParams.delete("change_pw_token");
      window.history.replaceState({}, "", url.toString());
      fetch(`${BACKEND}/auth/change-password/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: pwToken }),
      })
        .then((r) => setPwConfirmBanner(r.ok ? "success" : "error"))
        .catch(() => setPwConfirmBanner("error"));
    }
    fetch(`${BACKEND}/auth/password-status`, {
      credentials: "include",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token") ?? ""}`,
      },
    })
      .then((r) => r.json())
      .then((d) => setHasPassword(d.has_password ?? false))
      .catch(() => setHasPassword(false));
  }, []);

  async function handleChangePwSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPwErrors({});
    setPwSubmitting(true);
    setPwSent(false);
    try {
      const res = await fetch(`${BACKEND}/auth/change-password/request`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token") ?? ""}`,
        },
        body: JSON.stringify(pwForm),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.field_errors) {
          const flat: Record<string, string> = {};
          for (const [k, v] of Object.entries(data.field_errors)) {
            flat[k] = Array.isArray(v) ? (v as string[]).join(" ") : String(v);
          }
          setPwErrors(flat);
        } else {
          setPwErrors({ _general: data.error ?? "Request failed." });
        }
      } else {
        setPwSent(true);
        setPwForm({ current_password: "", new_password: "", confirm_password: "" });
      }
    } catch {
      setPwErrors({ _general: "Network error. Please try again." });
    } finally {
      setPwSubmitting(false);
    }
  }

  async function handleConnectDiscord() {
    setConnectingDiscord(true);
    try {
      const res = await fetch(`${BACKEND}/auth/discord/connect-start`, {
        method: "POST",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token") ?? ""}`,
        },
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      setError("Could not start Discord connection. Please try again.");
    } finally {
      setConnectingDiscord(false);
    }
  }

  async function handleDisconnectDiscord() {
    setDisconnectingDiscord(true);
    try {
      await apiPatch("/dashboard/profile", { discord_id: null, discord_username: null });
      onRefresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setDisconnectingDiscord(false);
    }
  }

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
        grade_level: normalizeGradeLevel(form.grade_level) || null,
        major: form.major.trim() || null,
        shirt_size: form.shirt_size || null,
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

      {discordBanner && (
        <div className="mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm text-emerald-300" style={{ background: "rgba(16,185,129,.12)", border: "1px solid rgba(16,185,129,.25)" }}>
          <DiscordIcon />
          Discord connected successfully!
        </div>
      )}

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
        {/* Read-only account email + student ID */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Account email", value: meData.email },
            { label: "Student ID", value: profile.student_id || "—" },
          ].map(({ label, value }) => (
            <div key={label}>
              <label className="mb-1 block text-sm font-medium text-white/80">{label}</label>
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2"
                style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)" }}
              >
                <span className="flex-1 truncate text-sm text-white/40">{value}</span>
                <span className="text-xs text-white/20">🔒</span>
              </div>
            </div>
          ))}
        </div>
        <p className="-mt-2 text-xs text-white/25">Contact an admin to change these.</p>

        {/* Preferred email (editable — used for notifications) */}
        <Field
          label="Preferred email"
          value={form.preferred_email}
          onChange={(v) => setForm({ ...form, preferred_email: v })}
          placeholder="jane@example.com"
          type="email"
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First name" value={form.first_name} onChange={(v) => setForm({ ...form, first_name: v })} placeholder="Jane" />
          <Field label="Last name" value={form.last_name} onChange={(v) => setForm({ ...form, last_name: v })} placeholder="Smith" />
        </div>

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
              {GRADE_LEVEL_OPTIONS.map((g) => (
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

        {/* Discord connection */}
        <div>
          <label className="mb-1 block text-sm font-medium text-white/80">Discord</label>
          {profile.discord_id ? (
            <div
              className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5"
              style={{ background: "rgba(88,101,242,.12)", border: "1px solid rgba(88,101,242,.3)" }}
            >
              <div className="flex items-center gap-2 text-[#7289da]">
                <DiscordIcon />
                <div>
                  <p className="text-sm font-medium text-white">
                    {profile.discord_username ? `@${profile.discord_username}` : "Connected"}
                  </p>
                  <p className="text-xs text-white/40">ID: {profile.discord_id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDisconnectDiscord}
                disabled={disconnectingDiscord}
                className="rounded-lg px-3 py-1 text-xs text-white/50 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
              >
                {disconnectingDiscord ? "Disconnecting…" : "Disconnect"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConnectDiscord}
              disabled={connectingDiscord}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium text-white transition disabled:opacity-50"
              style={{ background: "#5865F2" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#4752c4")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#5865F2")}
            >
              <DiscordIcon />
              {connectingDiscord ? "Redirecting…" : "Connect Discord"}
            </button>
          )}
        </div>

        {/* Officer Appearance — only for officer/admin */}
        {(meData.role === "officer" || meData.role === "admin") && (
          <div className="border-t border-white/8 pt-4">
            <OfficerAppearanceSection onRefresh={onRefresh} />
          </div>
        )}

        {/* Change / Set Password */}
        <div className="border-t border-white/8 pt-4">
          {pwConfirmBanner === "success" && (
            <div className="mb-3 rounded-xl px-4 py-3 text-sm text-emerald-300" style={{ background: "rgba(16,185,129,.12)", border: "1px solid rgba(16,185,129,.25)" }}>
              Password updated successfully!
            </div>
          )}
          {pwConfirmBanner === "error" && (
            <div className="mb-3 rounded-xl px-4 py-3 text-sm text-rose-300" style={{ background: "rgba(220,38,38,.1)", border: "1px solid rgba(220,38,38,.25)" }}>
              Confirmation link is invalid or expired. Please try again.
            </div>
          )}
          <button
            type="button"
            onClick={() => { setPwOpen((o) => !o); setPwSent(false); setPwErrors({}); }}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-white transition hover:bg-white/5"
            style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)" }}
          >
            <span>{hasPassword === false ? "Set a Password" : "Change Password"}</span>
            {pwOpen ? <ChevronUp size={16} className="text-white/40" /> : <ChevronDown size={16} className="text-white/40" />}
          </button>

          {pwOpen && (
            <div className="mt-3">
              {pwSent ? (
                <p className="rounded-xl px-4 py-3 text-sm text-emerald-300" style={{ background: "rgba(16,185,129,.12)", border: "1px solid rgba(16,185,129,.25)" }}>
                  A confirmation link has been sent to your email. Click it within 30 minutes to finalize your password change.
                </p>
              ) : (
                <form onSubmit={handleChangePwSubmit} className="space-y-3">
                  {hasPassword && (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-white/80">Current Password</label>
                      <input
                        type="password"
                        autoComplete="current-password"
                        className="w-full rounded-xl bg-white/5 px-3 py-2 text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-red-600/60 placeholder:text-white/30"
                        value={pwForm.current_password}
                        onChange={(e) => setPwForm({ ...pwForm, current_password: e.target.value })}
                      />
                      {pwErrors.current_password && <p className="mt-1 text-xs text-rose-300">{pwErrors.current_password}</p>}
                    </div>
                  )}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-white/80">New Password</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      className="w-full rounded-xl bg-white/5 px-3 py-2 text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-red-600/60 placeholder:text-white/30"
                      value={pwForm.new_password}
                      onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })}
                    />
                    {pwErrors.new_password && <p className="mt-1 text-xs text-rose-300">{pwErrors.new_password}</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-white/80">Confirm New Password</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      className="w-full rounded-xl bg-white/5 px-3 py-2 text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-red-600/60 placeholder:text-white/30"
                      value={pwForm.confirm_password}
                      onChange={(e) => setPwForm({ ...pwForm, confirm_password: e.target.value })}
                    />
                    {pwErrors.confirm_password && <p className="mt-1 text-xs text-rose-300">{pwErrors.confirm_password}</p>}
                  </div>
                  <p className="text-xs text-white/30">8+ characters · uppercase · lowercase · number · symbol</p>
                  {pwErrors._general && <p className="text-sm text-rose-300">{pwErrors._general}</p>}
                  <button
                    type="submit"
                    disabled={pwSubmitting}
                    className="w-full rounded-xl bg-red-700 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50"
                    style={{ boxShadow: "0 0 20px rgba(185,28,28,.35)" }}
                  >
                    {pwSubmitting ? "Sending…" : "Send Confirmation Email"}
                  </button>
                </form>
              )}
            </div>
          )}
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

function validateLinkedin(url: string): string {
  if (!url) return "";
  if (!url.startsWith("https://linkedin.com") && !url.startsWith("https://www.linkedin.com")) {
    return "Must be a valid LinkedIn URL (https://linkedin.com/in/...)";
  }
  return "";
}

function resolveOfficerPhoto(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("/admin/uploads/")) return `${BACKEND}${url}`;
  return url;
}

function OfficerAppearanceSection({ onRefresh }: { onRefresh: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoObjectPosition, setPhotoObjectPosition] = useState("50% 50%");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [cropMode, setCropMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [useAsAvatar, setUseAsAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkedinError = validateLinkedin(linkedinUrl);

  async function loadCurrent() {
    if (loaded) return;
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/admin/officers/self`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token") ?? ""}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPhotoUrl(data.photo_url ?? null);
        setPhotoObjectPosition(data.photo_object_position ?? "50% 50%");
        setLinkedinUrl(data.linkedin_url ?? "");
      }
      setLoaded(true);
    } catch {
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }

  function handleToggle() {
    setOpen((v) => {
      if (!v) loadCurrent();
      return !v;
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${BACKEND}/admin/officers/self/photo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token") ?? ""}` },
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setPhotoUrl(json.url);
      setPhotoObjectPosition("50% 50%");
      setCropMode(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleCropClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    setPhotoObjectPosition(`${x}% ${y}%`);
  }

  const focalX = parseFloat(photoObjectPosition.split(" ")[0]);
  const focalY = parseFloat(photoObjectPosition.split(" ")[1]);

  async function handleSave() {
    if (linkedinError) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await fetch(`${BACKEND}/admin/officers/self`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token") ?? ""}`,
        },
        body: JSON.stringify({
          photo_url: photoUrl ?? null,
          photo_object_position: photoObjectPosition,
          linkedin_url: linkedinUrl || null,
        }),
      }).then((r) => { if (!r.ok) throw new Error("Save failed"); });

      if (useAsAvatar && photoUrl) {
        await apiPatch("/dashboard/profile", { avatar_url: photoUrl });
        onRefresh();
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const resolvedPhoto = resolveOfficerPhoto(photoUrl);

  return (
    <div>
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-white transition hover:bg-white/5"
        style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)" }}
      >
        <span>Officer Appearance</span>
        {open ? <ChevronUp size={16} className="text-white/40" /> : <ChevronDown size={16} className="text-white/40" />}
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          {loading ? (
            <p className="text-xs text-white/40">Loading…</p>
          ) : (
            <>
              {/* Photo */}
              <div>
                <p className="mb-2 text-sm font-medium text-white/80">Headshot (shown on About page)</p>
                {resolvedPhoto ? (
                  <div className="flex gap-4 items-start">
                    <div
                      className="relative rounded-xl overflow-hidden shrink-0"
                      style={{
                        width: 100, height: 100,
                        cursor: cropMode ? "crosshair" : "default",
                        border: cropMode ? "2px solid rgba(248,113,113,.6)" : "1px solid rgba(185,28,28,.3)",
                      }}
                      onClick={cropMode ? handleCropClick : undefined}
                    >
                      <img
                        src={resolvedPhoto}
                        alt=""
                        draggable={false}
                        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: photoObjectPosition }}
                      />
                      {cropMode && (
                        <div
                          style={{
                            position: "absolute",
                            left: `${focalX}%`, top: `${focalY}%`,
                            transform: "translate(-50%, -50%)",
                            width: 10, height: 10,
                            borderRadius: "50%",
                            background: "#fff",
                            border: "2px solid rgba(0,0,0,.5)",
                            pointerEvents: "none",
                          }}
                        />
                      )}
                      {cropMode && (
                        <div style={{
                          position: "absolute", inset: 0,
                          background: "rgba(248,113,113,.08)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          pointerEvents: "none",
                        }}>
                          <span style={{ fontSize: 9, color: "rgba(255,255,255,.6)", fontFamily: "Oxanium,sans-serif" }}>
                            Click to reposition
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 flex-1">
                      <button
                        type="button"
                        onClick={() => setCropMode((v) => !v)}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
                        style={{
                          background: cropMode ? "rgba(185,28,28,.3)" : "rgba(255,255,255,.07)",
                          color: cropMode ? "rgba(248,113,113,.9)" : "rgba(255,255,255,.6)",
                          border: "1px solid rgba(255,255,255,.08)",
                        }}
                      >
                        <Move size={11} />
                        {cropMode ? "Done Repositioning" : "Reposition Focal Point"}
                      </button>
                      <label className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs cursor-pointer"
                        style={{ background: "rgba(255,255,255,.07)", color: "rgba(255,255,255,.6)", border: "1px solid rgba(255,255,255,.08)" }}>
                        <Upload size={11} />
                        {uploading ? "Uploading…" : "Replace Photo"}
                        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleFileChange} />
                      </label>
                      <button
                        type="button"
                        onClick={() => { setPhotoUrl(null); setPhotoObjectPosition("50% 50%"); setCropMode(false); }}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
                        style={{ background: "rgba(185,28,28,.1)", color: "rgba(248,113,113,.6)", border: "1px solid rgba(185,28,28,.2)" }}
                      >
                        <XIcon size={11} /> Remove Photo
                      </button>
                    </div>
                  </div>
                ) : (
                  <label
                    className="flex items-center gap-2 rounded-xl px-4 py-3 cursor-pointer w-fit"
                    style={{ background: "rgba(255,255,255,.05)", border: "1px dashed rgba(185,28,28,.3)", color: "rgba(255,255,255,.5)" }}
                  >
                    <Upload size={14} />
                    <span className="text-sm">{uploading ? "Uploading…" : "Upload Headshot"}</span>
                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleFileChange} />
                  </label>
                )}
              </div>

              {/* Use as avatar checkbox */}
              {photoUrl && (
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={useAsAvatar}
                    onChange={(e) => setUseAsAvatar(e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-transparent text-red-600 focus:ring-red-600"
                  />
                  <span className="text-sm text-white/70">Also use this photo as my profile avatar</span>
                </label>
              )}

              {/* LinkedIn */}
              <div>
                <label className="mb-1 flex items-center gap-1 text-sm font-medium text-white/80">
                  <Link size={12} /> LinkedIn URL
                </label>
                <input
                  type="url"
                  placeholder="https://linkedin.com/in/username"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  className="w-full rounded-xl bg-white/5 px-3 py-2 text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-red-600/60 placeholder:text-white/30"
                />
                {linkedinError && <p className="mt-1 text-xs text-rose-300">{linkedinError}</p>}
              </div>

              {error && <p className="text-sm text-rose-300">{error}</p>}
              {saved && <p className="text-sm text-emerald-400">Officer profile saved!</p>}

              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !!linkedinError}
                className="w-full rounded-xl bg-red-700 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50"
                style={{ boxShadow: "0 0 20px rgba(185,28,28,.35)" }}
              >
                {saving ? "Saving…" : "Save Officer Profile"}
              </button>
            </>
          )}
        </div>
      )}
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
        className="relative mt-0.5 h-6 w-11 flex-shrink-0 overflow-hidden rounded-full transition-colors"
        style={{ background: checked ? "#b91c1c" : "rgba(255,255,255,.15)" }}
        role="switch"
        aria-checked={checked}
      >
        <span
          className="absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white transition-transform"
          style={{ transform: checked ? "translateX(22px)" : "translateX(2px)" }}
        />
      </button>
    </div>
  );
}
