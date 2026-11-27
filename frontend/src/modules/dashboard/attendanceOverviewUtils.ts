export type DayAttendanceStatus =
  | "present"
  | "late"
  | "on_leave"
  | "absent"
  | "weekend"
  | "holiday"
  | "future"
  | "before_joining"
  | "today_pending";

export interface MonthlyAttendanceInputRecord {
  date: string;
  check_in?: string | null;
  check_out?: string | null;
  in_time?: string | null;
  out_time?: string | null;
  status?: string | null;
}

export interface MonthlyLeaveInputRequest {
  start_date: string;
  end_date: string;
  status: string;
  leave_type?: string;
}

export interface MonthlyHolidayInput {
  date: string;
  name: string;
  is_active?: boolean;
}

export interface MonthlyAttendanceDay {
  day: number;
  dateKey: string;
  dayOfWeek: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  status: DayAttendanceStatus;
  isToday: boolean;
  inTime: string | null;
  outTime: string | null;
  holidayName: string | null;
  leaveType: string | null;
}

export interface MonthlyAttendanceCounts {
  present: number;
  late: number;
  on_leave: number;
  absent: number;
}

export interface MonthlyAttendancePercentages {
  present: number;
  late: number;
  on_leave: number;
  absent: number;
}

export interface MonthlyAttendanceSummary {
  year: number;
  month: number; // 1-12
  monthKey: string;
  monthLabel: string;
  leadingEmptyDays: number; // Mon-first offset (0 = Mon ... 6 = Sun)
  days: MonthlyAttendanceDay[];
  workingDaysElapsed: number;
  counts: MonthlyAttendanceCounts;
  percentages: MonthlyAttendancePercentages;
}

export interface GetMonthlyAttendanceSummaryParams {
  year: number;
  month: number; // 1-12 (e.g. 11 for November)
  today?: Date | string;
  attendanceRecords?: MonthlyAttendanceInputRecord[];
  leaveRequests?: MonthlyLeaveInputRequest[];
  holidays?: MonthlyHolidayInput[];
  joiningDate?: string | null;
}

export const DAY_STATUS_LABELS: Record<DayAttendanceStatus, string> = {
  present: "Present",
  late: "Late",
  on_leave: "On Leave",
  absent: "Absent",
  weekend: "Weekend",
  holiday: "Company Holiday",
  future: "Upcoming",
  before_joining: "Before Joining",
  today_pending: "Today (Pending)",
};

export function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function toDateKey(value: Date | string): string {
  if (typeof value === "string") {
    return value.slice(0, 10);
  }
  return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
}

export function getMonthBounds(
  year: number,
  month: number,
): { startDate: string; endDate: string; daysInMonth: number } {
  const daysInMonth = new Date(year, month, 0).getDate();
  const prefix = `${year}-${pad2(month)}`;
  return {
    startDate: `${prefix}-01`,
    endDate: `${prefix}-${pad2(daysInMonth)}`,
    daysInMonth,
  };
}

export function getMonthOptions(
  anchorDate: Date = new Date(),
  monthsBack: number = 11,
): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  for (let offset = 0; offset <= monthsBack; offset += 1) {
    const d = new Date(anchorDate.getFullYear(), anchorDate.getMonth() - offset, 1);
    const value = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    const label = d.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });
    options.push({ value, label });
  }
  return options;
}

export function formatPunchTime(value?: string | null): string | null {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;

  if (/^\d{1,2}:\d{2}\s*[AP]M$/i.test(text)) {
    return text.toUpperCase();
  }

  const timeOnlyMatch = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (timeOnlyMatch) {
    const rawHours = Number(timeOnlyMatch[1]);
    const minutes = Number(timeOnlyMatch[2]);
    if (rawHours >= 0 && rawHours < 24 && minutes >= 0 && minutes < 60) {
      const period = rawHours >= 12 ? "PM" : "AM";
      const displayHour = rawHours % 12 === 0 ? 12 : rawHours % 12;
      return `${pad2(displayHour)}:${pad2(minutes)} ${period}`;
    }
  }

  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(text);
  const parsed = new Date(hasTimezone ? text : `${text}Z`);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function isLatePunch(value?: string | null): boolean {
  if (!value) return false;
  const text = String(value).trim();
  if (!text) return false;

  if (text.includes("T")) {
    const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(text);
    const parsed = new Date(hasTimezone ? text : `${text}Z`);
    if (!Number.isNaN(parsed.getTime())) {
      const istTime = parsed.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const [hours, minutes] = istTime.split(":").map(Number);
      return hours > 9 || (hours === 9 && minutes > 30);
    }
  }

  const amPmMatch = text.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (amPmMatch) {
    let hours = Number(amPmMatch[1]);
    const minutes = Number(amPmMatch[2]);
    const period = amPmMatch[3].toUpperCase();
    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    return hours > 9 || (hours === 9 && minutes > 30);
  }

  const timeMatch = text.match(/(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    const hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2]);
    return hours > 9 || (hours === 9 && minutes > 30);
  }

  return false;
}

/**
 * Computes a complete per-calendar-day attendance breakdown for a month.
 * `month` is 1-indexed (1 = January, 11 = November).
 */
