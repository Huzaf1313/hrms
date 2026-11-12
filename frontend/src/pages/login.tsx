import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, CheckCircle2 } from "lucide-react";
import {
  api,
  apiRaw,
  ApiError,
  clearSession,
  setAccessToken,
} from "../services/api";
import { AuthShell } from "../components/auth/AuthShell";
import { AuthField } from "../components/auth/AuthField";
import { OtpInput } from "../components/auth/OtpInput";
import { PasswordStrength } from "../components/auth/PasswordStrength";
import { clearAuthQueries } from "../lib/queryClient";
import { consumeLoginRedirectNotice } from "../lib/session";

interface LoginResponse {
  access_token: string;
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

type ForgotPasswordStep = "email" | "otp" | "reset" | "success";

function Login() {
  const navigate = useNavigate();

  // Login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

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

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Greet users arriving from a forced logout with the reason: a password
  // change elsewhere, or a revoked/expired session.
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
        ? "Your password was changed. Please log in with your new password."
        : "Your session has ended. Please log in again.",
    );
  }, []);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
      const loginResponse = await apiRaw.post<LoginResponse>(
        "/auth/login",
        {
          email: trimmedEmail,
          password,
        },
      );

      const { access_token } = loginResponse;

      // Clear any cached data from previous session
      clearAuthQueries();

      setAccessToken(access_token);

      const userResponse = await api.get("/users/me");
      const user = userResponse as UserResponse;

      localStorage.setItem("user", JSON.stringify(user));

      if (rememberMe) {
        localStorage.setItem("remember_me", "true");
      } else {
        localStorage.removeItem("remember_me");
      }

      // The account decides where you land, not a picker on this form.
      navigate(
        user.role === "employee" ? "/employee/dashboard" : "/dashboard",
      );
    } catch (err: unknown) {
      clearSession();
      setError(
        err instanceof ApiError
          ? err.message
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
      const response = await apiRaw.post("/auth/forgot-password", {
        email: trimmedEmail,
      });

      const result = response as ForgotPasswordResponse;

      setForgotEmail(trimmedEmail);
      setSuccessMessage(
        result.message ||
          "If an account with this email exists, a password reset OTP has been sent."
      );
      setForgotStep("otp");
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
    setError("");
    setSuccessMessage("");

    const trimmedOTP = otp.trim();

    if (!/^\d{6}$/.test(trimmedOTP)) {
      setError("Please enter the 6-digit OTP.");
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
        setError("OTP verification failed. Please request a new OTP.");
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
      setError("Please enter your new password and confirm password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
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
      setError("Password reset session is invalid. Please request a new OTP.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiRaw.post("/auth/forgot-password/reset-password", {
        email: forgotEmail.trim(),
        reset_token: resetToken,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      const result = response as ResetPasswordResponse;

      setSuccessMessage(result.message || "Password reset successfully.");
      setResetToken("");
      setNewPassword("");
      setConfirmPassword("");
      setForgotStep("success");
    } catch (err: unknown) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Unable to reset password. Please try again."
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
      {!isForgotPassword ? (
        <form onSubmit={handleLogin} className="space-y-4">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink-900">
              Welcome Back
            </h1>
            <p className="mt-1 text-xs text-ink-400">
              Sign in to access your HRMS portal
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700"
            >
              {error}
            </div>
          )}

          {/* Input Fields */}
          <div className="space-y-3">
            <AuthField
              id="login-email"
              label="Work Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              autoComplete="email"
              disabled={isLoading}
            />

            <AuthField
              id="login-password"
              label="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
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
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between text-xs">
            <label className="flex cursor-pointer select-none items-center gap-2 text-ink-600">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-line text-brand-600 accent-brand-600 focus:ring-brand-500"
              />
              Remember me
            </label>

            <button
              type="button"
              onClick={handleForgotPasswordStart}
              className="font-semibold text-brand-600 transition-colors hover:text-brand-700 hover:underline"
            >
              Forgot Password?
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white shadow-md shadow-brand-600/20 transition-all hover:bg-brand-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Signing In..." : "Sign In"}
          </button>

          <p className="text-center text-[11px] text-ink-400">
            Accounts are created by HR. Contact your HR admin for access.
          </p>
        </form>
      ) : (
        <div className="space-y-4">
          {/* Step 1: Send OTP to Email */}
          {forgotStep === "email" && (
            <>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-ink-900">
                  Forgot Password?
                </h2>
                <p className="mt-1 text-xs text-ink-400">
                  Enter your registered work email and we'll send a 6-digit
                  verification code to reset your password.
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700"
                >
                  {error}
                </div>
              )}

              <AuthField
                id="forgot-email"
                label="Registered Email"
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="name@company.com"
                disabled={isLoading}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSendOTP();
                }}
              />

              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleSendOTP}
                  disabled={isLoading}
                  className="w-full rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white shadow-md shadow-brand-600/20 transition-all hover:bg-brand-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? "Sending Code..." : "Send Verification Code"}
                </button>

                <button
                  type="button"
                  onClick={handleBackToLogin}
                  disabled={isLoading}
                  className="w-full rounded-xl border border-line py-2.5 text-xs font-semibold text-ink-600 transition-colors hover:bg-surface-muted"
                >
                  Back to Login
                </button>
              </div>
            </>
          )}

          {/* Step 2: Enter & Verify 6-digit OTP */}
          {forgotStep === "otp" && (
            <>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-ink-900">
                  Verify Code
                </h2>
                <p className="mt-1 text-xs text-ink-400">
                  We've sent a 6-digit verification code to{" "}
                  <span className="font-semibold text-ink-800">
                    {forgotEmail}
                  </span>
                </p>
              </div>

              {successMessage && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-700">
                  {successMessage}
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700"
                >
                  {error}
                </div>
              )}

              <div className="py-2">
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

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={handleVerifyOTP}
                  disabled={isLoading || otp.length !== 6}
                  className="w-full rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white shadow-md shadow-brand-600/20 transition-all hover:bg-brand-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? "Verifying..." : "Verify Code"}
                </button>

                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep("email");
                      setOtp("");
                      setError("");
                      setSuccessMessage("");
                    }}
                    disabled={isLoading}
                    className="font-medium text-ink-600 hover:text-brand-600"
                  >
                    Change Email
                  </button>

                  <button
                    type="button"
                    onClick={handleSendOTP}
                    disabled={isLoading}
                    className="font-semibold text-brand-600 hover:text-brand-700 hover:underline"
                  >
                    Resend Code
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Step 3: Enter New Password */}
          {forgotStep === "reset" && (
            <>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-ink-900">
                  New Password
                </h2>
                <p className="mt-1 text-xs text-ink-400">
                  Create a new secure password for your HRMS account.
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700"
                >
                  {error}
                </div>
              )}

              <div className="space-y-3.5">
                <AuthField
                  id="reset-new-password"
                  label="New Password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  disabled={isLoading}
                  icon={
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((p) => !p)}
                      className="p-1 text-ink-400 transition-colors hover:text-ink-800"
                      aria-label={
                        showNewPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showNewPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  }
                />

                <PasswordStrength value={newPassword} />

                <AuthField
                  id="reset-confirm-password"
                  label="Confirm New Password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  disabled={isLoading}
                  icon={
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((p) => !p)}
                      className="p-1 text-ink-400 transition-colors hover:text-ink-800"
                      aria-label={
                        showConfirmPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  }
                />
              </div>

              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={isLoading}
                  className="w-full rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white shadow-md shadow-brand-600/20 transition-all hover:bg-brand-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? "Updating Password..." : "Update Password"}
                </button>

                <button
                  type="button"
                  onClick={handleBackToLogin}
                  disabled={isLoading}
                  className="w-full rounded-xl border border-line py-2.5 text-xs font-semibold text-ink-600 transition-colors hover:bg-surface-muted"
                >
                  Cancel
                </button>
              </div>
            </>
          )}

          {/* Step 4: Success Message */}
          {forgotStep === "success" && (
            <div className="text-center py-4 space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm">
                <CheckCircle2 size={32} />
              </div>

              <div>
                <h2 className="text-xl font-bold tracking-tight text-ink-900">
                  Password Reset Complete
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-ink-600">
                  Your password has been successfully updated. You can now log
                  in with your new credentials.
                </p>
              </div>

              {successMessage && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-700">
                  {successMessage}
                </div>
              )}

              <button
                type="button"
                onClick={handleBackToLogin}
                className="w-full rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white shadow-md shadow-brand-600/20 transition-all hover:bg-brand-700 active:scale-[0.99]"
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
