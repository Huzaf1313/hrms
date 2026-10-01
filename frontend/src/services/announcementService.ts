import { api } from "./api";

export type AnnouncementCategory =
  | "Company News"
  | "HR & Policy"
  | "Events"
  | "IT & System";

export type AnnouncementPriority = "Normal" | "Important" | "Urgent";

export type AnnouncementAudience = "All Employees" | "Department-wise" | "Custom";

export interface EmployeeAnnouncement {
  id: string;
  title: string;
  description: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  audience: AnnouncementAudience;
  publish_date: string;
  expiry_date: string | null;
  pinned: boolean;
  author_name: string;
  created_at: string;
  attachment: {
    filename: string;
    url: string;
    content_type?: string;
    size?: number;
  } | null;
}

export interface EmployeeAnnouncementsResult {
  announcements: EmployeeAnnouncement[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface GetAnnouncementsParams {
  page?: number;
  page_size?: number;
  category?: string;
  search?: string;
  pinned?: boolean;
}

export const announcementService = {
  list(params: GetAnnouncementsParams = {}) {
    return api.get<EmployeeAnnouncementsResult>(
      "/employee-announcements",
      { ...params },
    );
  },

  get(announcementId: string) {
    return api.get<EmployeeAnnouncement>(
      `/employee-announcements/${announcementId}`,
    );
  },
};
