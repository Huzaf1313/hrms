import { useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";

import type { Department } from "../../types/department";
import type { Employee, EmployeeCreate } from "../../types/employee";

interface AdminEmployeeFormProps {
  departments: Department[];
  initialEmployee?: Employee;
  isSubmitting: boolean;
  errorMessage: string | null;
  onSubmit: (data: EmployeeCreate) => void;
  onCancel: () => void;
}

const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "intern", label: "Intern" },
] as const;

function toFormState(employee?: Employee): EmployeeCreate {
  if (!employee) {
    return {
      employee_id: "",
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      password: "Temp@1234",
      date_of_birth: "",
      gender: "",
      address: "",
      department_id: "",
      designation: "",
      joining_date: "",
      employment_type: "full_time",
      work_location: "",
      reporting_manager: "",
    };
  }

  return {
    employee_id: employee.employee_id,
    first_name: employee.first_name,
    last_name: employee.last_name,
    email: employee.email,
    phone: employee.phone,
    password: "",
    date_of_birth: employee.date_of_birth ?? "",
    gender: employee.gender ?? "",
    address: employee.address ?? "",
    department_id: employee.department_id,
    designation: employee.designation,
    joining_date: employee.joining_date,
    employment_type: employee.employment_type,
    work_location: employee.work_location ?? "",
    reporting_manager: employee.reporting_manager ?? "",
  };
}

