import type { LeaveRequest } from "./admin_leave_service";

/**
 * Browser-side storage for the leave requests an admin files for themselves.
 *
 * The admin portal has no "create leave" endpoint of its own yet - the one
 * that exists belongs to the employee portal and needs an employee record.
 * Until that lands, a self-application is kept in localStorage so it survives a
 * reload and is still there the next time the page is opened.
 *
 * Swapping this for a real `POST /employee-leave` call is a change to this
 * file only: every caller goes through `list`, `add` and `update`.
 */

const STORAGE_KEY = "hrms_admin_my_leave_requests";

function readRows(): LeaveRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;

    return Array.isArray(parsed) ? (parsed as LeaveRequest[]) : [];
  } catch {
    return [];
  }
}

function writeRows(rows: LeaveRequest[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch {
    // Storage can be full or blocked by the browser. The request still shows
    // up for the rest of this session, it just will not survive a reload.
  }
}

export const adminMyLeaveStore = {
  /** Every self-application, newest first. */
  list(): LeaveRequest[] {
    return readRows();
  },

  /** Adds a request and returns the new list. */
  add(request: LeaveRequest): LeaveRequest[] {
    const rows = [request, ...readRows()];

    writeRows(rows);

    return rows;
  },

  /** Applies a patch to one request and returns the new list. */
  update(id: string, patch: Partial<LeaveRequest>): LeaveRequest[] {
    const rows = readRows().map((row) =>
      row.id === id ? { ...row, ...patch } : row,
    );

    writeRows(rows);

    return rows;
  },
};
