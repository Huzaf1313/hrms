import { api } from "./api";
import type { Holiday, HolidayCreate, HolidayUpdate } from "../types/holiday";

export const holidayService = {
  /**
   * Holidays inside an inclusive date range, or every holiday when both bounds
   * are omitted. Only active holidays come back, so admins retire a past entry
   * by deactivating it rather than deleting it.
   */
  list(params?: { start_date?: string; end_date?: string }) {
    return api.get<Holiday[]>("/holidays", {
      start_date: params?.start_date,
      end_date: params?.end_date,
    });
  },

  create(data: HolidayCreate) {
    return api.post<Holiday>("/admin/holidays", data);
  },

  update(holidayId: string, data: HolidayUpdate) {
    return api.put<Holiday>(`/admin/holidays/${holidayId}`, data);
  },

  remove(holidayId: string) {
    return api.delete<null>(`/admin/holidays/${holidayId}`);
  },
};