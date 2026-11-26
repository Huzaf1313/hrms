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

export const attendanceReportsService = {
  async getReport(params: ReportFilterParams): Promise<AttendanceReportResult> {
    try {
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
      return {
        isMock: false,
        type: params.type,
        generated_at: new Date().toISOString(),
        totals: {
          total_employees: 0,
          avg_attendance_rate: 0,
          total_late_instances: 0,
          total_absent_days: 0,
          avg_hours: 0,
        },
        monthlySummary: [],
        lateArrivals: [],
        absenteeism: [],
        workingHours: [],
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
