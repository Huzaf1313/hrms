import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, ChevronDown, ChevronRight, LogOut, Menu, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

import AdminNotificationDropdown from "./admin/AdminNotificationDropdown";
import DatePicker from "./DatePicker";
import { employeeService } from "../services/employeeService";
import type { Employee } from "../types/employee";
import { adminNotificationService } from "../services/adminNotificationService";
import { adminProfileService } from "../services/adminProfileService";

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

// Only pages that genuinely sit under a parent get a trail; the rest render
// flat as just their own name. Attendance, Leave and My Profile are top-level
// pages in the sidebar, so they carry no "Dashboard" prefix.
const trails: Record<string, string[]> = {
  "Regularization Requests": ["Attendance", "Regularization Requests"],
};

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
  return role === "hr_admin" || role === "manager";
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

  const user = useMemo(() => readUser(), []);

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
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const fullName = user?.full_name ?? "Admin";
  const initials = fullName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between gap-4 border-b border-gray-200 bg-white px-6">
      <div className="flex min-w-0 items-center gap-4">
        <button
          type="button"
          onClick={() => {
            if (onOpenSidebar) onOpenSidebar();
            else onToggleSidebar?.();
          }}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="hidden h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 lg:flex"
            aria-label="Toggle menu"
            aria-expanded={!collapsed}
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex items-center gap-1.5 text-sm">
            {(trails[pageTitle] ?? [pageTitle]).map((crumb, index, all) => (
              <li key={crumb} className="flex min-w-0 items-center gap-1.5">
                <span
                  className={`truncate ${index === all.length - 1 ? "font-semibold text-gray-900" : "text-gray-500"}`}
                >
                  {crumb}
                </span>

                {index < all.length - 1 && (
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                )}
              </li>
            ))}
          </ol>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden lg:block">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

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
            aria-autocomplete="list"
            aria-expanded={
              showEmployeeSuggestions && employeeSuggestions.length > 0
            }
            className="w-64 rounded-full border border-gray-200 bg-[#f5f7fb] py-2.5 pl-10 pr-4 text-sm outline-none transition placeholder:text-gray-400 focus:border-[#2563eb] focus:bg-white focus:ring-2 focus:ring-[#2563eb]/15"
          />

          {showEmployeeSuggestions && normalizedQuery && (
            <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
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
                          <span className="block truncate text-sm font-medium text-gray-900">
                            {employeeFullName(employee)}
                          </span>
                          <span className="block text-xs text-gray-500">
                            {employee.employee_id || "Employee"}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-4 text-sm text-gray-500">
                  No matching employees found.
                </p>
              )}
            </div>
          )}
        </div>

        <div ref={notificationRef} className="relative">
          <button
            type="button"
            onClick={() => setShowNotificationDropdown((current) => !current)}
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100"
            aria-label="Notifications"
            aria-expanded={showNotificationDropdown}
          >
            <Bell className="h-5 w-5" />

            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4 items-center justify-center rounded-full bg-[#ef4444] px-1 text-[9px] font-bold text-white">
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

        <DatePicker canManageHolidays={isAdminRole(user?.role)} />

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowProfileMenu((previous) => !previous)}
            className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2 transition hover:bg-gray-100"
          >
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#2563eb] text-xs font-bold text-white">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </span>

            <span className="hidden min-w-0 max-w-[180px] text-left sm:block">
              <span className="block truncate text-sm font-semibold leading-tight text-gray-900">
                {fullName}
              </span>
              <span className="block truncate text-[11px] leading-tight text-gray-500">
                {roleDisplay(user?.role)}
              </span>
            </span>

            <ChevronDown className="h-4 w-4 text-gray-400" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 top-12 z-50 w-44 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-xl">
              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu(false);
                  navigate("/dashboard/profile");
                }}
                className="w-full px-4 py-2.5 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                My Profile
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu(false);
                  onLogout();
                }}
                className="w-full px-4 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
              >
                <LogOut className="mr-2 inline h-4 w-4" />
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
