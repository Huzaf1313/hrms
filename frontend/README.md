# TriMarkity HRMS Frontend

A modern, enterprise-grade HRMS frontend for Attendance Management, Leave Management, and core workforce operations. Designed following Keka, Zoho People, and Darwinbox enterprise UX standards with strict token consistency, high information density, and zero UI clutter.

---

## 1. Architecture & Design Tokens

### Design System Tokens (`src/styles/tokens.css`)
- **Typography**: Inter (`font-sans`), base 16px root font size.
  - Page Titles: 18px / 600 weight (`#1F2933`).
  - Panel / Card Headers: 14px / 600 weight (`#1F2933`).
  - Table Cells & Body: 13.5px / 400 weight (`#1F2933`).
  - Table Headers: 12px / 600 normal-case (`#4B5563` / `#7B8794`).
  - KPI Stat Numbers: 24px / 600 weight (`#1F2933`).
  - Metadata / Badges / Subtext: 11px - 12px / 500 weight.
- **Palette**:
  - Page Background: `#F6F7F5`
  - Panel Background: `#FFFFFF`
  - 1px Borders: `#E4E6E1`
  - Brand Primary: `#2F5FD0` (Hover: `#254FB2`)
  - Semantic Status Tints:
    - OK / Present / Approved: `#1E6B45` on `#E3F3EA`
    - Warn / Late / Half-Day / Pending: `#8A5A00` on `#FFF4E5`
    - Bad / Absent / Rejected: `#A12D22` on `#FBE4E1`
    - Info / WFH / Regularized: `#274C9E` on `#E6F0FA`
    - Off / Holiday / Rest Day: `#52606D` on `#F0F1EE`
  - Leave Category Accents:
    - Casual Leave: `#2F5FD0` (Tint: `#E8EEFB`)
    - Sick Leave: `#C2410C` (Tint: `#FFEDD5`)
    - Earned Leave: `#1E6B45` (Tint: `#E3F3EA`)
    - Comp Off: `#6D4AB5` (Tint: `#F3E8FF`)
    - Unpaid Leave: `#7B8794` (Tint: `#F0F1EE`)
- **Container & Layout**:
  - Border Radius: `rounded-[8px]` across panels, modals, and cards.
  - Box Shadows & Gradients: Explicitly purged (`box-shadow: none !important;`).
  - Shell: Sidebar width 240px, fixed 60px header, standard 24px layout content padding.

---

## 2. Modules Redesigned

### Attendance Management (`src/modules/attendance/`)
- **Admin Portal (`/dashboard/attendance`)**:
  - Single compact `StatStrip` with 5 live metrics (Present, On Time, Late, Absent, Half Day).
  - Collapsible 48px `Pending Regularization` quick-view bar (only expands when pending items exist).
  - `DailyAttendanceTable`: 48px row height, one-line search/filter toolbar, shift details, punch timestamps, semantic status pills, accessible row actions.
  - `AttendanceReportsView`: Monthly summaries, absentee trackers, late arrival analytics, working hours audit, and CSV export.
- **Employee Self-Service (`/employee/attendance`)**:
  - 360px left card (`TodayPunchCard`): Live clock, shift info, Office vs. WFH mode toggle, double-click protected 40px punch button, work timer, and punch timeline ribbon.
  - Right panel (`AttendanceHistoryView`): Calendar view with status tints + list view toggle.
  - Attendance regularization application drawer with validation.

### Leave Management (`src/modules/leaves/`)
- **Admin Portal (`/dashboard/leave`)**:
  - `AdminLeavePage`: Tabbed portal (`Pending Approvals`, `All Leave Records & Balances`, `Team Calendar`).
  - `LeaveApprovals`: High-density inbox with conflict/overlap warning indicators, quick approve, reject with reason dialog, and batch approval.
  - `LeaveBalanceHistory`: Unified table with category breakdown, annual entitlements, used days, available balances, and full application history with status filters.
  - `LeaveCalendarView`: Interactive team calendar with department & leave type filters.
- **Employee Portal (`/employee/leave`)**:
  - `EmployeeLeavePage`: Tabbed portal (`Overview & Balances`, `My History & Entitlements`, `Team Calendar`).
  - `LeaveDashboard`: KPI summary, `LeaveBalanceCards` with leave category accent bars, `UpcomingLeavesCard`, and `UpcomingHolidaysCard`.
  - `ApplyLeaveDrawer`: Clean slide-out drawer with leave category selection, dynamic working days calculation (auto-excluding weekends and gazetted holidays), half-day toggle, balance check, live validation, and attachment upload.

---

## 3. Role Permissions & Access Control

Permissions are checked via `src/lib/access.ts`:
- **Super Admin / HR**:
  - Full access to `/dashboard/*` modules.
  - Access to attendance override, regularization review, and leave approvals.
  - Ability to audit balances and view team-wide calendar schedules.
- **Manager**:
  - Review team regularizations and leave approvals.
  - View department attendance rosters and team calendars.
- **Employee**:
  - Restricted to `/employee/*` self-service routes.
  - Clock in/out with WFH toggle, file attendance regularizations, apply for leaves, and view personal leave balances and team schedules.

---

## 4. Mock Service Swappability (`src/services/mock/`)

All new features and views gracefully degrade to local mock adapters if the backend is offline or endpoints have not yet been deployed:
- `src/services/mock/leaveMockService.ts`:
  - `MOCK_DEFAULT_BALANCES`: Standard 2026 leave quotas.
  - `MOCK_HOLIDAYS_2026`: 2026 gazetted public holidays.
  - `MOCK_TEAM_LEAVES`: Cross-department team leave records for calendar view and overlap checking.
  - `MOCK_PENDING_APPROVALS`: Sample pending approvals with conflict detection.
- **How to swap to real backend**:
  - All calls in `src/modules/leaves/services/leaveService.ts` point to the backend API first (`/admin/leaves`, `/employee-leave`, `/employee-leave/employees/:id/balance`).
  - If the backend returns live data, the service returns it immediately. If the backend fails or endpoints are not implemented, it seamlessly falls back to the mock adapter.

---

## 5. Backend Needed (Pending API Contracts)

The frontend UI is ready for production. When backend engineering implements the following endpoints, the mock service fallbacks in `src/modules/leaves/services/leaveService.ts` can be removed:

1. **`GET /api/v1/leaves/holidays`**:
   - Query params: `?year=2026`
   - Returns: List of gazetted holidays (`[{ id, name, date, day }]`) to feed the holiday card and dynamic working days calculation.
2. **`GET /api/v1/leaves/team-calendar`**:
   - Query params: `?month=11&year=2026&department_id=...`
   - Returns: Scheduled leaves across employees for the month view (`[{ id, employee_id, employee_name, department_name, leave_type, start_date, end_date, total_days, status }]`).
3. **`GET /api/v1/leaves/check-overlap`**:
   - Query params: `?employee_id=...&start_date=...&end_date=...`
   - Returns: Whether the requested dates conflict with an existing leave application or an approved team absence.
4. **`POST /api/v1/admin/leaves/bulk-approve`**:
   - Body: `{ request_ids: string[] }`
   - Allows one-click bulk approval of multiple pending requests in the HR inbox.
