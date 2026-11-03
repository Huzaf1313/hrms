import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminPayrollService,
  type PayrollAnalyticsData,
  type PayrollAnalyticsParams,
  type CreateAdminPayslipPayload,
} from "../services/adminPayrollService";
import { queryKeys } from "../lib/queryKeys";

export function usePayrollAnalytics(params?: PayrollAnalyticsParams) {
  return useQuery<PayrollAnalyticsData>({
    queryKey: queryKeys.admin.payrollAnalytics(params),
    queryFn: () => adminPayrollService.getAnalytics(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCreatePayslip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateAdminPayslipPayload) =>
      adminPayrollService.createPayslip(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.admin.payrollAnalytics(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.admin.dashboard(),
      });
      void queryClient.invalidateQueries({
        queryKey: ["admin", "payslips"],
      });
    },
  });
}

export function useUpdatePayslipStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      adminPayrollService.updateStatus(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.admin.payrollAnalytics(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.admin.dashboard(),
      });
      void queryClient.invalidateQueries({
        queryKey: ["admin", "payslips"],
      });
    },
  });
}
