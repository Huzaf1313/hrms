import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell, ChevronDown, LogOut, Menu } from "lucide-react";
import { api } from "../services/api";

import EmployeeSidebar from "../pages/employee/EmployeeSidebar";
import DatePicker from "../components/DatePicker";


const pageTitles: Record<string, string> = {
  "/employee/dashboard": "Dashboard",
  "/employee/profile": "My Profile",
  "/employee/attendance": "My Attendance",
  "/employee/leave": "My Leave",
  "/employee/payroll": "My Payslip",
  "/employee/documents": "My Documents",
  "/employee/announcements": "Announcements",
  "/employee/help": "Help & Support",
};

function readUser() {
  try {
    const raw = localStorage.getItem("user");

    return raw
      ? (JSON.parse(raw) as { full_name?: string; employee_id?: string | null })
      : null;
  } catch {
    return null;
  }
}

function EmployeeLayout({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const [unreadAnnouncementCount, setUnreadAnnouncementCount] = useState(0);

  const user = useMemo(() => readUser(), []);

  useEffect(() => {
  const fetchUnreadAnnouncements = async () => {
    try {
      const response = await api.get<{
        announcements: { id: string }[];
        total: number;
      }>("/employee-announcements");

      const readIds = JSON.parse(
        localStorage.getItem("employee_read_announcement_ids") || "[]",
      ) as string[];

      const unreadCount = response.announcements.filter(
        (announcement) => !readIds.includes(announcement.id),
      ).length;

      setUnreadAnnouncementCount(unreadCount);
    } catch (error) {
      console.error("Failed to fetch announcement notifications:", error);
    }
  };

  fetchUnreadAnnouncements();

  const handleAnnouncementsRead = () => {
    setUnreadAnnouncementCount(0);
  };

  window.addEventListener("announcements-read", handleAnnouncementsRead);

  const interval = window.setInterval(fetchUnreadAnnouncements, 30000);

  return () => {
    window.clearInterval(interval);
    window.removeEventListener(
      "announcements-read",
      handleAnnouncementsRead,
    );
  };
}, []);

  const fullName = user?.full_name ?? "Employee";

  const initials = fullName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const pageTitle = pageTitles[location.pathname] ?? "Dashboard";

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
    <EmployeeSidebar onLogout={onLogout} />

    <div className="ml-[250px] min-w-0">
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between gap-4 border-b border-gray-200 bg-white px-6">
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100"
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <p className="truncate text-sm font-semibold text-gray-900">
              {pageTitle}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />

              {unreadAnnouncementCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ef4444] px-1 text-[9px] font-bold text-white">
                  {unreadAnnouncementCount > 99 ? "99+" : unreadAnnouncementCount}
                </span>
              )}
            </button>
            <DatePicker />

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowProfileMenu((previous) => !previous)}
                className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2 transition hover:bg-gray-100"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2563eb] text-xs font-bold text-white">
                  {initials}
                </span>

                <span className="hidden text-left sm:block">
                  <span className="block text-sm font-semibold leading-tight text-gray-900">
                    {fullName}
                  </span>
                  <span className="block text-[11px] leading-tight text-gray-500">
                    Employee
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
                      navigate("/employee/profile");
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

        <Outlet />
      </div>
    </div>
  );
}

export default EmployeeLayout;