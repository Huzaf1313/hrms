import { api, downloadFile } from "./api";
import type {
  ExitRequest,
  ExitRequestList,
  ExitRequestSummary,
  ExitStatus,
  ExitType,
  HandoverTask,
} from "../types/exitRequest";
 
interface ListParams {
  page?: number;
  limit?: number;
  status?: ExitStatus;
  search?: string;
  /** Restricts to one exit type; drives the single-type tabs. */
  exit_type?: ExitType;
  department_id?: string;
  /** ISO datetimes bounding submitted_at. */
  submitted_from?: string;
  submitted_to?: string;
}
 
export interface AdminExitRequestInput {
  employee_id: string;
  exit_type: ExitType;
  last_working_day: string;
  reason: string;
  remarks?: string;
  notice_period_days?: number;
  handover_tasks?: { task: string; remarks?: string; status: HandoverTask["status"] }[];
}
 
export const exitRequestService = {
  submit(form: FormData) {
    return api.postForm<ExitRequest>("/employee-exit-requests", form);
  },
 
  listMine(params: ListParams = {}) {
    return api.get<ExitRequestList>("/employee-exit-requests", { ...params });
  },
 
  getMine(id: string) {
    return api.get<ExitRequest>(`/employee-exit-requests/${id}`);
  },
 
  cancel(id: string) {
    return api.patch<ExitRequest>(`/employee-exit-requests/${id}/cancel`);
  },
 
  downloadMyAttachment(id: string, attachmentId: string) {
    return downloadFile(
      `/employee-exit-requests/${id}/attachments/${attachmentId}/download`,
    );
  },
};
 
export const adminExitRequestService = {
  list(params: ListParams = {}) {
    return api.get<ExitRequestList>("/admin/exit-requests", { ...params });
  },
 
  summary(exitType?: ExitType) {
    return api.get<ExitRequestSummary>("/admin/exit-requests/summary", {
      exit_type: exitType,
    });
  },

  /**
   * Records a departure HR raised themselves - the only way a Termination,
   * Contract End or Retirement can exist, since the employee form always
   * submits a Resignation.
   */
  create(data: AdminExitRequestInput) {
    return api.post<ExitRequest>("/admin/exit-requests", data);
  },
 
  get(id: string) {
    return api.get<ExitRequest>(`/admin/exit-requests/${id}`);
  },
 
  updateStatus(
    id: string,
    status: Exclude<ExitStatus, "Pending" | "Cancelled">,
    adminNote?: string,
  ) {
    return api.patch<ExitRequest>(`/admin/exit-requests/${id}/status`, {
      status,
      admin_note: adminNote || null,
    });
  },
 
  downloadAttachment(id: string, attachmentId: string) {
    return downloadFile(
      `/admin/exit-requests/${id}/attachments/${attachmentId}/download`,
    );
  },
};
 
export function formatExitDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
 
export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
 
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Quotes a CSV cell, doubling any embedded quotes. */
function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);

  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Exports the rows currently on screen as CSV.
 *
 * Built from the loaded page rather than a new server call, so the file always
 * matches the filters and the page the user was looking at.
 */
export function downloadExitCsv(
  requests: ExitRequest[],
  filename = "exit-requests.csv",
) {
  const headers = [
    "Employee ID",
    "Employee",
    "Department",
    "Designation",
    "Exit Type",
    "Reason",
    "Last Working Day",
    "Status",
    "Submitted On",
    "Notice Period (days)",
  ];

  const rows = requests.map((request) => [
    request.employee_id,
    request.employee_name,
    request.department_name,
    request.designation,
    request.exit_type,
    request.reason,
    request.last_working_day,
    request.status,
    request.submitted_at,
    request.notice_period_days,
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");

  // The BOM is what makes Excel open a UTF-8 CSV without mangling names.
  saveBlob(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }), filename);
}