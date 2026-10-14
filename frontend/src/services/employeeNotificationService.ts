import { api } from "./api";
import type {
  EmployeeNotification,
  EmployeeNotificationListResponse,
  EmployeeNotificationReadAllResponse,
  EmployeeNotificationUnreadCountResponse,
} from "../types/employeeNotification";

export interface GetEmployeeNotificationsParams {
  page?: number;
  limit?: number;
}

export const employeeNotificationService = {
  async getNotifications(
    params: GetEmployeeNotificationsParams = {},
  ): Promise<EmployeeNotificationListResponse> {
    const response = await api.get<EmployeeNotificationListResponse>(
      "/notifications",
      {
        page: params.page ?? 1,
        limit: params.limit ?? 20,
      },
    );

    return response;
  },

  async getUnreadCount(): Promise<number> {
    const response =
      await api.get<EmployeeNotificationUnreadCountResponse>(
        "/notifications/unread-count",
      );

    return response.unread_count;
  },

  async markAsRead(
    notificationId: string,
  ): Promise<EmployeeNotification> {
    return api.patch<EmployeeNotification>(
      `/notifications/${notificationId}/read`,
    );
  },

  async markAllAsRead(): Promise<EmployeeNotificationReadAllResponse> {
    return api.patch<EmployeeNotificationReadAllResponse>(
      "/notifications/read-all",
    );
  },
};