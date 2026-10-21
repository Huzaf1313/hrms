import { useEffect, useMemo, useState } from "react";
import type { ElementType } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Banknote,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Edit3,
  Mail,
  MapPin,
  Phone,
  Plus,
  Save,
  ShieldCheck,
  User,
  UserRound,
  Users,
  X,
} from "lucide-react";

import { employeeService } from "../../services/employeeService";
import { departmentService } from "../../services/departmentService";
import { shiftService } from "../../services/shiftService";
import type { Employee } from "../../types/employee";
import type { Department } from "../../types/department";
import type { Shift } from "../../types/shift";

interface UserResponse {
  id: string;
  employee_id: string | null;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

interface InfoItemProps {
  icon: ElementType;
  label: string;
  value?: string | null;
  muted?: boolean;
}

function InfoItem({
  icon: Icon,
  label,
  value,
  muted = false,
}: InfoItemProps) {
  return (
    <div className="group flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-4 transition-all duration-200 hover:border-slate-200 hover:bg-white hover:shadow-sm">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm ring-1 ring-slate-100 transition-colors group-hover:text-slate-700">
        <Icon size={17} strokeWidth={1.8} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </p>

        <p
          className={`mt-1 break-words text-sm font-medium ${
            muted ? "text-slate-400" : "text-slate-700"
          }`}
        >
          {value || "Not provided"}
        </p>
      </div>
    </div>
  );
}

function EmptyInformation({
  icon: Icon,
  title,
  description,
}: {
  icon: ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-5 py-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-100">
        <Icon size={18} />
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-600">{title}</p>
        <p className="mt-0.5 text-xs text-slate-400">{description}</p>
      </div>
    </div>
  );
}

function ProfileSummary({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: ElementType;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
        <Icon size={18} strokeWidth={1.8} />
      </div>

      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </p>

        <p className="mt-0.5 truncate text-sm font-semibold text-slate-700">
          {value}
        </p>
      </div>
    </div>
  );
}

function StatusRow({
  label,
  value,
  active,
}: {
  label: string;
  value: string;
  active?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0">
      <span className="text-sm text-slate-500">{label}</span>

      <div className="flex items-center gap-2">
        {active !== undefined && (
          <span
            className={`h-2 w-2 rounded-full ${
              active ? "bg-emerald-500" : "bg-slate-300"
            }`}
          />
        )}

        <span className="text-right text-sm font-semibold text-slate-700">
          {value}
        </span>
      </div>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "Not provided";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatEmploymentType(value?: string) {
  if (!value) return "Not provided";

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatStatus(value?: string) {
  if (!value) return "Not provided";

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function maskAccountNumber(accountNumber?: string) {
  if (!accountNumber) return "Not provided";

  if (accountNumber.length <= 4) {
    return accountNumber;
  }

  return `•••• •••• ${accountNumber.slice(-4)}`;
}

export default function EmployeeProfile() {
  const navigate = useNavigate();

  const [user, setUser] = useState<UserResponse | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [employeeLoadError, setEmployeeLoadError] = useState<string | null>(
    null,
  );
  const [isEditingEmergencyContact, setIsEditingEmergencyContact] =
  useState(false);

  const [emergencyContactForm, setEmergencyContactForm] = useState({
    name: "",
    relationship: "",
    phone: "",
    alternate_phone: "",
    address: "",
  });

  const [isSavingEmergencyContact, setIsSavingEmergencyContact] =
    useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      try {
        setIsLoading(true);
        setEmployeeLoadError(null);

        /*
         * /employees/me returns the logged-in employee's own profile
         * (the admin-only /employees list endpoint is not used).
         *
         * Departments and shifts are only used to turn IDs into
         * display names, so a failure there should not block the
         * profile from loading. Those two requests fail softly.
         */
        const [employeeProfile, departmentList, shiftList] =
          await Promise.all([
            employeeService.getMyProfile(),
            departmentService.listAll().catch((lookupError) => {
              console.warn("Unable to load departments:", lookupError);
              return [] as Department[];
            }),
            shiftService.list().catch((lookupError) => {
              console.warn("Unable to load shifts:", lookupError);
              return [] as Shift[];
            }),
          ]);

        if (!isMounted) return;

        setEmployee(employeeProfile);
        setDepartments(departmentList);
        setShifts(shiftList);

        /*
         * Keep the stored user information for account status,
         * role and account creation date.
         */
        try {
          const storedUser = localStorage.getItem("user");

          if (storedUser) {
            setUser(JSON.parse(storedUser) as UserResponse);
          }
        } catch (storageError) {
          console.warn("Unable to read stored user information:", storageError);
        }
      } catch (err) {
        if (!isMounted) return;

        console.error("Failed to load employee profile:", err);

        setEmployee(null);
        setEmployeeLoadError(
          "Unable to load your employee information. Please try again.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleEditEmergencyContact = () => {
    setEmergencyContactForm({
      name: employee?.emergency_contact?.name || "",
      relationship: employee?.emergency_contact?.relationship || "",
      phone: employee?.emergency_contact?.phone || "",
      alternate_phone: employee?.emergency_contact?.alternate_phone || "",
      address: employee?.emergency_contact?.address || "",
    });

    setIsEditingEmergencyContact(true);
  };

  const handleSaveEmergencyContact = async () => {
    if (!employee?.id) return;

    if (
      !emergencyContactForm.name.trim() ||
      !emergencyContactForm.relationship.trim() ||
      !emergencyContactForm.phone.trim()
    ) {
      return;
    }

    try {
      setIsSavingEmergencyContact(true);

      await employeeService.update(employee.id, {
        emergency_contact: {
          name: emergencyContactForm.name.trim(),
          relationship: emergencyContactForm.relationship.trim(),
          phone: emergencyContactForm.phone.trim(),
          alternate_phone:
            emergencyContactForm.alternate_phone.trim() || undefined,
          address: emergencyContactForm.address.trim() || undefined,
        },
      });

      setIsEditingEmergencyContact(false);
      // Refresh the employee profile using your existing profile-loading logic.
    } catch (error) {
      console.error("Failed to save emergency contact:", error);
    } finally {
      setIsSavingEmergencyContact(false);
    }
  };

  const profileCompletion = useMemo(() => {
    if (!employee) return 0;

    const checks = [
      Boolean(employee.first_name),
      Boolean(employee.last_name),
      Boolean(employee.email),
      Boolean(employee.phone),
      Boolean(employee.date_of_birth),
      Boolean(employee.gender),
      Boolean(employee.address),
      Boolean(employee.department_id),
      Boolean(employee.designation),
      Boolean(employee.joining_date),
      Boolean(employee.employment_type),
      Boolean(employee.work_location),
      Boolean(employee.reporting_manager),
      Boolean(employee.emergency_contact?.name),
      Boolean(employee.emergency_contact?.relationship),
      Boolean(employee.emergency_contact?.phone),
      Boolean(employee.bank_information?.bank_name),
      Boolean(employee.bank_information?.account_holder_name),
      Boolean(employee.bank_information?.account_number),
      Boolean(employee.bank_information?.ifsc_code),
    ];

    const completed = checks.filter(Boolean).length;

    return Math.round((completed / checks.length) * 100);
  }, [employee]);

  // Resolve IDs to display names (IDs stay internal).
  const departmentName = useMemo(() => {
    if (!employee?.department_id) return "Not assigned";

    return (
      departments.find(
        (department) => department.id === employee.department_id,
      )?.name ?? "Not provided"
    );
  }, [departments, employee?.department_id]);

  const shiftName = useMemo(() => {
    if (!employee?.shift_id) return "Not assigned";

    return (
      shifts.find((shift) => shift.id === employee.shift_id)?.name ??
      "Not assigned"
    );
  }, [shifts, employee?.shift_id]);

  const displayName = employee
    ? `${employee.first_name} ${employee.last_name}`.trim()
    : user?.full_name || "Employee";

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  const roleLabel = user?.role
    ? user.role
        .replace(/_/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase())
    : "Employee";

  const isActive =
    employee?.status === "active"
      ? true
      : employee?.status
        ? false
        : user?.is_active ?? false;

  if (isLoading) {
    return (
      <div className="min-h-full bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="h-9 w-24 animate-pulse rounded-lg bg-slate-200" />

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="h-32 animate-pulse bg-slate-200" />

            <div className="space-y-4 px-6 pb-8 pt-16 sm:px-8">
              <div className="h-7 w-56 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-72 animate-pulse rounded bg-slate-100" />

              <div className="mt-6 flex gap-3">
                <div className="h-10 w-28 animate-pulse rounded-xl bg-slate-100" />
                <div className="h-10 w-28 animate-pulse rounded-xl bg-slate-100" />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-20 animate-pulse rounded-2xl bg-white shadow-sm"
              />
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="h-96 animate-pulse rounded-2xl bg-white shadow-sm lg:col-span-2" />
            <div className="h-96 animate-pulse rounded-2xl bg-white shadow-sm" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Back */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-lg px-1 py-1 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
        >
          <ArrowLeft size={17} />
          <span>Back</span>
        </button>

        {/* Error */}
        {employeeLoadError && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
            <div>
              <p className="font-semibold">Profile information unavailable</p>
              <p className="mt-0.5 text-amber-600">{employeeLoadError}</p>
            </div>
          </div>
        )}

        {/* Profile Hero */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Cover */}
          <div className="relative h-32 overflow-hidden bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900">
            <div className="absolute -right-12 -top-24 h-64 w-64 rounded-full bg-white/5" />

            <div className="absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-white/[0.03]" />

            <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.04)_50%,transparent_100%)]" />

            <div className="absolute bottom-4 right-5 hidden items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm sm:flex">
              <ShieldCheck size={13} />
              Employee Profile
            </div>
          </div>

          {/* Identity */}
          <div className="relative px-6 pb-7 pt-16 sm:px-8 sm:pb-8 sm:pt-16">
            {/* Avatar */}
            <div className="absolute left-6 top-0 -translate-y-1/2 sm:left-8">
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl border-4 border-white bg-slate-100 text-2xl font-bold text-slate-600 shadow-lg">
                {employee?.avatar_url ? (
                  <img
                    src={employee.avatar_url}
                    alt={displayName}
                    className="h-full w-full rounded-xl object-cover"
                  />
                ) : (
                  initials || <UserRound size={34} />
                )}
              </div>

              <span
                className={`absolute bottom-1 right-1 h-4 w-4 rounded-full border-[3px] border-white ${
                  isActive ? "bg-emerald-500" : "bg-slate-400"
                }`}
              />
            </div>

            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    {displayName}
                  </h1>

                  {isActive && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-100">
                      <CheckCircle2 size={12} />
                      Active
                    </span>
                  )}

                  {!isActive && employee && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                      {formatStatus(employee.status)}
                    </span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <BriefcaseBusiness size={15} />
                    {employee?.designation || roleLabel}
                  </span>

                  {employee?.employee_id && (
                    <span className="inline-flex items-center gap-1.5">
                      <ShieldCheck size={15} />
                      {employee.employee_id}
                    </span>
                  )}
                </div>
              </div>

              {/* Completion */}
              <div className="shrink-0">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Profile completion
                  </p>

                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-slate-700 transition-all duration-500"
                        style={{ width: `${profileCompletion}%` }}
                      />
                    </div>

                    <span className="text-sm font-bold text-slate-700">
                      {profileCompletion}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Summary */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
            <ProfileSummary
              icon={Mail}
              label="Email"
              value={employee?.email || user?.email || "Not provided"}
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
            <ProfileSummary
              icon={Phone}
              label="Phone"
              value={employee?.phone || "Not provided"}
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
            <ProfileSummary
              icon={Building2}
              label="Department"
              value={departmentName}
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
            <ProfileSummary
              icon={CalendarDays}
              label="Joined"
              value={formatDate(employee?.joining_date)}
            />
          </div>
        </section>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Personal Information */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Personal Information
                </h2>

            <p className="mt-1 text-xs text-slate-400">
              Your personal information and contact details
            </p>
          </div>

          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-500">
            <UserRound size={18} />
          </div>
        </div>

        <div className="space-y-6 p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoItem
              icon={User}
              label="First Name"
              value={employee?.first_name}
            />

            <InfoItem
              icon={User}
              label="Last Name"
              value={employee?.last_name}
            />

            <InfoItem
              icon={CalendarDays}
              label="Date of Birth"
              value={formatDate(employee?.date_of_birth)}
            />

            <InfoItem
              icon={Users}
              label="Gender"
              value={employee?.gender}
            />

            <InfoItem
              icon={Mail}
              label="Email"
              value={employee?.email || user?.email}
            />

            <InfoItem
              icon={Phone}
              label="Contact Number"
              value={employee?.phone}
            />

            <div className="sm:col-span-2">
              <InfoItem
                icon={MapPin}
                label="Address"
                value={employee?.address}
              />
            </div>
          </div>
        </div>

          </section>

          {/* Emergency Contact */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Emergency Contact
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  Someone to contact in case of an emergency
                </p>
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-500">
                <Phone size={18} />
              </div>
            </div>

            <div className="p-6">
              {isEditingEmergencyContact ? (
                /* Edit Form */
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Name <span className="text-red-500">*</span>
                    </label>

                    <input
                      type="text"
                      value={emergencyContactForm.name}
                      onChange={(e) =>
                        setEmergencyContactForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      placeholder="Enter emergency contact name"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Relationship <span className="text-red-500">*</span>
                    </label>

                    <input
                      type="text"
                      value={emergencyContactForm.relationship}
                      onChange={(e) =>
                        setEmergencyContactForm((prev) => ({
                          ...prev,
                          relationship: e.target.value,
                        }))
                      }
                      placeholder="e.g. Father, Mother, Spouse"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Phone <span className="text-red-500">*</span>
                    </label>

                    <input
                      type="tel"
                      value={emergencyContactForm.phone}
                      onChange={(e) =>
                        setEmergencyContactForm((prev) => ({
                          ...prev,
                          phone: e.target.value,
                        }))
                      }
                      placeholder="Enter phone number"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Alternate Phone
                    </label>

                    <input
                      type="tel"
                      value={emergencyContactForm.alternate_phone}
                      onChange={(e) =>
                        setEmergencyContactForm((prev) => ({
                          ...prev,
                          alternate_phone: e.target.value,
                        }))
                      }
                      placeholder="Enter alternate phone number"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Address
                    </label>

                    <textarea
                      value={emergencyContactForm.address}
                      onChange={(e) =>
                        setEmergencyContactForm((prev) => ({
                          ...prev,
                          address: e.target.value,
                        }))
                      }
                      placeholder="Enter emergency contact address"
                      rows={3}
                      className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingEmergencyContact(false)}
                      disabled={isSavingEmergencyContact}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <X size={15} />
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveEmergencyContact}
                      disabled={
                        isSavingEmergencyContact ||
                        !emergencyContactForm.name.trim() ||
                        !emergencyContactForm.relationship.trim() ||
                        !emergencyContactForm.phone.trim()
                      }
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Save size={15} />
                      {isSavingEmergencyContact ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              ) : employee?.emergency_contact ? (
                /* Existing Contact */
                <div className="space-y-3">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-slate-400">
                        Current emergency contact
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleEditEmergencyContact}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                    >
                      <Edit3 size={14} />
                      Edit
                    </button>
                  </div>

                  <InfoItem
                    icon={User}
                    label="Name"
                    value={employee.emergency_contact.name}
                  />

                  <InfoItem
                    icon={Users}
                    label="Relationship"
                    value={employee.emergency_contact.relationship}
                  />

                  <InfoItem
                    icon={Phone}
                    label="Phone"
                    value={employee.emergency_contact.phone}
                  />

                  {employee.emergency_contact.alternate_phone && (
                    <InfoItem
                      icon={Phone}
                      label="Alternate Phone"
                      value={employee.emergency_contact.alternate_phone}
                    />
                  )}

                  {employee.emergency_contact.address && (
                    <InfoItem
                      icon={MapPin}
                      label="Address"
                      value={employee.emergency_contact.address}
                    />
                  )}
                </div>
              ) : (
                /* No Contact */
                <div className="flex flex-col items-center py-5 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
                    <Phone size={21} />
                  </div>

                  <h3 className="text-sm font-bold text-slate-800">
                    No emergency contact
                  </h3>

                  <p className="mt-1 max-w-xs text-xs leading-5 text-slate-400">
                    Add someone we can contact in case of an emergency.
                  </p>

                  <button
                    type="button"
                    onClick={handleEditEmergencyContact}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    <Plus size={15} />
                    Add Emergency Contact
                  </button>
                </div>
              )}
            </div>
          </section>
          </div>

          {/* Account Overview + Bank Information */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Account Overview */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-6 py-5">
                <h2 className="text-base font-bold text-slate-900">
                  Account Overview
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  Current account status
                </p>
              </div>

              <div className="px-6 py-3">
                <StatusRow
                  label="Account status"
                  value={isActive ? "Active" : "Inactive"}
                  active={isActive}
                />

                <StatusRow
                  label="Security status"
                  value={user?.is_locked ? "Locked" : "Secure"}
                  active={!user?.is_locked}
                />

                <StatusRow label="Account role" value={roleLabel} />

                <StatusRow
                  label="Member since"
                  value={formatDate(user?.created_at)}
                />

                <StatusRow
                  label="Employment"
                  value={formatEmploymentType(employee?.employment_type)}
                />

                <StatusRow
                  label="Status"
                  value={formatStatus(employee?.status)}
                  active={employee?.status === "active"}
                />
              </div>
            </section>

            {/* Bank Information */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Bank Information
                  </h2>

                  <p className="mt-1 text-xs text-slate-400">
                    Your salary and banking details
                  </p>
                </div>

                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-500">
                  <CreditCard size={18} />
                </div>
              </div>

              <div className="p-6">
                {employee?.bank_information ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoItem
                      icon={Building2}
                      label="Bank Name"
                      value={employee.bank_information.bank_name}
                    />

                    <InfoItem
                      icon={User}
                      label="Account Holder"
                      value={employee.bank_information.account_holder_name}
                    />

                    <InfoItem
                      icon={CreditCard}
                      label="Account Number"
                      value={maskAccountNumber(
                        employee.bank_information.account_number,
                      )}
                    />

                    <InfoItem
                      icon={ShieldCheck}
                      label="IFSC Code"
                      value={employee.bank_information.ifsc_code}
                    />

                    {employee.bank_information.branch && (
                      <InfoItem
                        icon={MapPin}
                        label="Branch"
                        value={employee.bank_information.branch}
                      />
                    )}
                  </div>
                ) : (
                  <EmptyInformation
                    icon={CreditCard}
                    title="Bank information not added"
                    description="Your bank information has not been provided by HR."
                  />
                )}
              </div>
            </section>
          </div>

        {/* Employment Information */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Employment Information
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                Your current employment details
              </p>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-500">
              <BriefcaseBusiness size={18} />
            </div>
          </div>

          <div className="grid gap-3 p-6 sm:grid-cols-2 lg:grid-cols-3">
            <InfoItem
              icon={ShieldCheck}
              label="Employee ID"
              value={employee?.employee_id}
            />

            <InfoItem
              icon={BriefcaseBusiness}
              label="Designation"
              value={employee?.designation}
            />

            <InfoItem
              icon={Building2}
              label="Department"
              value={departmentName}
            />

            <InfoItem
              icon={CalendarDays}
              label="Joining Date"
              value={formatDate(employee?.joining_date)}
            />

            <InfoItem
              icon={Clock3}
              label="Employment Type"
              value={formatEmploymentType(employee?.employment_type)}
            />

            <InfoItem
              icon={MapPin}
              label="Work Location"
              value={employee?.work_location}
            />

            <InfoItem
              icon={User}
              label="Reporting Manager"
              value={employee?.reporting_manager}
            />

            <InfoItem
              icon={Banknote}
              label="Salary Structure"
              value={employee?.salary_structure}
            />

            <InfoItem icon={Clock3} label="Shift" value={shiftName} />
          </div>
        </section>
      </div>
    </div>
  );
}