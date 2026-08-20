import { api } from "./api";
import type { Employee, EmployeeCreate } from "../types/employee";

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

  get(employeeId: string) {
    return api.get<Employee>(`/employees/${employeeId}`);
  },

  create(data: EmployeeCreate) {
    return api.post<Employee>("/employees", data);
  },

  update(employeeId: string, data: EmployeeUpdate) {
    return api.put<Employee>(`/employees/${employeeId}`, data);
  },

  deactivate(employeeId: string) {
    return api.patch<Employee>(`/employees/${employeeId}/deactivate`);
  },

  remove(employeeId: string) {
    return api.delete<null>(`/employees/${employeeId}`);
  },
};
