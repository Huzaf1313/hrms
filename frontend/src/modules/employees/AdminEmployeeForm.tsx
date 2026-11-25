import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  AlertCircle,
  Check,
  Loader2,
  LockKeyhole,
  Mail,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";

import type { Department } from "../departments/types";
import type { Employee, EmployeeCreate } from "./types";
import type { Shift } from "../shifts/types";
import { formatDuration, formatShiftTime } from "../shifts/shiftService";
import {
  LEGACY_SALARY_STRUCTURE_LABELS,
  salaryBandFor,
  type SalaryStructure,
} from "../payroll/admin_salary_structure_service";
import type { ManagerAccount } from "../auth/userService";
import { employeeService } from "./employeeService";
import { ApiError } from "../../services/api";
import { Button } from "../../components/ui/Button";

interface AdminEmployeeFormProps {
  departments: Department[];
  salaryStructures: SalaryStructure[];
  managers: ManagerAccount[];
  shifts: Shift[];
  initialEmployee?: Employee;
  isSubmitting: boolean;
  errorMessage: string | null;
  onSubmit: (data: EmployeeCreate) => void;
  onCancel: () => void;
}

const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "intern", label: "Intern" },
] as const;

type IdentityField = "first_name" | "last_name" | "phone";

const NAME_DIGIT_PATTERN = /[0-9]/;
const PHONE_PATTERN = /^[0-9]{10}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COUNTRY_CODES = [
  { code: "+91", label: "India", flag: "🇮🇳" },
  { code: "+1", label: "USA", flag: "🇺🇸" },
  { code: "+44", label: "UK", flag: "🇬🇧" },
  { code: "+971", label: "UAE", flag: "🇦🇪" },
  { code: "+61", label: "Australia", flag: "🇦🇺" },
  { code: "+49", label: "Germany", flag: "🇩🇪" },
  { code: "+33", label: "France", flag: "🇫🇷" },
  { code: "+81", label: "Japan", flag: "🇯🇵" },
  { code: "+65", label: "Singapore", flag: "🇸🇬" },
  { code: "+86", label: "China", flag: "🇨🇳" },
];

function sanitizeName(value: string): string {
  return value.replace(/[0-9]/g, "");
}

