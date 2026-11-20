import { api } from "../api";

export type ReportType = "monthly_summary" | "late_arrivals" | "absenteeism" | "working_hours";

export interface MonthlySummaryRow {
  employee_id: string;
  employee_code: string;
  name: string;
  department: string;
  designation: string;
  scheduled_days: number;
  present_days: number;
  late_days: number;
  absent_days: number;
  half_days: number;
  leave_days: number;
  total_hours: number;
  avg_hours_per_day: number;
  attendance_percentage: number;
}

export interface LateArrivalRow {
  id: string;
  employee_code: string;
  name: string;
  department: string;
  date: string;
  shift_timing: string;
  scheduled_in: string;
  actual_in: string;
  delay_minutes: number;
  status: "Grace Availed" | "Late Mark" | "Regularized";
}

export interface AbsenteeismRow {
  id: string;
  employee_code: string;
  name: string;
  department: string;
  date: string;
  type: "Uninformed Absence" | "Loss of Pay (LOP)" | "Unapproved Leave";
  reporting_manager: string;
}

export interface WorkingHoursRow {
  employee_code: string;
  name: string;
  department: string;
  expected_hours: number;
  logged_hours: number;
  difference_hours: number;
  status: "Target Met" | "Overtime" | "Hours Deficit";
}

export interface AttendanceReportResult {
  isMock: boolean;
  type: ReportType;
  generated_at: string;
  totals: {
    total_employees: number;
    avg_attendance_rate: number;
    total_late_instances: number;
    total_absent_days: number;
    avg_hours: number;
  };
  monthlySummary: MonthlySummaryRow[];
  lateArrivals: LateArrivalRow[];
  absenteeism: AbsenteeismRow[];
  workingHours: WorkingHoursRow[];
}

export interface ReportFilterParams {
  type: ReportType;
  month?: string; // YYYY-MM
  startDate?: string;
  endDate?: string;
  departmentId?: string;
  search?: string;
}

const MOCK_MONTHLY_SUMMARY: MonthlySummaryRow[] = [
  {
    employee_id: "emp-001",
    employee_code: "AAR001",
    name: "Aarav Sharma",
    department: "Engineering",
    designation: "Staff Software Engineer",
    scheduled_days: 22,
    present_days: 20,
    late_days: 1,
    absent_days: 0,
    half_days: 1,
    leave_days: 1,
    total_hours: 176.5,
    avg_hours_per_day: 8.6,
    attendance_percentage: 95.5,
  },
  {
    employee_id: "emp-002",
    employee_code: "PRI002",
    name: "Priya Patel",
    department: "Product & Design",
    designation: "Senior Product Designer",
    scheduled_days: 22,
    present_days: 21,
    late_days: 2,
    absent_days: 0,
    half_days: 0,
    leave_days: 1,
    total_hours: 174.0,
    avg_hours_per_day: 8.3,
    attendance_percentage: 97.7,
  },
  {
    employee_id: "emp-003",
    employee_code: "ROH003",
    name: "Rohan Verma",
    department: "Engineering",
    designation: "Frontend Engineer II",
    scheduled_days: 22,
    present_days: 19,
    late_days: 3,
    absent_days: 1,
    half_days: 1,
    leave_days: 1,
    total_hours: 158.0,
    avg_hours_per_day: 7.9,
    attendance_percentage: 88.6,
  },
  {
    employee_id: "emp-004",
    employee_code: "ANB004",
    name: "Ananya Iyer",
    department: "Human Resources",
    designation: "HR Operations Lead",
    scheduled_days: 22,
    present_days: 22,
    late_days: 0,
    absent_days: 0,
    half_days: 0,
    leave_days: 0,
    total_hours: 184.2,
    avg_hours_per_day: 8.4,
    attendance_percentage: 100.0,
  },
  {
    employee_id: "emp-005",
    employee_code: "VIK005",
    name: "Vikram Malhotra",
    department: "Sales & Marketing",
    designation: "Enterprise Account Executive",
    scheduled_days: 22,
    present_days: 18,
    late_days: 4,
    absent_days: 2,
    half_days: 0,
    leave_days: 2,
    total_hours: 148.5,
    avg_hours_per_day: 8.2,
    attendance_percentage: 81.8,
  },
  {
    employee_id: "emp-006",
    employee_code: "SNE006",
    name: "Sneha Kulkarni",
    department: "Finance & Operations",
    designation: "Senior Financial Analyst",
    scheduled_days: 22,
    present_days: 21,
    late_days: 1,
    absent_days: 0,
    half_days: 0,
    leave_days: 1,
    total_hours: 172.8,
    avg_hours_per_day: 8.2,
    attendance_percentage: 95.5,
  },
  {
    employee_id: "emp-007",
    employee_code: "RAJ007",
    name: "Rajesh Nair",
    department: "Engineering",
    designation: "Backend Architect",
    scheduled_days: 22,
    present_days: 21,
    late_days: 0,
    absent_days: 0,
    half_days: 0,
    leave_days: 1,
    total_hours: 189.0,
    avg_hours_per_day: 9.0,
    attendance_percentage: 97.7,
  },
  {
    employee_id: "emp-008",
    employee_code: "MEE008",
    name: "Meera Sen",
    department: "Product & Design",
    designation: "UX Researcher",
    scheduled_days: 22,
    present_days: 20,
    late_days: 1,
    absent_days: 1,
    half_days: 0,
    leave_days: 1,
    total_hours: 164.0,
    avg_hours_per_day: 8.2,
    attendance_percentage: 90.9,
  },
];

