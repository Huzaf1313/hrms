export type JobStatus = "active" | "closed";

export type CandidateStage =
  | "applied"
  | "screening"
  | "shortlisted"
  | "interview"
  | "selected"
  | "offer"
  | "hired"
  | "rejected";

// Columns on the pipeline board, in order ("rejected" is not a column).
export const PIPELINE_STAGES: CandidateStage[] = [
  "applied",
  "screening",
  "shortlisted",
  "interview",
  "selected",
  "offer",
  "hired",
];

export const ALL_STAGES: CandidateStage[] = [...PIPELINE_STAGES, "rejected"];

export const STAGE_LABELS: Record<CandidateStage, string> = {
  applied: "Applied",
  screening: "Screening",
  shortlisted: "Shortlisted",
  interview: "Interview",
  selected: "Selected",
  offer: "Offer",
  hired: "Hired",
  rejected: "Rejected",
};

export const STAGE_COLORS: Record<CandidateStage, string> = {
  applied: "#3b82f6",
  screening: "#8b5cf6",
  shortlisted: "#10b981",
  interview: "#f97316",
  selected: "#14b8a6",
  offer: "#ec4899",
  hired: "#22c55e",
  rejected: "#94a3b8",
};

export interface JobPosition {
  id: string;
  title: string;
  department: string;
  location: string;
  description: string | null;
  openings: number;
  status: JobStatus;
  created_at: string;
  updated_at: string;
}

export interface JobPositionInput {
  title: string;
  department: string;
  location: string;
  description?: string;
  openings: number;
}

export interface Candidate {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  skills: string[];
  experience_years: number | null;
  job_id: string;
  job_title: string;
  department: string;
  stage: CandidateStage;
  resume_file_name: string | null;
  resume_uploaded_at: string | null;
  applied_at: string;
  stage_updated_at: string;
  /** ISO instant of the booked interview, or null when none is booked. */
  interview_scheduled_at: string | null;
  // Set only by the change-stage call: the job was closed because all its openings are filled.
  job_auto_closed?: boolean;
}

export interface CandidateInput {
  full_name: string;
  email: string;
  phone?: string;
  skills: string[];
  experience_years?: number;
  job_id: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface PipelineCandidate {
  id: string;
  full_name: string;
  job_title: string;
  stage_updated_at: string;
}

export interface PipelineColumn {
  stage: CandidateStage;
  count: number;
  candidates: PipelineCandidate[];
}

export interface DepartmentCount {
  department: string;
  count: number;
}

/** One booked interview, as the dashboard's Upcoming Interviews card reads it. */
export interface UpcomingInterview {
  id: string;
  full_name: string;
  job_title: string;
  /** ISO instant; the browser renders it in local time. */
  interview_scheduled_at: string;
}

export interface RecruitmentStats {
  total_job_positions: number;
  active_job_positions: number;
  total_applications: number;
  interviews_scheduled: number;
  hired_candidates: number;
  stage_counts: Record<CandidateStage, number>;
  applications_by_department: DepartmentCount[];
}
