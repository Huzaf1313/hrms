import { api } from "./api";
import type {
  EmployeeNotification,
  EmployeeNotificationListResponse,
} from "../types/employeeNotification";

export interface GetAdminNotificationsParams {
  page?: number;
  limit?: number;
}

/**
 * Admin-facing notifications. The payload shape matches the employee one
 * exactly - the backend stores both in the same collection - so the shared
 * EmployeeNotification type is reused rather than duplicated.
 */
export const adminNotificationService = {
  async getNotifications(
    params: GetAdminNotificationsParams = {},
  ): Promise<EmployeeNotificationListResponse> {
    return api.get<EmployeeNotificationListResponse>(
      "/admin/notifications",
      {
        page: params.page ?? 1,
        limit: params.limit ?? 20,
      },
    );
  },

  /** Cheap poll target for the header badge. */
  async getUnreadCount(): Promise<number> {
    const response = await api.get<{ unread_count: number }>(
      "/admin/notifications/unread-count",
    );

    return response.unread_count;
  },

  markAsRead(notificationId: string): Promise<EmployeeNotification> {
    return api.patch<EmployeeNotification>(
      `/admin/notifications/${notificationId}/read`,
    );
  },

  markAllAsRead(): Promise<{ modified_count: number }> {
    return api.patch<{ modified_count: number }>(
      "/admin/notifications/read-all",
    );
  },
};