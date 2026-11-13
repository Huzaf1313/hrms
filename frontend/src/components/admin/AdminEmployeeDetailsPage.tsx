import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRightLeft,
  BriefcaseBusiness,
  Landmark,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShieldAlert,
  TrendingUp,
  User,
  UserX,
  Palmtree,
  Gift,
  Timer,
  Wallet,
  X,
} from "lucide-react";

import type { Department } from "../../types/department";
import type { Employee } from "../../types/employee";
import type { Shift } from "../../types/shift";
import AdminEmployeeDocuments from "./AdminEmployeeDocuments";
import { api } from "../../services/api";
import {
  formatDuration,
  formatShiftTime,
} from "../../services/shiftService";
import {
  LEGACY_SALARY_STRUCTURE_LABELS,
  type SalaryStructure,
} from "../../services/admin_salary_structure_service";
import { countWorkingDays } from "../../utils/workingDays";

const leaveBalanceConfig = [
  {
    label: "Casual Leave",
    type: "casualleave",
    total: 6,
    icon: Palmtree,
    iconBg: "bg-teal-50",
    iconColor: "text-teal-600",
  },
  {
    label: "Earned Leave",
    type: "earnedleave",
    total: 12,
    icon: Gift,
    iconBg: "bg-orange-50",
    iconColor: "text-orange-500",
  },
  {
    label: "Comp Off",
    type: "compoff",
    total: 1,
    icon: Timer,
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
  },
];

function leaveTypeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

interface AdminEmployeeDetailsPageProps {
  employee: Employee;
  departments: Department[];
  salaryStructures: SalaryStructure[];
  shifts: Shift[];
  onBack: () => void;
  onEdit: (employee: Employee) => void;
  onDeactivate: (employee: Employee) => void;

  onUpdateEmployee: (
    employeeId: string,
    data: {
      emergency_contact?: {
        name: string;
        relationship: string;
        phone: string;
        address: string;
      };
      bank_information?: {
        bank_name: string;
        account_holder_name: string;
        account_number: string;
        ifsc_code: string;
      };
    },
  ) => Promise<Employee>;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-700";

    case "on_leave":
      return "bg-orange-100 text-orange-700";

    case "inactive":
      return "bg-stone-100 text-stone-700";

    case "terminated":
      return "bg-red-100 text-red-700";

    default:
      return "bg-gray-100 text-gray-700";
  }
}

