const BACKEND = (import.meta.env.VITE_BACKEND_API_URL ?? 'http://localhost:5001').replace(/\/$/, '');

export type ProjectStatus = 'active' | 'completed';

export interface ProjectSponsor {
  sponsor_id: number;
  name: string;
  logo_url: string | null;
  website: string | null;
}

export interface Project {
  project_id: number;
  title: string;
  summary: string | null;
  description: string | null;
  status: ProjectStatus;
  semester: string | null;
  tags: string[];
  team_members: string[];
  cover_image_url: string | null;
  github_url: string | null;
  demo_url: string | null;
  sponsor: ProjectSponsor | null;
  is_published: boolean;
  display_order: number;
  created_at: string | null;
  updated_at: string | null;
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'In progress',
  completed: 'Completed',
};

// Uploaded images are served by the backend; external URLs are used as-is.
export function resolveUploadUrl(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('/admin/uploads/') ? `${BACKEND}${url}` : url;
}
