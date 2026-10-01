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
  min_salary?: number | null;
  max_salary?: number | null;
  earnings: Earning[];
  gross_salary: number;
  deductions?: AppliedDeduction[];
}

export interface SalaryStructureInput {
  name: string;
  range: string;
  min_salary?: number | null;
  max_salary?: number | null;
  earnings: Earning[];
}

export interface SalaryBand {
  min: number | null;
  max: number | null;
}

export const LEGACY_SALARY_STRUCTURE_LABELS: Record<string, string> = {
  basic: "Structure A – Basic",
  standard: "Structure B – Standard",
  professional: "Structure C – Professional",
};

function firstNumberIn(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const match = value.match(/\d[\d,]*/);

  if (!match) {
    return null;
  }

  const parsed = Number(match[0].replace(/,/g, ""));

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function salaryBandFor(
  structure:
    | Pick<SalaryStructure, "range" | "min_salary" | "max_salary">
    | undefined,
): SalaryBand {
  const min =
    typeof structure?.min_salary === "number" && structure.min_salary > 0
      ? structure.min_salary
      : firstNumberIn(structure?.range);

  const max =
    typeof structure?.max_salary === "number" && structure.max_salary > 0
      ? structure.max_salary
      : null;

  return { min, max };
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