const MOCK_LATE_ARRIVALS: LateArrivalRow[] = [
  {
    id: "late-01",
    employee_code: "ROH003",
    name: "Rohan Verma",
    department: "Engineering",
    date: "18 Nov 2026",
    shift_timing: "09:30 AM - 06:30 PM",
    scheduled_in: "09:30 AM",
    actual_in: "10:05 AM",
    delay_minutes: 35,
    status: "Late Mark",
  },
  {
    id: "late-02",
    employee_code: "VIK005",
    name: "Vikram Malhotra",
    department: "Sales & Marketing",
    date: "17 Nov 2026",
    shift_timing: "09:30 AM - 06:30 PM",
    scheduled_in: "09:30 AM",
    actual_in: "09:42 AM",
    delay_minutes: 12,
    status: "Grace Availed",
  },
  {
    id: "late-03",
    employee_code: "VIK005",
    name: "Vikram Malhotra",
    department: "Sales & Marketing",
    date: "15 Nov 2026",
    shift_timing: "09:30 AM - 06:30 PM",
    scheduled_in: "09:30 AM",
    actual_in: "10:15 AM",
    delay_minutes: 45,
    status: "Regularized",
  },
  {
    id: "late-04",
    employee_code: "PRI002",
    name: "Priya Patel",
    department: "Product & Design",
    date: "14 Nov 2026",
    shift_timing: "09:30 AM - 06:30 PM",
    scheduled_in: "09:30 AM",
    actual_in: "09:50 AM",
    delay_minutes: 20,
    status: "Late Mark",
  },
  {
    id: "late-05",
    employee_code: "SNE006",
    name: "Sneha Kulkarni",
    department: "Finance & Operations",
    date: "10 Nov 2026",
    shift_timing: "09:30 AM - 06:30 PM",
    scheduled_in: "09:30 AM",
    actual_in: "09:40 AM",
    delay_minutes: 10,
    status: "Grace Availed",
  },
];

