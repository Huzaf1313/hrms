import { api } from "../../services/api";

export interface MonthlyPayrollItem {
  month: string;
  month_name: string;
  year: number;
  month_num: number;
  gross: number;
  deductions: number;
  net: number;
  total_expense: number;
  employee_count: number;
  records_count: number;
}

export interface PayrollSummaryMetrics {
  total_employees: number;
  processed_payroll: number;
  pending_payroll: number;
  pending_employees?: number;
  total_payroll_amount: number;
  latest_month: string;
  period_gross: number;
  period_deductions: number;
  period_net: number;
  period_expense: number;
  new_joiners: number;
  unassigned_salary_structures: number;
}

export interface PayrollRecentRun {
  month: string;
  processed_on: string;
  progress: string;
  status: string;
}

export interface PayrollDepartmentSummary {
  department: string;
  employees: number;
  gross: number;
  net: number;
  status: string;
}

export interface PayrollAnalyticsData {
  timeline: MonthlyPayrollItem[];
  summary: PayrollSummaryMetrics;
  available_years: number[];
  recent_runs: PayrollRecentRun[];
  departments: PayrollDepartmentSummary[];
}

export interface PayrollAnalyticsParams {
  [key: string]: string | number | boolean | undefined;
  year?: number;
  months?: number;
}

export interface SalaryBreakdownItem {
  id?: string;
  name?: string;
  label?: string;
  amount: number;
  type?: string;
}

export interface AdminPayslipItem {
  id: string;
  employee_id: string;
  employee_name?: string;
  employee_code?: string;
  designation?: string;
  department?: string;
  bank_name?: string;
  account_number?: string;
  month: string;
  month_value?: string;
  pay_period_start: string;
  pay_period_end: string;
  salary: {
    basic: number;
    gross: number;
    earnings?: SalaryBreakdownItem[];
  };
  deductions: {
    total: number;
    items?: SalaryBreakdownItem[];
    [key: string]: any;
  };
  net_salary: number;
  bank_details?: {
    bank_name?: string;
    account_number?: string;
    account_last4?: string;
    ifsc_code?: string;
    branch?: string;
    account_holder_name?: string;
  };
  payment?: {
    status?: string;
    paid_on?: string | null;
    payment_method?: string;
  };
  tax_details?: {
    taxable_income?: number;
    tax_deducted?: number;
  };
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AdminPayslipsResponse {
  items: AdminPayslipItem[];
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface AdminPayslipQueryParams {
  [key: string]: string | number | boolean | undefined;
  page?: number;
  limit?: number;
  month?: string;
  year?: number;
  search?: string;
  status?: string;
}

export interface CreateAdminPayslipPayload {
  employee_id: string;
  month: string;
  year: number;
}

export interface BulkGeneratePayslipsPayload {
  month: string;
  year: number;
  department_id?: string;
}

export interface BulkGeneratePayslipsResult {
  total_eligible: number;
  created: number;
  skipped: number;
  errors: Array<{ employee_id: string; error: string }>;
}

export const adminPayrollService = {
  getAnalytics: (params?: PayrollAnalyticsParams) =>
    api.get<PayrollAnalyticsData>("/admin-payslip/analytics", params),

  getPayslips: (params?: AdminPayslipQueryParams) =>
    api.get<AdminPayslipsResponse>("/admin-payslip", params),

  getPayslipById: (id: string) =>
    api.get<AdminPayslipItem>(`/admin-payslip/${id}`),

  createPayslip: (payload: CreateAdminPayslipPayload) =>
    api.post<AdminPayslipItem>("/admin-payslip", payload),

  bulkGenerate: (payload: BulkGeneratePayslipsPayload) =>
    api.post<BulkGeneratePayslipsResult>("/admin-payslip/bulk-generate", payload),

  updateStatus: (id: string, status: string) =>
    api.patch<AdminPayslipItem>(`/admin-payslip/${id}/status`, { status }),

  bulkUpdateStatus: (payslip_ids: string[], status: string) =>
    api.post<{ total: number; updated: number; status: string }>("/admin-payslip/bulk-status", {
      payslip_ids,
      status,
    }),

  sendEmail: (id: string) =>
    api.post<{ success: boolean; message: string; recipient: string }>(
      `/admin-payslip/${id}/send-email`,
      {}
    ),

  bulkSendEmail: (payload: { month: string; year: number; status?: string }) =>
    api.post<{ total: number; sent: number; failed: number }>(
      "/admin-payslip/bulk-send-email",
      payload
    ),
};

