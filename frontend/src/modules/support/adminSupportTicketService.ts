import { api } from "../../services/api";
import type {
  SupportTicket,
  SupportTicketsPage,
  SupportTicketAnalytics,
  SupportTicketStatus,
} from "./types";

export interface GetSupportTicketsParams {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
  priority?: string;
  search?: string;
}

export const adminSupportTicketService = {
  list(params: GetSupportTicketsParams = {}) {
    return api.get<SupportTicketsPage>("/admin/support-tickets", {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      status: params.status || undefined,
      category: params.category || undefined,
      priority: params.priority || undefined,
      search: params.search || undefined,
    });
  },

  summary() {
    return api.get<SupportTicketAnalytics>("/admin/support-tickets/summary");
  },

  get(ticketId: string) {
    return api.get<SupportTicket>(`/admin/support-tickets/${ticketId}`);
  },

  respond(
    ticketId: string,
    data: { status: SupportTicketStatus; resolution_note?: string | null },
  ) {
    return api.patch<SupportTicket>(`/admin/support-tickets/${ticketId}`, data);
  },
};