const MOCK_ABSENTEEISM: AbsenteeismRow[] = [
  {
    id: "abs-01",
    employee_code: "ROH003",
    name: "Rohan Verma",
    department: "Engineering",
    date: "11 Nov 2026",
    type: "Uninformed Absence",
    reporting_manager: "Aarav Sharma",
  },
  {
    id: "abs-02",
    employee_code: "VIK005",
    name: "Vikram Malhotra",
    department: "Sales & Marketing",
    date: "04 Nov 2026",
    type: "Loss of Pay (LOP)",
    reporting_manager: "Sanjay Singhania",
  },
  {
    id: "abs-03",
    employee_code: "VIK005",
    name: "Vikram Malhotra",
    department: "Sales & Marketing",
    date: "05 Nov 2026",
    type: "Loss of Pay (LOP)",
    reporting_manager: "Sanjay Singhania",
  },
  {
    id: "abs-04",
    employee_code: "MEE008",
    name: "Meera Sen",
    department: "Product & Design",
    date: "02 Nov 2026",
    type: "Unapproved Leave",
    reporting_manager: "Priya Patel",
  },
];

const MOCK_WORKING_HOURS: WorkingHoursRow[] = [
  {
    employee_code: "AAR001",
    name: "Aarav Sharma",
    department: "Engineering",
    expected_hours: 176.0,
    logged_hours: 176.5,
    difference_hours: 0.5,
    status: "Target Met",
  },
  {
    employee_code: "PRI002",
    name: "Priya Patel",
    department: "Product & Design",
    expected_hours: 176.0,
    logged_hours: 174.0,
    difference_hours: -2.0,
    status: "Target Met",
  },
  {
    employee_code: "ROH003",
    name: "Rohan Verma",
    department: "Engineering",
    expected_hours: 176.0,
    logged_hours: 158.0,
    difference_hours: -18.0,
    status: "Hours Deficit",
  },
  {
    employee_code: "ANB004",
    name: "Ananya Iyer",
    department: "Human Resources",
    expected_hours: 176.0,
    logged_hours: 184.2,
    difference_hours: 8.2,
    status: "Overtime",
  },
  {
    employee_code: "VIK005",
    name: "Vikram Malhotra",
    department: "Sales & Marketing",
    expected_hours: 176.0,
    logged_hours: 148.5,
    difference_hours: -27.5,
    status: "Hours Deficit",
  },
  {
    employee_code: "SNE006",
    name: "Sneha Kulkarni",
    department: "Finance & Operations",
    expected_hours: 176.0,
    logged_hours: 172.8,
    difference_hours: -3.2,
    status: "Target Met",
  },
  {
    employee_code: "RAJ007",
    name: "Rajesh Nair",
    department: "Engineering",
    expected_hours: 176.0,
    logged_hours: 189.0,
    difference_hours: 13.0,
    status: "Overtime",
  },
  {
    employee_code: "MEE008",
    name: "Meera Sen",
    department: "Product & Design",
    expected_hours: 176.0,
    logged_hours: 164.0,
    difference_hours: -12.0,
    status: "Hours Deficit",
  },
];

