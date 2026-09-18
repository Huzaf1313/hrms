import { api } from "./api";

export interface Earning {
  label: string;
  amount: number;
}

export interface AppliedDeduction {
  id: string;
  name: string;
  type: "deduction" | "contribution";
  calculation_method: string;
  percentage?: number | null;
  fixed_amount?: number | null;
}

export interface SalaryStructure {
  id: string;
  name: string;
  range: string;
  earnings: Earning[];
  gross_salary: number;
  deductions?: AppliedDeduction[];
}

export interface SalaryStructureInput {
  name: string;
  range: string;
  earnings: Earning[];
}

export const salaryStructureService = {
  list() {
    return api.get<SalaryStructure[]>("/admin/salary-structures");
  },

  get(id: string) {
    return api.get<SalaryStructure>(`/admin/salary-structures/${id}`);
  },

  create(data: SalaryStructureInput) {
    return api.post<SalaryStructure>("/admin/salary-structures", data);
  },

  update(id: string, data: Partial<SalaryStructureInput>) {
    return api.put<SalaryStructure>(`/admin/salary-structures/${id}`, data);
  },

  delete(id: string) {
    return api.delete<null>(`/admin/salary-structures/${id}`);
  },
};
