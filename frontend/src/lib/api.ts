import { clearAuthSession, getAccessToken, replaceAccessToken } from "@/lib/auth";

// Get backend URL and ensure no trailing slash
const BACKEND = (import.meta.env.VITE_BACKEND_API_URL ?? "http://localhost:5001").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type RefreshOk = { access_token?: string };

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${BACKEND}/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });

        if (!res.ok) return null;

        const data = (await res.json().catch(() => ({}))) as RefreshOk;
        const nextToken = (data.access_token || "").trim();
        if (!nextToken) return null;

        replaceAccessToken(nextToken);
        return nextToken;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

async function performRequest(
  method: string,
  path: string,
  body?: unknown,
  formData?: FormData,
  tokenOverride?: string | null,
) {
  const token = tokenOverride ?? getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let bodyInit: BodyInit | undefined;
  if (formData) {
    bodyInit = formData;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    bodyInit = JSON.stringify(body);
  }

  return fetch(`${BACKEND}${path}`, { method, headers, body: bodyInit });
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  formData?: FormData,
): Promise<T> {
  let res = await performRequest(method, path, body, formData);

  if (res.status === 401) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) {
      res = await performRequest(method, path, body, formData, refreshedToken);
    }
  }

  if (res.status === 401) {
    clearAuthSession();
    window.location.replace("/auth?mode=login");
    throw new ApiError(res.status, "Unauthorized");
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

export function apiPut<T>(path: string, body: unknown): Promise<T> {
  return request<T>("PUT", path, body);
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
