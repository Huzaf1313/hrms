import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, ChevronDown, LogOut, Menu } from "lucide-react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import EmployeeSidebar from "../modules/employees/EmployeeSidebar";
import EmployeeNotificationDropdown from "../modules/dashboard/EmployeeNotificationDropdown";
import ErrorBoundary from "../components/ErrorBoundary";
import DatePicker from "../components/DatePicker";
import { employeeNotificationService } from "../modules/dashboard/employeeNotificationService";
import { employeeService } from "../modules/employees/employeeService";

const pageTitles: Record<string, string> = {
  "/employee/dashboard": "Dashboard",
  "/employee/profile": "My Profile",
  "/employee/attendance": "My Attendance",
  "/employee/leave": "My Leave",
  "/employee/payroll": "My Payslip",
  "/employee/documents": "My Documents",
  "/employee/announcements": "Announcements",
  "/employee/help": "Help & Support",
  "/employee/exit": "Exit / Offboarding",
  "/employee/exit/resignation": "Resignation Request",
};

function readUser() {
  try {
    const raw = localStorage.getItem("user");

    return raw
      ? (JSON.parse(raw) as {
        full_name?: string;
        employee_id?: string | null;
      })
      : null;
  } catch {
    return null;
  }
}

function EmployeeLayout({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close the profile menu on a click outside it or on Escape, as the admin
  // Header does.
  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setShowProfileMenu(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setShowProfileMenu(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [designation, setDesignation] = useState("");
  const [avatarRefreshKey, setAvatarRefreshKey] = useState(0);
  const notificationContainerRef = useRef<HTMLDivElement | null>(null);

  const user = useMemo(() => readUser(), []);

  useEffect(() => {
    const fetchUnreadNotificationCount = async () => {
      try {
        const count =
          await employeeNotificationService.getUnreadCount();

        setUnreadNotificationCount(count);
      } catch (error) {
        console.error(
          "Failed to fetch notification count:",
          error,
        );
      }
    };

    fetchUnreadNotificationCount();

    const interval = window.setInterval(
      fetchUnreadNotificationCount,
      30000,
    );

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    setAvatarUrl(null);

    const loadEmployeeHeader = async () => {
      try {
        const profile = await employeeService.getMyProfile();

        if (cancelled) return;

        setDesignation(profile.designation ?? "");

        if (profile.avatar_url) {
          setAvatarUrl(profile.avatar_url);
        } else {
          setAvatarUrl(null);
        }
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Failed to load employee header profile:",
            error,
          );
        }
      }
    };

    void loadEmployeeHeader();

    return () => {
      cancelled = true;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [location.pathname, avatarRefreshKey]);

  useEffect(() => {
    const handleProfilePhotoUpdate = () => {
      setAvatarRefreshKey((previous) => previous + 1);
    };

    window.addEventListener(
      "employee-profile-photo-updated",
      handleProfilePhotoUpdate,
    );

    return () => {
      window.removeEventListener(
        "employee-profile-photo-updated",
        handleProfilePhotoUpdate,
      );
    };
  }, []);

  useEffect(() => {
    if (!showNotificationDropdown) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        notificationContainerRef.current &&
        !notificationContainerRef.current.contains(target)
      ) {
        setShowNotificationDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [showNotificationDropdown]);

  useEffect(() => {
    setShowProfileMenu(false);
    setShowNotificationDropdown(false);
    setSidebarOpen(false);
  }, [location.pathname]);

  const fullName = user?.full_name ?? "Employee";

  const initials = fullName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const pageTitle = pageTitles[location.pathname] ?? "Dashboard";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f5f7fb]">
      <EmployeeSidebar
        onLogout={onLogout}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-1 flex-col h-full min-w-0 overflow-hidden">
        <header className="shrink-0 z-30 flex h-[72px] items-center justify-between gap-4 border-b border-slate-200/80 bg-white/80 px-6 backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              onClick={() => setSidebarOpen((previous) => !previous)}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 lg:hidden"
              aria-label="Open menu"
              aria-expanded={sidebarOpen}
            >
              <Menu className="h-5 w-5" />
            </button>

            <h1 className="truncate text-xl font-bold font-manrope text-slate-800">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Notifications */}
            <div
              ref={notificationContainerRef}
              className="relative"
            >
              <button
                type="button"
                onClick={() =>
                  setShowNotificationDropdown(
                    (previous) => !previous,
                  )
                }
                className={`relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-600 transition hover:bg-slate-50 ${showNotificationDropdown
                  ? "border-blue-300 bg-blue-50/50 text-[#0066ff]"
                  : ""
                  }`}
                aria-label="Notifications"
                aria-expanded={showNotificationDropdown}
              >
                <Bell className="h-4.5 w-4.5" />

                {unreadNotificationCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white shadow-sm">
                    {unreadNotificationCount > 99
                      ? "99+"
                      : unreadNotificationCount}
                  </span>
                )}
              </button>

              {showNotificationDropdown && (
                <EmployeeNotificationDropdown
                  onClose={() =>
                    setShowNotificationDropdown(false)
                  }
                  onUnreadCountChange={
                    setUnreadNotificationCount
                  }
                />
              )}
            </div>

            <DatePicker />

            {/* Profile */}
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() =>
                  setShowProfileMenu((previous) => !previous)
                }
                className="flex items-center gap-2.5 rounded-full p-1 transition hover:bg-slate-100"
              >
                <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#0066ff] text-xs font-bold text-white shadow-sm shadow-blue-500/20">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>

                <div className="hidden text-left sm:block">
                  <span className="block text-xs font-bold font-manrope text-slate-800 uppercase tracking-tight">
                    {fullName}
                  </span>

                  <span className="block text-[11px] font-semibold text-slate-400">
                    {designation || "Employee"}
                  </span>
                </div>

                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 top-12 z-50 w-48 overflow-hidden rounded-2xl border border-slate-150 bg-white py-1.5 shadow-xl shadow-slate-900/10">
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      navigate("/employee/profile");
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    My Profile
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      navigate("/employee/help");
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Help & Support
                  </button>

                  <div className="my-1 border-t border-slate-100" />

                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      onLogout();
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Scoped so a crash in one employee page leaves the header and
            sidebar usable. */}
        <main className="flex-1 overflow-y-auto min-w-0">
          <ErrorBoundary label={pageTitle}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

export default EmployeeLayout;
