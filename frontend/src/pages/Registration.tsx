import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, ShieldCheck, Briefcase, Check } from "lucide-react";
import { api, ApiError } from "../services/api";
import { AuthShell } from "../components/auth/AuthShell";
import { AuthField } from "../components/auth/AuthField";
import { OtpInput } from "../components/auth/OtpInput";
import {
  PasswordStrength,
  passwordRules,
} from "../components/auth/PasswordStrength";

type Step = 1 | 2 | 3;

interface RoleOption {
  label: string;
  value: string;
  description: string;
  icon: typeof Briefcase;
}

const roles: RoleOption[] = [
  {
    label: "Manager",
    value: "manager",
    description: "Manage team approvals, attendance, goals, and appraisals",
    icon: Briefcase,
  },
  {
    label: "HR Administrator",
    value: "hr_admin",
    description: "Administer workforce records, payroll, policies, and onboarding",
    icon: ShieldCheck,
  },
];

interface RegistrationForm {
  full_name: string;
  email: string;
  phone_number: string;
  password: string;
  confirm_password: string;
  role: string;
}

type FieldErrors = Partial<Record<keyof RegistrationForm, string>>;

const NAME_PATTERN = /^[A-Za-z][A-Za-z .'-]{1,99}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9]{10,15}$/;

function validateRegistrationForm(
  form: RegistrationForm,
  step: Step
): FieldErrors {
  const errors: FieldErrors = {};

  if (step === 1) {
    // Full Name
    const name = form.full_name.trim();
    if (!name) {
      errors.full_name = "Please enter your full name.";
    } else if (!NAME_PATTERN.test(name)) {
      errors.full_name =
        "Name can only contain letters, spaces, dots, apostrophes and hyphens.";
    }

    // Email
    const email = form.email.trim();
    if (!email) {
      errors.email = "Please enter your email address.";
    } else if (
      !EMAIL_PATTERN.test(email) ||
      email.includes("..") ||
      email.startsWith(".") ||
      email.endsWith(".") ||
      email.includes("@.") ||
      email.includes(".@")
    ) {
      errors.email = "Please enter a valid email address.";
    }

    // Phone Number
    const phone = form.phone_number.trim().replace(/[\s-]/g, "");
    if (!phone) {
      errors.phone_number = "Please enter your phone number.";
    } else if (!PHONE_PATTERN.test(phone)) {
      errors.phone_number = "Enter 10 to 15 digits (optional + prefix).";
    }

    // Password
    if (!form.password) {
      errors.password = "Please enter a password.";
    } else {
      const failedRule = passwordRules.find((rule) => !rule.test(form.password));
      if (failedRule) {
        errors.password = `Password needs ${failedRule.label.toLowerCase()}.`;
      }
    }

    // Confirm Password
    if (!form.confirm_password) {
      errors.confirm_password = "Please confirm your password.";
    } else if (form.password !== form.confirm_password) {
      errors.confirm_password = "Passwords do not match.";
    }
  }

  // Role
  if (step === 2 && !form.role) {
    errors.role = "Please select the position you are registering for.";
  }

  return errors;
}

function Registration() {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otp, setOtp] = useState("");

  const [form, setForm] = useState<RegistrationForm>({
    full_name: "",
    email: "",
    phone_number: "",
    password: "",
    confirm_password: "",
    role: "",
  });

  const updateField = (field: keyof RegistrationForm, value: string) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setError("");
    setSuccess("");

    setFieldErrors((previous) => ({
      ...previous,
      [field]: undefined,
    }));
  };

  const validateStep = () => {
    setError("");
    const errors = validateRegistrationForm(form, step);
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep()) {
      return;
    }
    setStep((previous) => (previous + 1) as Step);
  };

  const handleBack = () => {
    setError("");
    setSuccess("");
    setStep((previous) => (previous - 1) as Step);
  };

  const handleRegistration = async () => {
    if (!validateStep()) return;

    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      await api.post("/auth/register/request-otp", {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone_number: form.phone_number.trim(),
        password: form.password,
        role: form.role,
      });

      setSuccess("OTP sent successfully. Please check your email.");
      setOtp("");
      setStep(3);
    } catch (err: unknown) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Unable to send OTP. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp.trim()) {
      setError("Please enter the OTP.");
      return;
    }

    if (!/^\d{6}$/.test(otp.trim())) {
      setError("OTP must be exactly 6 digits.");
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      await api.post("/auth/register/verify-otp", {
        email: form.email.trim(),
        otp: otp.trim(),
      });

      setSuccess("Registration successful! Redirecting you to the login page...");

      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (err: unknown) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Unable to verify OTP. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const stepLabels = [
    { number: 1, title: "Personal Details" },
    { number: 2, title: "Role Details" },
    { number: 3, title: "Verification" },
  ];

  return (
    <AuthShell
      headline="Build a"
      accent="Better Workplace."
      subcopy="Create your HRMS account and get started with smarter workforce management and automated HR operations."
      features={[
        "Employee Management",
        "Attendance & Leave",
        "Reports & Analytics",
        "Performance & Goals",
      ]}
    >
      <div className="space-y-4">
        {/* Step Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">
            Create Your Account
          </h1>
          <p className="mt-1 text-xs text-ink-400">
            {step === 1 && "Enter your contact and account security credentials"}
            {step === 2 && "Select the administrative portal role for your account"}
            {step === 3 && `Enter the verification code sent to ${form.email}`}
          </p>
        </div>

        {/* 3-Step Progress Rail (Fixes previous 2-dot bug) */}
        <div className="flex items-center justify-between" aria-label="Registration Progress">
          {stepLabels.map((item, index) => {
            const isCompleted = step > item.number;
            const isCurrent = step === item.number;

            return (
              <div key={item.number} className="flex flex-1 items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`technical-label flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-200 ${
                      isCompleted
                        ? "bg-brand-600 text-white shadow-sm"
                        : isCurrent
                        ? "border-2 border-brand-600 bg-surface text-brand-600 shadow-sm"
                        : "border border-line bg-surface-muted text-ink-300"
                    }`}
                  >
                    {isCompleted ? <Check className="h-4 w-4 stroke-[2.5]" /> : item.number}
                  </div>
                  <span
                    className={`technical-label mt-1 text-[10px] font-semibold tracking-wider ${
                      isCurrent
                        ? "text-brand-600"
                        : isCompleted
                        ? "text-ink-800"
                        : "text-ink-300"
                    }`}
                  >
                    {item.title}
                  </span>
                </div>

                {index < stepLabels.length - 1 && (
                  <div
                    className={`mx-2 mb-4 h-0.5 flex-1 transition-colors duration-200 ${
                      step > item.number ? "bg-brand-600" : "bg-line"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Alert Messages */}
        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700"
          >
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-700">
            {success}
          </div>
        )}

        {/* Step 1: Personal and Security Info */}
        {step === 1 && (
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            <AuthField
              id="register-full-name"
              label="Full Name"
              value={form.full_name}
              onChange={(e) => updateField("full_name", e.target.value)}
              error={fieldErrors.full_name}
              placeholder="John Doe"
              autoComplete="name"
              disabled={isLoading}
            />

            <AuthField
              id="register-email"
              label="Work Email"
              type="email"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              error={fieldErrors.email}
              placeholder="name@company.com"
              autoComplete="email"
              disabled={isLoading}
            />

            <div className="sm:col-span-2">
              <AuthField
                id="register-phone"
                label="Phone Number"
                type="tel"
                value={form.phone_number}
                onChange={(e) => updateField("phone_number", e.target.value)}
                error={fieldErrors.phone_number}
                placeholder="+91 9876543210"
                autoComplete="tel"
                disabled={isLoading}
              />
            </div>

            <div className="sm:col-span-1">
              <AuthField
                id="register-password"
                label="Password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => updateField("password", e.target.value)}
                error={fieldErrors.password}
                placeholder="Create strong password"
                autoComplete="new-password"
                disabled={isLoading}
                icon={
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="p-1 text-ink-400 transition-colors hover:text-ink-800"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />
              <PasswordStrength value={form.password} />
            </div>

            <AuthField
              id="register-confirm-password"
              label="Confirm Password"
              type={showConfirmPassword ? "text" : "password"}
              value={form.confirm_password}
              onChange={(e) => updateField("confirm_password", e.target.value)}
              error={fieldErrors.confirm_password}
              placeholder="Re-enter password"
              autoComplete="new-password"
              disabled={isLoading}
              icon={
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="p-1 text-ink-400 transition-colors hover:text-ink-800"
                  aria-label={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
            />
          </div>
        )}

        {/* Step 2: Role Selection as Selectable Cards */}
        {step === 2 && (
          <div className="space-y-3">
            <label className="technical-label block text-[11px] font-semibold uppercase tracking-wider text-ink-400">
              Select Position / Role
            </label>

            <div className="grid gap-3">
              {roles.map((role) => {
                const isSelected = form.role === role.value;
                const IconComponent = role.icon;

                return (
                  <button
                    key={role.value}
                    type="button"
                    onClick={() => updateField("role", role.value)}
                    className={`group relative flex items-start gap-4 rounded-xl border p-4 text-left transition-all duration-150 ${
                      isSelected
                        ? "border-brand-600 bg-brand-50/30 ring-2 ring-brand-500/20"
                        : "border-line bg-surface hover:border-brand-500/40 hover:bg-surface-muted"
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${
                        isSelected
                          ? "bg-brand-600 text-white"
                          : "bg-surface-muted text-ink-600 group-hover:text-brand-600"
                      }`}
                    >
                      <IconComponent size={20} />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-ink-900">
                          {role.label}
                        </span>
                        <div
                          className={`flex h-4 w-4 items-center justify-center rounded-full border transition-all ${
                            isSelected
                              ? "border-brand-600 bg-brand-600"
                              : "border-ink-300"
                          }`}
                        >
                          {isSelected && (
                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                          )}
                        </div>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-ink-600">
                        {role.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {fieldErrors.role && (
              <p
                role="alert"
                aria-live="polite"
                className="mt-1.5 text-xs font-medium text-red-600"
              >
                {fieldErrors.role}
              </p>
            )}
          </div>
        )}

        {/* Step 3: OTP Verification */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-line bg-surface-muted p-4">
              <span className="technical-label block text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                Registered Work Email
              </span>
              <span className="mt-0.5 block text-sm font-semibold text-ink-900">
                {form.email}
              </span>
              <p className="mt-2 text-xs text-ink-600">
                The one-time verification code is valid for 5 minutes.
              </p>
            </div>

            <div className="py-2">
              <OtpInput
                value={otp}
                onChange={(val) => {
                  setOtp(val);
                  setError("");
                  setSuccess("");
                }}
                disabled={isLoading}
                autoFocus
              />
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={handleVerifyOTP}
                disabled={isLoading || otp.length !== 6}
                className="w-full rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white shadow-md shadow-brand-600/20 transition-all hover:bg-brand-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? "Verifying..." : "Verify OTP & Complete Setup"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep(2);
                  setOtp("");
                  setError("");
                  setSuccess("");
                }}
                disabled={isLoading}
                className="w-full rounded-xl border border-line py-2.5 text-xs font-semibold text-ink-600 transition-colors hover:bg-surface-muted"
              >
                ← Back to Role Details
              </button>
            </div>
          </div>
        )}

        {/* Navigation Buttons for Step 1 & 2 */}
        {step < 3 && (
          <div className="flex items-center gap-3 pt-2">
            {step > 1 && (
              <button
                type="button"
                onClick={handleBack}
                disabled={isLoading}
                className="w-1/3 rounded-xl border border-line py-3.5 text-sm font-semibold text-ink-600 transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                Back
              </button>
            )}

            {step === 1 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={isLoading}
                className="w-full rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white shadow-md shadow-brand-600/20 transition-all hover:bg-brand-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRegistration}
                disabled={isLoading}
                className="w-2/3 rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white shadow-md shadow-brand-600/20 transition-all hover:bg-brand-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? "Sending Code..." : "Send Verification Code"}
              </button>
            )}
          </div>
        )}

        {/* Footer Link to Login */}
        <p className="text-center text-xs text-ink-600">
          Already have an account?{" "}
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="font-semibold text-brand-600 transition-colors hover:text-brand-700 hover:underline"
          >
            Sign In
          </button>
        </p>
      </div>
    </AuthShell>
  );
}

export default Registration;
