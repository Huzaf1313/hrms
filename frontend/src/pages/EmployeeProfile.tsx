import { useEffect, useState } from "react";
import { api } from "../services/api";

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

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function formatDate(dateString: string) {
  if (!dateString) return "—";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function EmployeeProfile() {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      try {
        setIsLoading(true);
        setError("");

        const response = await api.get<UserResponse>("/users/me");

        if (isMounted) {
          setUser(response);
          localStorage.setItem("user", JSON.stringify(response));
        }
      } catch (err) {
        console.error("Failed to load employee profile", err);

        if (isMounted) {
          setError("Unable to load your profile. Please try again.");
        }
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

  if (isLoading) {
    return (
      <div className="min-h-full bg-[#f7f9f8] px-5 py-7 sm:px-7 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
            <p className="text-sm text-gray-500">
              Loading your profile...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-full bg-[#f7f9f8] px-5 py-7 sm:px-7 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="text-sm font-medium text-red-700">
              {error || "Profile information is unavailable."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const initials = getInitials(user.full_name);

  return (
    <div className="min-h-full bg-[#f7f9f8] px-5 py-7 sm:px-7 lg:px-10">

      <div className="mx-auto max-w-6xl">

        {/* Page Header */}
        <div className="mb-7">
          <p className="text-sm font-medium text-[#5f806b]">
            Employee Portal
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#171b1d] sm:text-4xl">
            My Profile
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            View your personal account information and profile details.
          </p>
        </div>

        {/* Profile Header Card */}
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">

          <div className="h-32 bg-gradient-to-r from-[#456b54] to-[#789681]" />

          <div className="px-6 pb-6 sm:px-8">

            <div className="-mt-12 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">

              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">

                {/* Avatar */}
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border-4 border-white bg-[#dce5df] text-2xl font-bold text-[#456b54] shadow-md">
                  {initials || "E"}
                </div>

                <div className="pb-1">
                  <h2 className="text-2xl font-bold text-[#17213a]">
                    {user.full_name}
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Employee
                  </p>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2 pb-1">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    user.is_active && !user.is_locked
                      ? "bg-green-500"
                      : "bg-red-500"
                  }`}
                />

                <span
                  className={`text-sm font-semibold ${
                    user.is_active && !user.is_locked
                      ? "text-green-700"
                      : "text-red-700"
                  }`}
                >
                  {user.is_active && !user.is_locked
                    ? "Active Account"
                    : "Account Restricted"}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Account Information */}
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">

          <div className="mb-6">
            <h2 className="text-lg font-bold text-[#17213a]">
              Personal Information
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Information associated with your HRMS account.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">

            {/* Full Name */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Full Name
              </p>

              <p className="mt-2 text-sm font-semibold text-gray-800">
                {user.full_name}
              </p>
            </div>

            {/* Email */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Email Address
              </p>

              <p className="mt-2 break-all text-sm font-semibold text-gray-800">
                {user.email}
              </p>
            </div>

            {/* Role */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Role
              </p>

              <span className="mt-2 inline-flex rounded-full bg-[#eef3ef] px-3 py-1 text-xs font-semibold capitalize text-[#456b54]">
                {user.role.replace(/_/g, " ")}
              </span>
            </div>

            {/* User ID */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Employee ID
              </p>

              <p className="mt-2 break-all text-sm font-semibold text-gray-800">
                {user.id}
              </p>
            </div>
          </div>
        </section>

        {/* Account Details */}
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">

          <div className="mb-6">
            <h2 className="text-lg font-bold text-[#17213a]">
              Account Details
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Your HRMS account status and activity information.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Account Status
              </p>

              <p className="mt-2 text-sm font-bold text-gray-800">
                {user.is_active ? "Active" : "Inactive"}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Security Status
              </p>

              <p className="mt-2 text-sm font-bold text-gray-800">
                {user.is_locked ? "Locked" : "Unlocked"}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Member Since
              </p>

              <p className="mt-2 text-sm font-bold text-gray-800">
                {formatDate(user.created_at)}
              </p>
            </div>
          </div>
        </section>

        {/* Last Updated */}
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <h2 className="text-lg font-bold text-[#17213a]">
                Profile Information
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Last updated on your HRMS account.
              </p>
            </div>

            <p className="text-sm font-semibold text-gray-700">
              {formatDate(user.updated_at)}
            </p>
          </div>
        </section>

        {/* Notice */}
        <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <p className="text-sm font-medium text-blue-800">
            Need to update your personal information?
          </p>

          <p className="mt-1 text-xs leading-5 text-blue-700">
            Contact your HR administrator to request changes to your employee
            profile information.
          </p>
        </div>

        {/* Footer */}
        <footer className="py-8 text-center text-xs text-gray-400">
          © 2026 HRMS. All rights reserved. · Employee Portal
        </footer>
      </div>
    </div>
  );
}

export default EmployeeProfile;