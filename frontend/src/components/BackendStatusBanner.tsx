import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { getBackendBaseUrl } from '@/lib/backend';

const HEALTH_URL = `${getBackendBaseUrl()}/health`;
const REQUEST_TIMEOUT_MS = 5_000;

export default function BackendStatusBanner() {
  const [isBackendOnline, setIsBackendOnline] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const checkBackend = async () => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      setIsChecking(true);

      try {
        const response = await fetch(HEALTH_URL, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
        });

        if (response.status === 429) {
          if (isMounted) {
            setIsBackendOnline(true);
          }
          return;
        }

        if (!response.ok) {
          throw new Error(`health_${response.status}`);
        }

        const payload = await response.json().catch(() => null) as { status?: string } | null;
        if (payload?.status !== 'ok') {
          throw new Error('health_unhealthy');
        }

        if (isMounted) {
          setIsBackendOnline(true);
        }
      } catch {
        if (isMounted) {
          setIsBackendOnline(false);
        }
      } finally {
        window.clearTimeout(timeoutId);
        if (isMounted) {
          setIsChecking(false);
        }
      }
    };

    void checkBackend();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isBackendOnline !== false) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="relative z-[110] border-b border-amber-400/30 bg-gradient-to-r from-amber-950 via-red-950 to-amber-950 px-4 py-3 text-amber-50 shadow-[0_8px_30px_rgba(0,0,0,.35)]"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-amber-200 ring-1 ring-amber-300/30">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div className="space-y-0.5">
            <p className="font-['Oxanium'] text-sm font-semibold uppercase tracking-[0.18em] text-amber-100">
              Backend unavailable
            </p>
            <p className="text-sm text-amber-50/90">
              Some features will not work as intended as we are undergoing maintenance. Please come back later.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => window.location.reload()}
          disabled={isChecking}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-amber-200/20 bg-white/10 px-4 py-2 text-sm font-medium text-amber-50 transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={isChecking ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          {isChecking ? 'Checking...' : 'Retry'}
        </button>
      </div>
    </div>
  );
}