import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import {
  api,
  apiRaw,
  ApiError,
  clearSession,
  markSessionActive,
} from "../../services/api";
import { AuthShell } from "./AuthShell";
import { OtpInput } from "./OtpInput";
import { PasswordStrength } from "./PasswordStrength";
import { clearAuthQueries } from "../../lib/queryClient";
import { consumeLoginRedirectNotice } from "../../lib/session";

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

type ForgotPasswordStep = "email" | "otp" | "reset" | "success";

export function Login() {
  const navigate = useNavigate();

  // Login form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Forgot password state
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState<ForgotPasswordStep>("email");
  const [forgotEmail, setForgotEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status alerts & busy state
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showDeactivatedModal, setShowDeactivatedModal] = useState(false);

  // Handle redirect notices (e.g. session expired, password changed)
  useEffect(() => {
    const notice =
      consumeLoginRedirectNotice() ??
      (new URLSearchParams(window.location.search).get("reason") ===
      "session_expired"
        ? "session_expired"
        : null);

    if (!notice) return;

    setSuccessMessage(
      notice === "password_changed"
        ? "Your password was changed successfully. Please log in with your new credentials."
        : "Your session has expired. Please sign in again.",
    );
  }, []);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError("");

    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      setError("Please enter both your email and password.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedEmail)) {
      setError("Please enter a valid work email address.");
      return;
    }

    setIsLoading(true);

    try {
      await apiRaw.post("/auth/login", {
        email: trimmedEmail,
        password,
      });

      // Clear previous cache & mark session active
      clearAuthQueries();
      markSessionActive();

      const userResponse = await api.get("/users/me");
      const user = userResponse as UserResponse;

      localStorage.setItem("user", JSON.stringify(user));

      // Route based on role
      navigate(user.role === "employee" ? "/employee/dashboard" : "/dashboard");
    } catch (err: unknown) {
      clearSession();

      if (
        err instanceof ApiError &&
        err.status === 403 &&
        err.message.toLowerCase().includes("inactive")
      ) {
        setError("");
        setShowDeactivatedModal(true);
      } else {
        setError(
          err instanceof ApiError
            ? err.message
            : "Unable to sign in. Please check your email and password and try again."
        );
      }
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
      setError("Please enter your registered work email.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiRaw.post("/auth/forgot-password", {
        email: trimmedEmail,
      });

      const result = response as ForgotPasswordResponse;

      setForgotEmail(trimmedEmail);
      setSuccessMessage(
        result.message ||
          "If an account with this email exists, a password reset OTP has been sent.",
      );
      setForgotStep("otp");
    } catch (err: unknown) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Unable to send verification code. Please check your email and try again.",
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
      setError("Please enter the complete 6-digit code.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiRaw.post("/auth/forgot-password/verify-otp", {
        email: forgotEmail.trim(),
        otp: trimmedOTP,
      });

      const result = response as VerifyOTPResponse;

      if (!result.verified || !result.reset_token) {
        setError(
          "Verification code expired or invalid. Please request a new code.",
        );
        return;
      }

      setResetToken(result.reset_token);
      setOtp("");
      setSuccessMessage("");
      setForgotStep("reset");
    } catch (err: unknown) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Invalid or expired verification code.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError("");
    setSuccessMessage("");

    if (!newPassword || !confirmPassword) {
      setError("Please fill in both password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (!/[A-Z]/.test(newPassword)) {
      setError("Password must contain at least one uppercase letter.");
      return;
    }

    if (!/[a-z]/.test(newPassword)) {
      setError("Password must contain at least one lowercase letter.");
      return;
    }

    if (!/[0-9]/.test(newPassword)) {
      setError("Password must contain at least one number.");
      return;
    }

    if (!/[^A-Za-z0-9]/.test(newPassword)) {
      setError("Password must contain at least one special character.");
      return;
    }

    if (!resetToken) {
      setError("Password reset session expired. Please request a new code.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiRaw.post(
        "/auth/forgot-password/reset-password",
        {
          email: forgotEmail.trim(),
          reset_token: resetToken,
          new_password: newPassword,
          confirm_password: confirmPassword,
        },
      );

      const result = response as ResetPasswordResponse;

      setSuccessMessage(result.message || "Password updated successfully.");
      setResetToken("");
      setNewPassword("");
      setConfirmPassword("");
      setForgotStep("success");
    } catch (err: unknown) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Unable to reset password. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      headline="Smarter People."
      accent="Stronger Business."
      subcopy="A complete HRMS to manage your workforce, automate HR operations and build a productive, happy workplace."
      features={[
        "Employee Management",
        "Attendance & Leave",
        "Reports & Analytics",
        "Performance & Goals",
      ]}
    >

      {showDeactivatedModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="deactivated-title"
            aria-describedby="deactivated-description"
            className="w-full max-w-md rounded bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <svg
                className="h-8 w-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v4m0 4h.01M10.3 3.86L1.82 18a2 2 0 001.72 3h16.92a2 2 0 001.72-3L13.7 3.86a2 2 0 00-3.4 0z"
                />
              </svg>
            </div>

            <div className="text-center">
              <h2
                id="deactivated-title"
                className="text-xl font-bold text-ink-900"
              >
                Account Deactivated
              </h2>

              <p
                id="deactivated-description"
                className="mt-3 text-sm leading-6 text-ink-500"
              >
                Your account has been deactivated by the administrator.
                Please contact your HR administrator for assistance.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowDeactivatedModal(false)}
              className="mt-7 w-full h-10 rounded bg-[#2F5FD0] hover:bg-[#264FB0] text-sm font-semibold text-white transition-colors"
            >
              Okay, Got It
            </button>
          </div>
        </div>
      )}

      {!isForgotPassword ? (
        /* ------------------------------------------------------------- */
        /* Exact Reference Layout: Welcome Back Login Form               */
        /* ------------------------------------------------------------- */
        <div className="w-full max-w-[360px] mx-auto flex flex-col justify-center">
          {/* Top Brand Logo & Wordmark (Matching Reference Image) */}
          <div className="flex items-center gap-2.5 mb-6">
            <img
              src="/peoplesync-logo.png"
              alt="PeopleSync Logo"
              className="h-[28px] w-auto object-contain"
            />
            <span className="text-2xl font-bold tracking-tight text-[#111827]">
              People<span className="text-[#2F5FD0]">Sync</span>
            </span>
          </div>

          {/* Heading */}
          <div className="mb-6">
            <h1 className="text-[24px] font-semibold tracking-tight text-[#111827] leading-tight">
              Welcome back
            </h1>
            <p className="mt-1 text-sm text-[#4B5563] font-normal">
              Sign in to your account
            </p>
          </div>

          {/* Success Message Banner */}
          {successMessage && (
            <div
              role="status"
              className="mb-4 flex items-start gap-2.5 rounded border border-[#A7F3D0] bg-[#ECFDF5] p-3 text-[13px] font-medium text-[#065F46]"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#059669] mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Error Message Banner */}
          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="mb-4 flex items-start gap-2.5 rounded border border-[#FECACA] bg-[#FEF2F2] p-3 text-[13px] font-medium text-[#B91C1C]"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-[#B91C1C] mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
              {/* Email Field */}
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-[13px] font-medium text-[#374151] mb-1.5"
                >
                  Email address
                </label>
                <div className="relative">
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    autoComplete="username"
                    disabled={isLoading}
                    autoFocus
                    className="w-full h-10 rounded border border-[#D1D5DB] bg-white px-3 text-sm text-[#111827] placeholder:text-[#6B7280] focus:border-[#2F5FD0] focus:ring-[3px] focus:ring-[#2F5FD0]/20 focus:outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label
                  htmlFor="login-password"
                  className="block text-[13px] font-medium text-[#374151] mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    autoComplete="current-password"
                    disabled={isLoading}
                    className="w-full h-10 rounded border border-[#D1D5DB] bg-white pl-3 pr-10 text-sm text-[#111827] placeholder:text-[#6B7280] focus:border-[#2F5FD0] focus:ring-[3px] focus:ring-[#2F5FD0]/20 focus:outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5FD0]"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Forgot Password Link (Right Aligned under Password) */}
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleForgotPasswordStart}
                    className="text-[13px] font-medium text-[#2F5FD0] hover:underline transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#2F5FD0] rounded"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>
            </div>

            {/* Login Action Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-10 rounded bg-[#2F5FD0] hover:bg-[#264FB0] text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5FD0] focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin text-white icon-on-primary"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign in</span>
              )}
            </button>
          </form>
        </div>
      ) : (
        /* ------------------------------------------------------------- */
        /* Forgot Password Flow (Seamlessly Integrated)                  */
        /* ------------------------------------------------------------- */
        <div className="w-full max-w-[360px] mx-auto space-y-4">
          {/* Header Back Button */}
          <button
            type="button"
            onClick={handleBackToLogin}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#2F5FD0] hover:underline transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#2F5FD0] rounded"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </button>

          {/* Error Message */}
          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="flex items-start gap-2.5 rounded border border-[#FECACA] bg-[#FEF2F2] p-3 text-[13px] font-medium text-[#B91C1C]"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-[#B91C1C] mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Step 1: Send OTP to Email */}
          {forgotStep === "email" && (
            <div className="space-y-4">
              <div className="flex h-10 w-10 items-center justify-center rounded bg-[#E8EEFB] text-[#2F5FD0] border border-[#C7D7F8]">
                <KeyRound className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-[24px] font-semibold tracking-tight text-[#111827]">
                  Reset Password
                </h2>
                <p className="mt-1 text-sm text-[#4B5563]">
                  Enter your registered work email to receive a 6-digit verification code.
                </p>
              </div>

              <div>
                <label
                  htmlFor="forgot-email"
                  className="block text-[13px] font-medium text-[#374151] mb-1.5"
                >
                  Work Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                  <input
                    id="forgot-email"
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="name@company.com"
                    disabled={isLoading}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSendOTP();
                    }}
                    className="w-full h-10 rounded border border-[#D1D5DB] bg-white pl-10 pr-3 text-sm text-[#111827] placeholder:text-[#6B7280] focus:border-[#2F5FD0] focus:ring-[3px] focus:ring-[#2F5FD0]/20 focus:outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSendOTP}
                disabled={isLoading}
                className="w-full h-10 rounded bg-[#2F5FD0] hover:bg-[#264FB0] text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5FD0] focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? "Sending Code..." : "Send Verification Code"}
              </button>
            </div>
          )}

          {/* Step 2: Enter & Verify 6-digit OTP */}
          {forgotStep === "otp" && (
            <div className="space-y-4">
              <div className="flex h-10 w-10 items-center justify-center rounded bg-[#E8EEFB] text-[#2F5FD0] border border-[#C7D7F8]">
                <ShieldCheck className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-[24px] font-semibold tracking-tight text-[#111827]">
                  Enter Verification Code
                </h2>
                <p className="mt-1 text-sm text-[#4B5563]">
                  We sent a 6-digit verification code to{" "}
                  <span className="font-semibold text-[#111827]">
                    {forgotEmail}
                  </span>
                </p>
              </div>

              {successMessage && (
                <div
                  role="status"
                  className="rounded border border-[#A7F3D0] bg-[#ECFDF5] p-3 text-[13px] font-medium text-[#065F46]"
                >
                  {successMessage}
                </div>
              )}

              <div className="py-1">
                <OtpInput
                  value={otp}
                  onChange={(val) => {
                    setOtp(val);
                    setError("");
                  }}
                  disabled={isLoading}
                  autoFocus
                />
              </div>

              <button
                type="button"
                onClick={handleVerifyOTP}
                disabled={isLoading || otp.length !== 6}
                className="w-full h-10 rounded bg-[#2F5FD0] hover:bg-[#264FB0] text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5FD0] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? "Verifying..." : "Verify Code"}
              </button>

              <div className="flex items-center justify-between text-[13px] pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setForgotStep("email");
                    setOtp("");
                    setError("");
                    setSuccessMessage("");
                  }}
                  disabled={isLoading}
                  className="font-medium text-[#4B5563] hover:text-[#111827] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#2F5FD0] rounded"
                >
                  Change Email
                </button>

                <button
                  type="button"
                  onClick={handleSendOTP}
                  disabled={isLoading}
                  className="font-semibold text-[#2F5FD0] hover:underline transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#2F5FD0] rounded"
                >
                  Resend Code
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Set New Password */}
          {forgotStep === "reset" && (
            <div className="space-y-4">
              <div className="flex h-10 w-10 items-center justify-center rounded bg-[#E8EEFB] text-[#2F5FD0] border border-[#C7D7F8]">
                <Lock className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-[24px] font-semibold tracking-tight text-[#111827]">
                  Set New Password
                </h2>
                <p className="mt-1 text-sm text-[#4B5563]">
                  Your new password must be at least 8 characters long and include numbers and special characters.
                </p>
              </div>

              <div className="space-y-3">
                {/* New Password */}
                <div>
                  <label
                    htmlFor="reset-new-password"
                    className="block text-[13px] font-medium text-[#374151] mb-1.5"
                  >
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="reset-new-password"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      disabled={isLoading}
                      className="w-full h-10 rounded border border-[#D1D5DB] bg-white pl-3 pr-10 text-sm text-[#111827] placeholder:text-[#6B7280] focus:border-[#2F5FD0] focus:ring-[3px] focus:ring-[#2F5FD0]/20 focus:outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((p) => !p)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5FD0]"
                      aria-label={showNewPassword ? "Hide password" : "Show password"}
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <PasswordStrength value={newPassword} />

                {/* Confirm New Password */}
                <div>
                  <label
                    htmlFor="reset-confirm-password"
                    className="block text-[13px] font-medium text-[#374151] mb-1.5"
                  >
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      id="reset-confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your new password"
                      disabled={isLoading}
                      className="w-full h-10 rounded border border-[#D1D5DB] bg-white pl-3 pr-10 text-sm text-[#111827] placeholder:text-[#6B7280] focus:border-[#2F5FD0] focus:ring-[3px] focus:ring-[#2F5FD0]/20 focus:outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((p) => !p)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5FD0]"
                      aria-label={
                        showConfirmPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleResetPassword}
                disabled={isLoading}
                className="w-full h-10 rounded bg-[#2F5FD0] hover:bg-[#264FB0] text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5FD0] focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? "Updating Password..." : "Update Password"}
              </button>
            </div>
          )}

          {/* Step 4: Success Message */}
          {forgotStep === "success" && (
            <div className="text-center py-3 space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]">
                <CheckCircle2 size={24} />
              </div>

              <div>
                <h2 className="text-[24px] font-semibold tracking-tight text-[#111827]">
                  Password Reset Complete
                </h2>
                <p className="mt-1 text-sm text-[#4B5563]">
                  Your password has been successfully updated. You can now sign in with your new credentials.
                </p>
              </div>

              {successMessage && (
                <div
                  role="status"
                  className="rounded border border-[#A7F3D0] bg-[#ECFDF5] p-3 text-[13px] font-medium text-[#065F46]"
                >
                  {successMessage}
                </div>
              )}

              <button
                type="button"
                onClick={handleBackToLogin}
                className="w-full h-10 rounded bg-[#2F5FD0] hover:bg-[#264FB0] text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5FD0] focus-visible:ring-offset-2 transition-colors"
              >
                Return to Sign In
              </button>
            </div>
          )}
        </div>
      )}
    </AuthShell>
  );
}

export default Login;
