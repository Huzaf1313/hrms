import { useMemo, useState } from "react";
import { Bell, ChevronDown, Menu, Search } from "lucide-react";

import DatePicker from "./DatePicker";

interface HeaderProps {
  onLogout: () => void;
  onToggleSidebar?: () => void;
  pageTitle?: string;
  collapsed?: boolean;
}

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

function Header({
  onLogout,
  onToggleSidebar,
  pageTitle = "Dashboard",
  collapsed = false,
}: HeaderProps) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const user = useMemo(() => readUser(), []);

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
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100"
            aria-label="Toggle menu"
            aria-expanded={!collapsed}
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <p className="truncate text-sm font-semibold text-gray-900">
          {pageTitle}
        </p>
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

        <button
          type="button"
          className="relative flex h-10 w-10 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />

          <span className="absolute -right-0.5 -top-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[#ef4444] px-1 text-[9px] font-bold text-white">
            12
          </span>
        </button>

        <DatePicker />

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
                  onLogout();
                }}
                className="w-full px-4 py-2.5 text-left text-sm font-medium text-gray-700 transition hover:bg-red-50 hover:text-red-600"
              >
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
