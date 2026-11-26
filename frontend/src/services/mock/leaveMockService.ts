export interface MockHoliday {
  id: string;
  name: string;
  date: string;
  day: string;
}

export interface MockTeamLeave {
  id: string;
  employee_id: string;
  employee_name: string;
  department_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  status: "approved" | "pending" | "rejected";
}

export interface MockLeaveBalance {
  leave_type: string;
  allocated: number;
  used: number;
  available: number;
}

export const leaveMockService = {
  getHolidays: (): Promise<MockHoliday[]> => Promise.resolve([]),
  getTeamLeaves: (): Promise<MockTeamLeave[]> => Promise.resolve([]),
  getDefaultBalances: (): Promise<MockLeaveBalance[]> => Promise.resolve([]),
};
