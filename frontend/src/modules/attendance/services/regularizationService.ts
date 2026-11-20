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

export const SAMPLE_REGULARIZATION_REQUESTS: RegularizationRequestItem[] = [
  {
    id: "reg-001",
    employeeId: "emp-001",
    employeeName: "Aarav Sharma",
    employeeCode: "AAR001",
    department: "Engineering",
    date: "2026-11-18",
    displayDate: "18 Nov 2026",
    issueType: "Missing Check-Out",
    reason: "Turnstile reader power failure at South Campus gate.",
    status: "Pending",
    currentCheckIn: "09:28 AM",
    currentCheckOut: "--:--",
    requestedCheckIn: "09:28 AM",
    requestedCheckOut: "06:35 PM",
    note: "Worked full shift; biometric reader failed at exit turnstile.",
    attachmentName: "gate_log_acknowledgement.pdf",
    requestedAt: "2026-11-18T19:00:00Z",
    displayRequestedAt: "18 Nov 2026, 07:00 PM",
    isSampleData: true,
  },
  {
    id: "reg-002",
    employeeId: "emp-002",
    employeeName: "Priya Patel",
    employeeCode: "PRI002",
    department: "Product & Design",
    date: "2026-11-17",
    displayDate: "17 Nov 2026",
    issueType: "Late Arrival",
    reason: "Metro Line 1 power trip between Garware and Civil Court.",
    status: "Pending",
    currentCheckIn: "10:14 AM",
    currentCheckOut: "07:15 PM",
    requestedCheckIn: "09:30 AM",
    requestedCheckOut: "07:15 PM",
    note: "Train stalled for 45 minutes; Pune Metro official delay notification attached.",
    attachmentName: "metro_service_delay.png",
    requestedAt: "2026-11-17T20:10:00Z",
    displayRequestedAt: "17 Nov 2026, 08:10 PM",
    isSampleData: true,
  },
  {
    id: "reg-003",
    employeeId: "emp-003",
    employeeName: "Rohan Verma",
    employeeCode: "ROH003",
    department: "Engineering",
    date: "2026-11-15",
    displayDate: "15 Nov 2026",
    issueType: "On-Duty / Client Visit",
    reason: "On-site deployment at client datacenter in Hinjawadi Phase 2.",
    status: "Approved",
    currentCheckIn: "--:--",
    currentCheckOut: "--:--",
    requestedCheckIn: "09:00 AM",
    requestedCheckOut: "06:00 PM",
    note: "Deployed Release 2.4 to client private cloud. Verified by Client Lead Vikram.",
    requestedAt: "2026-11-15T18:30:00Z",
    displayRequestedAt: "15 Nov 2026, 06:30 PM",
    reviewedBy: "Ananya Iyer (HR Admin)",
    reviewedAt: "2026-11-16T10:15:00Z",
    reviewerComment: "Approved based on client signoff confirmation.",
    isSampleData: true,
  },
  {
    id: "reg-004",
    employeeId: "emp-005",
    employeeName: "Vikram Malhotra",
    employeeCode: "VIK005",
    department: "Sales & Marketing",
    date: "2026-11-12",
    displayDate: "12 Nov 2026",
    issueType: "Missing Check-In",
    reason: "Direct travel to client presentation in BKC Mumbai.",
    status: "Approved",
    currentCheckIn: "--:--",
    currentCheckOut: "07:45 PM",
    requestedCheckIn: "09:15 AM",
    requestedCheckOut: "07:45 PM",
    note: "Attended pitch meeting at 09:30 AM. Check-out logged upon return to office.",
    requestedAt: "2026-11-12T20:00:00Z",
    displayRequestedAt: "12 Nov 2026, 08:00 PM",
    reviewedBy: "Ananya Iyer (HR Admin)",
    reviewedAt: "2026-11-13T09:45:00Z",
    reviewerComment: "Verified with Sales Director schedule.",
    isSampleData: true,
  },
  {
    id: "reg-005",
    employeeId: "emp-006",
    employeeName: "Sneha Kulkarni",
    employeeCode: "SNE006",
    department: "Finance & Operations",
    date: "2026-11-10",
    displayDate: "10 Nov 2026",
    issueType: "Missing Check-Out",
    reason: "Emergency medical departure without card punch.",
    status: "Rejected",
    currentCheckIn: "09:30 AM",
    currentCheckOut: "--:--",
    requestedCheckIn: "09:30 AM",
    requestedCheckOut: "06:30 PM",
    note: "Left at 2:00 PM due to fever. Requesting full day credit.",
    requestedAt: "2026-11-10T19:30:00Z",
    displayRequestedAt: "10 Nov 2026, 07:30 PM",
    reviewedBy: "Ananya Iyer (HR Admin)",
    reviewedAt: "2026-11-11T11:20:00Z",
    reviewerComment: "Cannot credit full day since early departure was at 2:00 PM. Please apply for Half-Day Sick Leave instead.",
    isSampleData: true,
  },
];

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
      // Backend failed or endpoint unavailable -> return realistic sample data
      return { requests: SAMPLE_REGULARIZATION_REQUESTS, isSampleData: true };
    }
  },

  async getMyRequests(employeeId = "AAR001"): Promise<{ requests: RegularizationRequestItem[]; isSampleData: boolean }> {
    try {
      const data = await api.get<BackendRegularizationRequest[]>("/employee-attendance/regularization/me");
      if (Array.isArray(data)) {
        return { requests: data.map(mapBackendRequest), isSampleData: false };
      }
      return { requests: [], isSampleData: false };
    } catch {
      // Filter fallback by employeeId or employeeCode
      const mine = SAMPLE_REGULARIZATION_REQUESTS.filter(
        (r) => r.employeeId === employeeId || r.employeeCode === employeeId || r.employeeCode === "AAR001",
      );
      return { requests: mine, isSampleData: true };
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
