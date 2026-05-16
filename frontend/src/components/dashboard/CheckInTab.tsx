import { useState, useEffect, useRef } from "react";
import { QrCode, CheckCircle, Camera, X } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { apiPost } from "@/lib/api";
import type { MeResponse } from "@/pages/Dashboard";

interface Props {
  meData?: MeResponse;
  onRefresh: () => void;
}

interface CheckInResponse {
  event_name: string;
  points_awarded: number;
  total_points: number;
}

export default function CheckInTab({ meData, onRefresh }: Props) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckInResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!scanning) return;

    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (text) => {
          let extracted = text.trim().toUpperCase();
          try {
            const url = new URL(text);
            const param = url.searchParams.get("code");
            if (param) extracted = param.toUpperCase();
          } catch {
            // not a URL — use raw text
          }
          scanner.stop().catch(() => {});
          scannerRef.current = null;
          setScanning(false);
          setCode(extracted);
        },
        () => {}
      )
      .catch(() => {
        setError("Camera access denied or unavailable.");
        setScanning(false);
      });

    return () => {
      scanner.stop().catch(() => {});
    };
  }, [scanning]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await apiPost<CheckInResponse>("/events/checkin", { code: trimmed });
      setResult(data);
      setCode("");
      onRefresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Check-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(185,28,28,.22)" }}
    >
      <div className="mb-5 flex items-center gap-3">
        <QrCode size={20} className="text-red-400" />
        <h2 className="font-['Oxanium'] text-lg font-semibold text-white">Event Check-In</h2>
      </div>

      {!meData?.has_profile && (
        <div className="mb-4 rounded-xl bg-yellow-900/20 px-4 py-3 text-sm text-yellow-300 ring-1 ring-yellow-700/30">
          Link your CougarAI profile in the Profile tab to check in to events.
        </div>
      )}

      <p className="mb-5 text-sm text-white/50">
        Enter the event code announced by your officer to earn points.
      </p>

      {result ? (
        <div
          className="flex flex-col items-center gap-3 rounded-2xl py-10 text-center"
          style={{
            background: "rgba(34,197,94,.06)",
            border: "1px solid rgba(34,197,94,.2)",
            animation: "scale-in 0.2s ease-out",
          }}
        >
          <CheckCircle size={40} className="text-emerald-400" />
          <p className="font-['Oxanium'] text-xl font-bold text-white">
            +{result.points_awarded} points!
          </p>
          <p className="text-sm text-white/60">
            Checked in to <span className="text-white">{result.event_name}</span>
          </p>
          <p className="text-xs text-white/40">Total points: {result.total_points}</p>
          <button
            onClick={() => setResult(null)}
            className="mt-2 rounded-xl bg-white/10 px-5 py-2 text-sm font-medium text-white ring-1 ring-white/15 transition hover:bg-white/15"
          >
            Check in to another event
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/80">Event code</label>
            <input
              className="w-full rounded-xl bg-white/5 px-3 py-3 text-center font-['Oxanium'] text-lg uppercase tracking-widest text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-red-600/60 placeholder:text-white/20 placeholder:text-base placeholder:tracking-normal"
              placeholder="WKSHP42"
              value={code}
              maxLength={12}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              disabled={loading || !meData?.has_profile}
            />
          </div>

          {/* QR camera scanner */}
          {scanning ? (
            <div className="relative overflow-hidden rounded-xl" style={{ border: "1px solid rgba(185,28,28,.3)" }}>
              <div id="qr-reader" className="w-full" />
              <button
                type="button"
                onClick={() => setScanning(false)}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white/70 transition hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setError(null); setScanning(true); }}
              disabled={!meData?.has_profile}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-white/70 transition hover:text-white disabled:opacity-40"
              style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)" }}
            >
              <Camera size={16} />
              Scan QR Code
            </button>
          )}

          {error && (
            <div className="rounded-lg bg-rose-900/40 px-3 py-2 text-sm text-rose-200 ring-1 ring-inset ring-rose-500/20">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !code.trim() || !meData?.has_profile}
            className="w-full rounded-xl bg-red-700 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50"
            style={{ boxShadow: "0 0 20px rgba(185,28,28,.35)" }}
          >
            {loading ? "Checking in…" : "Check In"}
          </button>
        </form>
      )}
    </div>
  );
}
