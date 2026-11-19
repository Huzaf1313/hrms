import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminDeductionService,
  type BackendDeduction,
  type DeductionCreatePayload,
} from "../modules/payroll/admin_deduction_service";
import { queryKeys } from "../lib/queryKeys";

export function useDeductions() {
  return useQuery<BackendDeduction[]>({
    queryKey: queryKeys.reference.deductions(),
    queryFn: () => adminDeductionService.list(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useCreateDeduction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: DeductionCreatePayload) =>
      adminDeductionService.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.reference.deductions(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.admin.payrollAnalytics(),
      });
    },
  });
}

export function useUpdateDeduction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<DeductionCreatePayload>;
    }) => adminDeductionService.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.reference.deductions(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.admin.payrollAnalytics(),
      });
    },
  });
}

export function useDeleteDeduction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => adminDeductionService.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.reference.deductions(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.admin.payrollAnalytics(),
      });
    },
  });
}
