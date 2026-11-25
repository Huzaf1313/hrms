# HRMS Project Documentation

This document describes the HRMS application in this repository: what it is
for, how it works, how to run it, and what each important source file is
responsible for. It is written against the current codebase, not the default
Vite template documentation.

## 1. Project Purpose

HRMS means Human Resource Management System. The application centralizes
employee and HR operations in two web portals:

- The **admin portal** is used by super administrators, HR administrators, and
  managers to manage people, departments, attendance, leave, payroll,
  recruitment, assets, announcements, and reports.
- The **employee portal** is used by employees for self-service tasks such as
  viewing their profile, punching attendance, requesting leave,
  downloading payslips and documents, requesting support, and submitting an
  exit or resignation request.

The project is a full-stack application:

| Layer | Technology | Purpose |
| --- | --- | --- |
| Frontend | React 19, TypeScript, Vite | Browser UI and client-side routing |
| Styling | Tailwind CSS 4 | Layout, responsive design, and visual styling |
| Data fetching | TanStack React Query | Server state, caching, loading, and refetching |
| Backend | Python, FastAPI | HTTP API, validation, authorization, and business logic |
| Database | MongoDB through Motor | Persistent document data and indexes |
| Cache | Redis | Optional cache/session-related infrastructure |
| Authentication | JWT, HttpOnly cookies, Argon2 | Login sessions and password security |
| Email | SMTP and Jinja2 | OTP, welcome, and password-reset messages |
| File storage | Cloudflare R2/S3-compatible storage | Private employee photos and documents |

## 2. High-Level Request Flow

1. A user opens the Vite frontend in a browser.
2. `frontend/src/main.tsx` creates the React application and providers.
3. `frontend/src/App.tsx` chooses the login, admin, or employee route.
4. A page calls a typed client in `frontend/src/services/`.
5. `frontend/src/services/api.ts` sends the request to the FastAPI API.
6. FastAPI routes in `backend/app/api/v1/` authenticate the request and parse
   request data using Pydantic schemas.
7. A service in `backend/app/services/` applies business rules.
8. A repository in `backend/app/repositories/` reads or writes MongoDB.
9. The API returns the standard response envelope:

   ```json
   { "success": true, "message": "...", "data": {} }
   ```

10. React Query updates the page and its cache with the returned data.

The intended backend layering is:

```text
API router -> schema validation -> service/business rules -> repository -> MongoDB
```

Routes should handle HTTP concerns, services should enforce rules, and
repositories should own database queries. Cross-field rules such as duplicate
emails, overlapping leave, manager scope, and salary validation belong in the
service layer.

## 3. Repository Layout

```text
HRMS-AabsharFeatures/
├── backend/                    Python API and operational scripts
├── frontend/                   React web application
├── start-all.bat               Windows launcher for both development servers
├── README.md                   Short setup and feature overview
├── WORK_LOG.md                 Historical development log
├── PROJECT_DOCUMENTATION.md    This detailed guide
└── .gitignore                  Ignored local, generated, and secret files
```

Generated files are intentionally not documented individually: `__pycache__/`,
`frontend/dist/`, local virtual environments, installed dependencies, and
`.env` files are build/runtime output or secrets rather than application source.

## 4. Running the Project

### Prerequisites

- Python 3.10 or newer
- Node.js 20 or newer
- MongoDB, either local or MongoDB Atlas
- Redis only if Redis features are enabled
- SMTP credentials for OTP and welcome emails
- Cloudflare R2 credentials for private employee files

### Backend setup

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate       # Windows
# source .venv/bin/activate         # macOS/Linux
pip install -r requirements.txt
```

Copy `backend/.env.example` to `backend/.env` and provide real values. Never
commit `.env`, passwords, JWT secrets, SMTP credentials, or R2 keys.

Start the API from the `backend` directory:

```bash
uvicorn app.main:app --reload
```

The API is available at `http://localhost:8000`; Swagger UI is at
`http://localhost:8000/docs` and ReDoc is at `/redoc`.

### Frontend setup

```bash
cd frontend
npm install
```