export function getMonthlyAttendanceSummary({
  year,
  month,
  today = new Date(),
  attendanceRecords = [],
  leaveRequests = [],
  holidays = [],
  joiningDate = null,
}: GetMonthlyAttendanceSummaryParams): MonthlyAttendanceSummary {
  const { daysInMonth } = getMonthBounds(year, month);
  const monthKey = `${year}-${pad2(month)}`;
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const todayKey = toDateKey(today);
  const rawJoining =
    joiningDate && /^\d{4}-\d{2}-\d{2}/.test(joiningDate.trim())
      ? joiningDate.trim().slice(0, 10)
      : null;
  // Ignore a joining date set in the future when computing past/today attendance
  // so an already-active account never has its current month wiped out.
  const normalizedJoining =
    rawJoining && rawJoining <= todayKey ? rawJoining : null;

  // Map records by YYYY-MM-DD (latest/last wins if duplicates exist)
  const recordByDate = new Map<string, MonthlyAttendanceInputRecord>();
  for (const record of attendanceRecords) {
    if (!record?.date) continue;
    recordByDate.set(record.date.slice(0, 10), record);
  }

  // Map active holidays by YYYY-MM-DD
  const holidayByDate = new Map<string, string>();
  for (const holiday of holidays) {
    if (!holiday?.date || holiday.is_active === false) continue;
    holidayByDate.set(holiday.date.slice(0, 10), holiday.name);
  }

  // Map approved leave dates by YYYY-MM-DD
  const approvedLeaveByDate = new Map<string, string>();
  for (const leave of leaveRequests) {
    if (leave.status?.trim().toLowerCase() !== "approved") continue;
    const start = new Date(`${leave.start_date.slice(0, 10)}T00:00:00`);
    const end = new Date(`${leave.end_date.slice(0, 10)}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;

    const cursor = new Date(start);
    while (cursor <= end) {
      approvedLeaveByDate.set(toDateKey(cursor), leave.leave_type ?? "Approved Leave");
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const firstJsDay = new Date(year, month - 1, 1).getDay();
  const leadingEmptyDays = (firstJsDay + 6) % 7;

  const counts: MonthlyAttendanceCounts = {
    present: 0,
    late: 0,
    on_leave: 0,
    absent: 0,
  };

  const days: MonthlyAttendanceDay[] = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month - 1, day);
    const dateKey = `${monthKey}-${pad2(day)}`;
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isToday = dateKey === todayKey;
    const isFuture = dateKey > todayKey;
    const isBeforeJoining = Boolean(normalizedJoining && dateKey < normalizedJoining);

    const record = recordByDate.get(dateKey) ?? null;
    const holidayName = holidayByDate.get(dateKey) ?? null;
    const leaveType = approvedLeaveByDate.get(dateKey) ?? null;

    const rawIn = record?.check_in ?? record?.in_time ?? null;
    const rawOut = record?.check_out ?? record?.out_time ?? null;
    const inTime = formatPunchTime(rawIn);
    const outTime = formatPunchTime(rawOut);
    const recordStatus = record?.status?.trim().toLowerCase() ?? "";
    const hasPunch = Boolean(rawIn);
    const hasExplicitStatus =
      hasPunch ||
      recordStatus === "late" ||
      recordStatus === "half_day" ||
      recordStatus === "present" ||
      recordStatus === "working" ||
      recordStatus === "overtime" ||
      recordStatus === "on_leave";

    let status: DayAttendanceStatus;

    if (
      record &&
      (recordStatus === "late" ||
        recordStatus === "half_day" ||
        (hasPunch && isLatePunch(rawIn)))
    ) {
      status = "late";
    } else if (
      record &&
      (recordStatus === "present" ||
        recordStatus === "working" ||
        recordStatus === "overtime" ||
        hasPunch)
    ) {
      status = "present";
    } else if (leaveType !== null || recordStatus === "on_leave") {
      status = "on_leave";
    } else if (!hasExplicitStatus && isBeforeJoining) {
      status = "before_joining";
    } else if (isWeekend) {
      status = "weekend";
    } else if (holidayName) {
      status = "holiday";
    } else if (isFuture) {
      status = "future";
    } else if (isToday) {
      status = "today_pending";
    } else {
      status = "absent";
    }

    if (status === "present") counts.present += 1;
    else if (status === "late") counts.late += 1;
    else if (status === "on_leave") counts.on_leave += 1;
    else if (status === "absent") counts.absent += 1;

    days.push({
      day,
      dateKey,
      dayOfWeek,
      status,
      isToday,
      inTime,
      outTime,
      holidayName,
      leaveType,
    });
  }

  const workingDaysElapsed =
    counts.present + counts.late + counts.on_leave + counts.absent;

  const pct = (count: number) =>
    workingDaysElapsed > 0 ? Math.round((count / workingDaysElapsed) * 100) : 0;

  return {
    year,
    month,
    monthKey,
    monthLabel,
    leadingEmptyDays,
    days,
    workingDaysElapsed,
    counts,
    percentages: {
      present: pct(counts.present),
      late: pct(counts.late),
      on_leave: pct(counts.on_leave),
      absent: pct(counts.absent),
    },
  };
}
