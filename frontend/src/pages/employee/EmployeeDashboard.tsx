import { useMemo } from "react";

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

const leaveRequests = [
  {
    date: "Aug 25 - Aug 27",
    type: "Casual Leave",
    status: "Approved",
  },
  {
    date: "Sep 04",
    type: "Sick Leave",
    status: "Pending",
  },
  {
    date: "Sep 18 - Sep 19",
    type: "Earned Leave",
    status: "Approved",
  },
];

const announcements = [
  {
    title: "Independence Day Holiday",
    description: "Office will remain closed on August 15.",
    date: "Aug 10",
  },
  {
    title: "Updated Leave Policy",
    description: "Please review the updated employee leave policy.",
    date: "Aug 08",
  },
  {
    title: "Monthly Town Hall",
    description: "Join the company town hall this Friday.",
    date: "Aug 05",
  },
];

const holidays = [
  {
    date: "15",
    month: "AUG",
    name: "Independence Day",
  },
  {
    date: "27",
    month: "AUG",
    name: "Ganesh Chaturthi",
  },
  {
    date: "05",
    month: "SEP",
    name: "Ganesh Visarjan",
  },
];

function EmployeeDashboard() {
    const user = useMemo<User | null>(() => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      return null;
    }

    try {
      return JSON.parse(storedUser) as User;
    } catch {
      return null;
    }
  }, []);

  const employeeName = user?.full_name || "Employee";

  const firstName = employeeName.split(" ")[0];

  return (
  <main className="min-w-0 flex-1 px-6 pb-10 pt-8 lg:px-8">

    {/* Greeting */}
    <section className="mb-7">
      <p className="text-sm font-medium text-[#2563eb]">
        Employee Portal
      </p>

      <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#171b1d] sm:text-4xl">
        Good Morning, {firstName} 👋
      </h1>

      <p className="mt-2 text-sm text-gray-500">
        Here's what's happening with your work today.
      </p>
    </section>

    {/* =======================================================
        KPI CARDS
    ======================================================= */}
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">

            {/* Attendance */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">

              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Today's Attendance
                  </p>

                  <p className="mt-3 text-2xl font-bold text-[#17213a]">
                    Checked In
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-700">
                  ✓
                </div>
              </div>

              <div className="mt-5 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Punch In</span>
                  <span className="font-semibold text-gray-700">
                    09:12 AM
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-500">Punch Out</span>
                  <span className="font-semibold text-gray-400">
                    --
                  </span>
                </div>
              </div>

              <button className="mt-4 text-sm font-semibold text-[#2563eb] hover:underline">
                View Details →
              </button>
            </div>

            {/* Leave */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">

              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Leave Balance
                  </p>

                  <p className="mt-3 text-2xl font-bold text-[#17213a]">
                    14 Days
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
                  ◷
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2 text-center">

                <div className="rounded-lg bg-gray-50 p-2">
                  <p className="text-lg font-bold">5</p>
                  <p className="text-[10px] text-gray-500">Casual</p>
                </div>

                <div className="rounded-lg bg-gray-50 p-2">
                  <p className="text-lg font-bold">4</p>
                  <p className="text-[10px] text-gray-500">Sick</p>
                </div>

                <div className="rounded-lg bg-gray-50 p-2">
                  <p className="text-lg font-bold">5</p>
                  <p className="text-[10px] text-gray-500">Earned</p>
                </div>
              </div>

              <button className="mt-4 text-sm font-semibold text-[#2563eb] hover:underline">
                Apply Leave →
              </button>
            </div>

            {/* Payslip */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">

              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    My Payslip
                  </p>

                  <p className="mt-3 text-2xl font-bold text-[#17213a]">
                    ₹48,750
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                  ₹
                </div>
              </div>

              <p className="mt-4 text-sm text-gray-500">
                July 2026 · Take-home salary
              </p>

              <button className="mt-4 text-sm font-semibold text-[#2563eb] hover:underline">
                View Payslip →
              </button>
            </div>

            {/* Performance */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">

              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    My Performance
                  </p>

                  <p className="mt-3 text-2xl font-bold text-[#17213a]">
                    4.5 / 5
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                  ★
                </div>
              </div>

              <div className="mt-4 flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    className={
                      star <= 4
                        ? "text-lg text-yellow-500"
                        : "text-lg text-gray-300"
                    }
                  >
                    ★
                  </span>
                ))}
              </div>

              <p className="mt-2 text-sm font-medium text-green-600">
                Excellent Performer
              </p>
            </div>
          </section>

          {/* =======================================================
              ATTENDANCE + ANNOUNCEMENTS
          ======================================================= */}
          <section className="mt-6 grid gap-6 xl:grid-cols-3">

            {/* Attendance Overview */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm xl:col-span-2">

              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#17213a]">
                    Attendance Overview
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Monthly attendance trend
                  </p>
                </div>

                <select className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 outline-none">
                  <option>August 2026</option>
                  <option>July 2026</option>
                  <option>June 2026</option>
                </select>
              </div>

              {/* Chart */}
              <div className="mt-8">

                <div className="relative h-[230px]">

                  {/* Grid */}
                  <div className="absolute inset-0 flex flex-col justify-between">
                    {[1, 2, 3, 4, 5].map((line) => (
                      <div
                        key={line}
                        className="border-t border-dashed border-gray-200"
                      />
                    ))}
                  </div>

                  {/* Chart visualization */}
                  <div className="absolute inset-x-0 bottom-6 top-4 flex items-end gap-3 px-2">

                    {[
                      { present: 82, late: 12, absent: 6 },
                      { present: 88, late: 7, absent: 5 },
                      { present: 75, late: 15, absent: 10 },
                      { present: 92, late: 5, absent: 3 },
                      { present: 86, late: 9, absent: 5 },
                      { present: 95, late: 3, absent: 2 },
                      { present: 89, late: 7, absent: 4 },
                      { present: 93, late: 5, absent: 2 },
                    ].map((item, index) => (
                      <div
                        key={index}
                        className="flex h-full flex-1 items-end justify-center gap-1"
                      >
                        <div
                          className="w-2 rounded-t-full bg-[#2563eb]"
                          style={{ height: `${item.present}%` }}
                        />

                        <div
                          className="w-2 rounded-t-full bg-orange-400"
                          style={{ height: `${item.late}%` }}
                        />

                        <div
                          className="w-2 rounded-t-full bg-red-400"
                          style={{ height: `${item.absent}%` }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* X Axis */}
                  <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 text-xs text-gray-400">
                    <span>Aug 01</span>
                    <span>Aug 05</span>
                    <span>Aug 10</span>
                    <span>Aug 15</span>
                    <span>Aug 20</span>
                    <span>Aug 25</span>
                    <span>Aug 31</span>
                  </div>
                </div>

                {/* Legend */}
                <div className="mt-5 flex gap-5 text-xs text-gray-500">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#2563eb]" />
                    Present
                  </span>

                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-orange-400" />
                    Late
                  </span>

                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                    Absent
                  </span>
                </div>
              </div>
            </div>

            {/* Announcements */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">

              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#17213a]">
                    Recent Announcements
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Latest company updates
                  </p>
                </div>

                <button className="text-sm font-semibold text-[#2563eb]">
                  View All
                </button>
              </div>

              <div className="mt-5 space-y-4">
                {announcements.map((announcement) => (
                  <div
                    key={announcement.title}
                    className="rounded-xl border border-gray-100 bg-gray-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-semibold text-gray-800">
                        {announcement.title}
                      </h3>

                      <span className="shrink-0 text-xs text-gray-400">
                        {announcement.date}
                      </span>
                    </div>

                    <p className="mt-2 text-xs leading-5 text-gray-500">
                      {announcement.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* =======================================================
              BOTTOM WIDGETS
          ======================================================= */}
          <section className="mt-6 grid gap-6 xl:grid-cols-3">

            {/* Leave Requests */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm xl:col-span-2">

              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#17213a]">
                    My Leave Requests
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Recent leave applications
                  </p>
                </div>

                <button className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4d6d59]">
                  Apply Leave
                </button>
              </div>

              <div className="mt-5 overflow-x-auto">

                <table className="w-full min-w-[500px] text-left">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                      <th className="pb-3 font-semibold">Date</th>
                      <th className="pb-3 font-semibold">Category</th>
                      <th className="pb-3 font-semibold">Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {leaveRequests.map((request) => (
                      <tr
                        key={`${request.date}-${request.type}`}
                        className="border-b border-gray-50 last:border-0"
                      >
                        <td className="py-4 text-sm font-medium text-gray-700">
                          {request.date}
                        </td>

                        <td className="py-4 text-sm text-gray-500">
                          {request.type}
                        </td>

                        <td className="py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              request.status === "Approved"
                                ? "bg-green-100 text-green-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {request.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Holidays */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">

              <h2 className="text-lg font-bold text-[#17213a]">
                Upcoming Holidays
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Upcoming public holidays
              </p>

              <div className="mt-5 space-y-4">
                {holidays.map((holiday) => (
                  <div
                    key={`${holiday.date}-${holiday.name}`}
                    className="flex items-center gap-4"
                  >
                    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-[#eef3ef]">
                      <span className="text-[10px] font-bold text-[#2563eb]">
                        {holiday.month}
                      </span>

                      <span className="text-lg font-bold text-[#2563eb]">
                        {holiday.date}
                      </span>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        {holiday.name}
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        Public Holiday
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* =======================================================
              QUICK ACTIONS
          ======================================================= */}
          <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">

            <div>
              <h2 className="text-lg font-bold text-[#17213a]">
                Quick Actions
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Frequently used employee actions
              </p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

              {[
                ["Apply Leave", "◷"],
                ["View Payslip", "₹"],
                ["Mark Attendance", "✓"],
                ["View Profile", "♙"],
              ].map(([label, icon]) => (
                <button
                  key={label}
                  type="button"
                  className="flex items-center gap-3 rounded-xl border border-gray-200 p-4 text-left transition hover:border-[#2563eb] hover:bg-[#f5f8f5]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#eef3ef] text-lg font-semibold text-[#2563eb]">
                    {icon}
                  </span>

                  <span className="text-sm font-semibold text-gray-700">
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Footer */}
          <footer className="mt-8 border-t border-gray-200 py-6 text-center text-xs text-gray-400">
            Ac 2026 HRMS. All rights reserved. A� Employee Portal
          </footer>
        </main>
  );
}

export default EmployeeDashboard;

