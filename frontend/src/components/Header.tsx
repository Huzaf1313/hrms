import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, ChevronDown, ChevronRight, LogOut, Menu, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

import AdminNotificationDropdown from "./admin/AdminNotificationDropdown";
import DatePicker from "./DatePicker";
import { adminNotificationService } from "../services/adminNotificationService";

interface HeaderProps {
  onLogout: () => void;
  onToggleSidebar?: () => void;
  pageTitle?: string;
  collapsed?: boolean;
  /** Mobile: opens the drawer. Desktop has no use for it. */
  onOpenSidebar?: () => void;
}

// "Attendance › Daily Attendance" in the reference design. Only pages that
// genuinely sit under a parent get a trail; the rest render flat.
const trails: Record<string, string[]> = {
  Attendance: ["Dashboard", "Attendance", "Daily Attendance"],
  "Regularization Requests": ["Dashboard", "Attendance", "Regularization Requests"],
  Leave: ["Dashboard", "Leave"],
  "My Profile": ["Dashboard", "My Profile"],
};

function readUser() {
  try {
    const raw = localStorage.getItem("user");

    return raw ? (JSON.parse(raw) as { full_name?: string; role?: string }) : null;
  } catch {
    return null;
  }
}

/** HR and Manager accounts are admin-level: display role "Admin" plus
 * their designation. Everyone else shows their own role. */
function roleDisplay(role?: string): string {
  switch (role) {
    case "hr_admin":
      return "Admin • HR";
    case "manager":
      return "Admin • Manager";
    case "employee":
      return "Employee";
    default:
      return role ? role.charAt(0).toUpperCase() + role.slice(1) : "";
  }
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
}: HeaderProps) {
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] =
    useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationRef = useRef<HTMLDivElement>(null);

  const user = useMemo(() => readUser(), []);

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
      {/* Left: menu + page title */}
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

      {/* Right: search, bell, date, profile */}
      <div className="flex items-center gap-3">
        <div className="relative hidden lg:block">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

          <input
            type="text"
            placeholder="Search employees..."
            className="w-64 rounded-full border border-gray-200 bg-[#f5f7fb] py-2.5 pl-10 pr-4 text-sm outline-none transition placeholder:text-gray-400 focus:border-[#2563eb] focus:bg-white focus:ring-2 focus:ring-[#2563eb]/15"
          />
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
              {initials}
            </span>

            <span className="hidden text-left sm:block">
              <span className="block text-sm font-semibold leading-tight text-gray-900">
                {fullName}
              </span>
              <span className="block text-[11px] leading-tight text-gray-500">
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
