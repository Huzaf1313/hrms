import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, LogOut, Menu, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

import AdminNotificationDropdown from "../modules/dashboard/AdminNotificationDropdown";
import DatePicker from "./DatePicker";
import { employeeService } from "../modules/employees/employeeService";
import type { Employee } from "../modules/employees/types";
import { adminNotificationService } from "../modules/dashboard/adminNotificationService";
import { adminProfileService } from "../modules/employees/adminProfileService";
import { SESSION_USER_UPDATED_EVENT } from "../lib/session";
import { Avatar } from "./ui/Avatar";

interface HeaderProps {
  onLogout: () => void;
  onToggleSidebar?: () => void;
  pageTitle?: string;
  collapsed?: boolean;
  onOpenSidebar?: () => void;
  onSearchEmployee?: (query: string) => void;
  onSelectEmployee?: (employeeId: string) => void;
}

function readUser() {
  try {
    const raw = localStorage.getItem("user");
    return raw ? (JSON.parse(raw) as { full_name?: string; role?: string }) : null;
  } catch {
    return null;
  }
}

function roleDisplay(role?: string): string {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "hr_admin":
      return "HR Admin";
    case "manager":
      return "Manager";
    case "employee":
      return "Employee";
    default:
      return role ? role.replace("_", " ") : "";
  }
}

function employeeFullName(employee: Employee) {
  return `${employee.first_name} ${employee.last_name}`.trim();
}

function isAdminRole(role?: string): boolean {
  return role === "super_admin" || role === "hr_admin" || role === "manager";
}

export function Header({
  onLogout,
  onToggleSidebar,
  pageTitle = "Dashboard",
  collapsed = false,
  onOpenSidebar,
  onSearchEmployee,
  onSelectEmployee,
}: HeaderProps) {
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [showEmployeeSuggestions, setShowEmployeeSuggestions] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [user, setUser] = useState(() => readUser());

  useEffect(() => {
    const refresh = () => setUser(readUser());
    window.addEventListener(SESSION_USER_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(SESSION_USER_UPDATED_EVENT, refresh);
  }, []);

  useEffect(() => {
    let cancelled = false;
    employeeService
      .listAll()
      .then((employees) => {
        if (!cancelled) setAllEmployees(employees);
      })
      .catch(() => { });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    adminProfileService
      .getProfile()
      .then((profile) => {
        if (!cancelled && profile.avatar_url) setAvatarUrl(profile.avatar_url);
      })
      .catch(() => { });

    return () => {
      cancelled = true;
    };
  }, [pageTitle]);

  const normalizedQuery = employeeSearch.trim().toLowerCase();

  const employeeSuggestions = normalizedQuery
    ? allEmployees
      .filter((employee) => {
        const fullName = employeeFullName(employee).toLowerCase();
        const firstName = employee.first_name.toLowerCase();
        const lastName = employee.last_name.toLowerCase();

        return (
          fullName.includes(normalizedQuery) ||
          firstName.startsWith(normalizedQuery) ||
          lastName.startsWith(normalizedQuery)
        );
      })
      .slice(0, 6)
    : [];

  function selectEmployee(employee: Employee) {
    setEmployeeSearch(employeeFullName(employee));
    setShowEmployeeSuggestions(false);
    onSelectEmployee?.(employee.id);
  }

  function handleEmployeeSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setShowEmployeeSuggestions(false);
      return;
    }

    if (event.key !== "Enter") return;

    event.preventDefault();
    const query = employeeSearch.trim();
    if (!query) return;

    if (employeeSuggestions.length > 0) {
      selectEmployee(employeeSuggestions[0]);
    } else {
      setShowEmployeeSuggestions(false);
      onSearchEmployee?.(query);
    }
  }

  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const refreshUnreadCount = useCallback(async () => {
    try {
      setUnreadCount(await adminNotificationService.getUnreadCount());
    } catch {
      // Ignored
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    adminNotificationService.getUnreadCount().then((count) => {
      if (!cancelled) setUnreadCount(count);
    }).catch(() => { });

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshUnreadCount();
      }
    }, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [refreshUnreadCount]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node)
      ) {
        setShowNotificationDropdown(false);
      }

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

  const fullName = user?.full_name ?? "Admin User";

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-5">
      {/* Skip link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-white focus:text-blue-600 focus:ring-2 focus:ring-blue-500 rounded"
      >
        Skip to main content
      </a>

      {/* Left: Hamburger & Page Title */}
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (onOpenSidebar) onOpenSidebar();
            else onToggleSidebar?.();
          }}
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors lg:hidden focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Toggle navigation"
        >
          <Menu className="h-4 w-4" />
        </button>

        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="hidden h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors lg:flex focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu className="h-4 w-4" />
          </button>
        )}

        {/* Sole page title on screen */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium hidden sm:inline">Workspace /</span>
          <h1 className="text-sm font-semibold text-slate-900 truncate">
            {pageTitle}
          </h1>
        </div>
      </div>

      {/* Center: Global Search */}
      <div className="relative hidden md:block flex-1 max-w-xs lg:max-w-sm mx-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={employeeSearch}
          onChange={(e) => {
            setEmployeeSearch(e.target.value);
            setShowEmployeeSuggestions(true);
          }}
          onFocus={() => setShowEmployeeSuggestions(true)}
          onBlur={() => setTimeout(() => setShowEmployeeSuggestions(false), 200)}
          onKeyDown={handleEmployeeSearchKeyDown}
          placeholder="Search employees by name or code..."
          className="w-full h-8 rounded-md bg-slate-50 pl-8 pr-3 text-xs text-slate-800 placeholder:text-slate-400 border border-slate-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
        />

        {showEmployeeSuggestions && normalizedQuery && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-slate-200 bg-white shadow-md">
            {employeeSuggestions.length > 0 ? (
              <ul className="max-h-60 overflow-y-auto py-1 text-xs">
                {employeeSuggestions.map((employee) => (
                  <li key={employee.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectEmployee(employee)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50 transition-colors"
                    >
                      <Avatar name={employeeFullName(employee)} size="xs" />
                      <div className="min-w-0">
                        <span className="font-medium text-slate-900 block truncate">
                          {employeeFullName(employee)}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          {employee.employee_id} • {employee.designation || "General"}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-3 py-3 text-xs text-slate-400 text-center">
                No employees match "{employeeSearch}"
              </p>
            )}
          </div>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Date Badge */}
        <DatePicker canManageHolidays={isAdminRole(user?.role)} />

        {/* Notification Bell */}
        <div ref={notificationRef} className="relative">
          <button
            type="button"
            onClick={() => setShowNotificationDropdown((prev) => !prev)}
            className={`relative flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${showNotificationDropdown ? "bg-slate-100 text-slate-900" : ""
              }`}
            aria-label="Notifications"
            aria-expanded={showNotificationDropdown}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {showNotificationDropdown && (
            <AdminNotificationDropdown
              onClose={() => setShowNotificationDropdown(false)}
              onUnreadCountChange={setUnreadCount}
              onRefreshRequest={refreshUnreadCount}
            />
          )}
        </div>

        {/* User Profile */}
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
                {roleDisplay(user?.role)}
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
                  navigate("/dashboard/profile");
                }}
                className="w-full px-3 py-2 text-left font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                My Profile
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
  );
}

export default Header;