function AdminEmployeeForm({
  departments,
  initialEmployee,
  isSubmitting,
  errorMessage,
  onSubmit,
  onCancel,
}: AdminEmployeeFormProps) {
  const [form, setForm] = useState<EmployeeCreate>(() =>
    toFormState(initialEmployee),
  );

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [lastInitialEmployee, setLastInitialEmployee] = useState(
    initialEmployee,
  );

  if (lastInitialEmployee !== initialEmployee) {
    setLastInitialEmployee(initialEmployee);
    setForm(toFormState(initialEmployee));
    setPhotoPreview(null);
  }

  const isEditMode = Boolean(initialEmployee);

  function updateField<K extends keyof EmployeeCreate>(
    key: K,
    value: EmployeeCreate[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handlePhotoChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const previewUrl = URL.createObjectURL(file);

    setPhotoPreview((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return previewUrl;
    });
  }

  function removePhoto() {
    setPhotoPreview((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return null;
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: EmployeeCreate = {
      ...form,
      date_of_birth: form.date_of_birth || undefined,
      gender: form.gender || undefined,
      address: form.address || undefined,
      work_location: form.work_location || undefined,
      reporting_manager: form.reporting_manager || undefined,
    };

    if (isEditMode && !form.password) {
      payload.password = undefined;
    }

    onSubmit(payload);
  }

  const initials =
    `${form.first_name?.charAt(0) ?? ""}${form.last_name?.charAt(0) ?? ""}`
      .toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6">
      <div className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl">

        {/* HEADER */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-8 py-6">
          <div>
            <h2 className="text-3xl font-semibold text-[#17375e]">
              {isEditMode ? "Edit Employee" : "Add Employee"}
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {isEditMode
                ? "Update employee information."
                : "Add a new employee to your organization."}
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center rounded-full text-2xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
          >
            ×
          </button>
        </div>

        {/* FORM */}
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-5 px-8 pb-8 pt-6 md:grid-cols-2"
        >

          {/* PHOTO */}
          <div className="col-span-1 flex items-center gap-5 md:col-span-2">
            <div className="relative">

              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Employee preview"
                  className="h-24 w-24 rounded-full object-cover ring-4 ring-gray-100"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#dce8df] text-2xl font-semibold text-[#2563eb] ring-4 ring-gray-100">
                  {initials || "?"}
                </div>
              )}

              {photoPreview && (
                <button
                  type="button"
                  onClick={removePhoto}
                  aria-label="Remove photo"
                  className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-lg text-white shadow hover:bg-red-600"
                >
                  ×
                </button>
              )}
            </div>

            <div>
              <h3 className="font-semibold text-gray-800">
                Employee Photo
              </h3>

              <p className="mb-3 text-sm text-gray-500">
                Upload a profile photo or use the initials avatar.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={handlePhotoChange}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-full border border-[#2563eb] px-4 py-2 text-sm font-medium text-[#2563eb] transition hover:bg-[#2563eb] hover:text-white"
              >
                {photoPreview ? "Change Photo" : "Upload Photo"}
              </button>
            </div>
          </div>

          {/* EMPLOYEE ID */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
              Employee ID
            </label>

            <input
              required
              disabled={isEditMode}
              value={form.employee_id}
              onChange={(event) =>
                updateField("employee_id", event.target.value)
              }
              placeholder="EMP001"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10 disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>

          {/* EMPLOYMENT TYPE */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
              Employment Type
            </label>

            <select
              value={form.employment_type}
              onChange={(event) => {
                updateField(
                  "employment_type",
                  event.target.value as EmployeeCreate["employment_type"],
                );
              }}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10"
            >
              {EMPLOYMENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* FIRST NAME */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
              First Name
            </label>

            <input
              required
              value={form.first_name}
              onChange={(event) =>
                updateField("first_name", event.target.value)
              }
              placeholder="First name"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10"
            />
          </div>

          {/* LAST NAME */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
              Last Name
            </label>

            <input
              required
              value={form.last_name}
              onChange={(event) =>
                updateField("last_name", event.target.value)
              }
              placeholder="Last name"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10"
            />
          </div>

          {/* EMAIL */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
              Email
            </label>

            <input
              required
              type="email"
              value={form.email}
              onChange={(event) =>
                updateField("email", event.target.value)
              }
              placeholder="employee@company.com"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10"
            />
          </div>

          {/* PHONE */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
              Phone
            </label>

            <input
              required
              minLength={10}
              value={form.phone}
              onChange={(event) =>
                updateField("phone", event.target.value)
              }
              placeholder="Phone number"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10"
            />
          </div>

          {/* DEPARTMENT */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
              Department
            </label>

            <select
              required
              value={form.department_id}
              onChange={(event) =>
                updateField("department_id", event.target.value)
              }
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10"
            >
              <option value="">Select department</option>

              {departments.map((department) => (
                <option
                  key={department.id}
                  value={department.id}
                >
                  {department.name}
                </option>
              ))}
            </select>
          </div>

          {/* DESIGNATION */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
              Designation
            </label>

            <input
              required
              value={form.designation}
              onChange={(event) =>
                updateField("designation", event.target.value)
              }
              placeholder="e.g. Software Engineer"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10"
            />
          </div>

          {/* JOINING DATE */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
              Joining Date
            </label>

            <input
              required
              type="date"
              value={form.joining_date}
              onChange={(event) =>
                updateField("joining_date", event.target.value)
              }
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10"
            />
          </div>

          {/* DATE OF BIRTH */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
              Date of Birth
            </label>

            <input
              type="date"
              value={form.date_of_birth ?? ""}
              onChange={(event) =>
                updateField("date_of_birth", event.target.value)
              }
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10"
            />
          </div>

          {/* GENDER */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
              Gender
            </label>

            <select
              value={form.gender ?? ""}
              onChange={(event) =>
                updateField("gender", event.target.value)
              }
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10"
            >
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* WORK LOCATION */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
              Work Location
            </label>

            <input
              value={form.work_location ?? ""}
              onChange={(event) =>
                updateField("work_location", event.target.value)
              }
              placeholder="e.g. Mumbai Office"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10"
            />
          </div>

          {/* REPORTING MANAGER */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
              Reporting Manager
            </label>

            <input
              value={form.reporting_manager ?? ""}
              onChange={(event) =>
                updateField("reporting_manager", event.target.value)
              }
              placeholder="Manager name"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10"
            />
          </div>

          {/* PASSWORD */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
              Temporary Password
            </label>

            <div className="relative">
              <input
                required={!isEditMode}
                type={isPasswordVisible ? "text" : "password"}
                value={form.password ?? ""}
                onChange={(event) =>
                  updateField("password", event.target.value)
                }
                placeholder={isEditMode ? "Leave blank to keep current" : "Temp@1234"}
                minLength={8}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-12 text-sm outline-none transition focus:border-[#456b54] focus:ring-2 focus:ring-[#456b54]/10"
              />
              <button
                type="button"
                onClick={() => setIsPasswordVisible((visible) => !visible)}
                aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                title={isPasswordVisible ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-[#456b54]"
              >
                {isPasswordVisible ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* ADDRESS */}
          <div className="col-span-1 md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
              Address
            </label>

            <textarea
              value={form.address ?? ""}
              onChange={(event) =>
                updateField("address", event.target.value)
              }
              rows={3}
              placeholder="Employee address"
              className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10"
            />
          </div>

          {/* ERROR */}
          {errorMessage && (
            <div className="col-span-1 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 md:col-span-2">
              {errorMessage}
            </div>
          )}

          {/* BUTTONS */}
          <div className="col-span-1 mt-2 flex justify-end gap-3 border-t border-gray-100 pt-5 md:col-span-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="rounded-full border border-gray-200 px-6 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-[#2563eb] px-7 py-3 text-sm font-semibold text-white transition hover:bg-[#385b45] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting
                ? "Saving…"
                : isEditMode
                  ? "Save Changes"
                  : "Add Employee"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminEmployeeForm;