export const attendanceReportsService = {
  async getReport(params: ReportFilterParams): Promise<AttendanceReportResult> {
    try {
      // Attempt backend API call first
      const data = await api.get<AttendanceReportResult>("/attendance/reports", {
        type: params.type,
        month: params.month,
        start_date: params.startDate,
        end_date: params.endDate,
        department_id: params.departmentId,
        search: params.search,
      });
      return { ...data, isMock: false };
    } catch {
      // Backend endpoint does not exist yet -> use realistic mock data
      const q = (params.search || "").toLowerCase().trim();
      const dep = params.departmentId || "";

      let filteredSummary = [...MOCK_MONTHLY_SUMMARY];
      if (dep) {
        filteredSummary = filteredSummary.filter((r) => r.department.toLowerCase().includes(dep.toLowerCase()));
      }
      if (q) {
        filteredSummary = filteredSummary.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.employee_code.toLowerCase().includes(q) ||
            r.department.toLowerCase().includes(q),
        );
      }

      let filteredLate = [...MOCK_LATE_ARRIVALS];
      if (dep) {
        filteredLate = filteredLate.filter((r) => r.department.toLowerCase().includes(dep.toLowerCase()));
      }
      if (q) {
        filteredLate = filteredLate.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.employee_code.toLowerCase().includes(q) ||
            r.department.toLowerCase().includes(q),
        );
      }

      let filteredAbs = [...MOCK_ABSENTEEISM];
      if (dep) {
        filteredAbs = filteredAbs.filter((r) => r.department.toLowerCase().includes(dep.toLowerCase()));
      }
      if (q) {
        filteredAbs = filteredAbs.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.employee_code.toLowerCase().includes(q) ||
            r.department.toLowerCase().includes(q),
        );
      }

      let filteredHours = [...MOCK_WORKING_HOURS];
      if (dep) {
        filteredHours = filteredHours.filter((r) => r.department.toLowerCase().includes(dep.toLowerCase()));
      }
      if (q) {
        filteredHours = filteredHours.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.employee_code.toLowerCase().includes(q) ||
            r.department.toLowerCase().includes(q),
        );
      }

      const totalEmployees = filteredSummary.length;
      const avgRate =
        totalEmployees > 0
          ? Number(
              (
                filteredSummary.reduce((acc, cur) => acc + cur.attendance_percentage, 0) / totalEmployees
              ).toFixed(1),
            )
          : 0;
      const totalLate = filteredSummary.reduce((acc, cur) => acc + cur.late_days, 0);
      const totalAbsent = filteredSummary.reduce((acc, cur) => acc + cur.absent_days, 0);
      const avgHours =
        totalEmployees > 0
          ? Number(
              (
                filteredSummary.reduce((acc, cur) => acc + cur.avg_hours_per_day, 0) / totalEmployees
              ).toFixed(1),
            )
          : 0;

      return {
        isMock: true,
        type: params.type,
        generated_at: new Date().toISOString(),
        totals: {
          total_employees: totalEmployees,
          avg_attendance_rate: avgRate,
          total_late_instances: totalLate,
          total_absent_days: totalAbsent,
          avg_hours: avgHours,
        },
        monthlySummary: filteredSummary,
        lateArrivals: filteredLate,
        absenteeism: filteredAbs,
        workingHours: filteredHours,
      };
    }
  },

  exportCsv(result: AttendanceReportResult, filename = "attendance_report.csv") {
    let csvContent = "";

    if (result.type === "monthly_summary") {
      csvContent += "Employee Code,Name,Department,Designation,Scheduled Days,Present Days,Late Days,Absent Days,Half Days,Leave Days,Total Hours,Avg Hours/Day,Attendance %\n";
      result.monthlySummary.forEach((r) => {
        csvContent += `"${r.employee_code}","${r.name}","${r.department}","${r.designation}",${r.scheduled_days},${r.present_days},${r.late_days},${r.absent_days},${r.half_days},${r.leave_days},${r.total_hours},${r.avg_hours_per_day},${r.attendance_percentage}%\n`;
      });
    } else if (result.type === "late_arrivals") {
      csvContent += "Employee Code,Name,Department,Date,Shift,Scheduled In,Actual In,Delay (Mins),Status\n";
      result.lateArrivals.forEach((r) => {
        csvContent += `"${r.employee_code}","${r.name}","${r.department}","${r.date}","${r.shift_timing}","${r.scheduled_in}","${r.actual_in}",${r.delay_minutes},"${r.status}"\n`;
      });
    } else if (result.type === "absenteeism") {
      csvContent += "Employee Code,Name,Department,Date,Absence Type,Reporting Manager\n";
      result.absenteeism.forEach((r) => {
        csvContent += `"${r.employee_code}","${r.name}","${r.department}","${r.date}","${r.type}","${r.reporting_manager}"\n`;
      });
    } else if (result.type === "working_hours") {
      csvContent += "Employee Code,Name,Department,Expected Hours,Logged Hours,Difference Hours,Status\n";
      result.workingHours.forEach((r) => {
        csvContent += `"${r.employee_code}","${r.name}","${r.department}",${r.expected_hours},${r.logged_hours},${r.difference_hours},"${r.status}"\n`;
      });
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};
