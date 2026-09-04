import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { api, setAccessToken, ApiError, setRefreshToken, apiRaw } from "../services/api";

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

function Login() {
  const navigate = useNavigate();

  const [selectedRole, setSelectedRole] = useState("Employee");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email address and password.");
      return;
    }

    setIsLoading(true);

    try {
      const loginResponse = await apiRaw.post("/auth/login", {
        email: email.trim(),
        password,
      });

      const {
        access_token,
        refresh_token,
        token_type,
      } = loginResponse as LoginResponse;

      setAccessToken(access_token);

      setRefreshToken(refresh_token);
      localStorage.setItem("token_type", token_type);

      const userResponse = await api.get("/users/me");
    
      const user = userResponse as UserResponse;

      const expectedRole = roleMap[selectedRole];

      if (user.role !== expectedRole) {
        setAccessToken(null);

        localStorage.removeItem("refresh_token");
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
      setAccessToken(null);

      localStorage.removeItem("refresh_token");
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8faff] via-white to-[#eef2ff] px-6 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center justify-center">
        
        <div className="grid w-full overflow-hidden rounded-3xl bg-white shadow-2xl lg:grid-cols-2">

          {/* Left Section */}
          <div className="hidden bg-gradient-to-br from-[#f5f3ff] via-[#eef2ff] to-[#e0e7ff] p-12 lg:block">
            <div className="flex h-full flex-col justify-center">

              {/* Logo */}
              <div className="mb-12">
                <h1 className="text-3xl font-bold text-[#17213a]">
                  HRMS
                </h1>

                <p className="mt-1 text-sm text-[#4b5875]">
                  Human Resource Management System
                </p>
              </div>

              {/* Heading */}
              <h2 className="max-w-xl text-5xl font-bold leading-tight text-[#14213d]">
                Smarter{" "}
                <span className="text-[#2563eb]">People.</span>
                <br />
                Stronger{" "}
                <span className="text-[#2563eb]">Business.</span>
              </h2>

              <p className="mt-6 max-w-xl text-lg leading-8 text-[#52607a]">
                A complete HRMS to manage your workforce, automate HR
                operations and build a productive, happy workplace.
              </p>

              {/* Features */}
              <div className="mt-10 grid grid-cols-2 gap-4">
                {[
                  "Employee Management",
                  "Attendance & Leave",
                  "Payroll & Payslip",
                  "Recruitment",
                  "Performance & Goals",
                  "Documents & Assets",
                  "Training & Development",
                  "Reports & Analytics",
                ].map((feature) => (
                  <div
                    key={feature}
                    className="rounded-2xl bg-white/80 p-5 shadow-sm"
                  >
                    <p className="font-semibold text-[#17213a]">
                      {feature}
                    </p>
                  </div>
                ))}
              </div>

            </div>
          </div>

          {/* Right Section */}
          <div className="flex items-center justify-center p-8 sm:p-12 lg:p-14">
            <div className="w-full max-w-xl">

              {/* Logo */}
              <div className="text-center">
                <h1 className="text-3xl font-bold text-[#17213a]">
                  HRMS
                </h1>

                <p className="mt-1 text-sm text-[#52607a]">
                  Human Resource Management System
                </p>

                <h2 className="mt-10 text-3xl font-bold text-[#14213d]">
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
                    className={`rounded-xl px-3 py-3 text-sm font-medium transition ${
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
              <div className="mt-8">
                <h3 className="text-xl font-semibold text-[#17213a]">
                  {selectedRole} Sign In
                </h3>

                <p className="mt-1 text-sm text-[#68758e]">
                  Sign in using your {selectedRole.toLowerCase()} account.
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Email */}
              <div className="mt-6">
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
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your work email"
                  className="w-full rounded-xl border border-[#d6dbe6] px-4 py-4 text-[#17213a] outline-none transition placeholder:text-[#8993a7] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
                />
              </div>

             {/* Password */}
            <div className="mt-5">
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold text-[#17213a]"
              >
                Password
              </label>

              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-[#d6dbe6] px-4 py-4 pr-12 text-[#17213a] outline-none transition placeholder:text-[#8993a7] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((previous) => !previous)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#68758e] transition hover:text-[#2563eb]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
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
              <div className="mt-5 flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-[#52607a]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) =>
                      setRememberMe(event.target.checked)
                    }
                    className="h-4 w-4 rounded border-gray-300 accent-[#2563eb]"
                  />
                  Remember me
                </label>

                <button
                  type="button"
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
                {isLoading ? "Signing In..." : "Sign In"}
              </button>

              {/* Divider */}
              <div className="my-7 flex items-center gap-4">
                <div className="h-px flex-1 bg-[#e0e3ea]" />
                <span className="text-sm text-[#7a8498]">
                  or continue with
                </span>
                <div className="h-px flex-1 bg-[#e0e3ea]" />
              </div>

              {/* Social Login */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  className="rounded-xl border border-[#d6dbe6] py-3 font-medium text-[#17213a] transition hover:bg-gray-50"
                >
                  Google
                </button>

                <button
                  type="button"
                  className="rounded-xl border border-[#d6dbe6] py-3 font-medium text-[#17213a] transition hover:bg-gray-50"
                >
                  Microsoft
                </button>
              </div>

              {/* Signup */}
              <p className="mt-8 text-center text-sm text-[#52607a]">
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/register")}
                  className="font-semibold text-[#2563eb] hover:underline"
                >
                  Sign up
                </button>
              </p>

              {/* Security */}
              <div className="mt-8 rounded-xl bg-[#f6f8fc] p-4 text-center text-xs text-[#68758e]">
                256-bit SSL Encrypted&nbsp;&nbsp; G�� &nbsp;&nbsp;
                Your data is always secure&nbsp;&nbsp; G�� &nbsp;&nbsp;
                Enterprise Grade Security
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default Login;

