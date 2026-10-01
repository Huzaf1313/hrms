import { api } from "./api";
import type { Department } from "../types/department";

export interface GetDepartmentsParams {
  name?: string;
  page?: number;
  limit?: number;
}

export interface DepartmentCreate {
  name: string;
  description?: string;
}

export const departmentService = {
  list(params: GetDepartmentsParams = {}) {
    return api.get<Department[]>("/departments", { ...params });
  },

  // The API caps a single page at 100 and returns no total count, so keep
  // requesting pages until one comes back short.
  async listAll(): Promise<Department[]> {
    const pageSize = 100;
    const collected: Department[] = [];
    let page = 1;

    for (;;) {
      const batch = await api.get<Department[]>("/departments", {
        page,
        limit: pageSize,
      });

      collected.push(...batch);

      if (batch.length < pageSize || page >= 20) break;

      page += 1;
    }

    return collected;
  },

  create(data: DepartmentCreate) {
    return api.post<Department>("/departments", data);
  },
};
