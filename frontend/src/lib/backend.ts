const DEFAULT_BACKEND_URL = 'http://localhost:5001';

export function getBackendBaseUrl(fallback = DEFAULT_BACKEND_URL) {
  return (import.meta.env.VITE_BACKEND_API_URL ?? fallback).replace(/\/$/, '');
}