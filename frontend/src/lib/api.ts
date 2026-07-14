import { clearAuthSession, getAccessToken } from "@/lib/auth";

const BACKEND = import.meta.env.VITE_BACKEND_API_URL ?? "http://localhost:5001";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Mutex: at most one refresh request in flight at a time; all concurrent 401s share the result.
let refreshPromise: Promise<string | null> | null = null;

async function attemptRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = fetch(`${BACKEND}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  })
    .then(async (r) => {
      if (!r.ok) return null;
      const data = (await r.json()) as { access_token: string };
      // Persist into whichever store the user originally chose (remember-me vs session).
      const store =
        window.localStorage.getItem("access_token") !== null
          ? window.localStorage
          : window.sessionStorage;
      store.setItem("access_token", data.access_token);
      return data.access_token;
    })
    .catch(() => null)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  formData?: FormData,
): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let bodyInit: BodyInit | undefined;
  if (formData) {
    bodyInit = formData;
    // Let browser set Content-Type with boundary for multipart
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    bodyInit = JSON.stringify(body);
  }

  const res = await fetch(`${BACKEND}${path}`, { method, headers, body: bodyInit });

  if (res.status === 401) {
    const newToken = await attemptRefresh();
    if (!newToken) {
      clearAuthSession();
      window.location.replace("/login");
      throw new ApiError(401, "Unauthorized");
    }
    // Retry the original request once with the fresh token.
    headers["Authorization"] = `Bearer ${newToken}`;
    const retry = await fetch(`${BACKEND}${path}`, { method, headers, body: bodyInit });
    if (retry.status === 401) {
      clearAuthSession();
      window.location.replace("/login");
      throw new ApiError(401, "Unauthorized");
    }
    if (!retry.ok) {
      let message = retry.statusText;
      try {
        const json = await retry.json();
        message = (json as { error?: string; message?: string }).error ?? (json as { error?: string; message?: string }).message ?? message;
      } catch { /* keep statusText */ }
      throw new ApiError(retry.status, message);
    }
    const retryText = await retry.text();
    if (!retryText) return undefined as T;
    return JSON.parse(retryText) as T;
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const json = await res.json();
      message = json.error ?? json.message ?? message;
    } catch {
      // keep statusText
    }
    throw new ApiError(res.status, message);
  }

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>("GET", path);
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>("POST", path, body);
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>("PATCH", path, body);
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>("DELETE", path);
}

export function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  return request<T>("POST", path, undefined, formData);
}
