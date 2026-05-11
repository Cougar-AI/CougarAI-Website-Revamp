export type StoredUser = {
  user_id: number;
  email: string;
};

const AUTH_EVENT = "cougarai-auth-changed";
const AUTH_NOTICE_KEY = "cougarai-auth-notice";

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

export function hasAccessToken() {
  return Boolean(window.localStorage.getItem("access_token") ?? window.sessionStorage.getItem("access_token"));
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
