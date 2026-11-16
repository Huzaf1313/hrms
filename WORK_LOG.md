# HRMS — Work Log (Zaid Momin)

The work I've done on the HRMS project from **13 Aug 2026 to 14 Nov 2026**, grouped by module.
Taken from the git history: 46 commits under *Zaid Momin* / *iamzaidmomin* and 13 pull requests merged into the shared branches.
Teammates' work (Aabshar, Atharv, Harsh, Jay, Shruti) is credited only where it shares a module with mine.

---

## Summary

| Area | What was delivered |
| --- | --- |
| Project foundation | Backend skeleton (FastAPI + MongoDB), health check, layered architecture, React frontend shell |
| Employees & departments | Department CRUD, employee management, employee ID scheme, seed and migration scripts |
| Attendance | Punch in/out, IST handling, late status, shifts, overtime, working-hours calculation, export, backfill script |
| Regularization | Employee request modal, admin review screens, backend API, manager scoping, access tests |
| Leave | Admin leave management, leave balances, HR/manager self-applications, self-approval blocked |
| Payroll | Salary structures, deductions, admin payslips |
| Announcements | Admin announcement module, employee feed, dashboard announcement ticker |
| Admin dashboard | KPI row, attendance trend, department donut, recruitment funnel, interviews, birthdays, pending approvals, activity |
| Assets & exit | Asset inventory, assignment and returns, asset requests, admin exit-request handling |
| Documents & storage | Employee document upload on Cloudflare R2, admin document view |
| Super admin | New `super_admin` role, admin account management, email OTP, welcome email |
| Security | Refresh and access tokens moved to HttpOnly cookies, CSRF header check, role groups, tests |

---

## 1. Project foundation — Aug 2026

- **13 Aug** — Set up the backend: FastAPI app, config, MongoDB connection, `/health` check.
- **13 Aug** — Added the layered backend structure (models → repositories → services → API routes) through the Department CRUD module, which later modules followed.
- **17 Aug** — Set up the React + TypeScript + Vite frontend with the dashboard layout, sidebar and header.
- **19 Aug** — Added the dashboard API and environment configuration (`.env.example`).

## 2. Employees & departments

- **17–20 Aug** — Employee management: schemas, repository, service and API; employee form, table, details modal and details page on the frontend.
- **20 Aug** — Department seed and clean-up scripts (`create_departments.py`, `clean_departments.py`).
- **29 Oct** — Shift, department and leave-balance updates to employee and user records.
- **12 Nov** — Employee ID scheme:
  - Super admin shows **AAR001** (display-only, never stored); real employee codes start at **AAR002**.
  - `shift_employee_ids.py` — a one-off migration that moves every employee ID and its references forward by one. It runs as a dry run unless told otherwise.
  - `migrate_employee_ids.py` now numbers from AAR002.
  - The Add Employee form shows the next employee ID as a preview (`GET /employees/next-id`).
- **12 Nov** — The email verification token is used up only after the department, salary and shift checks pass, so a fixable form mistake no longer wastes the token.

## 3. Attendance

- **24 Aug** — Attendance module: backend API and admin/employee attendance pages.
- **27 Aug** — Fixed IST time conversion, working-hours calculation and summary status matching.
- **31 Aug** — Late-status logic, time formatting, shift display; first version of the celebration ticker.
- **2–3 Sep** — Consistent working-hours format, reorganised attendance page, employee attendance export.
- **1 Oct** — **Shifts and overtime**: shift API, shift-aware attendance calculation (`attendance_calculation.py`), overtime tracking.
- **5 Oct** — Working-days helper (weekends excluded) and `backfill_attendance_metrics.py` to recalculate past records.
- **5 Oct** — Fixed the employee late-status display.
- **9 Nov** — Removed the duplicate per-row menu; fixed the "No employee record found" error when the super admin marked attendance.

## 4. Attendance regularization

- **1 Sep** — Employee regularization request modal and admin review section.
- **3 Sep** — Regularization backend: model, repository, service, API; admin Regularization Requests page and dashboard card.
- **22 Sep** — Fixes to regularization endpoints.
- **5 Nov** — Merged Aabshar's regularization work with mine; session and date-picker updates.
- **12 Nov** — Fixes and access rules:
  - Fixed approve/reject, which had stopped working after a merge moved `review_request` outside its service class.
  - Managers see and review only their own team's requests.
  - Nobody can review their own request (403).
  - HR and managers can file their own requests from the admin Attendance page.
  - Review errors now show in the modal, and a half-finished approval can be retried.

## 5. Leave management

