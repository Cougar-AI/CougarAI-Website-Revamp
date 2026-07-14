export interface Event {
  event_id: number;
  name: string;
  event_type: string;
  description: string | null;
  location: string | null;
  location_url: string | null;
  starts_at: string;
  ends_at: string | null;
  capacity: number | null;
  check_in_code: string | null;
  check_in_enabled: boolean;
  check_in_expires_at: string | null;
  points_value: number;
  google_event_id: string | null;
  require_location: boolean;
  latitude: number | null;
  longitude: number | null;
  checkin_radius_m: number;
  rsvp_enabled: boolean;
  rsvp_count?: number;
}

export interface Attendee {
  checkin_id: number;
  checked_in_at: string | null;
  student_id: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  points: number | null;
}

export interface AttendanceResponse {
  event_id: number;
  event_name: string;
  capacity: number | null;
  starts_at: string | null;
  attendance_count: number;
  attendees: Attendee[];
}

export interface EventTypeOption {
  type_id: number;
  name: string;
  default_points: number;
  color: string;
  is_active: boolean;
}

export interface PartnerOption {
  partner_id: number;
  name: string;
  type: string;
  logo_url?: string | null;
}

export interface SponsorOption {
  sponsor_id: number;
  name: string;
  tier: string;
  logo_url?: string | null;
}
