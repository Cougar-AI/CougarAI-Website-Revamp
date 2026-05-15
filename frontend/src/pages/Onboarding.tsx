import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPatch, apiPost } from "@/lib/api";
import { getAccessToken, getStoredUser, persistAuthSession } from "@/lib/auth";
import logo from "../assets/logo.png";

type Step = 1 | 2 | 3;

interface ProfileData {
  first_name: string;
  last_name: string;
  student_id: string;
  grade_level: string;
}

interface PrefData {
  is_public: boolean;
  notification_settings: {
    email_events: boolean;
    email_newsletter: boolean;
    email_announcements: boolean;
  };
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileData>({
    first_name: "",
    last_name: "",
    student_id: "",
    grade_level: "",
  });

  const [prefs, setPrefs] = useState<PrefData>({
    is_public: true,
    notification_settings: {
      email_events: true,
      email_newsletter: true,
      email_announcements: true,
    },
  });

  async function handleFinish() {
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        first_name: profile.first_name.trim() || undefined,
        last_name: profile.last_name.trim() || undefined,
        grade_level: profile.grade_level || undefined,
        is_public: prefs.is_public,
        notification_settings: prefs.notification_settings,
      };
      if (profile.student_id.trim()) {
        payload.student_id = profile.student_id.trim();
      }

      await apiPatch("/dashboard/profile", payload);
      await apiPost("/dashboard/onboarding/complete", {});

      const token = getAccessToken();
      const stored = getStoredUser();
      if (token && stored) {
        const remember = window.localStorage.getItem("access_token") !== null;
        persistAuthSession(token, { ...stored, onboarding_completed: true }, remember);
      }

      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="relative mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-7xl items-center justify-center px-6 py-16">
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl backdrop-blur"
        style={{
          background: "rgba(255,255,255,.04)",
          border: "1px solid rgba(185,28,28,.22)",
          boxShadow: "0 20px 60px rgba(0,0,0,.6)",
        }}
      >
        <div className="h-[3px] bg-gradient-to-r from-red-700 via-red-600 to-red-700" />

        <div className="p-6 sm:p-8">
          {/* Logo + title */}
          <div className="mb-6 text-center">
            <img
              src={logo}
              alt="CougarAI"
              className="mx-auto mb-3 h-10 w-10 rounded-[10px] object-contain"
              style={{ border: "2px solid rgba(185,28,28,.4)", boxShadow: "0 0 20px rgba(185,28,28,.3)" }}
            />
            <h1 className="font-['Oxanium'] text-2xl font-bold text-white">Set up your profile</h1>
            <p className="mt-1 text-sm text-white/50">Just a few steps to get you started.</p>
          </div>

          {/* Step indicators */}
          <div className="mb-8 flex justify-center gap-2">
            {([1, 2, 3] as Step[]).map((s) => (
              <div
                key={s}
                className="h-2 w-8 rounded-full transition-all"
                style={{ background: step === s ? "#b91c1c" : step > s ? "rgba(185,28,28,.4)" : "rgba(255,255,255,.1)" }}
              />
            ))}
          </div>

