import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, ChevronDown, LogOut, Menu } from "lucide-react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import EmployeeSidebar from "../modules/employees/EmployeeSidebar";
import EmployeeNotificationDropdown from "../modules/dashboard/EmployeeNotificationDropdown";
import ErrorBoundary from "../components/ErrorBoundary";
import DatePicker from "../components/DatePicker";
import { employeeNotificationService } from "../modules/dashboard/employeeNotificationService";
import { employeeService } from "../modules/employees/employeeService";
import { Avatar } from "../components/ui/Avatar";

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

export function EmployeeLayout({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notificationContainerRef = useRef<HTMLDivElement | null>(null);

  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [designation, setDesignation] = useState("");

  const user = useMemo(() => readUser(), []);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setShowProfileMenu(false);
      }
      if (
        notificationContainerRef.current &&
        !notificationContainerRef.current.contains(event.target as Node)
      ) {
        setShowNotificationDropdown(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowProfileMenu(false);
        setShowNotificationDropdown(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    employeeNotificationService
      .getUnreadCount()
      .then((count) => {
        if (!cancelled) setUnreadNotificationCount(count);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    employeeService
      .getMyProfile()
      .then((profile) => {
        if (!cancelled) {
          setDesignation(profile.designation ?? "");
          if (profile.avatar_url) setAvatarUrl(profile.avatar_url);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  const fullName = user?.full_name ?? "Employee";
  const pageTitle = pageTitles[location.pathname] ?? "Portal";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f8fafc]">
      {/* Skip link for keyboard accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-white focus:text-blue-600 focus:ring-2 focus:ring-blue-500 rounded"
      >
        Skip to main content
      </a>

      <EmployeeSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-1 flex-col h-full min-w-0 overflow-hidden">
        {/* Topbar: slim 56px, 1px bottom border, no shadow */}
        <header className="shrink-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white px-5">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 lg:hidden focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Open navigation menu"
              aria-expanded={sidebarOpen}
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Sole page title */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium hidden sm:inline">Self Service /</span>
              <h1 className="text-sm font-semibold text-slate-900 truncate">
                {pageTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Global DatePicker */}
            <DatePicker />

            {/* Notifications */}
            <div ref={notificationContainerRef} className="relative">
              <button
                type="button"
                onClick={() => setShowNotificationDropdown((prev) => !prev)}
                className={`relative flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  showNotificationDropdown ? "bg-slate-100 text-slate-900" : ""
                }`}
                aria-label="Notifications"
                aria-expanded={showNotificationDropdown}
              >
                <Bell className="h-4 w-4" />
                {unreadNotificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                    {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                  </span>
                )}
              </button>

              {showNotificationDropdown && (
                <EmployeeNotificationDropdown
                  onClose={() => setShowNotificationDropdown(false)}
                  onUnreadCountChange={setUnreadNotificationCount}
                />
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setShowProfileMenu((prev) => !prev)}
                className="flex items-center gap-2 p-1 rounded-md hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <Avatar name={fullName} src={avatarUrl} size="sm" />
                <div className="hidden sm:block text-left min-w-0">
                  <span className="block truncate text-xs font-semibold text-slate-800 leading-tight">
                    {fullName}
                  </span>
                  <span className="block truncate text-[10px] text-slate-400 leading-tight">
                    {designation || "Employee"}
                  </span>
                </div>
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 top-11 z-50 w-44 rounded-md border border-slate-200 bg-white py-1 shadow-md text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      navigate("/employee/profile");
                    }}
                    className="w-full px-3 py-2 text-left font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    My Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      navigate("/employee/help");
                    }}
                    className="w-full px-3 py-2 text-left font-medium text-slate-700 hover:bg-slate-50 transition-colors"
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
                    className="w-full px-3 py-2 text-left font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-1.5 transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto min-w-0 outline-none">
          <ErrorBoundary label={pageTitle}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

export default EmployeeLayout;
