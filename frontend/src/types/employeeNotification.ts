export interface EmployeeNotification {
  id: string;
  employee_id: string;
  type: string;
  title: string;
  message: string;
  target: string | null;
  target_id: string | null;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}

export interface EmployeeNotificationListResponse {
  notifications: EmployeeNotification[];
  total: number;
  unread_count: number;
}

export interface EmployeeNotificationUnreadCountResponse {
  success: boolean;
  unread_count: number;
}

export interface EmployeeNotificationReadAllResponse {
  success: boolean;
  message: string;
  modified_count: number;
}