Copy `frontend/.env.example` to `frontend/.env` and set:

```ini
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

Run the frontend:

```bash
npm run dev
```

It is served at `http://localhost:5173`.

On Windows, `start-all.bat` starts both processes in separate command windows.
It prefers `backend/.venv/Scripts/python.exe` and starts Uvicorn on port 8000
and Vite on port 5173.

### Frontend commands

| Command | Use |
| --- | --- |
| `npm run dev` | Vite development server |
| `npm run start` | Vite on port 5173 with strict port checking |
| `npm run build` | TypeScript build followed by production Vite build |
| `npm run lint` | ESLint |
| `npm run preview` | Preview the production build |

## 5. Configuration

### Backend environment variables

`backend/.env.example` documents the supported settings.

| Variable group | Variables | Purpose |
| --- | --- | --- |
| Database | `MONGODB_URI`, `DATABASE_NAME` | MongoDB connection and database |
| Browser access | `CORS_ORIGINS`, `FRONTEND_URL` | Allowed frontend origins and login links |
| JWT | `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS` | Token signing and lifetimes |
| Cookies | `COOKIE_SECURE`, `COOKIE_SAMESITE` | Access and refresh cookie behavior |
| Email | `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM` | SMTP delivery |
| Local files | `UPLOAD_DIR`, `PRIVATE_UPLOAD_DIR` | Runtime upload directories |
| Bootstrap users | `BOOTSTRAP_HR_*`, `BOOTSTRAP_SUPER_ADMIN_*` | Optional first admin accounts |
| R2 | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_SIGNED_URL_EXPIRY` | Private object storage |
| Redis | `REDIS_URL`, `REDIS_ENABLED` | Optional cache connection |

`backend/app/core/config.py` loads these settings with Pydantic Settings and
fails early with a useful configuration error when required values are absent.
The frontend only needs `VITE_API_BASE_URL`; Vite exposes variables prefixed
with `VITE_` to browser code.

## 6. Authentication and Authorization

The authentication flow is implemented by `auth.py`, the user/session/OTP
services, and the files in `backend/app/core/`.

- Passwords are hashed with Argon2 through `pwdlib`.
- Access and refresh tokens are stored in HttpOnly cookies.
- The API can also accept a bearer access token for supported integrations.
- Mutating cookie-authenticated requests require the expected
  `X-Requested-With` header as a CSRF defense.
- Refresh is limited to the authentication API path.
- Session revocation causes the frontend to clear its session and redirect to
  login.
- A `super_admin` has organisation-wide access and controls HR admin and
  manager accounts.
- `hr_admin` and `manager` are administrative roles with different data
  scope; managers are restricted to their teams where the route supports it.
- Employees use the employee portal and may only access their own records.

`backend/app/core/roles.py` defines role groups such as administrative and HR
level roles. `backend/app/core/scope.py` applies manager/team data scope.

## 7. Backend File Guide

### Backend entry point and database

| File | Responsibility |
| --- | --- |
| `backend/app/main.py` | Creates the FastAPI app, starts and closes database/Redis connections, bootstraps users, creates indexes, mounts uploads, registers routers, enables CORS, and formats `AppException` responses. |
| `backend/app/__init__.py` | Marks the backend app as a Python package. |
| `backend/app/db/database.py` | Creates the async Motor client, configures DNS resolution for MongoDB SRV connections, pings MongoDB, creates core indexes, and closes the client. |
| `backend/app/db/__init__.py` | Package marker for database code. |
| `backend/requirements.txt` | Pinned Python dependencies for FastAPI, MongoDB, Redis, authentication, email, and R2. |

### Core infrastructure

| File | Responsibility |
| --- | --- |
| `app/core/config.py` | Environment-backed application settings and derived URLs/origin lists. |
| `app/core/security.py` | Password hashing and password verification helpers. |
| `app/core/jwt.py` | JWT creation and decoding. |
| `app/core/cookies.py` | Cookie names and secure access/refresh cookie options. |
| `app/core/roles.py` | Role constants and reusable role groups. |
| `app/core/scope.py` | Manager/team access scoping helpers. |
| `app/core/exceptions.py` | `AppException`, the application error type with HTTP status and message. |
| `app/core/cache.py` | Optional Redis initialization, access, and shutdown. |
| `app/core/working_days.py` | Shared working-day calculations; weekends are excluded. |
| `app/core/leave_dates.py` | Leave date-range and working-day helpers. |
| `app/core/__init__.py` | Package marker. |

### API routers

Files in `backend/app/api/v1/` translate HTTP requests into service calls.
They define URL paths, dependencies, authentication checks, request parsing,
response models, and route-level permissions.

| Router | Main area |
| --- | --- |
| `auth.py` | Registration, OTP verification, login, refresh, logout, password flows |
| `health.py` | Health check for local and uptime monitoring |
| `users.py` | Admin account management |
| `employees.py` | Employee CRUD, next ID, status, and employee administration |
| `departments.py` | Department CRUD |
| `shifts.py` | Shift CRUD and employee shift assignment |
| `holidays.py` | Holiday management |
| `admin_attendance.py` | Admin attendance records, summaries, options, edits, and approvals |
| `employee_attendance.py` | Employee attendance punch and range views |
| `employee_attendance_regularization.py` | Missing-punch requests and review workflow |
| `admin_leaves.py` | Admin leave listing, summary, and approval status changes |
| `employee_leave.py` | Employee/HR/manager leave applications, balances, upcoming leave, and cancellation |
| `admin_salary_structures.py` | Salary structure administration |
| `admin_deductions.py` | Payroll deduction administration |
| `admin_payslip.py` | Admin payslip creation and viewing |
| `employee_payroll.py` | Employee payroll history and payroll data |
| `employee_payslip.py` | Employee payslip retrieval |
| `admin_announcements.py` | Admin announcement creation and publishing |
| `employee_announcement.py` | Employee announcement feed |
| `dashboard.py` | Admin dashboard metrics and activity data |
| `recruitment.py` | Job positions, candidates, funnel data, and interviews |
| `assets.py` | Asset inventory, assignment, returns, and requests |
| `employee_documents.py` | Employee document upload and access |
| `employee_profile_photo.py` | Employee profile photo upload and retrieval |
| `admin_notifications.py` | Admin notifications |
| `employee_notification.py` | Employee notifications |
| `admin_support_tickets.py` | Admin support ticket management |
| `employee_support_tickets.py` | Employee support ticket creation and tracking |
| `admin_exit_requests.py` | Admin exit/termination request management |
| `employee_exit_requests.py` | Employee resignation and exit requests |
| `app/api/v1/__init__.py` | API package marker. |

The API base path is `/api/v1`. The application also exposes `/health` without
the prefix for uptime monitors. The complete live endpoint reference is
generated by FastAPI at `/docs`; `backend/api_endpoint_inventory.json` is a
static endpoint inventory used for reference.

### Models and schemas

Models describe persisted MongoDB document concepts where a model module is
used. Schemas describe validated request and response shapes at the API
boundary. Some feature areas use repository dictionaries and schemas without a
separate model file.

| Model/schema area | Files |
| --- | --- |
| Users and sessions | `user.py`, `session.py` |
| Organisation | `department.py`, `holiday.py` |
| Attendance | `employee_attendance.py`, `employee_attendance_regularization.py`, `attendance.py` |
| Leave | `employee_leave.py`, `admin_leave.py` |
| Payroll | `employee_payroll.py`, `admin_salary_structure.py`, `admin_deduction.py`, `admin_payslip.py`, `employee_payroll.py` |
| Employee data | `employee_document.py` and employee-related schema/repository files |
| Announcements | `employee_announcement.py`, `admin_announcement.py` |
| Recruitment | `recruitment.py` |
| Assets | `asset.py` |
| Employee services | `employee_notification.py`, `employee_support_ticket.py`, `employee_exit_request.py` |
| Shared data | `common.py`, `dashboard.py`, package `__init__.py` files |

The files are located in `backend/app/models/` and `backend/app/schemas/`.
Schemas should be changed when an API contract changes; models should be
changed when the stored document shape or model behavior changes.

### Repositories

Repositories isolate MongoDB collection names, filters, sorting, pagination,
updates, and indexes from business logic.

| Repository files | Data area |
| --- | --- |
| `user_repository.py`, `session_repository.py`, `otp_repository.py` | Users, sessions, and OTP records |
| `employee_repository.py`, `department_repository.py` | Employee and department records |
| `shift_repository.py`, `holiday_repository.py` | Shifts and holidays |
| `attendance_repository.py`, `employee_attendance_repository.py`, `employee_attendance_regularization_repository.py` | Attendance and regularization |
| `leave_repository.py`, `employee_leave_repository.py`, `leave_balance_repository.py` | Leave requests and balances |
| `employee_payroll_repository.py`, `admin_salary_structure_repository.py`, `admin_deduction_repository.py`, `admin_payslip_repository.py` | Payroll data |
| `admin_announcement_repository.py`, `employee_announcement_repository.py` | Announcements |
| `employee_notification_repository.py` | Notifications |
| `employee_document_repository.py` | Document metadata |
| `candidate_repository.py`, `job_position_repository.py` | Recruitment |
| `asset_repository.py`, `asset_request_repository.py` | Assets and asset requests |
| `employee_support_ticket_repository.py` | Support tickets |
| `employee_exit_request_repository.py` | Exit requests |
| `activity_repository.py` | Audit/recent activity |
| `repositories/__init__.py` | Package marker. |

### Services

Services hold the application’s main business behavior. Important services
include:

| Service files | Responsibility |
| --- | --- |
| `user_service.py`, `session_service.py` | User lifecycle, bootstrap accounts, sessions, and account state |
| `otp_service.py`, `email_service.py` | OTP generation/verification and templated email delivery |
| `employee_service.py`, `employee_identity.py` | Employee CRUD, IDs, profile data, and identity backfill |
| `department_service.py`, `shift_service.py`, `holiday_service.py` | Organisation calendar and scheduling rules |
| `attendance_service.py`, `employee_attendance_service.py` | Admin and employee attendance workflows |
| `attendance_calculation.py` | Shift-aware working hours, late status, and overtime calculations |
| `employee_attendance_regularization_service.py` | Regularization request and approval rules |
| `admin_leave_service.py`, `employee_leave_service.py` | Leave administration, applications, balances, and approval rules |
| `admin_salary_structure_service.py`, `admin_deduction_service.py` | Salary and deduction configuration |
| `admin_payslip_service.py`, `employee_payroll_service.py`, `employee_payslip_service.py` | Payslip and payroll flows |
| `admin_announcement_service.py`, `employee_announcement_service.py` | Announcement publishing and employee feed |
| `dashboard_service.py`, `recruitment_stats_service.py` | Dashboard KPIs, charts, recruitment funnel, and summaries |
| `candidate_service.py`, `job_position_service.py` | Recruitment records and job positions |
| `asset_service.py`, `asset_request_service.py` | Asset inventory, assignment, return, and request rules |
| `employee_document_service.py`, `employee_cloudflare_r2_service.py`, `object_storage_service.py` | Private file metadata, R2 access, and signed URLs |
| `employee_notification_service.py`, `admin_notification_service.py` | Notification creation and retrieval |
| `employee_support_ticket_service.py` | Employee/admin support ticket workflow |
| `employee_exit_request_service.py` | Resignation and termination workflow |
| `activity_service.py` | Activity/audit log creation |
| `services/__init__.py` | Package marker. |

## 8. Backend Utility and Operational Files

| File | Use |
| --- | --- |
| `backend/app/utils/pagination.py` | Shared page/limit and pagination response helpers. |
| `backend/app/utils/filtering.py` | Reusable query filter parsing. |
| `backend/app/utils/employee_storage.py` | Employee-specific storage paths and file naming. |
| `backend/templates/emails/welcome_email.html` | New admin/employee welcome email template. |
| `backend/templates/emails/password_reset_otp.html` | Password reset OTP email template. |
| `backend/templates/emails/employee_verification_otp.html` | Employee email verification template. |
| `backend/create_departments.py` | Seeds departments. |
| `backend/clean_departments.py` | Removes or cleans department seed data. |
| `backend/seed_shifts.py` | Seeds shift records. |
| `backend/seed_assets.py` | Seeds asset records. |
| `backend/migrate_employee_ids.py` | Migrates/assigns employee IDs using the AAR sequence. |
| `backend/shift_employee_ids.py` | One-off employee-ID/reference shift migration; use its dry-run behavior first. |
| `backend/migrate_employee_storage.py` | Migrates employee files to R2 paths; run without `--apply` first. |
| `backend/backfill_manager_ids.py` | Backfills manager relationships. |
| `backend/backfill_attendance_metrics.py` | Recalculates historical attendance metrics. |
| `backend/verify_shift_math.py` | Manual verification of shift calculations. |
| `backend/verify_attendance_flow.py` | Manual attendance-flow verification. |
| `backend/test_email.py` | Manual SMTP/email test helper. |
| `backend/tests/test_auth_cookie.py` | HttpOnly cookie authentication behavior. |
| `backend/tests/test_auth_security.py` | Authentication and CSRF/security checks. |
| `backend/tests/test_role_access.py` | Role and access-control behavior. |
| `backend/tests/test_regularization_access.py` | Attendance regularization permissions and manager scope. |
| `backend/tests/__init__.py` | Test package marker. |

## 9. Frontend File Guide

### Application startup and routing

| File | Responsibility |
| --- | --- |
| `frontend/src/main.tsx` | React entry point; installs Strict Mode, error boundary, React Query provider, global CSS, and `App`. |
| `frontend/src/App.tsx` | Browser routes, login redirect, admin/employee protection, logout, session-clear redirect, and global date provider. |
| `frontend/src/index.css` | Tailwind entry point, global styles, animations, and application visual tokens. |
| `frontend/index.html` | Vite HTML shell and root element. |
| `frontend/vite.config.ts` | Vite, React, and Tailwind plugin configuration. |
| `frontend/tsconfig*.json` | TypeScript compiler settings for application and Node/Vite configuration. |
| `frontend/eslint.config.js` | ESLint rules and ignored build output. |
| `frontend/package.json` | Frontend dependencies and scripts. |
| `frontend/package-lock.json` | Locked npm dependency versions. |

### Layouts and pages

`DashboardLayout.tsx` is the admin shell. It holds the sidebar/header and
switches among admin modules. `EmployeeLayout.tsx` is the employee shell and
renders nested employee routes.

| Pages | Purpose |
| --- | --- |
| `pages/login.tsx` | Login and session entry screen. |
| `pages/admin/AdminDashboard.tsx` | Admin KPI/dashboard screen. |
| `pages/admin/AdminEmployees.tsx` | Employee listing and management. |
| `pages/admin/AdminAttendance.tsx` | Admin attendance, summaries, and regularization access. |
| `pages/admin/admin_leave.tsx` | Admin leave requests, balances, and approvals. |
| `pages/admin/AdminPayroll.tsx` | Salary structures, deductions, and payslips. |
| `pages/admin/AdminRecruitment.tsx` | Jobs, candidates, interviews, and recruitment funnel. |
| `pages/admin/AdminAssets.tsx` | Asset inventory and allocation. |
| `pages/admin/AdminAnnouncements.tsx` | Announcement creation and publishing. |
| `pages/admin/AdminAccounts.tsx` | Super-admin account management. |
| `pages/admin/AdminExitRequests.tsx` | Exit, resignation, and termination management. |
| `pages/admin/AdminRegularizationRequests.tsx` | Attendance regularization review screen. |
| `pages/admin/AdminSupportTickets.tsx` | Admin support ticket management. |
| `pages/admin/AdminMyProfile.tsx` | Admin profile display/editing. |
| `pages/admin/AdminSetting.tsx` | Admin settings screen. |
| `pages/employee/EmployeeDashboard.tsx` | Employee home/dashboard. |
| `pages/employee/EmployeeProfile.tsx` | Employee profile and personal information. |
| `pages/employee/EmployeeAttendance.tsx` | Punching, attendance history, and regularization entry. |
| `pages/employee/EmployeeLeave.tsx` | Leave balances and applications. |
| `pages/employee/EmployeePayroll.tsx` | Payroll history and payslips. |
| `pages/employee/EmployeeDocuments.tsx` | Employee documents. |
| `pages/employee/EmployeeAssets.tsx` | Assigned assets and asset requests. |
| `pages/employee/EmployeeAnnouncements.tsx` | Employee announcement feed. |
| `pages/employee/EmployeeHelpSupport.tsx` | Support tickets. |
| `pages/employee/EmployeeExit.tsx` | Exit status and requests. |
| `pages/employee/EmployeeResignation.tsx` | Resignation form and workflow. |
| `pages/employee/EmployeeLeaveModal.tsx` | Leave application modal. |
| `pages/employee/EmployeeLeaveDetailsModal.tsx` | Leave detail view. |
| `pages/employee/EmployeeAttendanceRegularizationModal.tsx` | Regularization request form. |
| `pages/employee/EmployeeSidebar.tsx` | Employee navigation. |
| `pages/DashboardPage.tsx`, `pages/Attendance.tsx` | Legacy/general pages; verify references before modifying or removing. |

### Shared components

| Directory/files | Purpose |
| --- | --- |
| `components/Header.tsx`, `Sidebar.tsx` | Admin navigation shell. |
| `components/ProtectedRoute.tsx` | Authentication and admin-role route guards. |
| `components/ErrorBoundary.tsx` | Prevents an uncaught component error from blanking the entire app. |
| `components/DatePicker.tsx`, `GlobalDateBadge.tsx` | Shared date selection and display. |
| `components/DashboardTicker.tsx`, `Celebrations.tsx`, `EmployeeAnnouncementTicker.tsx`, `EmployeeUpcomingLeaveTicker.tsx` | Dashboard announcements, celebrations, and upcoming leave banners. |
| `components/KpiCard.tsx`, `HiringPipeline.tsx` | Reusable dashboard presentation components. |
| `components/AddHolidayModal.tsx` | Holiday creation UI. |
| `components/ui/Skeleton.tsx` | Loading placeholders. |
| `components/ui/NoticePopup.tsx` | Shared centered success/error notice. |
| `components/auth/AuthShell.tsx`, `AuthField.tsx`, `OtpInput.tsx`, `PasswordStrength.tsx` | Login/verification form building blocks. |
| `components/employee/ExitStatusBadge.tsx`, `EmployeeNotificationDropdown.tsx` | Employee-specific shared UI. |
| `components/admin/` | Admin cards, dashboard charts, payroll, employee forms/tables, recruitment modals, regularization, notifications, and profile UI. |
| `components/admin/assets/` | Asset create, assign, return, detail, allocation, and delete modals. |
| `components/admin/exit/` | Exit request tables, filters, detail panels, resignation/termination panels, and dialogs. |

The main admin component files include `DashboardKpiRow`, `DashboardCard`,
`AttendanceTrendChart`, `DepartmentDonut`, `PayrollExpenseSummaryCard`,
`PendingLeaveRequestsCard`, `BirthdaysAndAnniversariesCard`,
`UpcomingInterviewsCard`, `RecentActivityCard`, `QuickActionsCard`,
`RecruitmentFunnel`, `RegularizationRequestsCard`, `AdminEmployeeTable`,
`AdminEmployeeForm`, `AdminEmployeeDetailsPage`, `AdminEmployeeDocuments`,
`SalaryStructureTab`, `DeductionsTab`, `PayslipsTab`, `ApplyDeductionModal`,
`ShiftManagerModal`, `Reports`, and the recruitment modal/viewer files. Each
is a feature-specific presentation or form component used by an admin page.

### Services, hooks, types, context, and utilities

| Directory | Responsibility |
| --- | --- |
| `src/services/api.ts` | Shared HTTP client, response-envelope unwrapping, credentials, refresh/retry on 401, and session clearing. |
| `src/services/authService.ts` | Login, registration, OTP, refresh, logout, and password operations. |
| `src/services/employeeService.ts`, `departmentService.ts`, `userService.ts` | Employee, department, and admin-account API clients. |
| `src/services/attendanceService.ts`, `shiftService.ts`, `holidayService.ts` | Attendance, shifts, and holidays. |
| `src/services/admin_leave_service.ts`, `exitRequestService.ts` | Admin leave and exit-request API clients. |
| `src/services/adminPayrollService.ts`, `admin_salary_structure_service.ts`, `admin_deduction_service.ts` | Admin payroll APIs. |
| `src/services/dashboardService.ts`, `recruitmentService.ts` | Dashboard and recruitment APIs. |
| `src/services/announcementService.ts`, `employeeNotificationService.ts`, `adminNotificationService.ts` | Announcements and notifications. |
| `src/services/assetService.ts` | Asset and asset-request APIs. |
| `src/services/employee_support_ticket_service.ts`, `adminSupportTicketService.ts` | Support ticket APIs. |
| `src/services/adminProfileService.ts` | Admin profile API. |
| `src/hooks/` | React Query hooks for employee data, departments, shifts, payroll, deductions, and salary structures. |
| `src/types/` | TypeScript DTOs for employees, departments, attendance, leave, shifts, assets, recruitment, holidays, announcements, notifications, tickets, exits, payroll, and admin profiles. |
| `src/lib/queryClient.ts` | Shared React Query client and cache behavior. |
| `src/lib/queryKeys.ts` | Consistent query-cache key definitions. |
| `src/lib/session.ts` | Client session flags and password-redirect notices. |
| `src/lib/access.ts` | Client-side role/access helpers. |
| `src/context/GlobalDateProvider.tsx` and `globalDateContext.ts` | Global date state shared by both layouts. |
| `src/utils/workingDays.ts` | Frontend counterpart to backend working-day rules. |
| `src/utils/dateKeys.ts` | Date key and date formatting helpers. |

## 10. Main Business Modules

### Employees and departments

HR can create, update, deactivate, and delete employee records, assign
departments/designations/managers/shifts, and manage profile photos/documents.
Employee IDs use the AAR sequence. The super-admin display identity is not a
normal employee record.

### Attendance

Employees punch in and out. The backend calculates working time, late status,
and overtime using the assigned shift. Admins can inspect summaries by date,
department, and status. A regularization request handles missing or incorrect
punches; reviewers cannot approve their own request, and managers are limited
to their team.

### Leave

Employees and eligible administrative users submit leave requests. Balances,
overlapping requests, approval status, and cancellation are tracked. Weekends
do not count as leave days, and a request containing only weekends is rejected.
The backend and frontend implement the same working-day rule in
`working_days.py` and `workingDays.ts`.

### Payroll

Admins configure salary structures and deductions and create payslips.
Employees view payroll history and payslips. Payroll data is kept behind
separate admin and employee routes.

### Recruitment and dashboard

Job positions and candidates provide recruitment funnel and interview data.
The admin dashboard combines attendance, department, payroll, recruitment,
pending approvals, birthdays, anniversaries, announcements, and activity.
Dashboard cards load independently so one failing metric does not blank the
whole page.

### Files and storage

Employee documents and profile photos use private Cloudflare R2 storage. The
backend generates controlled/signed access rather than exposing R2 credentials
to the browser. `migrate_employee_storage.py` supports migration of existing
files and should be run in dry-run mode before `--apply`.

## 11. API Areas

Base URL: `http://localhost:8000/api/v1`.

