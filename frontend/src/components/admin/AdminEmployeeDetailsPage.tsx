import { useState } from "react";
import {
  ArrowLeft,
  ArrowRightLeft,
  BriefcaseBusiness,
  //Eye,
  //EyeOff,
  Landmark,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShieldAlert,
  TrendingUp,
  User,
  UserX,
} from "lucide-react";

import type { Department } from "../../types/department";
import type { Employee } from "../../types/employee";

interface AdminEmployeeDetailsPageProps {
  employee: Employee;
  departments: Department[];
  onBack: () => void;
  onEdit: (employee: Employee) => void;
  onDeactivate: (employee: Employee) => void;
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

function formatDate(value?: string): string {
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
  onBack,
  onEdit,
  onDeactivate,
}: AdminEmployeeDetailsPageProps) {
  const [historyTab, setHistoryTab] = useState<"promotion" | "transfer">(
    "promotion",
  );

  const [showBankDetails, setShowBankDetails] = useState(false);

  const departmentName =
    departments.find(
      (department) => department.id === employee.department_id,
    )?.name ?? "—";

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
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#dce8df] text-3xl font-semibold text-[#2563eb]">
            {initials}
          </div>

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
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#dce8df] text-[10px] font-semibold text-[#2563eb]">
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
              <h3 className="mb-5 flex items-center gap-2 text-lg font-semibold text-gray-800">
                <ShieldAlert
                  size={20}
                  strokeWidth={2}
                  className="text-gray-700"
                />
                Emergency Contact
              </h3>

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
                <p className="text-sm text-gray-500">
                  No emergency contact on file.
                </p>
              )}
            </div>
          </div>

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

              {employee.bank_information && (
                <button
                  type="button"
                  onClick={() => setShowBankDetails((current) => !current)}
                  className="text-sm font-medium text-[#2563eb] hover:underline"
                >
                  {showBankDetails ? "Hide Details" : "Show Details"}
                </button>
              )}
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

          {/* PROMOTION / TRANSFER HISTORY */}
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            {/* HISTORY TABS */}
            <div className="mb-5 flex gap-6 border-b border-gray-100">
              {/* PROMOTION TAB */}
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

              {/* TRANSFER TAB */}
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

            {/* HISTORY CONTENT */}
            {activeHistory.length === 0 ? (
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
  );
}

export default AdminEmployeeDetailsPage;



