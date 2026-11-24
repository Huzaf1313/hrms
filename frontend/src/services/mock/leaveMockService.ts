export interface MockHoliday {
  id: string;
  name: string;
  date: string;
  day: string;
}

export const MOCK_HOLIDAYS_2026: MockHoliday[] = [
  { id: "h-1", name: "Republic Day", date: "2026-01-26", day: "Monday" },
  { id: "h-2", name: "Holi", date: "2026-03-25", day: "Wednesday" },
  { id: "h-3", name: "Dr. Ambedkar Jayanti", date: "2026-04-14", day: "Tuesday" },
  { id: "h-4", name: "Maharashtra Day / Labour Day", date: "2026-05-01", day: "Friday" },
  { id: "h-5", name: "Independence Day", date: "2026-08-15", day: "Saturday" },
  { id: "h-6", name: "Gandhi Jayanti", date: "2026-10-02", day: "Friday" },
  { id: "h-7", name: "Dussehra", date: "2026-10-20", day: "Tuesday" },
  { id: "h-8", name: "Diwali (Laxmi Pujan)", date: "2026-11-08", day: "Sunday" },
  { id: "h-9", name: "Diwali (Balipratipada)", date: "2026-11-10", day: "Tuesday" },
  { id: "h-10", name: "Christmas", date: "2026-12-25", day: "Friday" },
];

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

export const MOCK_TEAM_LEAVES: MockTeamLeave[] = [
  {
    id: "tl-1",
    employee_id: "EMP002",
    employee_name: "Rahul Verma",
    department_name: "Engineering",
    leave_type: "Casual Leave",
    start_date: "2026-11-19",
    end_date: "2026-11-20",
    total_days: 2,
    status: "approved",
  },
  {
    id: "tl-2",
    employee_id: "EMP004",
    employee_name: "Pooja Hegde",
    department_name: "Engineering",
    leave_type: "Sick Leave",
    start_date: "2026-11-20",
    end_date: "2026-11-20",
    total_days: 1,
    status: "approved",
  },
  {
    id: "tl-3",
    employee_id: "EMP005",
    employee_name: "Amit Patel",
    department_name: "Product & Design",
    leave_type: "Earned Leave",
    start_date: "2026-11-23",
    end_date: "2026-11-27",
    total_days: 5,
    status: "approved",
  },
  {
    id: "tl-4",
    employee_id: "EMP007",
    employee_name: "Sneha Rao",
    department_name: "Engineering",
    leave_type: "Casual Leave",
    start_date: "2026-11-24",
    end_date: "2026-11-25",
    total_days: 2,
    status: "pending",
  },
  {
    id: "tl-5",
    employee_id: "EMP009",
    employee_name: "Vikram Malhotra",
    department_name: "Human Resources",
    leave_type: "Comp Off",
    start_date: "2026-11-27",
    end_date: "2026-11-27",
    total_days: 1,
    status: "approved",
  },
];

export interface MockLeaveBalance {
  leave_type: string;
  allocated: number;
  used: number;
  available: number;
}

export const MOCK_PENDING_APPROVALS = [
  {
    id: "appr-1",
    employee_id: "EMP007",
    employee_name: "Sneha Rao",
    department_name: "Engineering",
    leave_type: "Casual Leave",
    start_date: "2026-11-24",
    end_date: "2026-11-25",
    total_days: 2,
    reason: "Attending family wedding and travel",
    status: "pending" as const,
    created_at: "2026-11-19T09:30:00Z",
  },
  {
    id: "appr-2",
    employee_id: "EMP011",
    employee_name: "Karan Johar",
    department_name: "Product & Design",
    leave_type: "Sick Leave",
    start_date: "2026-11-21",
    end_date: "2026-11-21",
    total_days: 1,
    reason: "Dental procedure appointment",
    status: "pending" as const,
    created_at: "2026-11-20T08:15:00Z",
  },
  {
    id: "appr-3",
    employee_id: "EMP014",
    employee_name: "Ananya Deshmukh",
    department_name: "Engineering",
    leave_type: "Earned Leave",
    start_date: "2026-12-01",
    end_date: "2026-12-05",
    total_days: 5,
    reason: "Pre-planned personal vacation",
    status: "pending" as const,
    created_at: "2026-11-18T14:20:00Z",
  },
];

export const MOCK_DEFAULT_BALANCES: MockLeaveBalance[] = [
  { leave_type: "Casual Leave", allocated: 12, used: 4, available: 8 },
  { leave_type: "Sick Leave", allocated: 10, used: 2, available: 8 },
  { leave_type: "Earned Leave", allocated: 15, used: 5, available: 10 },
  { leave_type: "Comp Off", allocated: 3, used: 1, available: 2 },
  { leave_type: "Unpaid Leave", allocated: 0, used: 0, available: 0 },
];

export const leaveMockService = {
  getHolidays: () => Promise.resolve(MOCK_HOLIDAYS_2026),
  getTeamLeaves: () => Promise.resolve(MOCK_TEAM_LEAVES),
  getDefaultBalances: () => Promise.resolve(MOCK_DEFAULT_BALANCES),
};