| Area | Representative routes |
| --- | --- |
| Auth | `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, OTP routes |
| Employees | `/employees`, `/employees/{id}`, `/employees/{id}/deactivate`, `/employees/next-id` |
| Departments | `/departments`, `/departments/{id}` |
| Shifts | `/shifts`, `/admin/shifts/{id}`, employee shift routes |
| Attendance | `/attendance`, `/attendance/summary`, `/employee-attendance`, regularization routes |
| Leave | `/employee-leave`, `/admin/leaves`, balances, upcoming, and status routes |
| Payroll | `/admin/salary-structures`, `/admin/deductions`, `/admin-payslip`, `/employee-payroll`, `/employee-payslip` |
| Announcements | `/announcements`, `/employee-announcements` |
| Recruitment | `/recruitment` routes for jobs, candidates, and interviews |
| Assets | `/assets` and asset-request routes |
| Files | Employee documents and profile photo routes |
| Notifications | Admin and employee notification routes |
| Support | Admin and employee support-ticket routes |
| Exit | Admin and employee exit-request routes |
| Dashboard | `/dashboard` |

Use `/docs` for the exact request parameters, response schemas, and currently
registered routes because it is generated directly from the running code.

## 12. Data and Storage Notes

MongoDB collections are accessed through repositories. Startup creates indexes
for frequently queried or unique data, including one attendance record per
employee per day and expiring email OTP records.

Local `uploads/` is created at runtime and mounted by FastAPI for appropriate
public/static upload use. Sensitive employee documents are intended for R2
private storage. Do not place production secrets or private documents in the
repository.

## 13. Testing and Verification

Backend tests are in `backend/tests/` and currently focus on:

- Cookie-based authentication and session behavior
- Authentication security and CSRF requirements
- Role access
- Attendance regularization permissions and team scope

Useful commands from `backend` include:

```bash
pytest
```

The current `requirements.txt` is the runtime dependency list. If the local
environment does not already provide `pytest` and `httpx`, install them in a
development environment or add a separate `requirements-dev.txt` rather than
mixing test-only packages into production deployment requirements.

The frontend currently has lint and TypeScript/build verification, but no
frontend test runner is configured:

```bash
cd frontend
npm run lint
npm run build
```

## 14. Maintenance Guidance

When adding a backend feature:

1. Add or update a model only if the stored document shape changes.
2. Add Pydantic schemas for request and response boundaries.
3. Put MongoDB operations in a repository.
4. Put validation that spans multiple fields or records in a service.
5. Add a router and register it in `app/main.py`.
6. Add the frontend type, service, page/component, and query invalidation as
   needed.
7. Add access-control tests for new protected behavior.

When adding a frontend feature:

1. Add the API client in `src/services/`.
2. Add or update DTOs in `src/types/`.
3. Use React Query for server data rather than duplicating request state.
4. Add the page under the correct admin or employee route.
5. Reuse shared notices, loading skeletons, layouts, and access helpers.
6. Run `npm run lint` and `npm run build`.

## 15. Current Notes and Risks

- `frontend/README.md` is still the generic Vite starter README; this file is
  the application-specific reference.
- `backend/uploads/` is created at runtime and may not exist in a clean clone.
- The frontend API base URL belongs in `frontend/.env`; it is also shown in the
  backend example for convenience, but backend settings do not need to expose
  it to the browser.
- Check the current `AUTH_ENABLED` behavior in the admin leave router before
  deploying, because the source notes that role authentication is still being
  wired in that area.
- Verify duplicate or legacy routes before removing them. The current codebase
  contains some older page files that are not obvious active route entry points.
- Run migration scripts in dry-run mode first and take a database backup before
  applying data changes.

## 16. Quick File Index

The most important files to read first are:

1. `README.md` for the short setup overview.
2. `PROJECT_DOCUMENTATION.md` for this complete guide.
3. `backend/app/main.py` for API startup and router registration.
4. `backend/app/core/config.py` for runtime settings.
5. `backend/app/api/v1/auth.py` for authentication routes.
6. `backend/app/services/` for business behavior.
7. `backend/app/repositories/` for MongoDB access.
8. `frontend/src/main.tsx` for React startup.
9. `frontend/src/App.tsx` for routing and protected portals.
10. `frontend/src/services/api.ts` for browser/API communication.
11. `frontend/src/layouts/` and `frontend/src/pages/` for the user interface.
12. `backend/tests/` for current security and access-control expectations.
