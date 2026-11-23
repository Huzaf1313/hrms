import { useState, useEffect, useCallback } from "react";
import { leaveService } from "../services/leaveService";
import { checkDateOverlap } from "../services/leaveTypes";
import type { MockHoliday, MockTeamLeave } from "../../../services/mock/leaveMockService";

export function useTeamLeaves() {
  const [teamLeaves, setTeamLeaves] = useState<MockTeamLeave[]>([]);
  const [holidays, setHolidays] = useState<MockHoliday[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(() => {
    setIsLoading(true);
    Promise.all([leaveService.getTeamLeaves(), leaveService.getHolidays()])
      .then(([leavesRes, holidaysRes]) => {
        setTeamLeaves(leavesRes);
        setHolidays(holidaysRes);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  /** Find colleagues on leave within the range */
  const getOverlappingColleagues = useCallback(
    (startDate: string, endDate: string, excludeEmployeeId?: string) => {
      if (!startDate || !endDate) return [];
      return teamLeaves.filter((l) => {
        if (excludeEmployeeId && l.employee_id === excludeEmployeeId) return false;
        if (l.status !== "approved" && l.status !== "pending") return false;
        return checkDateOverlap(startDate, endDate, l.start_date, l.end_date);
      });
    },
    [teamLeaves]
  );

  return { teamLeaves, holidays, isLoading, reload: loadData, getOverlappingColleagues };
}