function sanitizePhone(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

function toFormState(employee?: Employee): EmployeeCreate {
  if (!employee) {
    return {
      employee_id: "",
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      password: "Temp@1234",
      date_of_birth: "",
      gender: "",
      address: "",
      department_id: "",
      designation: "",
      joining_date: "",
      employment_type: "full_time",
      work_location: "",
      reporting_manager: "",
      manager_id: "",
      salary_structure: "",
      salary: "",
      shift_id: "",
    };
  }

  return {
    employee_id: employee.employee_id,
    first_name: employee.first_name,
    last_name: employee.last_name,
    email: employee.email,
    phone: employee.phone,
    password: "",
    date_of_birth: employee.date_of_birth ?? "",
    gender: employee.gender ?? "",
    address: employee.address ?? "",
    department_id: employee.department_id,
    designation: employee.designation,
    joining_date: employee.joining_date ?? "",
    employment_type: employee.employment_type,
    work_location: employee.work_location ?? "",
    reporting_manager: employee.reporting_manager ?? "",
    manager_id: employee.manager_id ?? "",
    salary_structure: employee.salary_structure ?? "",
    salary: employee.salary ?? "",
    shift_id: employee.shift_id ?? "",
  };
}

function AdminEmployeeForm({
  departments,
  salaryStructures,
  managers,
  shifts,
  initialEmployee,
  isSubmitting,
  errorMessage,
  onSubmit,
  onCancel,
}: AdminEmployeeFormProps) {
  const [form, setForm] = useState<EmployeeCreate>(() =>
    toFormState(initialEmployee),
  );

  const [countryCode, setCountryCode] = useState("+91");

  const [photoPreview, setPhotoPreview] = useState<string | null>(
    initialEmployee?.avatar_url ?? null,
  );
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [salaryError, setSalaryError] = useState<string | null>(null);
  const [identityErrors, setIdentityErrors] = useState<
    Partial<Record<IdentityField, string>>
  >({});

  // OTP Verification state (for Add Employee mode)
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSuccess, setOtpSuccess] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [emailError, setEmailError] = useState("");
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  // The ID the new employee will get, shown in the read-only field. Kept out
  // of `form` because the server allocates the real one on save.
  const [nextEmployeeId, setNextEmployeeId] = useState("");
  const isCreating = !initialEmployee;

  useEffect(() => {
    if (!isCreating) return;

    let active = true;

    employeeService
      .getNextEmployeeId()
      .then((result) => {
        if (active) setNextEmployeeId(result.employee_id);
      })
      .catch(() => {
        // Falls back to the placeholder; the ID is still assigned on save.
      });

    return () => {
      active = false;
    };
  }, [isCreating]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const [lastInitialEmployee, setLastInitialEmployee] =
    useState(initialEmployee);

  if (lastInitialEmployee !== initialEmployee) {
    setLastInitialEmployee(initialEmployee);
    setForm(toFormState(initialEmployee));
    setPhotoPreview(initialEmployee?.avatar_url ?? null);
    setPhotoFile(null);
    setPhotoRemoved(false);
    setSalaryError(null);
    setIdentityErrors({});
    setVerifiedEmail(null);
    setVerificationToken(null);
    setOtpSent(false);
    setOtpValue("");
    setOtpError(null);
    setOtpSuccess(null);
    setCooldownSeconds(0);
  }

  const isEditMode = Boolean(initialEmployee);
  const isDirty =
    JSON.stringify(form) !== JSON.stringify(toFormState(initialEmployee)) ||
    Boolean(photoFile) ||
    photoRemoved;

  const requestClose = useCallback(() => {
    if (isDirty && !window.confirm("Discard your unsaved changes?")) {
      return;
    }
    onCancel();
  }, [isDirty, onCancel]);

  useEffect(() => {
    function handleKeyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
        return;
      }

      if (event.key !== "Tab" || !modalRef.current) return;
      const focusable = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyboard);
    return () => document.removeEventListener("keydown", handleKeyboard);
  }, [requestClose]);

  function focusFirstError() {
    requestAnimationFrame(() => {
      formRef.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
    });
  }

  function generatePassword() {
    const value = `Temp@${Math.floor(1000 + Math.random() * 9000)}`;
    updateField("password", value);
    setShowPassword(true);
    setPasswordError(null);
  }

  const isEmailVerified =
    isEditMode ||
    (Boolean(verificationToken) &&
      Boolean(verifiedEmail) &&
      form.email.trim().toLowerCase() === verifiedEmail?.toLowerCase());

  function handleEmailChange(value: string) {
    updateField("email", value);
    // Invalidate verification if email address is edited after verification
    if (verifiedEmail && value.trim().toLowerCase() !== verifiedEmail.toLowerCase()) {
      setVerifiedEmail(null);
      setVerificationToken(null);
      setOtpSuccess(null);
      setOtpError(null);
      setOtpSent(false);
      setOtpValue("");
    }
  }

  async function handleSendOtp() {
    const emailToVerify = form.email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailToVerify || !emailRegex.test(emailToVerify)) {
      setOtpError("Please enter a valid email address before requesting an OTP.");
      return;
    }

    setIsSendingOtp(true);
    setOtpError(null);
    setOtpSuccess(null);

    try {
      const response = await employeeService.requestEmailOtp(emailToVerify);
      setOtpSent(true);
      setCooldownSeconds(response.cooldown_seconds || 60);
      setOtpSuccess(`Verification code sent to ${emailToVerify}.`);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to send verification code. Please check your network or try again.";
      setOtpError(message);
    } finally {
      setIsSendingOtp(false);
    }
  }

  async function handleVerifyOtp() {
    const trimmedOtp = otpValue.trim();
    if (!trimmedOtp || trimmedOtp.length !== 6 || !/^\d{6}$/.test(trimmedOtp)) {
      setOtpError("Please enter the complete 6-digit verification code.");
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError(null);
    setOtpSuccess(null);

    try {
      const emailToVerify = form.email.trim().toLowerCase();
      const response = await employeeService.verifyEmailOtp(emailToVerify, trimmedOtp);
      setVerifiedEmail(response.email.toLowerCase());
      setVerificationToken(response.verification_token);
      setOtpSuccess("Email address successfully verified!");
      setOtpError(null);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Invalid or expired OTP. Please try again.";
      setOtpError(message);
    } finally {
      setIsVerifyingOtp(false);
    }
  }

  const selectedStructure = salaryStructures.find(
    (structure) => structure.name === form.salary_structure,
  );

  // Tolerates a stale or missing prop: a parent running an older module can
  // pass undefined, and an unguarded .find()/.map() there blanks the form.
  const availableShifts: Shift[] = Array.isArray(shifts)
    ? isEditMode
      ? shifts
      : shifts.filter((shift) => shift.is_active)
    : [];

  const selectedShift = availableShifts.find(
    (shift) => shift.id === form.shift_id,
  );

  const legacyStructureName =
    form.salary_structure &&
      !selectedStructure &&
      LEGACY_SALARY_STRUCTURE_LABELS[form.salary_structure]
      ? form.salary_structure
      : null;

  const salaryBand = salaryBandFor(selectedStructure);

  const currentManager = form.reporting_manager?.trim() ?? "";

  const managerIsListed = managers.some(
    (manager) =>
      manager.full_name.trim().toLowerCase() === currentManager.toLowerCase(),
  );

  const unmatchedManager =
    currentManager !== "" && !managerIsListed ? currentManager : null;

  function handleManagerChange(value: string) {
    // Manager ids are what scope a manager's team. reporting_manager is kept
    // in step as the display name the details page reads.
    if (!value) {
      updateField("reporting_manager", "");
      updateField("manager_id", "");
      return;
    }

    const manager = managers.find((entry) => entry.id === value);

    if (!manager) {
      updateField("reporting_manager", value);
      updateField("manager_id", "");
      return;
    }

    updateField("reporting_manager", manager.full_name);
    updateField("manager_id", manager.id);
  }

  function validateSalary(): boolean {
    if (!form.salary_structure) {
      setSalaryError(null);
      return true;
    }

    const { min, max } = salaryBand;

    if (min === null && max === null) {
      setSalaryError(null);
      return true;
    }

    const raw = form.salary?.trim() ?? "";

    if (raw === "" || !Number.isFinite(Number(raw))) {
      setSalaryError(null);
      return true;
    }

    const amount = Number(raw);

    if (min !== null && amount < min) {
      setSalaryError(
        `Salary must be at least ₹${min.toLocaleString("en-IN")} for ${selectedStructure?.name}.`,
      );
      return false;
    }

    if (max !== null && amount > max) {
      setSalaryError(
        `Salary cannot be more than ₹${max.toLocaleString("en-IN")} for ${selectedStructure?.name}.`,
      );
      return false;
    }

    setSalaryError(null);
    return true;
  }

  function updateField<K extends keyof EmployeeCreate>(
    key: K,
    value: EmployeeCreate[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function setIdentityError(field: IdentityField, message?: string) {
    setIdentityErrors((current) => {
      if (message) {
        return { ...current, [field]: message };
      }

      if (!(field in current)) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function validateIdentityField(
    field: IdentityField,
    rawValue?: string,
  ): string | undefined {
    const value = (rawValue ?? form[field] ?? "").trim();

    if (value === "") {
      return undefined;
    }

    if (field === "phone") {
      if (/[A-Za-z]/.test(value)) {
        return "Phone number cannot contain letters";
      }

      return PHONE_PATTERN.test(value)
        ? undefined
        : "Phone number must be exactly 10 digits";
    }

    return NAME_DIGIT_PATTERN.test(value)
      ? `${field === "first_name" ? "First" : "Last"} name cannot contain numbers`
      : undefined;
  }

  function validateIdentityFields(): boolean {
    const failures = (["first_name", "last_name", "phone"] as const).map(
      (field) => [field, validateIdentityField(field)] as const,
    );

    const nextErrors: Partial<Record<IdentityField, string>> = {};

    for (const [field, message] of failures) {
      if (message) {
        nextErrors[field] = message;
      }
    }

    setIdentityErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  function handleNameChange(field: "first_name" | "last_name", value: string) {
    const sanitized = sanitizeName(value);

    updateField(field, sanitized);
    setIdentityError(field, validateIdentityField(field, sanitized));
  }

  function handlePhoneChange(value: string) {
    const sanitized = sanitizePhone(value);

    updateField("phone", sanitized);
    setIdentityError("phone", validateIdentityField("phone", sanitized));
  }

  function handlePhotoChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const previewUrl = URL.createObjectURL(file);

    setPhotoPreview((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return previewUrl;
    });
    setPhotoFile(file);
    setPhotoRemoved(false);
  }

  function removePhoto() {
    setPhotoPreview((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return null;
    });
    setPhotoFile(null);
    setPhotoRemoved(true);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = form.email.trim();

    if (!email) {
      setEmailError("Email address is required.");
      return;
    }

    if (!EMAIL_PATTERN.test(email)) {
      setEmailError("Enter a valid email address.");
      return;
    }

    setEmailError("");
    if (!validateIdentityFields()) {
      focusFirstError();
      return;
    }

    const password = form.password?.trim() ?? "";

    if (!isEditMode && password) {
      const failedRule = [
        { label: "at least 8 characters", ok: password.length >= 8 },
        { label: "an uppercase letter", ok: /[A-Z]/.test(password) },
        { label: "a lowercase letter", ok: /[a-z]/.test(password) },
        { label: "a number", ok: /[0-9]/.test(password) },
        {
          label: "a special character",
          ok: /[^A-Za-z0-9]/.test(password),
        },
      ].find((rule) => !rule.ok);

      if (failedRule) {
        setPasswordError(`Password needs ${failedRule.label}.`);
        focusFirstError();
        return;
      }
    }

    setPasswordError(null);

    if (!validateSalary()) {
      focusFirstError();
      return;
    }

    if (!isEditMode && !isEmailVerified) {
      setOtpError("Email verification is required before adding an employee.");
      focusFirstError();
      return;
    }

    const payload: EmployeeCreate = {
      ...form,
      password: !isEditMode && password ? password : undefined,
      date_of_birth: form.date_of_birth || undefined,
      gender: form.gender || undefined,
      address: form.address || undefined,
      work_location: form.work_location || undefined,
      reporting_manager: form.reporting_manager || undefined,
      shift_id: form.shift_id || undefined,
      email_verification_token: verificationToken ?? undefined,
      avatar_file: photoFile ?? undefined,
      avatar_remove: photoRemoved,
    };

    if (isEditMode && !form.password) {
      payload.password = undefined;
    }

    onSubmit(payload);
  }

  const initials =
    `${form.first_name?.charAt(0) ?? ""}${form.last_name?.charAt(0) ?? ""}`
      .toUpperCase();
  const passwordValue = form.password ?? "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(17,24,39,0.5)] p-4 sm:p-6" role="presentation">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-form-title"
        aria-describedby="employee-form-description"
        className="relative flex max-h-[calc(100vh-32px)] w-full max-w-[720px] flex-col overflow-hidden rounded-none bg-white shadow-2xl"
      >

        {/* HEADER */}
        <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-[#E5E7EB] bg-white px-6 py-5">
          <div>
            <h2 id="employee-form-title" className="text-[18px] font-semibold text-[#111827]">
              {isEditMode ? "Edit Employee" : "Add Employee"}
            </h2>

            <p id="employee-form-description" className="mt-1 text-[13px] text-[#6B7280]">
              {isEditMode
                ? "Update employee information."
                : "Add a new employee to your organization."}
            </p>
          </div>

          <button
            type="button"
            onClick={requestClose}
            aria-label="Close employee form"
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#6B7280] transition hover:bg-[#F3F4F6] hover:text-[#111827] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* FORM */}
        <form
          onSubmit={handleSubmit}
          ref={formRef}
          className="min-h-0 flex-1 overflow-y-auto grid grid-cols-1 gap-x-4 gap-y-5 px-6 py-6 md:grid-cols-2"
        >

          {/* PHOTO */}
          <section aria-labelledby="profile-section-title" className="order-1 col-span-1 md:col-span-2">
            <div className="mb-4 flex items-center gap-3">
              <h3 id="profile-section-title" className="text-[13px] font-semibold text-[#111827]">Profile</h3>
              <div className="h-px flex-1 bg-[#E5E7EB]" />
            </div>
          <div className="flex items-center gap-4">
            <div className="relative">

              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Employee preview"
                  onError={() => setPhotoPreview(null)}
                  className="h-[72px] w-[72px] rounded-full border border-[#E5E7EB] object-cover"
                />
              ) : (
                <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#DBEAFE] text-[20px] font-semibold text-[#1D4ED8]">
                  {initials || "EM"}
                </div>
              )}

              {photoPreview && (
                <button
                  type="button"
                  onClick={removePhoto}
                  aria-label="Remove photo"
                  className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-lg text-white shadow hover:bg-red-600"
                >
                  ×
                </button>
              )}
            </div>

            <div>
                <h3 className="text-[13px] font-semibold text-[#111827]">
                Employee Photo
              </h3>

              <p className="mb-3 text-[12px] text-[#6B7280]">
                JPG or PNG, max 2 MB
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={handlePhotoChange}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-[12px] font-medium text-[#2563EB] transition hover:bg-[#EFF6FF]"
              >
                {photoPreview ? "Change Photo" : "Upload Photo"}
              </button>
            </div>
          </div>
          </section>

          {/* EMPLOYEE ID */}
          <section aria-labelledby="basic-section-title" className="order-2 col-span-1 md:col-span-2">
            <div className="mb-0 flex items-center gap-3">
              <h3 id="basic-section-title" className="text-[13px] font-semibold text-[#111827]">Basic Information</h3>
              <div className="h-px flex-1 bg-[#E5E7EB]" />
            </div>
          </section>
          <div className="order-3">
            <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
              Employee ID
            </label>

            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                readOnly
                // Create mode shows the server's preview. Nothing is reserved,
                // so the saved ID can differ if another employee is added first.
                value={isEditMode ? form.employee_id : nextEmployeeId}
                placeholder={isEditMode ? "AAR001" : "Generated on save"}
                title="Employee IDs are assigned automatically and cannot be changed."
                className="h-10 w-full cursor-default rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] pl-9 pr-3 text-[14px] text-[#6B7280] outline-none"
              />
            </div>
          </div>

          <section aria-labelledby="job-section-title" className="order-11 col-span-1 md:col-span-2">
            <div className="mb-0 flex items-center gap-3">
              <h3 id="job-section-title" className="text-[13px] font-semibold text-[#111827]">Job Details</h3>
              <div className="h-px flex-1 bg-[#E5E7EB]" />
            </div>
          </section>

          {/* EMPLOYMENT TYPE */}
          <div className="order-12">
            <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
              Employment Type <span className="ml-1 text-red-500">*</span>
            </label>

            <select
              required
              value={form.employment_type}
              onChange={(event) => {
                updateField(
                  "employment_type",
                  event.target.value as EmployeeCreate["employment_type"],
                );
              }}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10"
            >
              {EMPLOYMENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

{/* SHIFT */}
            <div className="order-15">
              <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
                Shift
              </label>

            <select
              value={form.shift_id ?? ""}
              onChange={(event) =>
                updateField("shift_id", event.target.value)
              }
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10 disabled:cursor-not-allowed disabled:bg-gray-50"
            >
              <option value="">
                {availableShifts.length === 0
                  ? "No shifts available yet"
                  : "No shift assigned"}
              </option>
              {availableShifts.map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {shift.name} ({formatShiftTime(shift.start_time)} -{" "}
                  {formatShiftTime(shift.end_time)},{" "}
                  {formatDuration(shift.duration_minutes)})
                </option>
              ))}
            </select>

            {availableShifts.length === 0 ? (
              <p className="mt-1.5 text-xs font-medium text-amber-600">
                No shift added yet!
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-gray-500">
                {selectedShift
                  ? `Overtime is worked time beyond this ${formatDuration(
                    selectedShift.duration_minutes,
                  )} shift.`
                  : "Assign a shift so attendance can be measured against it."}
              </p>
            )}
          </div>

          {/* FIRST NAME */}
          <div className="order-4">
            <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
              First Name <span className="ml-1 text-red-500">*</span>
            </label>

            <input
              required
              value={form.first_name}
              onChange={(event) =>
                handleNameChange("first_name", event.target.value)
              }
              onBlur={() =>
                setIdentityError(
                  "first_name",
                  validateIdentityField("first_name"),
                )
              }
              placeholder="First name"
              aria-invalid={Boolean(identityErrors.first_name)}
              className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2 ${identityErrors.first_name
                ? "border-red-400 focus:border-red-400 focus:ring-red-400/10"
                : "border-gray-200 focus:border-[#2563eb] focus:ring-[#2563eb]/10"
                }`}
            />

            {identityErrors.first_name && (
              <p className="mt-1.5 text-xs font-medium text-red-600">
                {identityErrors.first_name}
              </p>
            )}
          </div>

          {/* LAST NAME */}
          <div className="order-5">
            <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
              Last Name <span className="ml-1 text-red-500">*</span>
            </label>

            <input
              required
              value={form.last_name}
              onChange={(event) =>
                handleNameChange("last_name", event.target.value)
              }
              onBlur={() =>
                setIdentityError(
                  "last_name",
                  validateIdentityField("last_name"),
                )
              }
              placeholder="Last name"
              aria-invalid={Boolean(identityErrors.last_name)}
              className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2 ${identityErrors.last_name
                ? "border-red-400 focus:border-red-400 focus:ring-red-400/10"
                : "border-gray-200 focus:border-[#2563eb] focus:ring-[#2563eb]/10"
                }`}
            />

            {identityErrors.last_name && (
              <p className="mt-1.5 text-xs font-medium text-red-600">
                {identityErrors.last_name}
              </p>
            )}
          </div>

          {/* EMAIL */}
          <div className={`order-6 ${!isEditMode && otpSent && !isEmailVerified ? "col-span-1 md:col-span-2" : ""}`}>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-sm font-medium text-[#17375e]">
                Email Address <span className="ml-1 text-red-500">*</span>
              </label>

              {!isEditMode && isEmailVerified && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  <Check className="h-3.5 w-3.5" />
                  Email Verified
                </span>
              )}
            </div>

            {isEditMode ? (
              <input
                required
                type="email"
                value={form.email}
                onChange={(event) => {
                  const value = event.target.value;
                  updateField("email", value);

                  if (!value.trim()) {
                    setEmailError("Email address is required.");
                  } else if (!EMAIL_PATTERN.test(value.trim())) {
                    setEmailError("Enter a valid email address.");
                  } else {
                    setEmailError("");
                  }
                }} placeholder="employee@company.com"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10"
              />
            ) : (
              <div className="space-y-2.5">
                <div className="relative flex items-center">
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(event) => handleEmailChange(event.target.value)}
                    placeholder="employee@company.com"
                    className={`w-full rounded-xl border px-4 py-3 pr-32 text-sm outline-none transition focus:ring-2 ${isEmailVerified
                      ? "border-emerald-300 bg-emerald-50/20 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/10"
                      : "border-gray-200 focus:border-[#2563eb] focus:ring-[#2563eb]/10"
                      }`}
                  />

                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={
                      isSendingOtp ||
                      isVerifyingOtp ||
                      cooldownSeconds > 0 ||
                      isEmailVerified
                    }
                    className="absolute right-2 rounded-lg bg-[#2563eb] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    {isSendingOtp ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Sending…
                      </span>
                    ) : isEmailVerified ? (
                      "Verified"
                    ) : cooldownSeconds > 0 ? (
                      `Resend in ${cooldownSeconds}s`
                    ) : otpSent ? (
                      "Resend OTP"
                    ) : (
                      "Send OTP"
                    )}
                  </button>

                </div>

                {/* OTP Verification Box */}
                {otpSent && !isEmailVerified && (
                  <div className="rounded-2xl border border-blue-100 bg-[#f8faff] p-3.5 transition-all">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                        <Mail className="h-3.5 w-3.5 text-[#2563eb]" />
                        Enter 6-digit OTP sent to {form.email}
                      </span>
                      {cooldownSeconds > 0 && (
                        <span className="text-xs text-gray-500">
                          Resend available in {cooldownSeconds}s
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otpValue}
                        onChange={(e) => {
                          setOtpValue(
                            e.target.value.replace(/\D/g, "").slice(0, 6),
                          );
                          setOtpError(null);
                        }}
                        placeholder="Enter 6-digit OTP"
                        className="flex-1 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-mono tracking-widest outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10"
                      />

                      <button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={
                          isVerifyingOtp ||
                          isSendingOtp ||
                          otpValue.trim().length !== 6
                        }
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isVerifyingOtp ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Verifying…
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Verify OTP
                          </>
                        )}
                      </button>
                    </div>

                    {otpError && (
                      <p className="mt-2 flex items-center gap-1 text-xs font-medium text-red-600">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        {otpError}
                      </p>
                    )}

                    {otpSuccess && (
                      <p className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-600">
                        <Check className="h-3.5 w-3.5 shrink-0" />
                        {otpSuccess}
                      </p>
                    )}
                  </div>
                )}

                {/* Pre-OTP error or guidance */}
                {!otpSent && otpError && (
                  <p className="flex items-center gap-1 text-xs font-medium text-red-600">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {otpError}
                  </p>
                )}

                {isEmailVerified && (
                  <p className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                    <Check className="h-3.5 w-3.5" />
                    Email verified. Ready to add employee.
                  </p>
                )}

                {!otpSent && !isEmailVerified && !otpError && (
                  <p className="text-xs text-gray-500">
                    Click <strong>Send OTP</strong> to verify this employee's email address.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* PHONE */}
          <div className="order-7">
            <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
              Phone <span className="ml-1 text-red-500">*</span>
            </label>

            <div className="flex gap-2">
              <select
                value={countryCode}
                onChange={(event) => setCountryCode(event.target.value)}
                title={COUNTRY_CODES.find((c) => c.code === countryCode)?.label}
                className="w-[150px] shrink-0 rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-[#17375e] outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10"
              >
                {COUNTRY_CODES.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.flag} {country.code} ({country.label})
                  </option>
                ))}
              </select>

              <input
                required
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={form.phone}
                onChange={(event) => handlePhoneChange(event.target.value)}
                onBlur={() =>
                  setIdentityError("phone", validateIdentityField("phone"))
                }
                placeholder="10-digit phone number"
                aria-invalid={Boolean(identityErrors.phone)}
                className={`min-w-0 flex-1 rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2 ${
                  identityErrors.phone
                    ? "border-red-400 focus:border-red-400 focus:ring-red-400/10"
                    : "border-gray-200 focus:border-[#2563eb] focus:ring-[#2563eb]/10"
                }`}
              />
            </div>

            {identityErrors.phone ? (
              <p className="mt-1.5 text-xs font-medium text-red-600">
                {identityErrors.phone}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-gray-400">
                Exactly 10 digits, shown with{" "}
                {COUNTRY_CODES.find((c) => c.code === countryCode)?.code} prefix
              </p>
            )}
          </div>

          {/* REPORTING MANAGER */}
          <div className="order-16">
            <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
              Reporting Manager
            </label>

            <select
              value={form.manager_id || unmatchedManager || ""}
              onChange={(event) => handleManagerChange(event.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10"
            >
              <option value="">Select reporting manager</option>

              {unmatchedManager && (
                <option value={unmatchedManager}>
                  {unmatchedManager} (legacy)
                </option>
              )}

              {managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.full_name}
                </option>
              ))}
            </select>

            <p className="mt-1.5 text-xs text-gray-400">
              {managers.length === 0
                ? "No HR or manager accounts available"
                : unmatchedManager
                  ? "Previously typed manually — please re-select a current account"
                  : "HR and manager accounts only"}
            </p>
          </div>

          {/* LOGIN CREDENTIALS - create mode only */}
          {!isEditMode && (
            <section aria-labelledby="access-section-title" className="order-20 md:col-span-2">
              <div className="mb-4 flex items-center gap-3">
                <h3 id="access-section-title" className="text-[13px] font-semibold text-[#111827]">Account Access</h3>
                <div className="h-px flex-1 bg-[#E5E7EB]" />
              </div>
              <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
                Temporary Password{" "}
              </label>

              <div className="relative">
                <input
                  id="temporary-password"
                  type={showPassword ? "text" : "password"}
                  value={form.password ?? ""}
                  onChange={(event) => {
                    setPasswordError(null);
                    updateField("password", event.target.value);
                  }}
                  placeholder="Employee login password"
                  autoComplete="new-password"
                  aria-invalid={Boolean(passwordError)}
                  className={`h-10 w-full rounded-lg border px-3 py-2 pr-12 text-[14px] outline-none transition focus:ring-[3px] ${
                    passwordError
                      ? "border-red-400 focus:border-red-400 focus:ring-red-400/10"
                      : "border-gray-200 focus:border-[#2563eb] focus:ring-[#2563eb]/10"
                  }`}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((previous) => !previous)}
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-medium text-[#2563EB] hover:underline"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              {passwordError ? (
                <p className="mt-1.5 text-xs font-medium text-red-600">
                  {passwordError}
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-gray-400">
                  Min 8 characters with an uppercase letter, lowercase letter,
                  number &amp; special character. Shown once after creation so
                  you can share it with the employee.
                </p>
              )}
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg bg-[#F9FAFB] p-3 sm:grid-cols-5">
                {[
                   ["8+ characters", passwordValue.length >= 8],
                   ["Uppercase", /[A-Z]/.test(passwordValue)],
                   ["Lowercase", /[a-z]/.test(passwordValue)],
                   ["Number", /[0-9]/.test(passwordValue)],
                   ["Special character", /[^A-Za-z0-9]/.test(passwordValue)],
                ].map(([label, valid]) => (
                  <span key={String(label)} className={`flex items-center gap-1.5 text-[12px] ${valid ? "text-[#15803D]" : "text-[#6B7280]"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${valid ? "bg-[#22C55E]" : "bg-[#D1D5DB]"}`} />
                    {label}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={generatePassword}
                className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-[#2563EB] hover:underline"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Generate password
              </button>
            </section>
          )}

          {/* DEPARTMENT */}
          <div className="order-13">
            <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
              Department
            </label>

            <select
              required
              value={form.department_id}
              onChange={(event) =>
                updateField("department_id", event.target.value)
              }
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10"
            >
              <option value="">Select department</option>

              {departments.map((department) => (
                <option
                  key={department.id}
                  value={department.id}
                >
                  {department.name}
                </option>
              ))}
            </select>

            {departments.length === 0 ? (
              <p className="mt-1.5 text-xs font-medium text-amber-600">
                No department added yet!
              </p>
            ) : null}
          </div>

          {/* DESIGNATION */}
          <div className="order-14">
            <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
              Designation
            </label>

            <input
              required
              value={form.designation}
              onChange={(event) =>
                updateField("designation", event.target.value)
              }
              placeholder="e.g. Software Engineer"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10"
            />
          </div>

          {/* JOINING DATE */}
          <div className="order-17">
            <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
              Joining Date
            </label>

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={form.password ?? ""}
              onChange={(event) => {
                setPasswordError(null);
                updateField("password", event.target.value);
              }}
              placeholder="Employee login password"
              autoComplete="new-password"
              className={`w-full rounded-xl border px-4 py-3 pr-12 text-sm outline-none transition focus:ring-2 ${passwordError
                ? "border-red-400 focus:border-red-400 focus:ring-red-400/10"
                : "border-gray-200 focus:border-[#2563eb] focus:ring-[#2563eb]/10"
                }`}
            />

          {/* DATE OF BIRTH */}
          <div className="order-8">
            <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
              Date of Birth <span className="ml-1 text-red-500">*</span>
            </label>

            <input
              required={!isEditMode}
              type="date"
              value={form.date_of_birth ?? ""}
              onChange={(event) =>
                updateField("date_of_birth", event.target.value)
              }
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#2563eb] hover:underline"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          {/* GENDER */}
          <div className="order-9">
            <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
              Gender <span className="ml-1 text-red-500">*</span>
            </label>

          {departments.map((department) => (
            <option
              key={department.id}
              value={department.id}
            >
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* WORK LOCATION */}
          <div className="order-18">
            <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
              Work Location
            </label>

      {/* DESIGNATION */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
          Designation
        </label>

        <input
          required
          value={form.designation}
          onChange={(event) =>
            updateField("designation", event.target.value)
          }
          placeholder="e.g. Software Engineer"
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10"
        />
      </div>

          {/* SALARY STRUCTURE */}
          <div className="order-19 grid grid-cols-1 gap-4 sm:grid-cols-2 md:col-span-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
                Salary Structure
              </label>

      {/* DATE OF BIRTH */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
          Date of Birth <span className="ml-1 text-red-500">*</span>
        </label>

        <input
          required={!isEditMode}
          type="date"
          value={form.date_of_birth ?? ""}
          onChange={(event) =>
            updateField("date_of_birth", event.target.value)
          }
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10"
        />
      </div>

      {/* GENDER */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
          Gender <span className="ml-1 text-red-500">*</span>
        </label>

        <select
          required={!isEditMode}
          value={form.gender ?? ""}
          onChange={(event) =>
            updateField("gender", event.target.value)
          }
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10"
        >
          <option value="">Select gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </select>
      </div>

      {/* WORK LOCATION */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
          Work Location
        </label>

        <input
          value={form.work_location ?? ""}
          onChange={(event) =>
            updateField("work_location", event.target.value)
          }
          placeholder="e.g. Mumbai Office"
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10"
        />
      </div>

      {/* SALARY STRUCTURE */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:col-span-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
            Salary Structure
          </label>

          <select
            value={form.salary_structure ?? ""}
            onChange={(event) => {
              updateField("salary_structure", event.target.value);
              updateField("salary", "");
            }}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#456b54] focus:ring-2 focus:ring-[#456b54]/10"
          >
            <option value="" disabled>
              Select Salary Structure
            </option>

            {legacyStructureName && (
              <option value={legacyStructureName}>
                {LEGACY_SALARY_STRUCTURE_LABELS[legacyStructureName]} (legacy)
              </option>
            )}

            {salaryStructures.map((structure) => (
              <option key={structure.id} value={structure.name}>
                {structure.name}
              </option>
            ))}
          </select>

          <p className="mt-1.5 text-xs text-gray-400">
            {selectedStructure
              ? `Range: ${selectedStructure.range} · Gross: ₹${selectedStructure.gross_salary.toLocaleString("en-IN")}`
              : legacyStructureName
                ? "Previously hardcoded structure — please re-assign a current one"
                : "Choose a structure from Payroll → Salary Structure"}
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
            Salary Amount
          </label>

          <input
            type="number"
            min={salaryBand.min ?? undefined}
            max={salaryBand.max ?? undefined}
            required={Boolean(form.salary_structure)}
            value={form.salary ?? ""}
            onChange={(event) => {
              updateField("salary", event.target.value);
              setSalaryError(null);
            }}
            onBlur={validateSalary}
            placeholder="Enter salary"
            disabled={!form.salary_structure}
            aria-invalid={Boolean(salaryError)}
            className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2 disabled:bg-gray-100 disabled:cursor-not-allowed ${salaryError
              ? "border-red-400 focus:border-red-500 focus:ring-red-500/10"
              : "border-gray-200 focus:border-[#456b54] focus:ring-[#456b54]/10"
              }`}
          />

          {/* ADDRESS */}
          <div className="order-10 col-span-1 md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
              Address
            </label>

      {/* ADDRESS */}
      <div className="col-span-1 md:col-span-2">
        <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
          Address
        </label>

        <textarea
          value={form.address ?? ""}
          onChange={(event) =>
            updateField("address", event.target.value)
          }
          rows={3}
          placeholder="Employee address"
          className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10"
        />
      </div>

          {/* ERROR */}
          {errorMessage && (
            <div className="order-21 col-span-1 rounded-lg bg-[#FEF2F2] px-4 py-3 text-[12px] text-[#B91C1C] md:col-span-2">
              {errorMessage}
            </div>
          )}

          {/* BUTTONS */}
          <div className="sticky bottom-0 z-10 order-22 col-span-1 mt-2 flex justify-end gap-2 border-t border-[#E5E7EB] bg-white px-0 pt-4 md:col-span-2">
            <Button
              type="button"
              variant="outline"
              size="md"
              className="!rounded-none"
              onClick={requestClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="!rounded-none"
              isLoading={isSubmitting}
              disabled={isSubmitting || (!isEditMode && !isEmailVerified)}
              title={
                !isEditMode && !isEmailVerified
                  ? "Verify employee email to enable"
                  : undefined
              }
            >
              {isEditMode ? "Save Changes" : "Add Employee"}
            </Button>
          </div>
        </form>
      </div>
    </form>
      </div >
    </div >
  );
}

export default AdminEmployeeForm;
