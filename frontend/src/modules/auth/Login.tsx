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

  const handleSocialLogin = (provider: "Facebook" | "Google") => {
    setError("");
    if (provider === "Google") {
      // In enterprise SSO environments, initiate Google SSO or notify user
      setError(
        "Google Workspace Single Sign-On (SSO) is enabled. Please enter your work email above to sign in or contact your IT admin.",
      );
    } else {
      setError(
        "Corporate SSO for Meta Workplace is routed through your organization identity provider. Please sign in with your corporate email.",
      );
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
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
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
              className="mt-7 w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-brand-700"
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
        <div className="w-full max-w-[360px] sm:max-w-[380px] mx-auto flex flex-col justify-center">
          {/* Top Brand Logo & Wordmark (Matching Reference Image) */}
          <div className="flex items-center gap-2.5 mb-5 sm:mb-6">
            <img
              src="/peoplesync-logo.png"
              alt="PeopleSync Logo"
              className="h-8 w-auto object-contain"
            />
            <span className="text-2xl font-bold tracking-tight text-slate-900 font-manrope">
              People<span className="text-[#3b66f5]">Sync</span>
            </span>
          </div>

          {/* Heading */}
          <div className="mb-6">
            <h1 className="text-[28px] sm:text-[30px] font-extrabold tracking-tight text-[#0f172a] leading-tight">
              Welcome Back
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-400 font-normal">
              Please Login to your account
            </p>
          </div>

          {/* Success Message Banner */}
          {successMessage && (
            <div
              role="status"
              className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/90 p-3 text-xs font-medium text-emerald-800"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Error Message Banner */}
          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/90 p-3 text-xs font-medium text-red-800"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email Field */}
            <div className="relative">
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                autoComplete="email"
                disabled={isLoading}
                autoFocus
                className="w-full rounded-xl bg-[#f8fafc] border border-slate-200/80 px-4 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-[#4068f6] focus:ring-4 focus:ring-blue-500/10 transition-all outline-none disabled:opacity-60"
              />
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete="current-password"
                  disabled={isLoading}
                  className="w-full rounded-xl bg-[#f8fafc] border border-slate-200/80 pl-4 pr-11 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-[#4068f6] focus:ring-4 focus:ring-blue-500/10 transition-all outline-none disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  tabIndex={-1}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Forgot Password Link (Right Aligned under Password) */}
              <div className="flex justify-end pt-0.5">
                <button
                  type="button"
                  onClick={handleForgotPasswordStart}
                  tabIndex={-1}
                  className="text-xs text-slate-400 hover:text-[#4068f6] font-medium transition-colors"
                >
                  Forgot Password
                </button>
              </div>
            </div>

            {/* Login Action Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-[#4068f6] hover:bg-[#325beb] py-3.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition-all duration-150 active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
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
                  <span>Logging in...</span>
                </>
              ) : (
                <span>Login</span>
              )}
            </button>
          </form>

          {/* Divider: or Login with */}
          <div className="relative flex items-center justify-center my-5">
            <div className="w-full border-t border-slate-200" />
            <span className="bg-white px-3 text-[11px] font-medium text-slate-400 whitespace-nowrap">
              or Login with
            </span>
            <div className="w-full border-t border-slate-200" />
          </div>

          {/* Social / SSO Row: Facebook and Google (Pill Buttons) */}
          <div className="flex items-center gap-3">
            {/* Facebook Button */}
            <button
              type="button"
              onClick={() => handleSocialLogin("Facebook")}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50/80 py-2.5 px-3 text-xs font-semibold text-slate-700 transition-all shadow-sm hover:border-slate-300"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="#1877F2">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              <span>Facebook</span>
            </button>

            {/* Google Button */}
            <button
              type="button"
              onClick={() => handleSocialLogin("Google")}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50/80 py-2.5 px-3 text-xs font-semibold text-slate-700 transition-all shadow-sm hover:border-slate-300"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>Google</span>
            </button>
          </div>
        </div>
      ) : (
        /* ------------------------------------------------------------- */
        /* Forgot Password Flow (Seamlessly Integrated)                  */
        /* ------------------------------------------------------------- */
        <div className="w-full max-w-[360px] sm:max-w-[380px] mx-auto space-y-4">
          {/* Header Back Button */}
          <button
            type="button"
            onClick={handleBackToLogin}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-[#4068f6]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Sign In
          </button>

          {/* Error Message */}
          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/90 p-3 text-xs font-medium text-red-800"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Step 1: Send OTP to Email */}
          {forgotStep === "email" && (
            <div className="space-y-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 shadow-sm">
                <KeyRound className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  Reset Password
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Enter your registered work email to receive a 6-digit verification code.
                </p>
              </div>

              <div>
                <label
                  htmlFor="forgot-email"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Work Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
                    className="w-full rounded-xl bg-[#f8fafc] border border-slate-200/80 pl-10 pr-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:bg-white focus:border-[#4068f6] focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSendOTP}
                disabled={isLoading}
                className="w-full rounded-xl bg-[#4068f6] hover:bg-[#325beb] py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition-all duration-150 active:scale-[0.99] disabled:opacity-60"
              >
                {isLoading ? "Sending Code..." : "Send Verification Code"}
              </button>
            </div>
          )}

          {/* Step 2: Enter & Verify 6-digit OTP */}
          {forgotStep === "otp" && (
            <div className="space-y-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm">
                <ShieldCheck className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  Enter Verification Code
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  We sent a 6-digit verification code to{" "}
                  <span className="font-semibold text-slate-800">
                    {forgotEmail}
                  </span>
                </p>
              </div>

              {successMessage && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
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
                className="w-full rounded-xl bg-[#4068f6] hover:bg-[#325beb] py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition-all duration-150 active:scale-[0.99] disabled:opacity-50"
              >
                {isLoading ? "Verifying..." : "Verify Code"}
              </button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setForgotStep("email");
                    setOtp("");
                    setError("");
                    setSuccessMessage("");
                  }}
                  disabled={isLoading}
                  className="font-medium text-slate-500 hover:text-slate-800"
                >
                  Change Email
                </button>

                <button
                  type="button"
                  onClick={handleSendOTP}
                  disabled={isLoading}
                  className="font-semibold text-[#4068f6] hover:underline"
                >
                  Resend Code
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Set New Password */}
          {forgotStep === "reset" && (
            <div className="space-y-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 shadow-sm">
                <Lock className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  Set New Password
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Choose a strong, secure password for your workspace account
                </p>
              </div>

              <div className="space-y-3">
                {/* New Password */}
                <div>
                  <label
                    htmlFor="reset-new-password"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="reset-new-password"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      disabled={isLoading}
                      autoFocus
                      className="w-full rounded-xl bg-[#f8fafc] border border-slate-200/80 pl-3 pr-10 py-2.5 text-sm text-slate-900 outline-none transition-all focus:bg-white focus:border-[#4068f6] focus:ring-4 focus:ring-blue-500/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((p) => !p)}
                      tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
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
                    className="block text-xs font-semibold text-slate-700 mb-1"
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
                      className="w-full rounded-xl bg-[#f8fafc] border border-slate-200/80 pl-3 pr-10 py-2.5 text-sm text-slate-900 outline-none transition-all focus:bg-white focus:border-[#4068f6] focus:ring-4 focus:ring-blue-500/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((p) => !p)}
                      tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
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
                className="w-full rounded-xl bg-[#4068f6] hover:bg-[#325beb] py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition-all duration-150 active:scale-[0.99] disabled:opacity-60"
              >
                {isLoading ? "Updating Password..." : "Update Password"}
              </button>
            </div>
          )}

          {/* Step 4: Success Message */}
          {forgotStep === "success" && (
            <div className="text-center py-3 space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm">
                <CheckCircle2 size={28} />
              </div>

              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  Password Reset Complete
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Your password has been successfully updated. You can now sign in
                  with your new credentials.
                </p>
              </div>

              {successMessage && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
                  {successMessage}
                </div>
              )}

              <button
                type="button"
                onClick={handleBackToLogin}
                className="w-full rounded-xl bg-[#4068f6] hover:bg-[#325beb] py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition-all duration-150 active:scale-[0.99]"
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
