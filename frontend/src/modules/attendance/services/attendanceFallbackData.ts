import type { AttendanceRecord, AttendanceSummary, EmployeeAttendanceRecord } from "../types";

export const SAMPLE_ATTENDANCE_RECORDS: AttendanceRecord[] = [
  {
    id: "att-sample-1",
    employee_id: "emp-1",
    date: "2026-11-20",
    status: "present",
    shift: "General Shift",
    shift_id: "shift-gen",
    shift_start: "09:30 AM",
    shift_end: "06:30 PM",
    shift_duration_minutes: 540,
    check_in: "09:18 AM",
    check_out: "-",
    in_time: "09:18 AM",
    out_time: null,
    total_hours: 5.5,
    working_hours: "5h 30m",
    worked_minutes: 330,
    is_late: false,
    late_minutes: 0,
    is_regularized: false,
    notes: "Office - Pune HQ",
    employee: {
      id: "emp-1",
      first_name: "Aiman",
      last_name: "Mulla",
      employee_code: "AAR001",
      department_id: "dept-dev",
      department_name: "Engineering",
      designation: "Senior DevOps Engineer",
    },
  },
  {
    id: "att-sample-2",
    employee_id: "emp-2",
    date: "2026-11-20",
    status: "late",
    shift: "General Shift",
    shift_id: "shift-gen",
    shift_start: "09:30 AM",
    shift_end: "06:30 PM",
    shift_duration_minutes: 540,
    check_in: "10:15 AM",
    check_out: "-",
    in_time: "10:15 AM",
    out_time: null,
    total_hours: 4.5,
    working_hours: "4h 30m",
    worked_minutes: 270,
    is_late: true,
    late_minutes: 45,
    late_display: "45m late",
    is_regularized: false,
    notes: "Traffic on Hinjewadi bridge",
    employee: {
      id: "emp-2",
      first_name: "Shruti",
      last_name: "Ugale",
      employee_code: "AAR003",
      department_id: "dept-dev",
      department_name: "Engineering",
      designation: "Software Engineer",
    },
  },
  {
    id: "att-sample-3",
    employee_id: "emp-3",
    date: "2026-11-20",
    status: "present",
    shift: "General Shift",
    shift_id: "shift-gen",
    shift_start: "09:30 AM",
    shift_end: "06:30 PM",
    shift_duration_minutes: 540,
    check_in: "09:05 AM",
    check_out: "-",
    in_time: "09:05 AM",
    out_time: null,
    total_hours: 5.75,
    working_hours: "5h 45m",
    worked_minutes: 345,
    is_late: false,
    late_minutes: 0,
    is_regularized: false,
    notes: "WFH Approved",
    employee: {
      id: "emp-3",
      first_name: "Rohit",
      last_name: "Kumar",
      employee_code: "AAR004",
      department_id: "dept-mkt",
      department_name: "Marketing",
      designation: "Marketing Lead",
    },
  },
  {
    id: "att-sample-4",
    employee_id: "emp-4",
    date: "2026-11-20",
    status: "half_day",
    shift: "Morning Shift",
    shift_id: "shift-mor",
    shift_start: "08:30 AM",
    shift_end: "01:30 PM",
    shift_duration_minutes: 300,
    check_in: "08:30 AM",
    check_out: "01:30 PM",
    in_time: "08:30 AM",
    out_time: "01:30 PM",
    total_hours: 5,
    working_hours: "5h 00m",
    worked_minutes: 300,
    is_late: false,
    is_regularized: false,
    notes: "First half approved",
    employee: {
      id: "emp-4",
      first_name: "Priya",
      last_name: "Sharma",
      employee_code: "AAR005",
      department_id: "dept-hr",
      department_name: "Human Resources",
      designation: "HR Executive",
    },
  },
  {
    id: "att-sample-5",
    employee_id: "emp-5",
    date: "2026-11-20",
    status: "on_leave",
    shift: "General Shift",
    shift_id: "shift-gen",
    shift_start: "09:30 AM",
    shift_end: "06:30 PM",
    check_in: "-",
    check_out: "-",
    in_time: null,
    out_time: null,
    total_hours: 0,
    working_hours: "-",
    is_late: false,
    is_regularized: false,
    notes: "Casual Leave (Approved)",
    employee: {
      id: "emp-5",
      first_name: "Amit",
      last_name: "Kapoor",
      employee_code: "AAR006",
      department_id: "dept-sales",
      department_name: "Sales",
      designation: "Senior Sales Executive",
    },
  },
  {
    id: "att-sample-6",
    employee_id: "emp-6",
    date: "2026-11-20",
    status: "missing_punch",
    shift: "General Shift",
    shift_id: "shift-gen",
    shift_start: "09:30 AM",
    shift_end: "06:30 PM",
    check_in: "09:20 AM",
    check_out: "-",
    in_time: "09:20 AM",
    out_time: null,
    total_hours: null,
    working_hours: "Incomplete",
    is_late: false,
    is_regularized: false,
    notes: "Biometric timeout at turnstile",
    employee: {
      id: "emp-6",
      first_name: "Kavita",
      last_name: "Nair",
      employee_code: "AAR007",
      department_id: "dept-finance",
      department_name: "Finance",
      designation: "Accountant",
    },
  },
  {
    id: "att-sample-7",
    employee_id: "emp-7",
    date: "2026-11-20",
    status: "absent",
    shift: "General Shift",
    shift_id: "shift-gen",
    shift_start: "09:30 AM",
    shift_end: "06:30 PM",
    check_in: "-",
    check_out: "-",
    in_time: null,
    out_time: null,
    total_hours: 0,
    working_hours: "-",
    is_late: false,
    is_regularized: false,
    notes: "Unplanned absence",
    employee: {
      id: "emp-7",
      first_name: "Vikram",
      last_name: "Singh",
      employee_code: "AAR008",
      department_id: "dept-dev",
      department_name: "Engineering",
      designation: "QA Engineer",
    },
  },
];

