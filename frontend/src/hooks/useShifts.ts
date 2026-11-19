import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { shiftService } from "../modules/shifts/shiftService";
import type { Shift, ShiftCreate, ShiftUpdate } from "../modules/shifts/types";
import { queryKeys } from "../lib/queryKeys";

export function useShifts(includeInactive: boolean = true) {
  return useQuery<Shift[]>({
    queryKey: [...queryKeys.reference.shifts(), { includeInactive }],
    queryFn: () => shiftService.listAll(includeInactive),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useCreateShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ShiftCreate) => shiftService.create(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.reference.shifts(),
      });
    },
  });
}

export function useUpdateShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ShiftUpdate }) =>
      shiftService.update(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.reference.shifts(),
      });
    },
  });
}

export function useRemoveShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (shiftId: string) => shiftService.remove(shiftId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.reference.shifts(),
      });
    },
  });
}

export function useAssignShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      employeeId,
      shiftId,
    }: {
      employeeId: string;
      shiftId: string | null;
    }) => shiftService.assign(employeeId, shiftId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.reference.shifts(),
      });
    },
  });
}
