import { api, downloadFile } from "./api";
import type {
  ExitRequest,
  ExitRequestList,
  ExitRequestSummary,
  ExitStatus,
} from "../types/exitRequest";
 
interface ListParams {
  page?: number;
  limit?: number;
  status?: ExitStatus;
  search?: string;
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
 
  summary() {
    return api.get<ExitRequestSummary>("/admin/exit-requests/summary");
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