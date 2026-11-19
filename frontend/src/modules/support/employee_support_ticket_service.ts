
import { api } from "../../services/api";

export type SupportTicketCategory =
  | "IT"
  | "HR"
  | "Payroll"
  | "Attendance"
  | "Leave"
  | "Other";

export type SupportTicketPriority =
  | "Low"
  | "Medium"
  | "High"
  | "Urgent";

export type SupportTicketStatus =
  | "Open"
  | "In Progress"
  | "Waiting for Employee"
  | "Resolved"
  | "Closed";

export interface SupportTicketCreate {
  subject: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  description: string;
}

export interface SupportTicket {
  id: string;
  subject: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  description: string;
  status: SupportTicketStatus;
  employee_id: string;
  created_at: string;
  updated_at: string;
}

export interface SupportTicketsResponse {
  tickets: SupportTicket[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export const employeeSupportTicketService = {
  create(data: SupportTicketCreate) {
    return api.post<SupportTicket>(
      "/employee-support-tickets",
      data,
    );
  },

  list(page = 1, pageSize = 5) {
    return api.get<SupportTicketsResponse>(
      "/employee-support-tickets",
      {
        page,
        page_size: pageSize,
      },
    );
  },

  getById(ticketId: string) {
    return api.get<SupportTicket>(
      `/employee-support-tickets/${ticketId}`,
    );
  },
};