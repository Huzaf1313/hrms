import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import {
  api,
  ApiError,
  clearSession,
  setAccessToken,
  setRefreshToken,
} from "../services/api";
import { clearAuthQueries } from "../lib/queryClient";

const roles = [
  "Manager",
  "HR",
  "Employee",
];

const roleMap: Record<string, string> = {
  Manager: "manager",
  HR: "hr_admin",
  Employee: "employee",
};

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

interface UserResponse {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

interface ForgotPasswordResponse {
  message: string;
  expires_in_minutes: number;
}

interface VerifyOTPResponse {
  email: string;
  verified: boolean;
  reset_token: string;
  expires_in_minutes: number;
}

interface ResetPasswordResponse {
  message: string;
}

type ForgotPasswordStep =
  | "email"
  | "otp"
  | "reset"
  | "success";

function Login() {
  const navigate = useNavigate();

  const [selectedRole, setSelectedRole] = useState("Employee");

  // Login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Forgot password state
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] =
    useState<ForgotPasswordStep>("email");

  const [forgotEmail, setForgotEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setError("");

    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      setError("Please enter your email address and password.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);

    try {
      const loginResponse = await api.post("/auth/login", {
        email: trimmedEmail,
        password,
      });

      const {
        access_token,
        refresh_token,
        token_type,
      } = loginResponse as LoginResponse;

      // Clear any cached data from previous session
      clearAuthQueries();

      setAccessToken(access_token);

      setRefreshToken(refresh_token);
      localStorage.setItem("token_type", token_type);

      const userResponse = await api.get("/users/me");

      const user = userResponse as UserResponse;

      const expectedRole = roleMap[selectedRole];

      if (user.role !== expectedRole) {
        clearSession();
        localStorage.removeItem("token_type");

        setError(
          `This account belongs to the ${user.role} role. Please select the correct login section.`
        );

        return;
      }

      localStorage.setItem("user", JSON.stringify(user));

      if (rememberMe) {
        localStorage.setItem("remember_me", "true");
      } else {
        localStorage.removeItem("remember_me");
      }

      if (user.role === "employee") {
        navigate("/employee/dashboard");
      } else {
        navigate("/dashboard");
      }
    } catch (error: unknown) {
      clearSession();
      localStorage.removeItem("token_type");

      setError(
        error instanceof ApiError
          ? error.message
          : "Unable to sign in. Please check your email and password and try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPasswordStart = () => {
    setIsForgotPassword(true);
    setForgotStep("email");
    setForgotEmail(email.trim());
    setOtp("");
    setResetToken("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setSuccessMessage("");
  };

  const handleBackToLogin = () => {
    setIsForgotPassword(false);
    setForgotStep("email");
    setForgotEmail("");
    setOtp("");
    setResetToken("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setSuccessMessage("");
    setIsLoading(false);
  };

  const handleSendOTP = async () => {
    setError("");
    setSuccessMessage("");

    const trimmedEmail = forgotEmail.trim();

    if (!trimmedEmail) {
      setError("Please enter your email address.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.post(
        "/auth/forgot-password",
        {
          email: trimmedEmail,
        }
      );

      const result = response as ForgotPasswordResponse;

      setForgotEmail(trimmedEmail);
      setSuccessMessage(
        result.message ||
          "If an account with this email exists, a password reset OTP has been sent."
      );

      setForgotStep("otp");
    } catch (error: unknown) {
      setError(
        error instanceof ApiError
          ? error.message
          : "Unable to send OTP. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    setError("");
    setSuccessMessage("");

    const trimmedOTP = otp.trim();

    if (!/^\d{6}$/.test(trimmedOTP)) {
      setError("Please enter the 6-digit OTP.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.post(
        "/auth/forgot-password/verify-otp",
        {
          email: forgotEmail.trim(),
          otp: trimmedOTP,
        }
      );

      const result = response as VerifyOTPResponse;

      if (!result.verified || !result.reset_token) {
        setError(
          "OTP verification failed. Please request a new OTP."
        );
        return;
      }

      setResetToken(result.reset_token);
      setOtp("");
      setSuccessMessage("");
      setForgotStep("reset");
    } catch (error: unknown) {
      setError(
        error instanceof ApiError
          ? error.message
          : "Unable to verify OTP. Please check the OTP and try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError("");
    setSuccessMessage("");

    if (!newPassword || !confirmPassword) {
      setError(
        "Please enter your new password and confirm password."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(
        "New password and confirm password do not match."
      );
      return;
    }

    if (newPassword.length < 8) {
      setError(
        "Password must be at least 8 characters long."
      );
      return;
    }

    if (!/[A-Z]/.test(newPassword)) {
      setError(
        "Password must contain at least one uppercase letter."
      );
      return;
    }

    if (!/[a-z]/.test(newPassword)) {
      setError(
        "Password must contain at least one lowercase letter."
      );
      return;
    }

    if (!/[0-9]/.test(newPassword)) {
      setError(
        "Password must contain at least one number."
      );
      return;
    }

    if (!/[^A-Za-z0-9]/.test(newPassword)) {
      setError(
        "Password must contain at least one special character."
      );
      return;
    }

    if (!resetToken) {
      setError(
        "Password reset session is invalid. Please request a new OTP."
      );
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.post(
        "/auth/forgot-password/reset-password",
        {
          email: forgotEmail.trim(),
          reset_token: resetToken,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }
      );

      const result = response as ResetPasswordResponse;

      setSuccessMessage(
        result.message || "Password reset successfully."
      );

      setResetToken("");
      setNewPassword("");
      setConfirmPassword("");
      setForgotStep("success");
    } catch (error: unknown) {
      setError(
        error instanceof ApiError
          ? error.message
          : "Unable to reset password. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const renderForgotPasswordContent = () => {
    if (forgotStep === "email") {
      return (
        <>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-[#14213d]">
              Forgot Password?
            </h2>

            <p className="mt-2 text-[#52607a]">
              Enter your registered email address and we'll
              send you an OTP to reset your password.
            </p>
          </div>

          <div className="mt-8">
            <label
              htmlFor="forgot-email"
              className="mb-2 block text-sm font-semibold text-[#17213a]"
            >
              Email Address
            </label>

            <input
              id="forgot-email"
              type="email"
              value={forgotEmail}
              onChange={(event) =>
                setForgotEmail(event.target.value)
              }
              placeholder="Enter your registered email"
              disabled={isLoading}
              className="w-full rounded-xl border border-[#d6dbe6] px-4 py-4 text-[#17213a] outline-none transition placeholder:text-[#8993a7] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 disabled:bg-gray-50"
            />
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleSendOTP}
            disabled={isLoading}
            className="mt-6 w-full rounded-xl bg-[#2563eb] py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Sending OTP..." : "Send OTP"}
          </button>

          <button
            type="button"
            onClick={handleBackToLogin}
            disabled={isLoading}
            className="mt-4 w-full rounded-xl border border-[#d6dbe6] py-3 text-sm font-semibold text-[#52607a] transition hover:bg-[#f8faff] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Back to Login
          </button>
        </>
      );
    }

    if (forgotStep === "otp") {
      return (
        <>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-[#14213d]">
              Verify OTP
            </h2>

            <p className="mt-2 text-[#52607a]">
              Enter the 6-digit verification code sent to
            </p>

            <p className="mt-1 font-semibold text-[#17213a]">
              {forgotEmail}
            </p>
          </div>

          {successMessage && (
            <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              {successMessage}
            </div>
          )}

          <div className="mt-7">
            <label
              htmlFor="otp"
              className="mb-2 block text-sm font-semibold text-[#17213a]"
            >
              Verification Code
            </label>

            <input
              id="otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(event) =>
                setOtp(
                  event.target.value
                    .replace(/\D/g, "")
                    .slice(0, 6)
                )
              }
              placeholder="Enter 6-digit OTP"
              disabled={isLoading}
              className="w-full rounded-xl border border-[#d6dbe6] px-4 py-4 text-center text-xl font-semibold tracking-[0.4em] text-[#17213a] outline-none transition placeholder:text-[#8993a7] placeholder:tracking-normal focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 disabled:bg-gray-50"
            />
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleVerifyOTP}
            disabled={isLoading}
            className="mt-6 w-full rounded-xl bg-[#2563eb] py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Verifying..." : "Verify OTP"}
          </button>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setForgotStep("email");
                setOtp("");
                setError("");
                setSuccessMessage("");
              }}
              disabled={isLoading}
              className="text-sm font-semibold text-[#2563eb] hover:underline disabled:opacity-60"
            >
              Change Email
            </button>

            <button
              type="button"
              onClick={handleSendOTP}
              disabled={isLoading}
              className="text-sm font-semibold text-[#2563eb] hover:underline disabled:opacity-60"
            >
              Resend OTP
            </button>
          </div>
        </>
      );
    }

    if (forgotStep === "reset") {
      return (
        <>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-[#14213d]">
              Create New Password
            </h2>

            <p className="mt-2 text-[#52607a]">
              Enter a new password for your HRMS account.
            </p>
          </div>

          <div className="mt-7">
            <label
              htmlFor="new-password"
              className="mb-2 block text-sm font-semibold text-[#17213a]"
            >
              New Password
            </label>

            <div className="relative">
              <input
                id="new-password"
                type={
                  showNewPassword ? "text" : "password"
                }
                value={newPassword}
                onChange={(event) =>
                  setNewPassword(event.target.value)
                }
                placeholder="Enter new password"
                disabled={isLoading}
                className="w-full rounded-xl border border-[#d6dbe6] px-4 py-4 pr-12 text-[#17213a] outline-none transition placeholder:text-[#8993a7] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 disabled:bg-gray-50"
              />

              <button
                type="button"
                onClick={() =>
                  setShowNewPassword(
                    (previous) => !previous
                  )
                }
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#68758e] transition hover:text-[#2563eb]"
                aria-label={
                  showNewPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showNewPassword ? (
                  <EyeOff size={20} />
                ) : (
                  <Eye size={20} />
                )}
              </button>
            </div>
          </div>

          <div className="mt-4">
            <label
              htmlFor="confirm-password"
              className="mb-2 block text-sm font-semibold text-[#17213a]"
            >
              Confirm Password
            </label>

            <div className="relative">
              <input
                id="confirm-password"
                type={
                  showConfirmPassword
                    ? "text"
                    : "password"
                }
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                placeholder="Confirm new password"
                disabled={isLoading}
                className="w-full rounded-xl border border-[#d6dbe6] px-4 py-4 pr-12 text-[#17213a] outline-none transition placeholder:text-[#8993a7] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 disabled:bg-gray-50"
              />

              <button
                type="button"
                onClick={() =>
                  setShowConfirmPassword(
                    (previous) => !previous
                  )
                }
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#68758e] transition hover:text-[#2563eb]"
                aria-label={
                  showConfirmPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showConfirmPassword ? (
                  <EyeOff size={20} />
                ) : (
                  <Eye size={20} />
                )}
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3">
            <p className="text-xs leading-5 text-[#52607a]">
              Password must contain at least 8 characters,
              including uppercase, lowercase, a number, and
              a special character.
            </p>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleResetPassword}
            disabled={isLoading}
            className="mt-6 w-full rounded-xl bg-[#2563eb] py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading
              ? "Resetting Password..."
              : "Reset Password"}
          </button>
        </>
      );
    }

    return (
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg
            className="h-8 w-8 text-green-600"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <h2 className="mt-5 text-2xl font-bold text-[#14213d]">
          Password Reset Successful
        </h2>

        <p className="mt-3 text-[#52607a]">
          Your password has been updated successfully.
          You can now sign in using your new password.
        </p>

        {successMessage && (
          <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {successMessage}
          </div>
        )}

        <button
          type="button"
          onClick={handleBackToLogin}
          className="mt-7 w-full rounded-xl bg-[#2563eb] py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-[#1d4ed8]"
        >
          Back to Login
        </button>
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

              {/* Logo */}
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-[#17213a]">
                  HRMS
                </h1>

                <p className="mt-1 text-sm text-[#4b5875]">
                  Human Resource Management System
                </p>
              </div>

              {/* Heading */}
              <h2 className="max-w-xl text-4xl font-bold leading-tight text-[#14213d]">
                Smarter{" "}
                <span className="text-[#2563eb]">
                  People.
                </span>
                <br />
                Stronger{" "}
                <span className="text-[#2563eb]">
                  Business.
                </span>
              </h2>

              <p className="mt-4 max-w-xl text-base leading-7 text-[#52607a]">
                A complete HRMS to manage your workforce,
                automate HR operations and build a productive,
                happy workplace.
              </p>

              {/* Features */}
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

              {!isForgotPassword ? (
                <>
                  {/* Login Header */}
                  <div className="text-center">
                    <h1 className="text-2xl font-bold text-[#17213a]">
                      HRMS
                    </h1>

                    <p className="mt-1 text-sm text-[#52607a]">
                      Human Resource Management System
                    </p>

                    <h2 className="mt-6 text-2xl font-bold text-[#14213d]">
                      Welcome Back!
                    </h2>

                    <p className="mt-2 text-[#52607a]">
                      Sign in to access your HRMS account
                    </p>
                  </div>

                  {/* Role Selector */}
                  <div className="mt-8 grid grid-cols-3 gap-2">
                    {roles.map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => {
                          setSelectedRole(role);
                          setError("");
                        }}
                        className={`rounded-xl px-3 py-2 text-xs font-medium transition ${
                          selectedRole === role
                            ? "bg-[#2563eb] text-white shadow-md"
                            : "bg-[#f3f4f8] text-[#52607a] hover:bg-[#e9eaf0]"
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>

                  {/* Selected Role */}
                  <div className="mt-5">
                    <h3 className="text-lg font-semibold text-[#17213a]">
                      {selectedRole} Sign In
                    </h3>

                    <p className="mt-1 text-sm text-[#68758e]">
                      Sign in using your{" "}
                      {selectedRole.toLowerCase()} account.
                    </p>
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  {/* Email */}
                  <div className="mt-4">
                    <label
                      htmlFor="email"
                      className="mb-2 block text-sm font-semibold text-[#17213a]"
                    >
                      Email Address
                    </label>

                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(event) =>
                        setEmail(event.target.value)
                      }
                      placeholder="Enter your work email"
                      className="w-full rounded-xl border border-[#d6dbe6] px-4 py-4 text-[#17213a] outline-none transition placeholder:text-[#8993a7] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
                    />
                  </div>

                  {/* Password */}
                  <div className="mt-4">
                    <label
                      htmlFor="password"
                      className="mb-2 block text-sm font-semibold text-[#17213a]"
                    >
                      Password
                    </label>

                    <div className="relative">
                      <input
                        id="password"
                        type={
                          showPassword
                            ? "text"
                            : "password"
                        }
                        value={password}
                        onChange={(event) =>
                          setPassword(event.target.value)
                        }
                        placeholder="Enter your password"
                        className="w-full rounded-xl border border-[#d6dbe6] px-4 py-4 pr-12 text-[#17213a] outline-none transition placeholder:text-[#8993a7] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword(
                            (previous) => !previous
                          )
                        }
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#68758e] transition hover:text-[#2563eb]"
                        aria-label={
                          showPassword
                            ? "Hide password"
                            : "Show password"
                        }
                      >
                        {showPassword ? (
                          <EyeOff size={20} />
                        ) : (
                          <Eye size={20} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Remember / Forgot */}
                  <div className="mt-4 flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-[#52607a]">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(event) =>
                          setRememberMe(
                            event.target.checked
                          )
                        }
                        className="h-4 w-4 rounded border-gray-300 accent-[#2563eb]"
                      />
                      Remember me
                    </label>

                    <button
                      type="button"
                      onClick={handleForgotPasswordStart}
                      className="text-sm font-semibold text-[#2563eb] hover:underline"
                    >
                      Forgot Password?
                    </button>
                  </div>

                  {/* Sign In */}
                  <button
                    type="button"
                    onClick={handleLogin}
                    disabled={isLoading}
                    className="mt-7 w-full rounded-xl bg-[#2563eb] py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLoading
                      ? "Signing In..."
                      : "Sign In"}
                  </button>

                  {/* Signup */}
                  <p className="mt-5 text-center text-sm text-[#52607a]">
                    Don't have an account?{" "}
                    <button
                      type="button"
                      onClick={() => navigate("/register")}
                      className="font-semibold text-[#2563eb] hover:underline"
                    >
                      Sign up
                    </button>
                  </p>
                </>
              ) : (
                <>
                  {/* Forgot Password Header */}
                  <div className="mb-7 text-center">
                    <h1 className="text-2xl font-bold text-[#17213a]">
                      HRMS
                    </h1>

                    <p className="mt-1 text-sm text-[#52607a]">
                      Human Resource Management System
                    </p>
                  </div>

                  {renderForgotPasswordContent()}
                </>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;