export type CelebrationType = "birthday" | "anniversary";

export interface Celebration {
  employee_id: string;
  name: string;
  type: CelebrationType;
  message: string;
  avatar_url?: string | null;
  designation?: string | null;
  /** Completed years, for anniversaries only. */
  years?: number | null;
}