          {step === 1 && (
            <StepOne profile={profile} onChange={setProfile} onNext={() => setStep(2)} />
          )}
          {step === 2 && (
            <StepTwo prefs={prefs} onChange={setPrefs} onBack={() => setStep(1)} onNext={() => setStep(3)} />
          )}
          {step === 3 && (
            <StepThree
              firstName={profile.first_name.trim() || "there"}
              saving={saving}
              error={error}
              onFinish={handleFinish}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function StepOne({
  profile,
  onChange,
  onNext,
}: {
  profile: ProfileData;
  onChange: (p: ProfileData) => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="font-['Oxanium'] text-lg font-semibold text-white">Profile Setup</h2>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-white/80">First name</label>
          <input
            className="w-full rounded-xl bg-white/5 px-3 py-2 text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-red-600/60 placeholder:text-white/30"
            placeholder="Jane"
            value={profile.first_name}
            onChange={(e) => onChange({ ...profile, first_name: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-white/80">Last name</label>
          <input
            className="w-full rounded-xl bg-white/5 px-3 py-2 text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-red-600/60 placeholder:text-white/30"
            placeholder="Smith"
            value={profile.last_name}
            onChange={(e) => onChange({ ...profile, last_name: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-white/80">
          UH Student ID <span className="text-white/40">(optional)</span>
        </label>
        <input
          className="w-full rounded-xl bg-white/5 px-3 py-2 text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-red-600/60 placeholder:text-white/30"
          placeholder="1234567"
          value={profile.student_id}
          onChange={(e) => onChange({ ...profile, student_id: e.target.value })}
        />
        <p className="mt-1 text-xs text-white/30">Links your profile for event points tracking.</p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-white/80">Grade level</label>
        <select
          className="w-full rounded-xl bg-white/5 px-3 py-2 text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-red-600/60"
          value={profile.grade_level}
          onChange={(e) => onChange({ ...profile, grade_level: e.target.value })}
          style={{ colorScheme: "dark" }}
        >
          <option value="">Select…</option>
          <option value="freshman">Freshman</option>
          <option value="sophomore">Sophomore</option>
          <option value="junior">Junior</option>
          <option value="senior">Senior</option>
          <option value="graduate">Graduate</option>
          <option value="other">Other</option>
        </select>
      </div>

      <button
        onClick={onNext}
        className="mt-2 w-full rounded-xl bg-red-700 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800"
        style={{ boxShadow: "0 0 20px rgba(185,28,28,.35)" }}
      >
        Next →
      </button>
    </div>
  );
}

function StepTwo({
  prefs,
  onChange,
  onBack,
  onNext,
}: {
  prefs: PrefData;
  onChange: (p: PrefData) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const { notification_settings: ns } = prefs;

  function toggleNotif(key: keyof typeof ns) {
    onChange({ ...prefs, notification_settings: { ...ns, [key]: !ns[key] } });
  }

  return (
    <div className="space-y-5">
      <h2 className="font-['Oxanium'] text-lg font-semibold text-white">Preferences</h2>

      <div
        className="flex items-start justify-between gap-4 rounded-xl p-4"
        style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" }}
      >
        <div>
          <p className="text-sm font-medium text-white">Leaderboard visibility</p>
          <p className="mt-0.5 text-xs text-white/40">
            Show your name on the public points and streak leaderboards.
          </p>
        </div>
        <button
          onClick={() => onChange({ ...prefs, is_public: !prefs.is_public })}
          className="relative mt-0.5 h-6 w-11 flex-shrink-0 rounded-full transition-colors"
          style={{ background: prefs.is_public ? "#b91c1c" : "rgba(255,255,255,.15)" }}
          aria-checked={prefs.is_public}
          role="switch"
        >
          <span
            className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform"
            style={{ transform: prefs.is_public ? "translateX(22px)" : "translateX(2px)" }}
          />
        </button>
      </div>

      <div>
        <p className="mb-3 text-sm font-medium text-white">Email notifications</p>
        <div className="space-y-2">
          {[
            { key: "email_events" as const, label: "Event announcements" },
            { key: "email_newsletter" as const, label: "Club newsletter" },
            { key: "email_announcements" as const, label: "Important announcements" },
          ].map(({ key, label }) => (
            <label key={key} className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={ns[key]}
                onChange={() => toggleNotif(key)}
                className="h-4 w-4 rounded border-white/20 bg-transparent text-red-600 focus:ring-red-600"
              />
              <span className="text-sm text-white/70">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 rounded-xl bg-white/10 py-2.5 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          className="flex-1 rounded-xl bg-red-700 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800"
          style={{ boxShadow: "0 0 20px rgba(185,28,28,.35)" }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

function StepThree({
  firstName,
  saving,
  error,
  onFinish,
}: {
  firstName: string;
  saving: boolean;
  error: string | null;
  onFinish: () => void;
}) {
  return (
    <div className="space-y-6 text-center">
      <div>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-900/40 text-4xl ring-2 ring-red-700/40">
          🎉
        </div>
        <h2 className="font-['Oxanium'] text-2xl font-bold text-white">You're all set, {firstName}!</h2>
        <p className="mt-2 text-sm text-white/50">
          Your profile is ready. Start earning points at CougarAI events.
        </p>
      </div>

      <div className="flex justify-center gap-4 text-sm">
        <a
          href="https://discord.com/invite/5Jhw67yQDH"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 transition"
        >
          <span>Join Discord →</span>
        </a>
        <a
          href="/calendar"
          className="flex items-center gap-1.5 text-red-400 hover:text-red-300 transition"
        >
          <span>View Calendar →</span>
        </a>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-900/40 px-3 py-2 text-sm text-rose-200 ring-1 ring-inset ring-rose-500/20">
          {error}
        </div>
      )}

      <button
        onClick={onFinish}
        disabled={saving}
        className="w-full rounded-xl bg-red-700 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-60"
        style={{ boxShadow: "0 0 20px rgba(185,28,28,.35)" }}
      >
        {saving ? "Saving…" : "Go to Dashboard →"}
      </button>
    </div>
  );
}
