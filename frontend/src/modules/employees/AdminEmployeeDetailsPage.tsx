import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRightLeft,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  Copy,
  FileText,
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

import type { Department } from "../departments/types";
import type { Employee } from "./types";
import type { Shift } from "../shifts/types";
import AdminEmployeeDocuments from "./AdminEmployeeDocuments";
import { PhotoViewerModal } from "../../components/ui/PhotoViewerModal";
import {
  formatDuration,
  formatShiftTime,
} from "../shifts/shiftService";
import {
  LEGACY_SALARY_STRUCTURE_LABELS,
  type SalaryStructure,
} from "../payroll/admin_salary_structure_service";
import {
  leaveService,
  type EmployeeLeaveBalance,
} from "../leaves/admin_leave_service";

const leaveBalanceStyles: Record<string, { icon: typeof Palmtree; iconBg: string; iconColor: string }> = {
  "Casual Leave": { icon: Palmtree, iconBg: "bg-teal-50", iconColor: "text-teal-600" },
  "Sick Leave": { icon: Palmtree, iconBg: "bg-blue-50", iconColor: "text-blue-600" },
  "Earned Leave": { icon: Gift, iconBg: "bg-orange-50", iconColor: "text-orange-500" },
  "Comp Off": { icon: Timer, iconBg: "bg-violet-50", iconColor: "text-violet-600" },
};

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
  const [activeTab, setActiveTab] = useState<
    "overview" | "documents" | "leave" | "compensation"
  >("overview");
  const [copiedField, setCopiedField] = useState<"email" | "phone" | null>(null);
  const [isPhotoOpen, setIsPhotoOpen] = useState(false);

  const [historyTab, setHistoryTab] = useState<
    "promotion" | "transfer" | "salary"
  >("salary");

  const [showBankDetails, setShowBankDetails] = useState(false);

  function handleCopy(field: "email" | "phone", value: string) {
    if (!value) return;
    void navigator.clipboard?.writeText(value);
    setCopiedField(field);
    window.setTimeout(() => {
      setCopiedField((current) => (current === field ? null : current));
    }, 1500);
  }

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

  const [emergencyForm, setEmergencyForm] = useState({
    name: employee.emergency_contact?.name ?? "",
    relationship: employee.emergency_contact?.relationship ?? "",
    phone: employee.emergency_contact?.phone ?? "",
    alternate_phone: employee.emergency_contact?.alternate_phone ?? "",
    address: employee.emergency_contact?.address ?? "",
  });

  const [leaveBalances, setLeaveBalances] = useState<EmployeeLeaveBalance[]>([]);
  const [leaveLoading, setLeaveLoading] = useState(true);

  useEffect(() => {
    const fetchLeaveBalance = async () => {
      try {
        setLeaveLoading(true);

        setLeaveBalances(
          await leaveService.employeeBalance(employee.employee_id),
        );
      } catch (error) {
        console.error("Failed to fetch leave balance:", error);
        setLeaveBalances([]);
      } finally {
        setLeaveLoading(false);
      }
    };

    fetchLeaveBalance();
  }, [employee.employee_id]);

  function openEmergencyEdit() {
    setSaveError(null);
    setEmergencyForm({
      name: employee.emergency_contact?.name ?? "",
      relationship: employee.emergency_contact?.relationship ?? "",
      phone: employee.emergency_contact?.phone ?? "",
      alternate_phone: employee.emergency_contact?.alternate_phone ?? "",
      address: employee.emergency_contact?.address ?? "",
    });
    setEditSection("emergency");
  }

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

  async function handleSaveEmergency() {
    if (!emergencyForm.name.trim()) {
      setSaveError("Contact name is required.");
      return;
    }

    if (!emergencyForm.relationship.trim()) {
      setSaveError("Relationship is required.");
      return;
    }

    if (!emergencyForm.phone.trim()) {
      setSaveError("Phone number is required.");
      return;
    }

    const cleanPhone = emergencyForm.phone.trim().replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      setSaveError("Phone number must be exactly 10 digits.");
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);

      await onUpdateEmployee(employee.id, {
        emergency_contact: {
          name: emergencyForm.name.trim(),
          relationship: emergencyForm.relationship.trim(),
          phone: cleanPhone,
          address: emergencyForm.address.trim(),
        },
      });

      setEditSection(null);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Failed to update emergency contact.",
      );
    } finally {
      setIsSaving(false);
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

  const profileTabs = [
    { id: "overview", label: "Overview", icon: User },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "leave", label: "Leave Balance", icon: CalendarDays },
    { id: "compensation", label: "Bank & Compensation", icon: Wallet },
  ] as const;

  return (
    <div className="px-1 sm:px-4 pb-10 pt-2">
      {/* TOP ACTION BAR */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-medium text-[#374151] transition hover:bg-[#F9FAFB] hover:text-[#111827]"
        >
          <ArrowLeft size={16} strokeWidth={2} />
          Back to Employees
        </button>

        <div className="flex items-center gap-2.5">
          {employee.status === "active" && (
            <button
              type="button"
              onClick={() => onDeactivate(employee)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#FECACA] bg-white px-3.5 py-2 text-sm font-medium text-[#B91C1C] transition hover:bg-[#FEF2F2]"
            >
              <UserX size={16} strokeWidth={2} />
              Deactivate
            </button>
          )}

          <button
            type="button"
            onClick={() => onEdit(employee)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1D4ED8]"
          >
            <Pencil size={15} strokeWidth={2} />
            Edit Profile
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[290px_1fr] lg:items-stretch">
        {/* LEFT COLUMN (Profile Card - height driven by right column on desktop) */}
        <div className="relative">
          <div className="flex flex-col gap-4 rounded-xl border border-[#E5E7EB] bg-white p-5 lg:absolute lg:inset-0 lg:overflow-y-auto">
            <div className="space-y-4">
              <div className="flex flex-col items-start">
                <button
                  type="button"
                  onClick={() => setIsPhotoOpen(true)}
                  aria-label={`View profile photo of ${employee.first_name} ${employee.last_name}`}
                  className="group relative rounded-full cursor-pointer transition-all duration-150 hover:brightness-95 hover:ring-[3px] hover:ring-[rgba(37,99,235,0.3)] focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[#2563EB]"
                >
                  {employee.avatar_url ? (
                    <img
                      src={employee.avatar_url}
                      alt={`${employee.first_name} ${employee.last_name}`}
                      className="h-[72px] w-[72px] rounded-full object-cover ring-2 ring-[#E5E7EB]"
                    />
                  ) : (
                    <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#2563EB] text-2xl font-semibold text-white">
                      {initials}
                    </div>
                  )}
                </button>

                <h2 className="mt-3 text-lg font-semibold text-[#111827]">
                  {employee.first_name} {employee.last_name}
                </h2>

                <p className="mt-0.5 text-sm text-[#6B7280]">
                  {employee.designation || "—"}
                </p>

                <span
                  className={`mt-2.5 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(
                    employee.status,
                  )}`}
                >
                  {statusLabel(employee.status)} • ID: {employee.employee_id}
                </span>
              </div>

              {/* INTERACTIVE CONTACT INFORMATION */}
              <div className="space-y-3 border-t border-[#F3F4F6] pt-4 text-sm text-[#4B5563]">
                <div className="flex items-center justify-between gap-2">
                  <a
                    href={`mailto:${employee.email}`}
                    className="flex min-w-0 items-center gap-2.5 hover:text-[#2563EB] transition-colors"
                    title="Send email"
                  >
                    <Mail size={15} strokeWidth={2} className="shrink-0 text-[#6B7280]" />
                    <span className="truncate">{employee.email}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => handleCopy("email", employee.email)}
                    aria-label="Copy email address"
                    title="Copy email"
                    className="shrink-0 rounded p-1 text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#111827]"
                  >
                    {copiedField === "email" ? (
                      <Check size={14} className="text-[#16A34A]" />
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                </div>

                {employee.phone && (
                  <div className="flex items-center justify-between gap-2">
                    <a
                      href={`tel:${employee.phone}`}
                      className="flex min-w-0 items-center gap-2.5 hover:text-[#2563EB] transition-colors"
                      title="Call phone"
                    >
                      <Phone size={15} strokeWidth={2} className="shrink-0 text-[#6B7280]" />
                      <span className="truncate">{employee.phone}</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopy("phone", employee.phone)}
                      aria-label="Copy phone number"
                      title="Copy phone"
                      className="shrink-0 rounded p-1 text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#111827]"
                    >
                      {copiedField === "phone" ? (
                        <Check size={14} className="text-[#16A34A]" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                )}

                {employee.work_location && (
                  <p className="flex items-center gap-2.5">
                    <MapPin size={15} strokeWidth={2} className="shrink-0 text-[#6B7280]" />
                    <span className="truncate">{employee.work_location}</span>
                  </p>
                )}
              </div>

              {/* QUICK INFO */}
              <div className="space-y-2 border-t border-[#F3F4F6] pt-4 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#6B7280]">Joined</span>
                  <span className="font-medium text-[#111827]">{formatDate(employee.joining_date)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#6B7280]">Manager</span>
                  <span className="font-medium text-[#111827] truncate">
                    {employee.reporting_manager || "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* QUICK ACTIONS */}
            <div className="mt-auto grid grid-cols-2 gap-2 border-t border-[#F3F4F6] pt-4">
              <a
                href={`mailto:${employee.email}`}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-xs font-medium text-[#374151] transition hover:border-[#2563EB] hover:bg-[#EFF6FF] hover:text-[#2563EB]"
              >
                <Mail size={14} className="shrink-0" />
                <span>Send Email</span>
              </a>
              {employee.phone ? (
                <a
                  href={`tel:${employee.phone}`}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-xs font-medium text-[#374151] transition hover:border-[#2563EB] hover:bg-[#EFF6FF] hover:text-[#2563EB]"
                >
                  <Phone size={14} className="shrink-0" />
                  <span>Call</span>
                </a>
              ) : (
                <span className="inline-flex h-9 cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-2.5 text-xs font-medium text-[#9CA3AF]">
                  <Phone size={14} className="shrink-0" />
                  <span>Call</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="min-w-0 space-y-5">
          {/* SECTION TABS */}
          <div
            role="tablist"
            aria-label="Employee profile sections"
            className="flex items-center gap-1 overflow-x-auto overflow-y-hidden scrollbar-hidden max-w-full rounded-xl border border-[#E5E7EB] bg-white p-1.5"
          >
            {profileTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] whitespace-nowrap transition-all duration-150 cursor-pointer ${isActive
                    ? "bg-[#EFF6FF] font-semibold text-[#2563EB]"
                    : "font-medium text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#111827]"
                    }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="grid">
            <div
              aria-hidden={activeTab !== "overview"}
              className={`col-start-1 row-start-1 space-y-5 ${
                activeTab === "overview" ? "visible" : "invisible pointer-events-none"
              }`}
            >
              {/* EMPLOYMENT DETAILS */}
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
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
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {/* PERSONAL INFORMATION */}
                <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
                  <h3 className="mb-5 flex items-center gap-2 text-lg font-semibold text-gray-800">
                    <User
                      size={20}
                      strokeWidth={2}
                      className="text-gray-700"
                    />
                    Personal Information
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
                <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
                  <div className="mb-5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldAlert
                        size={20}
                        strokeWidth={2}
                        className="text-gray-700"
                      />

                      <h3 className="text-lg font-semibold text-gray-800">
                        Emergency Contact
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={openEmergencyEdit}
                      className="flex items-center gap-1.5 text-sm font-medium text-[#2563eb] hover:underline"
                    >
                      <Pencil size={15} strokeWidth={2} />
                      {employee.emergency_contact ? "Edit" : "Add"}
                    </button>
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
            </div>

          <div
            aria-hidden={activeTab !== "documents"}
            className={`col-start-1 row-start-1 ${
              activeTab === "documents" ? "visible" : "invisible pointer-events-none"
            }`}
          >
            <AdminEmployeeDocuments employeeId={employee.employee_id} />
          </div>

          {/* LEAVE BALANCE */}
          <div
            aria-hidden={activeTab !== "leave"}
            className={`col-start-1 row-start-1 ${
              activeTab === "leave" ? "visible" : "invisible pointer-events-none"
            }`}
          >
            <div className="h-full rounded-xl border border-[#E5E7EB] bg-white p-6">
              <h3 className="mb-5 font-semibold text-gray-900">
                Leave Balance
              </h3>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
                {leaveBalances.map((balance) => {
                  const style = leaveBalanceStyles[balance.leave_type] ?? {
                    icon: Gift,
                    iconBg: "bg-slate-50",
                    iconColor: "text-slate-600",
                  };

                  const Icon = style.icon;
                  const percent =
                    balance.allocated > 0
                      ? Math.min(100, Math.round((balance.used / balance.allocated) * 100))
                      : 0;

                  return (
                    <div
                      key={balance.leave_type}
                      className="rounded-xl border border-[#E5E7EB] p-4 transition hover:border-[#D1D5DB]"
                    >
                      <div
                        className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg ${style.iconBg}`}
                      >
                        <Icon
                          className={`h-4 w-4 ${style.iconColor}`}
                        />
                      </div>

                      <p className="text-xs font-medium text-gray-500">
                        {balance.leave_type}
                      </p>

                      {leaveLoading ? (
                        <p className="mt-1 text-sm text-gray-400">
                          Loading...
                        </p>
                      ) : (
                        <>
                          <p className="mt-1 text-xl font-bold text-gray-900 tabular-nums">
                            {balance.used}

                            <span className="text-sm font-medium text-gray-400">
                              {" "}
                              / {balance.allocated} Days
                            </span>
                          </p>

                          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                            <div
                              className="h-full rounded-full bg-[#2563EB] transition-all duration-500"
                              style={{ width: `${percent}%` }}
                            />
                          </div>

                          <p className="mt-2 text-xs text-gray-500">
                            {balance.available} Available
                          </p>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div
            aria-hidden={activeTab !== "compensation"}
            className={`col-start-1 row-start-1 flex flex-col gap-5 ${
              activeTab === "compensation" ? "visible" : "invisible pointer-events-none"
            }`}
          >
            {/* BANK INFORMATION */}
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
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

          {/* PROMOTION / TRANSFER / SALARY */}
            <div className="flex-1 rounded-xl border border-[#E5E7EB] bg-white p-6">
              {/* HISTORY TABS */}
              <div className="mb-5 flex gap-6 overflow-x-auto overflow-y-hidden scrollbar-hidden max-w-full border-b border-gray-100">
                {/* SALARY TAB - FIRST */}
                <button
                  type="button"
                  onClick={() => setHistoryTab("salary")}
                  className={`flex items-center gap-2 pb-3 text-sm font-medium ${historyTab === "salary"
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
                  className={`flex items-center gap-2 pb-3 text-sm font-medium ${historyTab === "promotion"
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
                  className={`flex items-center gap-2 pb-3 text-sm font-medium ${historyTab === "transfer"
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
        </div>
      </div>

      <PhotoViewerModal
        isOpen={isPhotoOpen}
        onClose={() => setIsPhotoOpen(false)}
        imageUrl={employee.avatar_url}
        name={`${employee.first_name} ${employee.last_name}`}
        designation={employee.designation}
      />

      {/* EDIT MODAL */}
      {editSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded bg-white p-6 shadow-xl">
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
                className="flex h-9 w-9 items-center justify-center rounded text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* EMERGENCY CONTACT FORM */}
            {editSection === "emergency" ? (
              <div className="mt-6 space-y-4">
                {/* CONTACT NAME */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Contact Name <span className="text-red-500">*</span>
                  </label>

                  <input
                    type="text"
                    value={emergencyForm.name}
                    onChange={(event) =>
                      setEmergencyForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    className="w-full rounded border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-[#2563eb]"
                    placeholder="Enter contact name"
                  />
                </div>

                {/* RELATIONSHIP */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Relationship <span className="text-red-500">*</span>
                  </label>

                  <input
                    type="text"
                    value={emergencyForm.relationship}
                    onChange={(event) =>
                      setEmergencyForm((current) => ({
                        ...current,
                        relationship: event.target.value,
                      }))
                    }
                    className="w-full rounded border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-[#2563eb]"
                    placeholder="e.g. Spouse, Father, Mother, Sibling"
                  />
                </div>

                {/* PHONE NUMBER */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Phone Number <span className="text-red-500">*</span>
                  </label>

                  <input
                    type="tel"
                    maxLength={10}
                    value={emergencyForm.phone}
                    onChange={(event) =>
                      setEmergencyForm((current) => ({
                        ...current,
                        phone: event.target.value.replace(/\D/g, "").slice(0, 10),
                      }))
                    }
                    className="w-full rounded border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-[#2563eb]"
                    placeholder="10-digit phone number"
                  />
                </div>

                {/* ALTERNATE PHONE */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Alternate Phone
                  </label>

                  <input
                    type="tel"
                    maxLength={10}
                    value={emergencyForm.alternate_phone}
                    onChange={(event) =>
                      setEmergencyForm((current) => ({
                        ...current,
                        alternate_phone: event.target.value.replace(/\D/g, "").slice(0, 10),
                      }))
                    }
                    className="w-full rounded border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-[#2563eb]"
                    placeholder="Optional alternate phone number"
                  />
                </div>

                {/* ADDRESS */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Address
                  </label>

                  <textarea
                    rows={3}
                    value={emergencyForm.address}
                    onChange={(event) =>
                      setEmergencyForm((current) => ({
                        ...current,
                        address: event.target.value,
                      }))
                    }
                    className="w-full resize-none rounded border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-[#2563eb]"
                    placeholder="Emergency contact address"
                  />
                </div>

                {/* ERROR */}
                {saveError && (
                  <div className="rounded bg-red-50 px-4 py-3 text-sm text-red-600">
                    {saveError}
                  </div>
                )}

                {/* ACTIONS */}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    disabled={isSaving}
                    className="rounded border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveEmergency}
                    disabled={isSaving}
                    className="rounded bg-[#2563eb] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            ) : (
              /* BANK INFORMATION FORM */
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
                    className="w-full rounded border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-[#2563eb]"
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
                    className="w-full rounded border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-[#2563eb]"
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
                    className="w-full rounded border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-[#2563eb]"
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
                    className="w-full rounded border border-gray-200 px-4 py-2.5 text-sm uppercase outline-none transition focus:border-[#2563eb]"
                    placeholder="e.g. SBIN0001234"
                  />
                </div>

                {/* ERROR */}
                {saveError && (
                  <div className="rounded bg-red-50 px-4 py-3 text-sm text-red-600">
                    {saveError}
                  </div>
                )}

                {/* ACTIONS */}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    disabled={isSaving}
                    className="rounded border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveBank}
                    disabled={isSaving}
                    className="rounded bg-[#2563eb] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminEmployeeDetailsPage;
