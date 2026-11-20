import { api, downloadFile } from "../../services/api";
import type {
  Candidate,
  CandidateInput,
  CandidateOfferInput,
  CandidateOnboardInput,
  CandidateStage,
  JobPosition,
  JobPositionInput,
  JobStatus,
  Paginated,
  PipelineColumn,
  RecruitmentStats,
  ScheduleInterviewInput,
  UpcomingInterview,
} from "./types";

export interface ListJobsParams {
  status?: JobStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ListCandidatesParams {
  search?: string;
  stage?: CandidateStage;
  job_id?: string;
  has_resume?: boolean;
  page?: number;
  limit?: number;
}

export const recruitmentService = {
  getStats() {
    return api.get<RecruitmentStats>("/recruitment/stats");
  },

  getPipeline(jobId?: string, perColumn?: number) {
    return api.get<PipelineColumn[]>("/recruitment/pipeline", {
      job_id: jobId,
      per_column: perColumn,
    });
  },

  // ---- Job positions
  listJobs(params: ListJobsParams = {}) {
    return api.get<Paginated<JobPosition>>("/recruitment/jobs", { ...params });
  },

  createJob(data: JobPositionInput) {
    return api.post<JobPosition>("/recruitment/jobs", data);
  },

  updateJob(
    id: string,
    data: Partial<JobPositionInput> & { status?: JobStatus },
  ) {
    return api.put<JobPosition>(`/recruitment/jobs/${id}`, data);
  },

  deleteJob(id: string) {
    return api.delete<null>(`/recruitment/jobs/${id}`);
  },

  // ---- Candidates
  listCandidates(params: ListCandidatesParams = {}) {
    return api.get<Paginated<Candidate>>("/recruitment/candidates", {
      ...params,
    });
  },

  createCandidate(data: CandidateInput) {
    return api.post<Candidate>("/recruitment/candidates", data);
  },

  changeStage(
    id: string,
    stage: CandidateStage,
    sendRejectionEmail = false,
    rejectionReason?: string,
  ) {
    return api.patch<Candidate>(`/recruitment/candidates/${id}/stage`, {
      stage,
      send_rejection_email: sendRejectionEmail,
      rejection_reason: rejectionReason,
    });
  },

  // ---- Interviews

  /**
   * Books an interview. `when` must be a future ISO instant carrying a
   * timezone offset; the server rejects naive or past times. Pass null to
   * cancel a booking.
   */
  scheduleInterview(
    id: string,
    payload: ScheduleInterviewInput | string | null,
  ) {
    if (typeof payload === "string" || payload === null) {
      return api.patch<Candidate>(`/recruitment/candidates/${id}/interview`, {
        interview_scheduled_at: payload,
      });
    }

    return api.patch<Candidate>(`/recruitment/candidates/${id}/interview`, payload);
  },

  // ---- Offers & Onboarding

  issueOffer(id: string, data: CandidateOfferInput) {
    return api.post<Candidate>(`/recruitment/candidates/${id}/offer`, data);
  },

  onboardCandidate(id: string, data: CandidateOnboardInput = {}) {
    return api.post<Candidate>(`/recruitment/candidates/${id}/onboard`, data);
  },

  /** Interviews still ahead of now, soonest first. */
  getUpcomingInterviews(limit = 6) {
    return api.get<UpcomingInterview[]>("/recruitment/interviews/upcoming", {
      limit,
    });
  },

  deleteCandidate(id: string) {
    return api.delete<null>(`/recruitment/candidates/${id}`);
  },

  // ---- Resume
  uploadResume(id: string, file: File) {
    const body = new FormData();
    body.append("file", file);

    return api.postForm<Candidate>(
      `/recruitment/candidates/${id}/resume`,
      body,
    );
  },

  downloadResume(id: string) {
    return downloadFile(`/recruitment/candidates/${id}/resume`);
  },
};
