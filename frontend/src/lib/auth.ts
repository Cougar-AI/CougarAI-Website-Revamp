export type StoredUser = {
  user_id: number;
  email: string;
  role?: string;
  onboarding_completed?: boolean;
  provider?: "google" | "microsoft" | "discord" | "credentials";
};

const AUTH_EVENT = "cougarai-auth-changed";
const AUTH_NOTICE_KEY = "cougarai-auth-notice";
const PENDING_CHECKIN_CODE_KEY = "cougarai:pendingCheckinCode";
// Defense-in-depth: a pending check-in code left over from an abandoned scan
// (user never mounted /checkin, so nothing ever cleared it) should not be
// usable indefinitely. Bound its lifetime so a stale code can't resurface
// during some unrelated future login.
const PENDING_CHECKIN_CODE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function preferredStore(remember: boolean) {
  return remember ? window.localStorage : window.sessionStorage;
}

export function persistAuthSession(token: string, user: StoredUser, remember: boolean) {
  try {
    preferredStore(remember).setItem("access_token", token);
    preferredStore(remember).setItem("user", JSON.stringify(user));
    const otherStore = remember ? window.sessionStorage : window.localStorage;
    otherStore.removeItem("access_token");
    otherStore.removeItem("user");
  } catch {
    // Ignore storage failures.
  }
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function replaceAccessToken(token: string) {
  try {
    if (window.localStorage.getItem("access_token")) {
      window.localStorage.setItem("access_token", token);
    }
    if (window.sessionStorage.getItem("access_token")) {
      window.sessionStorage.setItem("access_token", token);
    }
  } catch {
    // Ignore storage failures.
  }
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function clearAuthSession() {
  try {
    window.localStorage.removeItem("access_token");
    window.localStorage.removeItem("user");
    window.sessionStorage.removeItem("access_token");
    window.sessionStorage.removeItem("user");
  } catch {
    // Ignore storage failures.
  }
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function getStoredUser(): StoredUser | null {
  const raw = window.localStorage.getItem("user") ?? window.sessionStorage.getItem("user");
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function updateStoredUser(user: StoredUser) {
  try {
    const store = window.localStorage.getItem("access_token") ? window.localStorage : window.sessionStorage;
    store.setItem("user", JSON.stringify(user));
  } catch {
    // Ignore storage failures.
  }
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function hasAccessToken() {
  return Boolean(window.localStorage.getItem("access_token") ?? window.sessionStorage.getItem("access_token"));
}

export function getAccessToken(): string | null {
  return window.localStorage.getItem("access_token") ?? window.sessionStorage.getItem("access_token");
}

export function subscribeToAuthChanges(onChange: () => void) {
  const handler = () => onChange();
  window.addEventListener(AUTH_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(AUTH_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function setAuthNotice(message: string) {
  try {
    window.sessionStorage.setItem(AUTH_NOTICE_KEY, message);
  } catch {
    // Ignore storage failures.
  }
}

export function consumeAuthNotice() {
  try {
    const message = window.sessionStorage.getItem(AUTH_NOTICE_KEY);
    if (!message) return null;
    window.sessionStorage.removeItem(AUTH_NOTICE_KEY);
    return message;
  } catch {
    return null;
  }
}

/**
 * Persist a pending check-in code so it survives the register -> verify-email ->
 * login -> onboarding hop chain (all of which can drop query params or open new tabs).
 * Stored alongside a timestamp so a code left behind by an abandoned scan
 * (see consumePendingCheckinCode) doesn't linger forever.
 */
export function setPendingCheckinCode(code: string) {
  try {
    window.sessionStorage.setItem(
      PENDING_CHECKIN_CODE_KEY,
      JSON.stringify({ code, storedAt: Date.now() })
    );
  } catch {
    // Ignore storage failures.
  }
}

/**
 * Reads + clears the stored pending check-in code without any TTL check.
 * Internal helper shared by consumePendingCheckinCode and any future peek.
 */
function readAndClearPendingCheckinCode(): { code: string; storedAt: number } | null {
  try {
    const raw = window.sessionStorage.getItem(PENDING_CHECKIN_CODE_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(PENDING_CHECKIN_CODE_KEY);

    // Support the legacy plain-string format (pre-TTL) as a bare code with no
    // timestamp, so any code already in storage from before this change isn't
    // silently dropped.
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && typeof parsed.code === "string") {
        return { code: parsed.code, storedAt: Number(parsed.storedAt) || 0 };
      }
    } catch {
      // Not JSON — treat as legacy plain string.
    }
    return { code: raw, storedAt: 0 };
  } catch {
    return null;
  }
}

export function consumePendingCheckinCode(): string | null {
  const entry = readAndClearPendingCheckinCode();
  if (!entry) return null;
  const age = Date.now() - entry.storedAt;
  if (!entry.storedAt || age > PENDING_CHECKIN_CODE_TTL_MS) {
    // Expired (or legacy entry with no timestamp we can't trust) — drop it.
    return null;
  }
  return entry.code;
}
