import { api } from "../../../services/api";
import { formatDisplayDate } from "../../../utils/dateKeys";

export type RegularizationStatus = "Pending" | "Approved" | "Rejected";

export interface RegularizationRequestItem {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  date: string; // YYYY-MM-DD
  displayDate: string; // e.g. "18 Nov 2026"
  issueType: string;
  reason: string;
  status: RegularizationStatus;
  currentCheckIn?: string;
  currentCheckOut?: string;
  requestedCheckIn: string;
  requestedCheckOut: string;
  note?: string;
  attachmentName?: string;
  requestedAt: string;
  displayRequestedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewerComment?: string;
  isSampleData?: boolean;
}

export interface BackendRegularizationRequest {
  id: string;
  employee_id?: string;
  employee_name?: string;
  employee_code?: string;
  department_name?: string;
  date: string;
  issue_type?: string;
  reason: string;
  status: RegularizationStatus;
  requested_at: string;
  requested_check_in?: string;
  requested_check_out?: string;
  current_check_in?: string;
  current_check_out?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  reviewer_comment?: string;
}

function formatTime(value?: string | null): string {
  if (!value) return "--:--";
  const text = value.trim();
  if (/^\d{1,2}:\d{2}\s*[AP]M$/i.test(text)) return text;
  const parsed = new Date(text);
  if (isNaN(parsed.getTime())) return text;
  return parsed.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function mapBackendRequest(r: BackendRegularizationRequest): RegularizationRequestItem {
  return {
    id: r.id,
    employeeId: r.employee_id || "",
    employeeName: r.employee_name || r.employee_code || "Employee",
    employeeCode: r.employee_code || "EMP",
    department: r.department_name || "General",
    date: r.date,
    displayDate: formatDisplayDate(r.date),
    issueType: r.issue_type || "Attendance Correction",
    reason: r.reason,
    status: r.status,
    currentCheckIn: formatTime(r.current_check_in),
    currentCheckOut: formatTime(r.current_check_out),
    requestedCheckIn: formatTime(r.requested_check_in),
    requestedCheckOut: formatTime(r.requested_check_out),
    note: r.reason,
    requestedAt: r.requested_at,
    displayRequestedAt: formatDisplayDate(r.requested_at),
    reviewedBy: r.reviewed_by,
    reviewedAt: r.reviewed_at ? formatDisplayDate(r.reviewed_at) : undefined,
    reviewerComment: r.reviewer_comment,
    isSampleData: false,
  };
}

export const regularizationService = {
  async getAll(): Promise<{ requests: RegularizationRequestItem[]; isSampleData: boolean }> {
    try {
      const data = await api.get<BackendRegularizationRequest[]>("/employee-attendance/regularization");
      if (Array.isArray(data)) {
        return { requests: data.map(mapBackendRequest), isSampleData: false };
      }
      return { requests: [], isSampleData: false };
    } catch {
      return { requests: [], isSampleData: false };
    }
  },

  async getMyRequests(_employeeId = ""): Promise<{ requests: RegularizationRequestItem[]; isSampleData: boolean }> {
    void _employeeId;
    try {
      const data = await api.get<BackendRegularizationRequest[]>("/employee-attendance/regularization/me");
      if (Array.isArray(data)) {
        return { requests: data.map(mapBackendRequest), isSampleData: false };
      }
      return { requests: [], isSampleData: false };
    } catch {
      return { requests: [], isSampleData: false };
    }
  },

  async submit(data: {
    attendance_id?: string | null;
    date: string;
    issue_type: string;
    requested_check_in?: string | null;
    requested_check_out?: string | null;
    reason: string;
  }) {
    return api.post("/employee-attendance/regularization", data);
  },

  async review(id: string, status: "Approved" | "Rejected", comment?: string) {
    return api.patch(`/employee-attendance/regularization/${id}/review`, {
      status,
      comment: comment || undefined,
    });
  },
};
