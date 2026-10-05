export function parseDateOnly(value: string): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isWeekendDate(value: Date): boolean {
  const day = value.getDay();

  return day === 0 || day === 6;
}

export function isWeekend(value: string): boolean {
  const parsed = parseDateOnly(value);

  return parsed ? isWeekendDate(parsed) : false;
}

/**
 * Counts leave days inside an inclusive range. Saturdays and Sundays are
 * predefined weekly offs, so they never count towards a leave request.
 */
export function countWorkingDays(startDate: string, endDate: string): number {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);

  if (!start || !end || end < start) {
    return 0;
  }

  let total = 0;

  const current = new Date(start);

  while (current <= end) {
    if (!isWeekendDate(current)) {
      total += 1;
    }

    current.setDate(current.getDate() + 1);
  }

  return total;
}