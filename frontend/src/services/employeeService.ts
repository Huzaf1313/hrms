import { api } from "./api";
import type {
  Employee,
  EmployeeCreate,
  EmployeeOTPRequestResponse,
  EmployeeOTPVerifyResponse,
} from "../types/employee";

export type EmployeeUpdate = Partial<EmployeeCreate>;

export interface GetEmployeesParams {
  search?: string;
  department_id?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export const employeeService = {
  list(params: GetEmployeesParams = {}) {
    return api.get<Employee[]>("/employees", { ...params });
  },

  // The API caps a single page at 100 and returns no total count, so keep
  // requesting pages until one comes back short.
  async listAll(
    params: Omit<GetEmployeesParams, "page" | "limit"> = {},
  ): Promise<Employee[]> {
    const pageSize = 100;
    const collected: Employee[] = [];
    let page = 1;

    for (;;) {
      const batch = await api.get<Employee[]>("/employees", {
        ...params,
        page,
        limit: pageSize,
      });

      collected.push(...batch);

      if (batch.length < pageSize || page >= 20) break;

      page += 1;
    }

    return collected;
  },

  get(employeeId: string) {
    return api.get<Employee>(`/employees/${employeeId}`);
  },

  getMyProfile() {
    return api.get<Employee>("/employees/me");
  },

  create(data: EmployeeCreate) {
    return api.post<Employee>("/employees", data);
  },

  requestEmailOtp(email: string) {
    return api.post<EmployeeOTPRequestResponse>(
      "/employees/request-email-otp",
      { email },
    );
  },

  verifyEmailOtp(email: string, otp: string) {
    return api.post<EmployeeOTPVerifyResponse>(
      "/employees/verify-email-otp",
      { email, otp },
    );
  },

  update(employeeId: string, data: EmployeeUpdate) {
    return api.put<Employee>(`/employees/${employeeId}`, data);
  },

  uploadAvatar(employeeId: string, file: File) {
    const form = new FormData();
    form.append("file", file);

    return api.postForm<Employee>(`/employees/${employeeId}/avatar`, form);
  },

  removeAvatar(employeeId: string) {
    return api.delete<Employee>(`/employees/${employeeId}/avatar`);
  },

  deactivate(employeeId: string) {
    return api.patch<Employee>(`/employees/${employeeId}/deactivate`);
  },

  remove(employeeId: string) {
    return api.delete<null>(`/employees/${employeeId}`);
  },
};