function statusLabel(status: string): string {
  if (status === "on_leave") {
    return "On Leave";
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

function initialFor(value?: string): string {
  return value?.charAt(0).toUpperCase() ?? "";
}

function formatDate(value?: string | null): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function maskAccountNumber(value: string): string {
  const last4 = value.slice(-4);
  return `•••• ${last4}`;
}

function salaryStructureLabel(
  value: string | undefined,
  structures: SalaryStructure[],
): string {
  if (!value) {
    return "—";
  }

  return (
    structures.find((structure) => structure.name === value)?.name ??
    LEGACY_SALARY_STRUCTURE_LABELS[value] ??
    value
  );
}

function formatSalary(value?: string | null): string {
  const amount = Number(value);

  if (!value || !Number.isFinite(amount)) {
    return "—";
  }

  return `₹${amount.toLocaleString("en-IN")}`;
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 font-semibold text-gray-800">{value || "—"}</p>
    </div>
  );
}

function AdminEmployeeDetailsPage({
  employee,
  departments,
  salaryStructures,
  shifts,
  onBack,
  onEdit,
  onDeactivate,
  onUpdateEmployee,
}: AdminEmployeeDetailsPageProps) {
  const [historyTab, setHistoryTab] = useState<
    "promotion" | "transfer" | "salary"
  >("salary");

  const [showBankDetails, setShowBankDetails] = useState(false);

  type EditSection = "emergency" | "bank" | null;

  const [editSection, setEditSection] = useState<EditSection>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [bankForm, setBankForm] = useState({
    bank_name: employee.bank_information?.bank_name ?? "",
    account_holder_name: employee.bank_information?.account_holder_name ?? "",
    account_number: employee.bank_information?.account_number ?? "",
    ifsc_code: employee.bank_information?.ifsc_code ?? "",
  });

  const [leaveUsed, setLeaveUsed] = useState<Record<string, number>>({});
  const [leaveLoading, setLeaveLoading] = useState(true);

  useEffect(() => {
    const fetchLeaveBalance = async () => {
      try {
        setLeaveLoading(true);

        // Through the shared client so the session cookie goes along.
        const result = await api.get<{
          items?: Array<{
            status?: string;
            leave_type: string;
            start_date: string;
            end_date: string;
            total_days?: number | null;
          }>;
        }>("/admin/leaves", {
          employee_id: employee.employee_id,
          limit: 100,
        });

        const approvedLeaves = result?.items ?? [];

        const used: Record<string, number> = {};

        approvedLeaves
          .filter(
            (leave: { status?: string }) =>
              leave.status?.toLowerCase() === "approved",
          )
          .forEach(
            (leave: {
              leave_type: string;
              start_date: string;
              end_date: string;
              total_days?: number | null;
            }) => {
              // Working days only. Saturdays and Sundays are predefined
              // weekly offs, so they never consume leave balance.
              const days =
                leave.total_days ??
                countWorkingDays(
                  leave.start_date,
                  leave.end_date,
                );

              const type = leaveTypeKey(leave.leave_type);

              used[type] = (used[type] || 0) + days;
            },
          );

        setLeaveUsed(used);
      } catch (error) {
        console.error("Failed to fetch leave balance:", error);
        setLeaveUsed({});
      } finally {
        setLeaveLoading(false);
      }
    };

    fetchLeaveBalance();
  }, [employee.employee_id]);

  function openBankEdit() {
    setSaveError(null);

    setBankForm({
      bank_name: employee.bank_information?.bank_name ?? "",
      account_holder_name: employee.bank_information?.account_holder_name ?? "",
      account_number: employee.bank_information?.account_number ?? "",
      ifsc_code: employee.bank_information?.ifsc_code ?? "",
    });

    setEditSection("bank");
  }

  function closeEditModal() {
    if (!isSaving) {
      setEditSection(null);
      setSaveError(null);
    }
  }

  async function handleSaveBank() {
    if (!bankForm.bank_name.trim()) {
      setSaveError("Bank name is required.");
      return;
    }

    if (!bankForm.account_holder_name.trim()) {
      setSaveError("Account holder name is required.");
      return;
    }

    if (!bankForm.account_number.trim()) {
      setSaveError("Account number is required.");
      return;
    }

    if (!/^\d+$/.test(bankForm.account_number)) {
      setSaveError("Account number must contain only numbers.");
      return;
    }

    if (!bankForm.ifsc_code.trim()) {
      setSaveError("IFSC code is required.");
      return;
    }

    if (bankForm.ifsc_code.length !== 11) {
      setSaveError("IFSC code must be exactly 11 characters.");
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);

      await onUpdateEmployee(employee.id, {
        bank_information: {
          bank_name: bankForm.bank_name.trim(),
          account_holder_name: bankForm.account_holder_name.trim(),
          account_number: bankForm.account_number,
          ifsc_code: bankForm.ifsc_code.trim().toUpperCase(),
        },
      });

      setEditSection(null);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Failed to update bank information.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const departmentName =
    departments.find(
      (department) => department.id === employee.department_id,
    )?.name ?? "—";

  // Tolerates a stale or missing prop: a parent running an older module can
  // pass undefined, and an unguarded .find() there blanks the whole page.
  const availableShifts: Shift[] = Array.isArray(shifts) ? shifts : [];

  const assignedShift = employee.shift_id
    ? (availableShifts.find((shift) => shift.id === employee.shift_id) ?? null)
    : null;

  const initials =
    `${employee.first_name.charAt(0)}${employee.last_name.charAt(0)}`.toUpperCase();

  const promotionHistory = employee.promotion_history ?? [];
  const transferHistory = employee.transfer_history ?? [];

  const activeHistory =
    historyTab === "promotion" ? promotionHistory : transferHistory;

  return (
    <div className="px-10 pb-10 pt-8">
      {/* TOP ACTION BAR */}
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
        >
          <ArrowLeft size={17} strokeWidth={2} />
          Back
        </button>

        <div className="flex items-center gap-4">
          {employee.status === "active" && (
            <button
              type="button"
              onClick={() => onDeactivate(employee)}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-stone-700"
            >
              <UserX size={16} strokeWidth={2} />
              Deactivate
            </button>
          )}

          <button
            type="button"
            onClick={() => onEdit(employee)}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            <Pencil size={16} strokeWidth={2} />
            Edit Profile
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        {/* LEFT COLUMN */}
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          {employee.avatar_url ? (
            <img
              src={employee.avatar_url}
              alt={`${employee.first_name} ${employee.last_name}`}
              className="h-24 w-24 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#2563eb] text-3xl font-semibold text-white">
              {initials}
            </div>
          )}

          {/* EMPLOYEE NAME */}
          <h2 className="mt-4 text-xl font-bold text-gray-800">
            {employee.first_name} {employee.last_name}
          </h2>

          {/* DESIGNATION */}
          <p className="mt-1 text-sm text-gray-500">
            {employee.designation}
          </p>

          {/* STATUS */}
          <span
            className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass(
              employee.status,
            )}`}
          >
            {statusLabel(employee.status)} • ID: {employee.employee_id}
          </span>

          {/* CONTACT INFORMATION */}
          <div className="mt-8 space-y-4 border-t border-gray-100 pt-6 text-sm text-gray-600">
            {/* EMAIL */}
            <p className="flex items-center gap-3">
              <Mail
                size={17}
                strokeWidth={2}
                className="shrink-0 text-gray-500"
              />
              <span className="break-all">{employee.email}</span>
            </p>

            {/* PHONE */}
            <p className="flex items-center gap-3">
              <Phone
                size={17}
                strokeWidth={2}
                className="shrink-0 text-gray-500"
              />
              <span>{employee.phone}</span>
            </p>

            {/* WORK LOCATION */}
            {employee.work_location && (
              <p className="flex items-center gap-3">
                <MapPin
                  size={17}
                  strokeWidth={2}
                  className="shrink-0 text-gray-500"
                />
                <span>{employee.work_location}</span>
              </p>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          {/* EMPLOYMENT DETAILS */}
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h3 className="mb-5 flex items-center gap-2 text-lg font-semibold text-gray-800">
              <BriefcaseBusiness
                size={20}
                strokeWidth={2}
                className="text-gray-700"
              />
              Employment Details
            </h3>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <DetailField
                label="Department"
                value={departmentName}
              />

              <DetailField
                label="Designation"
                value={employee.designation}
              />

              <DetailField
                label="Employment Type"
                value={employee.employment_type.replace("_", "-")}
              />

              <div>
                <p className="text-sm text-gray-500">
                  Shift
                </p>

                {assignedShift ? (
                  <>
                    <p className="mt-1 font-semibold text-gray-800">
                      {assignedShift.name}
                    </p>

                    <p className="mt-0.5 text-xs text-gray-500">
                      {formatShiftTime(assignedShift.start_time)} -{" "}
                      {formatShiftTime(assignedShift.end_time)}
                      {assignedShift.is_overnight
                        ? " (ends next day)"
                        : ""}
                    </p>

                    <p className="mt-0.5 text-xs text-gray-400">
                      Overtime after {formatDuration(
                        assignedShift.duration_minutes,
                      )}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 font-semibold text-amber-600">
                    No shift assigned
                  </p>
                )}
              </div>

              <DetailField
                label="Joining Date"
                value={formatDate(employee.joining_date)}
              />

              {/* REPORTING MANAGER */}
              <div>
                <p className="text-sm text-gray-500">
                  Reporting Manager
                </p>

                {employee.reporting_manager ? (
                  <p className="mt-1 flex items-center gap-2 font-semibold text-gray-800">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2563eb] text-[10px] font-semibold text-white">
                      {initialFor(employee.reporting_manager)}
                    </span>

                    {employee.reporting_manager}
                  </p>
                ) : (
                  <p className="mt-1 font-semibold text-gray-800">—</p>
                )}
              </div>

              <DetailField
                label="Work Location"
                value={employee.work_location}
              />
            </div>
          </div>

          {/* PERSONAL + EMERGENCY */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* PERSONAL INFORMATION */}
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h3 className="mb-5 flex items-center gap-2 text-lg font-semibold text-gray-800">
                <User
                  size={20}
                  strokeWidth={2}
                  className="text-gray-700"
                />
                Personal Information
              </h3>

              <div className="grid grid-cols-2 gap-6">
                <DetailField
                  label="Date of Birth"
                  value={formatDate(employee.date_of_birth)}
                />

                <DetailField
                  label="Gender"
                  value={employee.gender}
                />
              </div>

              {/* CURRENT ADDRESS */}
              <div className="mt-6">
                <p className="text-sm text-gray-500">
                  Current Address
                </p>

                <p className="mt-1 flex items-start gap-2 font-semibold text-gray-800">
                  <MapPin
                    size={17}
                    strokeWidth={2}
                    className="mt-0.5 shrink-0 text-gray-500"
                  />

                  <span>{employee.address || "—"}</span>
                </p>
              </div>
            </div>

            {/* EMERGENCY CONTACT */}
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-2">
                <ShieldAlert
                  size={20}
                  strokeWidth={2}
                  className="text-gray-700"
                />

                <h3 className="text-lg font-semibold text-gray-800">
                  Emergency Contact
                </h3>
              </div>

              {employee.emergency_contact ? (
                <div className="rounded-2xl bg-gray-50 p-4">
                  {/* CONTACT NAME */}
                  <p className="font-semibold text-gray-800">
                    {employee.emergency_contact.name}
                  </p>

                  {/* RELATIONSHIP */}
                  <p className="text-sm text-gray-500">
                    {employee.emergency_contact.relationship}
                  </p>

                  {/* CONTACT PHONE */}
                  <p className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                    <Phone
                      size={16}
                      strokeWidth={2}
                      className="shrink-0"
                    />
                    {employee.emergency_contact.phone}
                  </p>

                  {/* CONTACT ADDRESS */}
                  {employee.emergency_contact.address && (
                    <p className="mt-2 flex items-start gap-2 text-sm text-gray-600">
                      <MapPin
                        size={16}
                        strokeWidth={2}
                        className="mt-0.5 shrink-0"
                      />

                      <span>
                        {employee.emergency_contact.address}
                      </span>
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl bg-gray-50 px-4 py-5">
                  <p className="text-sm font-medium text-gray-700">
                    No emergency contact on file.
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    The employee can add their emergency contact from their profile.
                  </p>
                </div>
              )}
            </div>
          </div>

          <AdminEmployeeDocuments employeeId={employee.employee_id} />

          {/* BANK INFORMATION */}
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                <Landmark
                  size={20}
                  strokeWidth={2}
                  className="text-gray-700"
                />
                Bank Information
              </h3>

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={openBankEdit}
                  className="flex items-center gap-1.5 text-sm font-medium text-[#2563eb] hover:underline"
                >
                  <Pencil size={15} strokeWidth={2} />
                  Edit
                </button>

                {employee.bank_information && (
                  <button
                    type="button"
                    onClick={() =>
                      setShowBankDetails((current) => !current)
                    }
                    className="text-sm font-medium text-[#2563eb] hover:underline"
                  >
                    {showBankDetails
                      ? "Hide Details"
                      : "Show Details"}
                  </button>
                )}
              </div>
            </div>

            {employee.bank_information ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-4">
                <DetailField
                  label="Bank Name"
                  value={employee.bank_information.bank_name}
                />

                <DetailField
                  label="Account Holder"
                  value={
                    employee.bank_information.account_holder_name
                  }
                />

                <DetailField
                  label="Account Number"
                  value={
                    showBankDetails
                      ? employee.bank_information.account_number
                      : maskAccountNumber(
                          employee.bank_information.account_number,
                        )
                  }
                />

                <DetailField
                  label="IFSC Code"
                  value={
                    showBankDetails
                      ? employee.bank_information.ifsc_code
                      : maskAccountNumber(
                          employee.bank_information.ifsc_code,
                        )
                  }
                />
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                No bank information on file.
              </p>
            )}
          </div>

          {/* LEAVE BALANCE */}
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h3 className="mb-5 font-bold text-gray-900">
              Leave Balance
            </h3>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {leaveBalanceConfig.map((balance) => {
                const Icon = balance.icon;

                const used = leaveUsed[balance.type] ?? 0;

                const available = Math.max(
                  balance.total - used,
                  0,
                );

                return (
                  <div
                    key={balance.label}
                    className="rounded-2xl border border-gray-100 p-4"
                  >
                    <div
                      className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg ${balance.iconBg}`}
                    >
                      <Icon
                        className={`h-4 w-4 ${balance.iconColor}`}
                      />
                    </div>

                    <p className="text-xs text-gray-500">
                      {balance.label}
                    </p>

                    {leaveLoading ? (
                      <p className="mt-1 text-sm text-gray-400">
                        Loading...
                      </p>
                    ) : (
                      <>
                        <p className="mt-1 text-xl font-bold text-gray-900">
                          {used}

                          <span className="text-sm font-medium text-gray-400">
                            {" "}
                            / {balance.total} Days
                          </span>
                        </p>

                        <p className="text-xs text-gray-400">
                          {available} Available
                        </p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* PROMOTION / TRANSFER / SALARY */}
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            {/* HISTORY TABS */}
            <div className="mb-5 flex gap-6 border-b border-gray-100">
              {/* SALARY TAB - FIRST */}
              <button
                type="button"
                onClick={() => setHistoryTab("salary")}
                className={`flex items-center gap-2 pb-3 text-sm font-medium ${
                  historyTab === "salary"
                    ? "border-b-2 border-[#2563eb] text-[#2563eb]"
                    : "text-gray-500"
                }`}
              >
                <Wallet
                  size={16}
                  strokeWidth={2}
                />
                Salary Details
              </button>

              {/* PROMOTION TAB - SECOND */}
              <button
                type="button"
                onClick={() => setHistoryTab("promotion")}
                className={`flex items-center gap-2 pb-3 text-sm font-medium ${
                  historyTab === "promotion"
                    ? "border-b-2 border-[#2563eb] text-[#2563eb]"
                    : "text-gray-500"
                }`}
              >
                <TrendingUp
                  size={16}
                  strokeWidth={2}
                />
                Promotion History
              </button>

              {/* TRANSFER TAB - THIRD */}
              <button
                type="button"
                onClick={() => setHistoryTab("transfer")}
                className={`flex items-center gap-2 pb-3 text-sm font-medium ${
                  historyTab === "transfer"
                    ? "border-b-2 border-[#2563eb] text-[#2563eb]"
                    : "text-gray-500"
                }`}
              >
                <ArrowRightLeft
                  size={16}
                  strokeWidth={2}
                />
                Transfer History
              </button>
            </div>

            {/* TAB CONTENT */}
            {historyTab === "salary" ? (
              employee.salary ? (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <DetailField
                    label="Salary Structure"
                    value={salaryStructureLabel(
                      employee.salary_structure,
                      salaryStructures,
                    )}
                  />

                  <DetailField
                    label="Salary Amount"
                    value={formatSalary(employee.salary)}
                  />
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  No salary details on file.
                </p>
              )
            ) : activeHistory.length === 0 ? (
              <p className="text-sm text-gray-500">
                No history recorded.
              </p>
            ) : (
              <div className="space-y-4">
                {historyTab === "promotion"
                  ? promotionHistory.map((entry, index) => (
                      <div
                        key={`${entry.promotion_date}-${index}`}
                        className="flex gap-4 rounded-2xl bg-gray-50 p-4"
                      >
                        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#2563eb]" />

                        <div>
                          <p className="text-xs text-gray-500">
                            {formatDate(entry.promotion_date)}
                          </p>

                          <p className="font-semibold text-gray-800">
                            Promoted to {entry.to_designation}
                          </p>

                          <p className="mt-1 text-sm text-gray-600">
                            Transitioned from{" "}
                            {entry.from_designation}.
                            {entry.reason
                              ? ` Reason: ${entry.reason}`
                              : ""}
                          </p>
                        </div>
                      </div>
                    ))
                  : transferHistory.map((entry, index) => (
                      <div
                        key={`${entry.transfer_date}-${index}`}
                        className="flex gap-4 rounded-2xl bg-gray-50 p-4"
                      >
                        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#2563eb]" />

                        <div>
                          <p className="text-xs text-gray-500">
                            {formatDate(entry.transfer_date)}
                          </p>

                          <p className="font-semibold text-gray-800">
                            Transferred to {entry.to_department}
                          </p>

                          <p className="mt-1 text-sm text-gray-600">
                            From {entry.from_department}.
                            {entry.reason
                              ? ` Reason: ${entry.reason}`
                              : ""}
                          </p>
                        </div>
                      </div>
                    ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* EDIT MODAL */}
      {editSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {editSection === "emergency"
                    ? "Edit Emergency Contact"
                    : "Edit Bank Information"}
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  Update the information and save your changes.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditModal}
                disabled={isSaving}
                className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

              {/* BANK INFORMATION FORM */}
              <div className="mt-6 space-y-4">
                {/* BANK NAME */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Bank Name
                  </label>

                  <input
                    type="text"
                    value={bankForm.bank_name}
                    onChange={(event) =>
                      setBankForm((current) => ({
                        ...current,
                        bank_name: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-[#2563eb]"
                    placeholder="Enter bank name"
                  />
                </div>

                {/* ACCOUNT HOLDER */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Account Holder Name
                  </label>

                  <input
                    type="text"
                    value={bankForm.account_holder_name}
                    onChange={(event) =>
                      setBankForm((current) => ({
                        ...current,
                        account_holder_name: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-[#2563eb]"
                    placeholder="Enter account holder name"
                  />
                </div>

                {/* ACCOUNT NUMBER */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Account Number
                  </label>

                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={18}
                    value={bankForm.account_number}
                    onChange={(event) => {
                      const value = event.target.value
                        .replace(/\D/g, "")
                        .slice(0, 18);

                      setBankForm((current) => ({
                        ...current,
                        account_number: value,
                      }));
                    }}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-[#2563eb]"
                    placeholder="Enter account number"
                  />
                </div>

                {/* IFSC */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    IFSC Code
                  </label>

                  <input
                    type="text"
                    maxLength={11}
                    value={bankForm.ifsc_code}
                    onChange={(event) =>
                      setBankForm((current) => ({
                        ...current,
                        ifsc_code: event.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9]/g, "")
                          .slice(0, 11),
                      }))
                    }
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm uppercase outline-none transition focus:border-[#2563eb]"
                    placeholder="e.g. SBIN0001234"
                  />
                </div>

                {/* ERROR */}
                {saveError && (
                  <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                    {saveError}
                  </div>
                )}

                {/* ACTIONS */}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    disabled={isSaving}
                    className="rounded-full border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveBank}
                    disabled={isSaving}
                    className="rounded-full bg-[#2563eb] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminEmployeeDetailsPage;
