import { api } from "./api";

export interface DeductionSlab {
  uptoAnnualIncome: number | null;
  amount: number;
}

export interface BackendDeduction {
  id: string;
  name: string;
  code: string;
  type: "deduction" | "contribution";
  calculation_method:
    | "percentage_of_basic"
    | "fixed_amount"
    | "slab"
    | "tax_calculation";
  percentage?: number | null;
  fixed_amount?: number | null;
  slabs?: DeductionSlab[];
  tax_regime?: "old" | "new";
  description?: string | null;
  is_active: boolean;
}

export interface DeductionCreatePayload {
  name: string;
  code: string;
  type: "deduction" | "contribution";
  calculation_method:
    | "percentage_of_basic"
    | "fixed_amount"
    | "slab"
    | "tax_calculation";
  percentage?: number | null;
  fixed_amount?: number | null;
  slabs?: DeductionSlab[];
  tax_regime?: "old" | "new";
  description?: string | null;
  is_active: boolean;
}

export interface DeductionCalculationRequest {
  basic_salary: number;
  annual_income: number;
}

export interface DeductionCalculationResult {
  id: string;
  name: string;
  code: string;
  type: "deduction" | "contribution";
  calculated_amount: number;
}

export interface DeductionCalculationResponse {
  basic_salary: number;
  annual_income: number;
  results: DeductionCalculationResult[];
  total_deductions: number;
  total_contributions: number;
}

export const adminDeductionService = {
  list() {
    return api.get<BackendDeduction[]>("/admin/deductions");
  },

  create(payload: DeductionCreatePayload) {
    return api.post<BackendDeduction>("/admin/deductions", payload);
  },

  update(id: string, payload: Partial<DeductionCreatePayload>) {
    return api.put<BackendDeduction>(
      `/admin/deductions/${id}`,
      payload,
    );
  },

  delete(id: string) {
    return api.delete<null>(`/admin/deductions/${id}`);
  },

  apply(id: string, salaryStructureIds: string[]) {
    return api.post<{ updated_structures: number }>(
      `/admin/deductions/${id}/apply`,
      { salary_structure_ids: salaryStructureIds },
    );
  },

  calculate(payload: DeductionCalculationRequest) {
    return api.post<DeductionCalculationResponse>(
      "/admin/deductions/calculate",
      payload,
    );
  },
};
