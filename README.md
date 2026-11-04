# HRMS — Human Resource Management System

A full-stack HRMS built with **FastAPI + MongoDB** on the backend and **React 19 + TypeScript + Vite** on the frontend.

It covers the two audiences a company actually has: an **admin portal** for HR and managers, and an **employee self-service portal**.

| Layer | Stack |
| --- | --- |
| Backend | Python 3.10+, FastAPI, Pydantic v2, Motor (async MongoDB), PyJWT, Jinja2 |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, React Router v7, lucide-react |
| Database | MongoDB (Atlas or local) |

---

## Features

**Employee management** — create, edit, deactivate and delete employees, assign department, designation, reporting manager, work location, shift and salary structure. Names reject digits, phone numbers accept exactly 10 digits (validated on both the form and the API).

**Attendance** — punch-in/punch-out with shift-aware working hours and overtime, daily summary with present/late/absent/on-leave counts, per-department presence, and a regularization request flow for missing punches.

**Leave** — apply for Casual, Sick, Earned or Comp Off leave with balance tracking and overlapping-request detection. **Weekends are excluded**: leave days count working days only, and a range that falls purely on Saturdays and Sundays is rejected.

**Payroll** — salary structures, deductions and contributions, on-screen payslip viewing, and employee-facing payroll history.

**Announcements, documents, departments, shifts, and reports** round out the module set.

**Dashboards** — the admin dashboard has animated attendance trends, a recruitment funnel, a department donut, payroll summary, pending approvals, upcoming interviews, birthdays and anniversaries, recent activity and quick actions. Each figure resolves independently, so a failing endpoint leaves that one card on its placeholder instead of blanking the page.

---

## Project structure

```
HRMS/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # routers (employees, attendance, leave, payroll, auth, ...)
│   │   ├── core/            # config, security, JWT, roles, working-day helpers
│   │   ├── db/              # Mongo connection
│   │   ├── models/          # document shapes
│   │   ├── repositories/    # data access
│   │   ├── schemas/         # Pydantic request/response models
│   │   ├── services/        # business logic
│   │   └── main.py          # app factory, routers, static uploads
│   ├── templates/           # Jinja2 email templates
│   ├── uploads/             # served at /uploads
│   ├── .env.example
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── components/      # shared + admin/ components
    │   ├── layouts/         # DashboardLayout (admin), EmployeeLayout
    │   ├── pages/           # route pages (admin/ and employee/)
    │   ├── services/        # typed API clients
    │   ├── types/           # TypeScript DTOs
    │   ├── utils/           # shared helpers (working-day maths)
    │   ├── index.css        # Tailwind entry + custom keyframes
    │   └── App.tsx          # routes
    └── .env.example
```

---

## Setup

### Prerequisites

- Python 3.10 or newer
- Node.js 20 or newer
- A MongoDB instance (local or Atlas)

### 1. Backend

```bash
cd backend

python -m venv .venv
source .venv/Scripts/activate      # Windows
# source .venv/bin/activate        # macOS / Linux

pip install -r requirements.txt
```

Create your environment file:

```bash
cp .env.example .env
```

Then fill in the values:

```ini
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<database>?retryWrites=true&w=majority
DATABASE_NAME=hrms
CORS_ORIGINS=http://localhost:5173
VITE_API_BASE_URL=http://localhost:8000/api/v1

# openssl rand -hex 32
SECRET_KEY=<long-random-secret>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# SMTP, used for welcome and OTP emails
EMAIL_HOST=<smtp-host>
EMAIL_PORT=465
EMAIL_USER=<smtp-user>
EMAIL_PASSWORD=<smtp-password>
EMAIL_FROM=<sender-address>
```

`UPLOAD_DIR` is optional and defaults to `uploads`.

Employee profile photos and documents are stored privately in Cloudflare R2
under the employee's actual `AAR###` ID and database name:

```text
employees/AAR001_Aiman_Mulla/profile/AAR001_Aiman_Mulla_Profile.jpg
employees/AAR001_Aiman_Mulla/documents/AAR001_Aiman_Mulla_Resume.pdf
```

After configuring R2, migrate existing employee files with a dry run first:

```bash
cd backend
python migrate_employee_storage.py
python migrate_employee_storage.py --apply
```

Run the API:

```bash
uvicorn app.main:app --reload
```

It serves on `http://localhost:8000`, with interactive docs at `/docs` and `/redoc`.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
```

```ini
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

Start the dev server:

```bash
npm run dev
```

It serves on `http://localhost:5173`.

### 3. Sign in

Register an account at `/register`, then use `/login`. Admin roles (`hr_admin`, `manager`) land on `/dashboard`; employees land on `/employee`.

---

## Scripts

**Backend**

```bash
uvicorn app.main:app --reload     # dev server with hot reload
```

**Frontend**

```bash
npm run dev         # dev server
npm run build       # typecheck and build for production
npm run preview     # serve the production build
npm run lint        # ESLint
```

---

## Conventions

**Backend** follows a layered split: routers handle HTTP, services hold business rules and raise `AppException` with a status code, repositories own the queries, and Pydantic schemas validate the boundary. Cross-field checks that a schema cannot express (duplicate email, salary band, overlapping leave) live in the service layer.

**Frontend** has no schema library. Validation is HTML attributes plus small hand-written checks alongside the form, and the API validates everything again as the real boundary. Styling is Tailwind utilities on a `#2563eb` primary with `#f5f7fb` page background; cards are `rounded-2xl border border-gray-100 bg-white p-5 shadow-sm`.

**Working days** are defined once per side — `app/core/working_days.py` and `src/utils/workingDays.ts` — so the day count a user sees always matches what the API stores.

---

## API

Base URL `http://localhost:8000/api/v1`. Interactive reference at `/docs`.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/register`, `/auth/register/request-otp`, `/auth/register/verify-otp`, `/auth/login`, `/auth/refresh`, `/auth/logout` |
| Employees | `GET/POST /employees`, `GET/PUT/DELETE /employees/{id}`, `PATCH /employees/{id}/deactivate` |
| Departments | `GET/POST /departments`, `GET/PUT/DELETE /departments/{id}` |
| Shifts | `GET/POST /shifts`, `GET/PUT/DELETE /admin/shifts/{id}`, `GET/PUT /admin/employees/{id}/shift` |
| Attendance | `GET/POST /attendance`, `GET /attendance/summary`, `GET /attendance/options`, `PUT /attendance/{id}`, `PATCH /attendance/{id}/approve` |
| Employee attendance | `GET/POST /employee-attendance`, `GET /employee-attendance/range`, regularization request + review routes |
| Leave | `GET/POST /employee-leave`, `PATCH /employee-leave/{id}/cancel`, balance / upcoming / pending-count |
| Admin leave | `GET/POST /admin/leaves`, `GET /admin/leaves/summary`, `PATCH /admin/leaves/{id}/status` |
| Payroll | `GET /admin/salary-structures`, `GET/POST /admin/deductions`, `GET/POST /admin-payslip`, `GET /employee-payroll/...`, `GET /employee-payslip/{id}` |
| Announcements | `GET/POST /announcements`, `GET/POST /employee-announcements` |
| Dashboard | `GET /dashboard` |

Responses are wrapped in a `{ success, message, data }` envelope; the frontend unwraps it in `src/services/api.ts`, which also handles the access-token refresh and retry on `401`.

---

## Notes

Admin leave routes currently run with authentication disabled while the role flow is being wired up — see `AUTH_ENABLED` in `app/api/v1/admin_leaves.py`.