- **26 Aug** — Leave management API and admin leave page.
- **4–8 Sep** — Reorganised the leave module (`admin_leaves`), rebuilt the admin leave page, added leave info to employee details.
- **29 Oct** — Leave balance repository and admin leave balance endpoints.
- **9 Nov** — HR and manager self-applications used to sit in `localStorage` and never reach the server. They now go through `/employee-leave`, so HR and the super admin can approve them. Self-approval is blocked (403), and HR/manager requests are badged.

## 6. Payroll

- **17 Sep** — Salary structures and deductions: backend modules and admin payroll components.
- **28 Sep** — Admin payslip API and repository.

## 7. Announcements

- **18 Sep** — Admin announcement module (create, publish, manage) and announcements page.
- **28 Sep** — Updates to the employee announcement feed.
- **12 Nov** — Announcement ticker on the admin dashboard; managers see announcement events in Recent Activity; the employee feed refreshes every minute.
- **13 Nov** — Combined the celebration and announcement banners into one `DashboardTicker`.

## 8. Admin dashboard

- **5 Oct** — Built the admin dashboard: KPI row, attendance trend chart, department donut, payroll summary, pending leave requests, quick actions, recent activity, recruitment funnel, upcoming interviews, birthdays and anniversaries.
- **7 Oct** — Rebuilt the birthdays/anniversaries and pending-leave cards.
- **15 Oct** — Connected the recruitment funnel and upcoming interviews to live candidate data.
- **15–16 Oct** — Admin notifications, tickets, calendar and the admin profile page.
- **12 Nov** — Replaced the toast messages on seven admin pages with one shared, centered `NoticePopup`.

## 9. Assets & exit requests

- **7 Oct** — Asset management frontend.
- **13 Oct** — Asset backend: inventory, assignment, returns and asset requests; `seed_assets.py`; assign/return/detail/form modals.
- **13 Oct** — Admin exit-request handling, linked to asset recovery (allocation details, delete confirmation).

## 10. Documents & file storage

- **3 Nov** — Employee document upload and profile photos stored on **Cloudflare R2** (S3-compatible); activity logging.
- **3 Nov** — Fixed document upload and frontend build errors.
- **5 Nov** — Admin employee documents view and calendar updates.

## 11. Super admin role — `super-admin` branch, Nov 2026

- **7 Nov** — Added a new `super_admin` role:
  - Has every HR permission and sees data across the whole organisation.
  - Only the super admin can create HR admin and manager accounts, or lock, unlock, deactivate and reactivate them. Locking or deactivating ends that account's sessions immediately.
  - The account is created on startup from the `BOOTSTRAP_SUPER_ADMIN_*` settings.
  - Replaced hard-coded role checks with the `HR_LEVEL_ROLES` and `ADMIN_ROLES` groups.
  - Frontend: Admin Accounts page, sidebar entry, role labels.
- **9 Nov** — Super admin profile: editable name, optional designation/department/phone, header updates without signing in again.
- **12 Nov** — Admin Accounts:
  - New HR admin and manager accounts need an OTP-verified email; the server enforces this.
  - A welcome email is sent on account creation. If sending fails, the account is still created and the problem is reported.
  - The browser confirm on Lock/Deactivate is replaced with an in-app dialog.

## 12. Authentication & security

- **12 Nov** — The refresh token is an HttpOnly cookie limited to `/api/v1/auth`; nothing is stored in `localStorage`. The session is restored after a page reload, and logout always clears the cookie. New `COOKIE_SECURE` and `COOKIE_SAMESITE` settings.
- **13 Nov** — The access token is also an HttpOnly cookie. The API accepts either the bearer header or the cookie, and writes made with the cookie need an `X-Requested-With` header to block CSRF. The frontend API client no longer keeps the token.
- Profile menus close on an outside click or Escape.

## 13. Testing & maintenance

- Tests added in `backend/tests/`: cookie auth (`test_auth_cookie.py`) and regularization access (`test_regularization_access.py`).
- Employee creation tests now mock the activity log and the employee-code sequence, so they no longer write fake records to the shared database.
- **9 Nov** — Removed a duplicate `boto3` pin that made `pip install -r requirements.txt` fail.
- **14 Nov** — Brought `requirements.txt` in line with the working environment. Pinned the 7 missing indirect dependencies (`argon2-cffi`, `argon2-cffi-bindings`, `cffi`, `pycparser`, `six`, `urllib3`, Windows-only `colorama`), so it now pins exactly the 37 packages installed in `.venv`.
- Merged the team's branches regularly (Zaid-Features, AabsharFeatures, Harsh-Features → dev/main) and resolved conflicts, including reverting a bad Harsh-Features merge on 21 Oct.

---

## Open items

- `pytest` and `httpx` are needed by the backend tests but aren't in `requirements.txt` or the venv. They should go in a `requirements-dev.txt`.
- The `super-admin` branch hasn't been merged into `main` yet.
