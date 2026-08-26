import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../services/api";
import { Eye, EyeOff } from "lucide-react";

type Step = 1 | 2;

const roles = [
  { label: "Manager", value: "manager" },
  { label: "HR", value: "hr_admin" },
  { label: "Employee", value: "employee" },
];

interface RegistrationForm {
  full_name: string;
  email: string;
  phone_number: string;
  password: string;
  confirm_password: string;
  role: string;
}

function Registration() {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [form, setForm] = useState<RegistrationForm>({
    full_name: "",
    email: "",
    phone_number: "",
    password: "",
    confirm_password: "",
    role: "",
  });

  const updateField = (
    field: keyof RegistrationForm,
    value: string,
  ) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setError("");
  };

  const validateStep = () => {
    setError("");

    if (step === 1) {
      if (!form.full_name.trim()) {
        setError("Please enter your full name.");
        return false;
      }

      if (!form.email.trim()) {
        setError("Please enter your email address.");
        return false;
      }

      if (!form.phone_number.trim()) {
        setError("Please enter your phone number.");
        return false;
      }

      if (!/^\d{10,15}$/.test(form.phone_number.trim())) {
        setError("Please enter a valid phone number.");
        return false;
      }

      if (!form.password) {
        setError("Please enter a password.");
        return false;
      }

      if (form.password.length < 8) {
        setError("Password must be at least 8 characters long.");
        return false;
      }

      if (!form.confirm_password) {
        setError("Please confirm your password.");
        return false;
      }

      if (form.password !== form.confirm_password) {
        setError("Passwords do not match.");
        return false;
      }
    }

    if (step === 2) {
      if (!form.role) {
        setError("Please select the position you are registering for.");
        return false;
      }
    }

    return true;
  };

  const handleNext = () => {
    if (!validateStep()) {
      return;
    }

    setStep((previous) => (previous + 1) as Step);
  };

  const handleBack = () => {
    setError("");
    setStep((previous) => (previous - 1) as Step);
  };

  const handleRegistration = async () => {
    if (!validateStep()) {
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      await api.post("/auth/register", {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone_number: form.phone_number.trim(),
        password: form.password,
        role: form.role,
      });

      setSuccess(
        "Registration successful! Redirecting you to the login page...",
      );

      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (error: unknown) {
      setError(
        error instanceof ApiError
          ? error.message
          : "Unable to complete registration. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const renderInput = (
  label: string,
  field: keyof RegistrationForm,
  type = "text",
  placeholder = "",
) => {
  const isPasswordField = type === "password";

  const isPasswordVisible =
    field === "password"
      ? showPassword
      : showConfirmPassword;

  const inputType =
    isPasswordField && isPasswordVisible
      ? "text"
      : type;

  const togglePasswordVisibility = () => {
    if (field === "password") {
      setShowPassword((previous) => !previous);
    } else if (field === "confirm_password") {
      setShowConfirmPassword((previous) => !previous);
    }
  };

  return (
    <div>
      <label
        htmlFor={field}
        className="mb-2 block text-sm font-semibold text-[#17213a]"
      >
        {label}
      </label>

      <div className="relative">
        <input
          id={field}
          type={inputType}
          value={form[field]}
          onChange={(event) =>
            updateField(field, event.target.value)
          }
          placeholder={placeholder}
          className={`w-full rounded-xl border border-[#d6dbe6] px-4 py-4 text-[#17213a] outline-none transition placeholder:text-[#8993a7] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 ${
            isPasswordField ? "pr-12" : ""
          }`}
        />

        {isPasswordField && (
          <button
            type="button"
            onClick={togglePasswordVisibility}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#68758e] transition hover:text-[#2563eb]"
            aria-label={
              isPasswordVisible
                ? `Hide ${label.toLowerCase()}`
                : `Show ${label.toLowerCase()}`
            }
          >
            {isPasswordVisible ? (
              <EyeOff size={20} />
            ) : (
              <Eye size={20} />
            )}
          </button>
        )}
      </div>
    </div>
  );
};

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8faff] via-white to-[#eef2ff] px-4 py-4 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-6xl items-center justify-center">

        <div className="grid w-full overflow-hidden rounded-2xl bg-white shadow-2xl lg:grid-cols-2">

          {/* Left Section */}
          <div className="hidden bg-gradient-to-br from-[#f5f3ff] via-[#eef2ff] to-[#e0e7ff] p-8 lg:block">
            <div className="flex h-full flex-col justify-center">

              <div className="mb-8">
                <h1 className="text-2xl font-bold text-[#17213a]">
                  HRMS
                </h1>

                <p className="mt-1 text-sm text-[#4b5875]">
                  Human Resource Management System
                </p>
              </div>

              <h2 className="max-w-xl text-4xl font-bold leading-tight text-[#14213d]">
                Build a{" "}
                <span className="text-[#2563eb]">
                  Better Workplace.
                </span>
              </h2>

              <p className="mt-4 max-w-xl text-base leading-7 text-[#52607a]">
                Create your HRMS account and get started with
                smarter workforce management.
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3">
                {[
                  "Employee Management",
                  "Attendance & Leave",
                  "Reports & Analytics",
                  "Performance & Goals",
                ].map((feature) => (
                  <div
                    key={feature}
                    className="rounded-xl bg-white/80 p-3 shadow-sm"
                  >
                    <p className="text-sm font-semibold text-[#17213a]">
                      {feature}
                    </p>
                  </div>
                ))}
              </div>

            </div>
          </div>

          {/* Right Section */}
          <div className="flex items-center justify-center p-6 sm:p-8 lg:p-10">
            <div className="w-full max-w-lg">

              {/* Header */}
              <div className="text-center">
                <h1 className="text-2xl font-bold text-[#17213a]">
                  HRMS
                </h1>

                <p className="mt-1 text-sm text-[#52607a]">
                  Human Resource Management System
                </p>

                <h2 className="mt-5 text-2xl font-bold text-[#14213d]">
                  Create Your Account
                </h2>

                <p className="mt-2 text-[#52607a]">
                  Complete the steps below to create your HRMS account
                </p>
              </div>

              {/* Step Indicator */}
              <div className="mt-8 flex items-center justify-center">
                {[1, 2].map((item) => (
                  <div
                    key={item}
                    className="flex items-center"
                  >
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                        step >= item
                          ? "bg-[#2563eb] text-white"
                          : "bg-[#eef0f5] text-[#8993a7]"
                      }`}
                    >
                      {item}
                    </div>

                    {item < 2 && (
                      <div
                        className={`h-1 w-10 sm:w-16 ${
                          step > item
                            ? "bg-[#2563eb]"
                            : "bg-[#e2e5ec]"
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Step Title */}
              <div className="mt-5">
                <h3 className="text-lg font-semibold text-[#17213a]">
                  {step === 1 && "Personal Details"}
                  {step === 2 && "Role Details"}
                </h3>

                <p className="mt-1 text-sm text-[#68758e]">
                  {step === 1 &&
                    "Enter your personal information to get started."}

                  {step === 2 &&
                    "Select the position you are registering for."}
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Success */}
              {success && (
                <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                  {success}
                </div>
              )}

              {/* Step 1 */}
              {step === 1 && (
                <div className="mt-4 space-y-4">
                  {renderInput(
                    "Full Name",
                    "full_name",
                    "text",
                    "Enter your full name",
                  )}

                  {renderInput(
                    "Email Address",
                    "email",
                    "email",
                    "Enter your email address",
                  )}

                  {renderInput(
                    "Phone Number",
                    "phone_number",
                    "tel",
                    "Enter your phone number",
                  )}

                  {renderInput(
                    "Password",
                    "password",
                    "password",
                    "Create a password",
                  )}

                  {renderInput(
                    "Confirm Password",
                    "confirm_password",
                    "password",
                    "Confirm your password",
                  )}
                </div>
              )}

              {/* Step 2 */}
              {step === 2 && (
                <div className="mt-6">
                  <label
                    htmlFor="role"
                    className="mb-2 block text-sm font-semibold text-[#17213a]"
                  >
                    Select Position
                  </label>

                  <select
                    id="role"
                    value={form.role}
                    onChange={(event) =>
                      updateField("role", event.target.value)
                    }
                    className="w-full rounded-xl border border-[#d6dbe6] bg-white px-4 py-4 text-[#17213a] outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
                  >
                    <option value="">
                      Select the position you are registering for
                    </option>

                    {roles.map((role) => (
                      <option
                        key={role.value}
                        value={role.value}
                      >
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Navigation */}
              <div className="mt-6 flex gap-3">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={handleBack}
                    disabled={isLoading}
                    className="w-1/3 rounded-xl border border-[#d6dbe6] py-3 font-semibold text-[#52607a] transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Back
                  </button>
                )}

                {step < 2 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="w-full rounded-xl bg-[#2563eb] py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-[#1d4ed8]"
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleRegistration}
                    disabled={isLoading}
                    className="w-2/3 rounded-xl bg-[#2563eb] py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLoading
                      ? "Creating Account..."
                      : "Create Account"}
                  </button>
                )}
              </div>

              {/* Login */}
              <p className="mt-6 text-center text-sm text-[#52607a]">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="font-semibold text-[#2563eb] hover:underline"
                >
                  Sign In
                </button>
              </p>

              {/* Security */}
              <div className="mt-6 rounded-xl bg-[#f6f8fc] p-3 text-center text-xs text-[#68758e]">
                256-bit SSL Encrypted&nbsp;&nbsp; • &nbsp;&nbsp;
                Your data is always secure&nbsp;&nbsp; • &nbsp;&nbsp;
                Enterprise Grade Security
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default Registration;