export const SAMPLE_ATTENDANCE_SUMMARY: AttendanceSummary = {
  date: "2026-11-20",
  total_employees: 35,
  present_count: 28,
  present_percentage: 80,
  late_count: 4,
  late_percentage: 11,
  on_leave_count: 2,
  on_leave_percentage: 6,
  absent_count: 1,
  absent_percentage: 3,
  missing_punch_count: 1,
  overtime_employee_count: 3,
  overtime_total_minutes: 180,
  overtime_total_display: "3h 00m",
  department_presence: [
    { department_id: "dept-dev", department_name: "Engineering", total_employees: 18, present_count: 15, present_percentage: 83 },
    { department_id: "dept-mkt", department_name: "Marketing", total_employees: 6, present_count: 5, present_percentage: 83 },
    { department_id: "dept-hr", department_name: "Human Resources", total_employees: 4, present_count: 4, present_percentage: 100 },
    { department_id: "dept-sales", department_name: "Sales", total_employees: 7, present_count: 4, present_percentage: 57 },
  ],
};

export function generateSampleMonthRecords(employeeId: string, year: number, monthIndex: number): EmployeeAttendanceRecord[] {
  const records: EmployeeAttendanceRecord[] = [];
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const today = new Date();

  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(year, monthIndex, day);
    const dayOfWeek = dateObj.getDay(); // 0 is Sunday, 6 is Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${d}`;

    if (dateObj > today) continue; // Future date

    if (isWeekend) {
      continue;
    }

    // Realistic patterns
    let status = "present";
    let inTime = "09:20 AM";
    let outTime: string | null = "06:35 PM";
    let hours = 8.75;
    let isLate = false;
    let lateMins = 0;
    const isRegularized = false;
    let remarks = "On-time arrival";

    if (day === 4) {
      status = "late";
      inTime = "10:12 AM";
      outTime = "06:40 PM";
      hours = 8.4;
      isLate = true;
      lateMins = 42;
      remarks = "Late by 42m - metro disruption";
    } else if (day === 8) {
      status = "half_day";
      inTime = "09:30 AM";
      outTime = "01:45 PM";
      hours = 4.25;
      remarks = "Half day approved for personal errand";
    } else if (day === 12) {
      status = "on_leave";
      inTime = "";
      outTime = null;
      hours = 0;
      remarks = "Casual Leave";
    } else if (day === 15) {
      status = "missing_punch";
      inTime = "09:25 AM";
      outTime = null;
      hours = 0;
      remarks = "Forgot to check out before leaving";
    } else if (day === 17) {
      status = "present";
      inTime = "09:10 AM";
      outTime = "07:45 PM";
      hours = 9.5;
      remarks = "Overtime 1h 15m (release deployment)";
    }

    records.push({
      id: `emp-att-${year}-${monthIndex}-${day}`,
      employee_id: employeeId,
      date: dateStr,
      in_time: inTime,
      out_time: outTime,
      check_in: inTime,
      check_out: outTime,
      status,
      total_hours: hours,
      remarks,
      shift: "General Shift",
      shift_start: "09:30 AM",
      shift_end: "06:30 PM",
      is_late: isLate,
      late_minutes: lateMins,
      is_regularized: isRegularized,
      created_at: `${dateStr}T09:20:00Z`,
      updated_at: `${dateStr}T18:35:00Z`,
    });
  }

  return records;
}
