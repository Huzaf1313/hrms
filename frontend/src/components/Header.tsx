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

interface HeaderProps {
  onLogout: () => void;
  onToggleSidebar?: () => void;
  pageTitle?: string;
  collapsed?: boolean;
  /** Mobile: opens the drawer. Desktop has no use for it. */
  onOpenSidebar?: () => void;
  onSearchEmployee?: (query: string) => void;
  onSelectEmployee?: (employeeId: string) => void;
}

function readUser() {
  try {
    const raw = localStorage.getItem("user");

    return raw
      ? (JSON.parse(raw) as { full_name?: string; role?: string })
      : null;
  } catch {
    return null;
  }
}

function roleDisplay(role?: string): string {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "hr_admin":
      return "HR";
    case "manager":
      return "Manager";
    case "employee":
      return "Employee";
    default:
      return role ? role.charAt(0).toUpperCase() + role.slice(1) : "";
  }
}

function employeeFullName(employee: Employee) {
  return `${employee.first_name} ${employee.last_name}`.trim();
}

/** Only admin-level roles may create or edit holidays. */
function isAdminRole(role?: string): boolean {
  return role === "super_admin" || role === "hr_admin" || role === "manager";
}

function Header({
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
  const [showEmployeeSuggestions, setShowEmployeeSuggestions] =
    useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [user, setUser] = useState(() => readUser());

  // A profile save renames the cached session user; pick that up live.
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
        if (!cancelled) {
          setAllEmployees(employees);
        }
      })
      .catch((error) => {
        console.error("Failed to load employee search suggestions", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void adminProfileService
      .getProfile()
      .then((profile) => {
        if (!cancelled) setAvatarUrl(profile.avatar_url);
      })
      .catch((error) => {
        console.error("Failed to load header profile photo", error);
      });

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
      .slice(0, 8)
    : [];

  function selectEmployee(employee: Employee) {
    setEmployeeSearch(employeeFullName(employee));
    setShowEmployeeSuggestions(false);
    onSelectEmployee?.(employee.id);
  }

  function handleEmployeeSearchKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
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
  const [showNotificationDropdown, setShowNotificationDropdown] =
    useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationRef = useRef<HTMLDivElement>(null);
  // Wraps the avatar button and its menu, so a click inside either keeps it open.
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // A newly created employee has no `created_by` on file yet, so notifications
  // route to every active admin until their creator is known.
  const refreshUnreadCount = useCallback(async () => {
    try {
      setUnreadCount(await adminNotificationService.getUnreadCount());
    } catch (error) {
      console.error("Failed to load admin unread count:", error);
    }
  }, []);

  useEffect(() => {
    // Polling an external source on mount and on an interval. The setState
    // happens after the await, so this is not a synchronous cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshUnreadCount();

    const interval = window.setInterval(() => {
      // Paused while the tab is hidden so a backgrounded dashboard does not keep
      // hitting the API.
      if (document.visibilityState === "visible") {
        void refreshUnreadCount();
      }
    }, 30_000);

    return () => window.clearInterval(interval);
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

    // Escape closes the profile menu only; the notification dropdown keeps
    // its existing click-outside behaviour.
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

  const fullName = user?.full_name ?? "Admin";
  const initials = fullName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between gap-4 border-b border-slate-100 bg-white px-6">
      <div className="flex min-w-0 items-center gap-4">
        <button
          type="button"
          onClick={() => {
            if (onOpenSidebar) onOpenSidebar();
            else onToggleSidebar?.();
          }}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 transition hover:bg-slate-100 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="hidden h-10 w-10 items-center justify-center rounded-xl text-slate-700 transition hover:bg-slate-100 lg:flex"
            aria-label="Toggle menu"
            aria-expanded={!collapsed}
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#0f172a] font-manrope">
          {pageTitle}
        </h1>
      </div>

      {/* Center Search Pill */}
      <div className="relative hidden md:block flex-1 max-w-xs lg:max-w-sm mx-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />

        <input
          type="text"
          value={employeeSearch}
          onChange={(event) => {
            setEmployeeSearch(event.target.value);
            setShowEmployeeSuggestions(true);
          }}
          onFocus={() => setShowEmployeeSuggestions(true)}
          onBlur={() => setShowEmployeeSuggestions(false)}
          onKeyDown={handleEmployeeSearchKeyDown}
          placeholder="Search employees..."
          aria-label="Search employees"
          className="w-full rounded-full bg-[#f1f4f9] py-2 pl-10 pr-4 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 border border-transparent focus:border-slate-200"
        />

        {showEmployeeSuggestions && normalizedQuery && (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            {employeeSuggestions.length > 0 ? (
              <ul role="listbox" className="max-h-80 overflow-y-auto py-2">
                {employeeSuggestions.map((employee) => (
                  <li key={employee.id} role="option" aria-selected={false}>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectEmployee(employee)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-blue-50"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                        {employee.first_name.charAt(0).toUpperCase()}
                      </span>

                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-900">
                          {employeeFullName(employee)}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {employee.employee_id || "Employee"}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-4 text-sm text-slate-500">
                No matching employees found.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Right Navbar Controls */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Notification Bell with Badge */}
        <div ref={notificationRef} className="relative">
          <button
            type="button"
            onClick={() => setShowNotificationDropdown((current) => !current)}
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100"
            aria-label="Notifications"
            aria-expanded={showNotificationDropdown}
          >
            <Bell className="h-5 w-5" />

            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[#ef4444] px-1 text-[10px] font-bold text-white ring-2 ring-white shadow-sm">
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

        {/* Date Badge */}
        <DatePicker canManageHolidays={isAdminRole(user?.role)} />

        {/* User Profile Pill */}
        <div className="relative" ref={profileMenuRef}>
          <button
            type="button"
            onClick={() => setShowProfileMenu((previous) => !previous)}
            className="flex items-center gap-2.5 rounded-full p-1 transition hover:bg-slate-100/80"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#0066ff] text-xs font-extrabold text-white shadow-sm">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </span>

            <span className="hidden min-w-0 max-w-[160px] text-left sm:block">
              <span className="block truncate text-xs font-extrabold leading-tight text-slate-900 tracking-wider uppercase">
                {fullName}
              </span>
              <span className="block truncate text-[11px] leading-tight text-slate-500 capitalize font-medium">
                {roleDisplay(user?.role)}
              </span>
            </span>

            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 top-12 z-50 w-44 overflow-hidden rounded-2xl border border-slate-100 bg-white py-1 shadow-xl">
              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu(false);
                  navigate("/dashboard/profile");
                }}
                className="w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                My Profile
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu(false);
                  onLogout();
                }}
                className="w-full px-4 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
