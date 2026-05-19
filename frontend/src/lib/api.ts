import { clearAuthSession, getAccessToken } from "@/lib/auth";

const BACKEND = import.meta.env.VITE_BACKEND_API_URL ?? "http://localhost:5001";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
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

  if (res.status === 401 || res.status === 422) {
    clearAuthSession();
    window.location.replace("/login");
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

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>("PATCH", path, body);
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>("DELETE", path);
}

export function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  return request<T>("POST", path, undefined, formData);
}
