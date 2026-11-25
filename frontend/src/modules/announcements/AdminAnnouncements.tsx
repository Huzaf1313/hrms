import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Megaphone,
  Plus,
  Search,
  RotateCcw,
  Calendar,
  User,
  ArrowRight,
  ArrowLeft,
  Pin,
  Clock,
  FileText,
  Shield,
  PartyPopper,
  Wrench,
  Eye,
  Paperclip,
  Download,
  UploadCloud,
  Send,
  Pencil,
  Trash2,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link,
  X,
  Building2,
  Users,
  Check,
  ChevronDown,
  UserPlus,
  Loader2,
  AlertCircle,
  Lightbulb,
} from "lucide-react";
import { api, ApiError } from "../../services/api";
import NoticePopup from "../../components/ui/NoticePopup";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Select } from "../../components/ui/Select";
import { Skeleton } from "../../components/ui/Skeleton";
import { Tabs as SharedTabs } from "../../components/ui/Tabs";
import { departmentService } from "../departments/departmentService";
import { employeeService } from "../employees/employeeService";
import type { Department } from "../departments/types";
import type { Employee } from "../employees/types";


// ---- Types ------------------------------------------------------------------

type Category =
  | "Company News"
  | "HR & Policy"
  | "Events"
  | "IT & System";

type Status = "NEW" | "IMPORTANT" | "UPCOMING" | "INFO";

type Priority = "Normal" | "Important" | "Urgent";

type Audience = "All Employees" | "Department-wise" | "Custom";

interface Announcement {
  id: string;
  category: Category;
  status: Status;
  priority: Priority;
  title: string;
  description: string;
  date: string;
  author: string;
  publishDate: string;
  expiryDate: string | null;
  audience: Audience;
  pinned: boolean;
  createdAt: string;
  targetDepartments: string[];
  targetEmployees: string[];
  attachment?: {
    filename: string;
    url: string;
    content_type?: string;
    size?: number;
  } | null;
}


const tabs: ("All" | Category)[] = [
  "All",
  "Company News",
  "HR & Policy",
  "Events",
  "IT & System",
];

// ---- Quick filter options -----------------------------------------------------

type QuickCategory = "All Categories" | Category;

type DateRangeKey = "Last 7 Days" | "Last 30 Days" | "Last 90 Days" | "All Time";

const dateRangeDays: Record<DateRangeKey, number | null> = {
  "Last 7 Days": 7,
  "Last 30 Days": 30,
  "Last 90 Days": 90,
  "All Time": null,
};

// ---- Style helpers -----------------------------------------------------------

const categoryStyles: Record<
  Category,
  { badge: string; icon: ReactNode; iconBg: string }
> = {
  "Company News": {
    badge: "bg-[#EFF6FF] text-[#1D4ED8]",
    icon: <FileText className="h-5 w-5 text-blue-600" />,
    iconBg: "bg-[#DBEAFE]",
  },

  "HR & Policy": {
    badge: "bg-[#F5F3FF] text-[#6D28D9]",
    icon: <Shield className="h-5 w-5 text-purple-600" />,
    iconBg: "bg-[#EDE9FE]",
  },

  Events: {
    badge: "bg-[#ECFDF5] text-[#047857]",
    icon: <PartyPopper className="h-5 w-5 text-green-600" />,
    iconBg: "bg-[#D1FAE5]",
  },

  "IT & System": {
    badge: "bg-[#F3F4F6] text-[#4B5563]",
    icon: <Wrench className="h-5 w-5 text-[#4B5563]" />,
    iconBg: "bg-[#E5E7EB]",
  },
};

const dotStyles: Record<Category, string> = {
  "Company News": "bg-[#3B82F6]",
  "HR & Policy": "bg-[#8B5CF6]",
  Events: "bg-[#10B981]",
  "IT & System": "bg-[#6B7280]",
};

// ---- Date helpers ------------------------------------------------------------

function formatDateTime(value?: string | null): string {
  if (!value) return "—";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// ---- Draft persistence ------------------------------------------------------

const DRAFT_STORAGE_KEY = "hrms_announcement_draft";

interface AnnouncementDraft {
  title: string;
  category: Category | "";
  priority: Priority;
  publishDate: string;
  expiryDate: string;
  audience: Audience;
  description: string;
  isPinned: boolean;
  selectedDepartments: string[];
  selectedEmployees: string[];
  isAddEmployeeMode?: boolean;
}

function readDraft(): AnnouncementDraft | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_STORAGE_KEY);

    return raw ? (JSON.parse(raw) as AnnouncementDraft) : null;
  } catch {
    return null;
  }
}

function writeDraft(draft: AnnouncementDraft) {
  try {
    window.sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Storage unavailable (private mode / quota) - the draft simply will not
    // survive navigation. Publishing still works as normal.
  }
}

function clearDraft() {
  try {
    window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Ignore - nothing to clean up.
  }
}

// A draft only exists in the sense that it is worth resuming once the admin has
// actually typed something. Merely having opened the form writes a draft, so
// trusting "a draft is present" would force the create form open on every later
// visit and bury the announcement the user actually came to read.
function hasDraftContent(draft: AnnouncementDraft | null): boolean {
  if (!draft) return false;

  return draft.title.trim().length > 0 || draft.description.trim().length > 0;
}

function formatDateOnly(value?: string | null): string {
  if (!value) return "—";

  const parsed = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function formatRelativeDate(value?: string | null): string {
  if (!value) return "—";
  const timestamp = Date.parse(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(timestamp)) return "—";

  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 60) return `${Math.max(1, minutes)} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/** Newest-first sort key. Falls back to createdAt, then to 0, so records
 * with missing or malformed dates sort last instead of dropping out. */
function announcementTimestamp(announcement: Announcement): number {
  const published = Date.parse(announcement.publishDate);

  if (!Number.isNaN(published)) {
    return published;
  }

  const created = Date.parse(announcement.createdAt);

  return Number.isNaN(created) ? 0 : created;
}

// ---- Multi-select dropdown ---------------------------------------------------

interface MultiSelectOption {
  value: string;
  label: string;
  hint?: string;
}

interface MultiSelectProps {
  label: string;
  placeholder: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  isLoading?: boolean;
  emptyText?: string;
  onAddNew?: () => void;
  addNewLabel?: string;
}

function MultiSelect({
  label,
  placeholder,
  options,
  selected,
  onChange,
  isLoading = false,
  emptyText = "No options available",
  onAddNew,
  addNewLabel,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value],
    );
  };

  const selectedLabels = options
    .filter((option) => selected.includes(option.value))
    .map((option) => option.label);

  return (
    <div className="mb-5">
      <label className="mb-2 block text-sm font-semibold text-slate-800">
        {label}
      </label>

      <div className="relative">
        {isOpen && (
          <button
            type="button"
            aria-label="Close dropdown"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setIsOpen(false)}
          />
        )}

        <button
          type="button"
          onClick={() => setIsOpen((previous) => !previous)}
          className="relative z-20 flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10"
          aria-expanded={isOpen}
        >
          <span
            className={
              selectedLabels.length > 0 ? "text-slate-700" : "text-slate-400"
            }
          >
            {selectedLabels.length === 0
              ? placeholder
              : selectedLabels.length <= 2
                ? selectedLabels.join(", ")
                : `${selectedLabels.length} selected`}
          </span>

          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-400 transition ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isOpen && (
          <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {isLoading ? (
              <p className="flex items-center gap-2 px-4 py-3 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </p>
            ) : options.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-400">{emptyText}</p>
            ) : (
              options.map((option) => {
                const isSelected = selected.includes(option.value);

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggle(option.value)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        isSelected
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-300"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{option.label}</span>

                      {option.hint && (
                        <span className="block truncate text-xs text-slate-400">
                          {option.hint}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })
            )}

            {onAddNew && (
              <div className="mt-1 border-t border-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onAddNew();
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
                >
                  <Plus className="h-4 w-4" />
                  {addNewLabel ?? "Add new"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedLabels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {options
            .filter((option) => selected.includes(option.value))
            .map((option) => (
              <span
                key={option.value}
                className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
              >
                {option.label}
                <button
                  type="button"
                  onClick={() => toggle(option.value)}
                  className="text-blue-400 transition hover:text-blue-700"
                  aria-label={`Remove ${option.label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

// ---- Confirmation dialog ---------------------------------------------------

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  isWorking,
  onConfirm,
  onCancel,
  tone = "primary",
  icon,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  isWorking: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  tone?: "primary" | "danger";
  icon?: ReactNode;
}) {
  const isDanger = tone === "danger";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-6"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className={icon ? "flex items-start gap-3" : undefined}>
          {icon && (
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                isDanger ? "bg-red-100" : "bg-blue-50"
              }`}
            >
              {icon}
            </span>
          )}

          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{message}</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isWorking}
            className="rounded border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isWorking}
            className={`inline-flex items-center gap-1.5 rounded px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
              isDanger
                ? "bg-red-600 hover:bg-red-700"
                : "bg-[#2563eb] hover:bg-[#1d4ed8]"
            }`}
          >
            {isWorking && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Page --------------------------------------------------------------------

interface AdminAnnouncementsProps {
  onCreateEmployee?: () => void;
  /** Opens straight into the create form, used by the dashboard shortcut. */
  autoOpenCreateForm?: boolean;
}

export default function AdminAnnouncements({
  onCreateEmployee,
  autoOpenCreateForm = false,
}: AdminAnnouncementsProps = {}) {
  // List state
  const [activeTab, setActiveTab] =
    useState<(typeof tabs)[number]>("All");


  const [search, setSearch] = useState("");

  const [quickCategory, setQuickCategory] = useState<QuickCategory>("All Categories");
  const [quickDateRange, setQuickDateRange] = useState<DateRangeKey>("All Time");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const [announcementList, setAnnouncementList] = useState<Announcement[]>([]);
  const [selectedAnnouncement, setSelectedAnnouncement] =
    useState<Announcement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // Restore any in-progress draft. Required because navigating to the
  // Employees page unmounts this component. Read once, then used as the
  // initial value for each piece of form state.
  const [restoredDraft] = useState<AnnouncementDraft | null>(readDraft);

  // Create form state
  // The page opens on the list, unless the dashboard asked for the form
  // directly. An unfinished announcement is offered as a banner instead of
  // force-opening the form over the top of it.
  const [showCreateForm, setShowCreateForm] = useState(autoOpenCreateForm);
  const [restoredDraftAvailable, setRestoredDraftAvailable] = useState(
    () => hasDraftContent(restoredDraft) && !autoOpenCreateForm,
  );
  const [editingAnnouncement, setEditingAnnouncement] =
    useState<Announcement | null>(null);

  const [title, setTitle] = useState(restoredDraft?.title ?? "");
  const [category, setCategory] = useState<Category | "">(
    restoredDraft?.category ?? "",
  );
  const [priority, setPriority] = useState<Priority>(
    restoredDraft?.priority ?? "Important",
  );

  const [publishDate, setPublishDate] = useState(
    restoredDraft?.publishDate ?? new Date().toISOString().split("T")[0],
  );

  const [expiryDate, setExpiryDate] = useState(restoredDraft?.expiryDate ?? "");

  const [audience, setAudience] = useState<Audience>(
    restoredDraft?.audience ?? "All Employees",
  );

  const [description, setDescription] = useState(
    restoredDraft?.description ?? "",
  );

  const [attachment, setAttachment] = useState<File | null>(null);

  const [isPinned, setIsPinned] = useState(restoredDraft?.isPinned ?? true);

  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(
    restoredDraft?.selectedDepartments ?? [],
  );
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>(
    restoredDraft?.selectedEmployees ?? [],
  );

  // Audience target options
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isAddingDepartment, setIsAddingDepartment] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [isCreatingDepartment, setIsCreatingDepartment] = useState(false);
  const [isAddEmployeeMode, setIsAddEmployeeMode] = useState(
    restoredDraft?.isAddEmployeeMode ?? false,
  );

  // Confirmation dialogs, replacing browser alert()/confirm() popups.
  const [pendingDelete, setPendingDelete] = useState<Announcement | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmingPublish, setIsConfirmingPublish] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");


  const mapAnnouncement = (item: {
    id: string;
    category: Category;
    priority: Priority;
    title: string;
    description: string;
    publish_date: string;
    expiry_date: string | null;
    audience: Audience;
    pinned: boolean;
    author_name: string;
    created_at: string;
    target_departments?: string[] | null;
    target_employees?: string[] | null;
    attachment?: Announcement["attachment"];
  }): Announcement => ({
    id: item.id,
    category: item.category,
    priority: item.priority,
    status:
      item.priority === "Normal"
        ? "NEW"
        : item.priority === "Urgent" || item.priority === "Important"
          ? "IMPORTANT"
          : "INFO",
    title: item.title,
    description: item.description,
    date: new Date(`${item.publish_date}T00:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    }),
    publishDate: item.publish_date,
    expiryDate: item.expiry_date,
    audience: item.audience,
    pinned: item.pinned,
    author: item.author_name || "HR Team",
    createdAt: item.created_at,
    targetDepartments: item.target_departments ?? [],
    targetEmployees: item.target_employees ?? [],
    attachment: item.attachment,
  });

  // ---- Persist draft --------------------------------------------------------

  // Must be defined before the "add new employee" handler below, which
  // persists synchronously before navigating away.
  const currentDraft: AnnouncementDraft = {
    title,
    category,
    priority,
    publishDate,
    expiryDate,
    audience,
    description,
    isPinned,
    selectedDepartments,
    selectedEmployees,
    isAddEmployeeMode,
  };

  useEffect(() => {
    // Edits are deliberately not persisted: this key is the "unfinished new
    // announcement" slot, and restoring an edited announcement into an empty
    // create form would publish it as a duplicate.
    if (!showCreateForm || editingAnnouncement) return;

    writeDraft(currentDraft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCreateForm, editingAnnouncement, ...Object.values(currentDraft)]);

  // ---- Label helpers ------------------------------------------------------

  const departmentNameById = (id: string) =>
    departments.find((department) => department.id === id)?.name ?? "Unknown";

  const employeeNameById = (id: string) => {
    const employee = employees.find((item) => item.id === id);

    if (!employee) return "Unknown";

    const fullName = `${employee.first_name} ${employee.last_name}`.trim();

    return fullName || employee.email;
  };

  // Resolved audience, so an admin can see exactly who receives the post.
  const audienceNames = (a: Announcement): string[] => {
    if (a.audience === "All Employees") return [];

    if (a.audience === "Department-wise") {
      return a.targetDepartments.map(departmentNameById);
    }

    return a.targetEmployees.map(employeeNameById);
  };

  const audienceLabel = (a: Announcement) => {
    if (a.audience === "All Employees") return "Everyone";

    const names = audienceNames(a);

    if (names.length === 0) return "No recipients selected";

    return `${names.length} ${a.audience === "Department-wise" ? "department" : "employee"}${names.length === 1 ? "" : "s"}`;
  };

  const audienceTooltip = (a: Announcement) => {
    if (a.audience === "All Employees") {
      return "Visible to every employee";
    }

    const names = audienceNames(a);

    if (names.length === 0) {
      return "No recipients are selected, so nobody will see this";
    }

    return "Only: " + names.join(", ");
  };

  // Human summary of who will receive the announcement being published.
  const publishConfirmationMessage = () => {
    if (audience === "All Employees") {
      return `"${title.trim() || "This announcement"}" will be visible to every employee.`;
    }

    const names =
      audience === "Department-wise"
        ? selectedDepartments.map(departmentNameById)
        : selectedEmployees.map(employeeNameById);

    if (names.length === 0) {
      return "No recipients are selected, so nobody will see this announcement.";
    }

    const heading =
      audience === "Department-wise"
        ? names.length === 1
          ? "department"
          : "departments"
        : names.length === 1
          ? "employee"
          : "employees";

    return (
      `"${title.trim() || "This announcement"}" will be sent to ` +
      `${names.length} ${heading}: ${names.join(", ")}.`
    );
  };

  const departmentOptions: MultiSelectOption[] = useMemo(
    () =>
      departments.map((department) => ({
        value: department.id,
        label: department.name,
      })),
    [departments],
  );

  const employeeOptions: MultiSelectOption[] = useMemo(
    () =>
      employees.map((employee) => ({
        value: employee.id,
        label:
          `${employee.first_name} ${employee.last_name}`.trim() ||
          employee.email,
        hint: employee.email,
      })),
    [employees],
  );

  // ---- Load audience target options ---------------------------------------

  useEffect(() => {
    let isMounted = true;

    Promise.allSettled([
      departmentService.listAll(),
      employeeService.listAll({ status: "active" }),
    ])
      .then(([departmentResult, employeeResult]) => {
        if (!isMounted) return;

        if (departmentResult.status === "fulfilled") {
          setDepartments(departmentResult.value);
        }

        if (employeeResult.status === "fulfilled") {
          setEmployees(employeeResult.value);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingOptions(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // ---- Create a new department inline -------------------------------------

  const handleCreateDepartment = async () => {
    const name = newDepartmentName.trim();

    if (name.length < 2) {
      setError("Department name must be at least 2 characters.");
      return;
    }

    if (
      departments.some(
        (department) =>
          department.name.trim().toLowerCase() === name.toLowerCase(),
      )
    ) {
      setError(`"${name}" already exists.`);
      return;
    }

    try {
      setIsCreatingDepartment(true);
      setError("");

      const created = await departmentService.create({ name });

      setDepartments((previous) => [...previous, created]);
      setSelectedDepartments((previous) => [...previous, created.id]);
      setNewDepartmentName("");
      setIsAddingDepartment(false);
    } catch (requestError: unknown) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Could not create the department.",
      );
    } finally {
      setIsCreatingDepartment(false);
    }
  };

  // ---- Audience change ----------------------------------------------------

  const handleAudienceChange = (next: Audience) => {
    setAudience(next);

    if (next !== "Department-wise") setSelectedDepartments([]);
    if (next !== "Custom") setSelectedEmployees([]);
  };


  useEffect(() => {
    let isMounted = true;

    api
      .get<Array<Parameters<typeof mapAnnouncement>[0]>>("/announcements", {
        limit: 100,
      })
      .then((items) => {
        if (isMounted) {
          setAnnouncementList(items.map(mapAnnouncement));
        }
      })
      .catch((requestError: unknown) => {
        if (isMounted) {
          setError(
            requestError instanceof ApiError
              ? requestError.message
              : "Could not load announcements.",
          );
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  // ---- Filter announcements -----------------------------------------------

  const filtered = useMemo(() => {
    const days = dateRangeDays[quickDateRange];
    const cutoff =
      days === null ? null : new Date().getTime() - days * 86400000;

    return announcementList
      .filter((a) => {
      const matchesTab =
        quickCategory === "All Categories" || a.category === quickCategory;

      const searchText = search.toLowerCase();

      const matchesSearch =
        a.title.toLowerCase().includes(searchText) ||
        a.description.toLowerCase().includes(searchText);

      // An unparseable or missing publish date is kept rather than silently
      // dropped, so bad data never hides announcements from the list.
      let matchesDate = true;

      if (cutoff !== null) {
        const published = Date.parse(a.publishDate);

        matchesDate = Number.isNaN(published) || published >= cutoff;
      }

        return matchesTab && matchesSearch && matchesDate;
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return announcementTimestamp(b) - announcementTimestamp(a);
      });
  }, [quickCategory, search, quickDateRange, announcementList]);

  const hasActiveQuickFilters =
    quickDateRange !== "All Time" || quickCategory !== "All Categories";

  // ---- Sidebar lists ---------------------------------------------------------

  const SIDEBAR_PREVIEW_COUNT = 5;

  const pinnedItems = useMemo(
    () => announcementList.filter((a) => a.pinned),
    [announcementList],
  );

  // Recent deliberately excludes pinned entries so the two sidebar cards do
  // not show the same announcement twice.
  const recentItems = useMemo(
    () =>
      [...announcementList].sort(
        (a, b) => announcementTimestamp(b) - announcementTimestamp(a),
      ),
    [announcementList],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedAnnouncements = filtered.slice(
    (safeCurrentPage - 1) * rowsPerPage,
    safeCurrentPage * rowsPerPage,
  );
  const showingFrom = filtered.length === 0 ? 0 : (safeCurrentPage - 1) * rowsPerPage + 1;
  const showingTo = Math.min(safeCurrentPage * rowsPerPage, filtered.length);

  const thisMonthCount = announcementList.filter((announcement) => {
    const date = new Date(`${announcement.publishDate}T00:00:00`);
    const now = new Date();
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth()
    );
  }).length;

  const announcementKpis = [
    {
      label: "Total Announcements",
      value: announcementList.length,
      helper: "All time",
      icon: <Megaphone className="h-5 w-5" />,
      tone: "bg-[#EFF6FF] text-[#2563EB]",
    },
    {
      label: "Pinned",
      value: pinnedItems.length,
      helper: "Shown at the top",
      icon: <Pin className="h-5 w-5" />,
      tone: "bg-[#FFF7ED] text-[#C2410C]",
    },
    {
      label: "Important",
      value: announcementList.filter((item) => item.priority !== "Normal").length,
      helper: "High priority",
      icon: <AlertCircle className="h-5 w-5" />,
      tone: "bg-[#FEF2F2] text-[#DC2626]",
    },
    {
      label: "This Month",
      value: thisMonthCount,
      helper: `Published in ${new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" })}`,
      icon: <Calendar className="h-5 w-5" />,
      tone: "bg-[#ECFDF5] text-[#047857]",
    },
  ];

  const [sidebarModal, setSidebarModal] = useState<"pinned" | "recent" | null>(null);

  // Reading an announcement and composing one are mutually exclusive, so
  // viewing always hides the create form. The draft is left in storage on
  // purpose - it still resumes the next time this page mounts.
  function openAnnouncement(announcement: Announcement) {
    setSidebarModal(null);
    setShowCreateForm(false);
    setSelectedAnnouncement(announcement);
  }

  // The tab strip and the Quick Filters category select are two views of the
  // same filter, so every change has to move both.
  function handleCategoryFilterChange(next: QuickCategory) {
    setQuickCategory(next);
    setActiveTab(next === "All Categories" ? "All" : next);
    setCurrentPage(1);
  }

  function handleClearQuickFilters() {
    setQuickCategory("All Categories");
    setQuickDateRange("All Time");
    setActiveTab("All");
    setSearch("");
    setCurrentPage(1);
  }

  async function handleTogglePinned(announcement: Announcement) {
    const formData = new FormData();
    formData.append("pinned", String(!announcement.pinned));

    try {
      const saved = await api.putForm<Parameters<typeof mapAnnouncement>[0]>(
        `/announcements/${announcement.id}`,
        formData,
      );
      const updated = mapAnnouncement(saved);
      setAnnouncementList((previous) =>
        previous.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (requestError: unknown) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Could not update the pinned status.",
      );
    }
  }

  // ---- Open create form ----------------------------------------------------

  const handleCreateAnnouncement = () => {
    setEditingAnnouncement(null);
    setRestoredDraftAvailable(false);
    setShowCreateForm(true);
  };

  // Bring back the unfinished announcement without discarding it.
  const handleResumeDraft = () => {
    setEditingAnnouncement(null);
    setRestoredDraftAvailable(false);
    setShowCreateForm(true);
  };

  const handleDiscardDraft = () => {
    clearDraft();
    resetForm();
    setRestoredDraftAvailable(false);
  };

  const handleEditAnnouncement = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setTitle(announcement.title);
    setCategory(announcement.category);
    setPriority(announcement.priority);
    setPublishDate(announcement.publishDate);
    setExpiryDate(announcement.expiryDate || "");
    setAudience(announcement.audience);
    setDescription(announcement.description);
    setAttachment(null);
    setIsPinned(announcement.pinned);
    setSelectedDepartments(announcement.targetDepartments);
    setSelectedEmployees(announcement.targetEmployees);
    setSelectedAnnouncement(null);
    // Editing must not be mistaken for a resumed draft on the next visit.
    setRestoredDraftAvailable(false);
    setShowCreateForm(true);
  };


  const requestDeleteAnnouncement = (announcement: Announcement) => {
    setPendingDelete(announcement);
  };

  const handleDeleteAnnouncement = async () => {
    if (!pendingDelete) return;

    const announcement = pendingDelete;

    try {
      setIsDeleting(true);
      setError("");
      await api.delete(`/announcements/${announcement.id}`);
      setAnnouncementList((previous) =>
        previous.filter((item) => item.id !== announcement.id),
      );
      setSelectedAnnouncement(null);
      setPendingDelete(null);
    } catch (requestError: unknown) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Could not delete the announcement.",
      );
      setPendingDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // ---- Reset form ----------------------------------------------------------

  const resetForm = () => {
    setTitle("");
    setCategory("");
    setPriority("Important");
    setPublishDate(new Date().toISOString().split("T")[0]);
    setExpiryDate("");
    setAudience("All Employees");
    setDescription("");
    setAttachment(null);
    setIsPinned(true);
    setSelectedDepartments([]);
    setSelectedEmployees([]);
    setNewDepartmentName("");
    setIsAddingDepartment(false);
    setIsAddEmployeeMode(false);
  };

  // ---- Cancel form ---------------------------------------------------------

  const handleCancel = () => {
    clearDraft();
    resetForm();
    setEditingAnnouncement(null);
    setRestoredDraftAvailable(false);
    setShowCreateForm(false);
  };


  // ---- Publish announcement -----------------------------------------------

  // Step 1: validate, then ask for confirmation.
  const handlePublishClick = () => {
    setError("");

    if (!title.trim()) {
      setError("Please enter an announcement title.");
      return;
    }

    if (!category) {
      setError("Please select a category.");
      return;
    }

    if (!description.trim()) {
      setError("Please enter the announcement description.");
      return;
    }

    if (audience === "Department-wise" && selectedDepartments.length === 0) {
      setError("Please select at least one department.");
      return;
    }

    if (audience === "Custom" && selectedEmployees.length === 0) {
      setError("Please select at least one employee.");
      return;
    }

    setIsConfirmingPublish(true);
  };

  // Step 2: the user confirmed, so actually send it.
  const handlePublish = async () => {
    const formData = new FormData();
    formData.append("title", title.trim());
    formData.append("category", category);
    formData.append("priority", priority);
    formData.append("publish_date", publishDate);
    if (expiryDate) formData.append("expiry_date", expiryDate);
    formData.append("audience", audience);
    formData.append("description", description.trim());
    formData.append("pinned", String(isPinned));
    selectedDepartments.forEach((id) =>
      formData.append("target_departments", id),
    );
    selectedEmployees.forEach((id) =>
      formData.append("target_employees", id),
    );
    if (editingAnnouncement) {
      formData.append("clear_expiry", String(!expiryDate));
    }
    if (attachment) formData.append("attachment", attachment);

    const wasEditing = editingAnnouncement !== null;
    const publishedTitle = title.trim();

    try {
      setIsPublishing(true);
      setError("");

      const saved = wasEditing
        ? await api.putForm<Parameters<typeof mapAnnouncement>[0]>(
            `/announcements/${editingAnnouncement.id}`,
            formData,
          )
        : await api.postForm<Parameters<typeof mapAnnouncement>[0]>(
            "/announcements",
            formData,
          );

      const savedAnnouncement = mapAnnouncement(saved);

      setAnnouncementList((previous) =>
        wasEditing
          ? previous.map((item) =>
              item.id === savedAnnouncement.id ? savedAnnouncement : item,
            )
          : [savedAnnouncement, ...previous],
      );

      setIsConfirmingPublish(false);
      clearDraft();
      resetForm();
      setEditingAnnouncement(null);
      setRestoredDraftAvailable(false);
      setShowCreateForm(false);

      setSuccessMessage(
        `"${publishedTitle}" was ${wasEditing ? "updated" : "published"} successfully.`,
      );
    } catch (requestError: unknown) {
      setIsConfirmingPublish(false);

      if (requestError instanceof ApiError && requestError.status === 403) {
        setError(
          "You do not have permission to publish announcements. Only HR and Manager accounts can create them.",
        );
        return;
      }

      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Could not publish the announcement.",
      );
    } finally {
      setIsPublishing(false);
    }
  };

  // ==========================================================================
  // CREATE ANNOUNCEMENT FORM
  // ==========================================================================

  if (showCreateForm) {
    const previewCategory: Category =
      category || "Company News";

    const previewTitle =
      title.trim() || "Sample Announcement Title";

    const previewDescription =
      description.trim() ||
      "This is a preview of how your announcement will appear to employees.";

    const previewDate = publishDate
      ? new Date(publishDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "May 8, 2026";

    return (
      <div className="min-h-screen bg-slate-50 px-6 py-6">
        {/* Header ----------------------------------------------------------- */}

        <div className="mb-6 flex items-start gap-3">
          <button
            type="button"
            onClick={() => setShowCreateForm(false)}
            className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-blue-600 transition hover:bg-blue-50"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>

          <div>
            <h1 className="text-2xl font-bold text-slate-900">
               {editingAnnouncement ? "Edit Announcement" : "Create Announcement"}
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Share important updates, policies and news with your employees.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Main grid -------------------------------------------------------- */}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_510px]">
          {/* LEFT FORM ------------------------------------------------------ */}

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            {/* Title -------------------------------------------------------- */}

            <div className="mb-5">
              <label className="mb-2 block text-sm font-semibold text-slate-800">
                Title <span className="text-red-500">*</span>
              </label>

              <input
                type="text"
                maxLength={100}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter announcement title"
                className="w-full rounded-lg border border-blue-100 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10"
              />

              <div className="mt-1 text-right text-xs text-slate-400">
                {title.length}/100
              </div>
            </div>

            {/* Category + Priority ----------------------------------------- */}

            <div className="mb-5 grid grid-cols-1 gap-5 md:grid-cols-[1fr_1fr]">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-800">
                  Category <span className="text-red-500">*</span>
                </label>

                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as Category | "")
                  }
                  className="w-full rounded-lg border border-blue-100 bg-white px-3 py-3 text-sm text-slate-600 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10"
                >
                  <option value="">Select category</option>
                  <option value="Company News">Company News</option>
                  <option value="HR & Policy">HR & Policy</option>
                  <option value="Events">Events</option>
                  <option value="IT & System">IT & System</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-800">
                  Priority
                </label>

                <div className="grid grid-cols-3 gap-2">
                  {(["Normal", "Important", "Urgent"] as Priority[]).map(
                    (item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setPriority(item)}
                        className={`rounded-lg px-2 py-3 text-sm font-medium transition ${
                          priority === item
                            ? item === "Normal"
                              ? "bg-blue-100 text-blue-600 ring-1 ring-blue-200"
                              : item === "Important"
                                ? "bg-orange-100 text-orange-600 ring-1 ring-orange-200"
                                : "bg-red-100 text-red-600 ring-1 ring-red-200"
                            : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        {item}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Dates -------------------------------------------------------- */}

            <div className="mb-5 grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-800">
                  Publish Date <span className="text-red-500">*</span>
                </label>

                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

                  <input
                    type="date"
                    value={publishDate}
                    onChange={(e) =>
                      setPublishDate(e.target.value)
                    }
                    className="w-full rounded-lg border border-blue-100 bg-white py-3 pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-blue-400"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-800">
                  Expiry Date{" "}
                  <span className="font-normal text-slate-500">
                    (Optional)
                  </span>
                </label>

                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

                  <input
                    type="date"
                    value={expiryDate}
                    min={publishDate}
                    onChange={(e) =>
                      setExpiryDate(e.target.value)
                    }
                    className="w-full rounded-lg border border-blue-100 bg-white py-3 pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-blue-400"
                  />
                </div>
              </div>
            </div>

            {/* Audience ----------------------------------------------------- */}

            <div className="mb-5">
              <label className="mb-3 block text-sm font-semibold text-slate-800">
                Audience
              </label>

              <div className="flex flex-wrap gap-x-7 gap-y-3">
                {(
                  [
                    "All Employees",
                    "Department-wise",
                    "Custom",
                  ] as Audience[]
                ).map((item) => (
                  <label
                    key={item}
                    className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
                  >
                    <input
                      type="radio"
                      name="audience"
                      value={item}
                      checked={audience === item}
                      onChange={() => handleAudienceChange(item)}
                      className="h-4 w-4 accent-blue-600"
                    />

                    {item}
                  </label>
                ))}
              </div>
            </div>

            {/* Department targets ------------------------------------------ */}

            {audience === "Department-wise" && (
              <>
                {isAddingDepartment ? (
                  <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50/50 p-4">
                    <label className="mb-2 block text-sm font-semibold text-slate-800">
                      New department
                    </label>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="text"
                        value={newDepartmentName}
                        autoFocus
                        onChange={(event) =>
                          setNewDepartmentName(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void handleCreateDepartment();
                          }
                        }}
                        placeholder="e.g. Customer Success"
                        className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10"
                      />

                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={isCreatingDepartment}
                          onClick={() => void handleCreateDepartment()}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isCreatingDepartment ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                          Add
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingDepartment(false);
                            setNewDepartmentName("");
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <MultiSelect
                    label="Departments"
                    placeholder="Select departments"
                    options={departmentOptions}
                    selected={selectedDepartments}
                    onChange={setSelectedDepartments}
                    isLoading={isLoadingOptions}
                    emptyText="No departments found"
                    onAddNew={() => setIsAddingDepartment(true)}
                    addNewLabel="Add new department"
                  />
                )}
              </>
            )}

            {/* Employee targets --------------------------------------------- */}

            {audience === "Custom" && (
              <>
                <MultiSelect
                  label="Employees"
                  placeholder="Select employees"
                  options={employeeOptions}
                  selected={selectedEmployees}
                  onChange={setSelectedEmployees}
                  isLoading={isLoadingOptions}
                  emptyText="No active employees found"
                  onAddNew={
                    onCreateEmployee
                      ? () => {
                          // Persist synchronously - this component unmounts as
                          // soon as the navigation below is processed.
                          writeDraft({
                            ...currentDraft,
                            isAddEmployeeMode: true,
                          });
                          onCreateEmployee();
                        }
                      : undefined
                  }
                  addNewLabel="Add new employee"
                />

                {isAddEmployeeMode && (
                  <div className="-mt-3 mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-amber-100 bg-amber-50/60 px-4 py-3 text-sm text-amber-800">
                    <UserPlus className="h-4 w-4 shrink-0" />

                    <span className="flex-1">
                      Your draft is saved. Create the employee on the Employees
                      page, then return here - the list refreshes automatically
                      and the new employee will be available to select.
                    </span>
                  </div>
                )}
              </>
            )}

            {/* Description -------------------------------------------------- */}

            <div className="mb-5">
              <label className="mb-2 block text-sm font-semibold text-slate-800">
                Description / Content{" "}
                <span className="text-red-500">*</span>
              </label>

              <div className="overflow-hidden rounded-lg border border-blue-100 bg-white focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/10">
                {/* Toolbar */}

                <div className="flex items-center gap-1 border-b border-slate-100 px-2 py-2">
                  <button
                    type="button"
                    title="Bold"
                    className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
                  >
                    <Bold className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    title="Italic"
                    className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
                  >
                    <Italic className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    title="Underline"
                    className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
                  >
                    <Underline className="h-4 w-4" />
                  </button>

                  <div className="mx-1 h-5 w-px bg-slate-200" />

                  <button
                    type="button"
                    title="Bullet list"
                    className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
                  >
                    <List className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    title="Numbered list"
                    className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
                  >
                    <ListOrdered className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    title="Link"
                    className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
                  >
                    <Link className="h-4 w-4" />
                  </button>

                  <div className="ml-2">
                    <select className="rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-600 outline-none">
                      <option>Normal</option>
                      <option>Heading 1</option>
                      <option>Heading 2</option>
                    </select>
                  </div>
                </div>

                <textarea
                  value={description}
                  maxLength={5000}
                  onChange={(e) =>
                    setDescription(e.target.value)
                  }
                  placeholder="Write your announcement details here..."
                  className="min-h-[145px] w-full resize-none border-0 px-3 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400"
                />
              </div>

              <div className="mt-1 text-right text-xs text-slate-400">
                {description.length}/5000
              </div>
            </div>

            {/* Attachment --------------------------------------------------- */}

            <div className="mb-5">
              <label className="mb-2 block text-sm font-semibold text-slate-800">
                Attachment{" "}
                <span className="font-normal text-slate-500">
                  (Optional)
                </span>
              </label>

              <label className="flex min-h-[86px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-blue-200 bg-slate-50/50 text-center transition hover:bg-blue-50/30">
                <UploadCloud className="mb-1 h-6 w-6 text-blue-500" />

                {attachment ? (
                  <>
                    <p className="text-sm font-medium text-blue-600">
                      {attachment.name}
                    </p>

                    <p className="text-xs text-slate-400">
                      Click to replace file
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-blue-600">
                      Drag and drop files here, or{" "}
                      <span className="font-semibold">
                        click to browse
                      </span>
                    </p>

                    <p className="mt-1 text-[11px] text-slate-500">
                      Supports: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG
                      (Max 10MB)
                    </p>
                  </>
                )}

                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) =>
                    setAttachment(
                      e.target.files?.[0] || null
                    )
                  }
                />
              </label>
            </div>

            {/* Bottom controls --------------------------------------------- */}

            <div className="flex flex-col gap-4 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) =>
                    setIsPinned(e.target.checked)
                  }
                  className="h-4 w-4 rounded accent-blue-600"
                />

                <Pin className="h-4 w-4 text-blue-500" />

                Pin this announcement{" "}
                <span className="text-xs text-slate-400">
                </span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-lg border border-blue-100 bg-white px-4 py-2.5 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handlePublishClick}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                   {editingAnnouncement ? (
                     <Pencil className="h-4 w-4" />
                   ) : (
                     <Send className="h-4 w-4" />
                   )}
                   {editingAnnouncement ? "Save Changes" : "Announcement"}
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN --------------------------------------------------- */}

          <div className="flex flex-col gap-5">
            {/* Preview ------------------------------------------------------ */}

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
                <Eye className="h-5 w-5 text-blue-600" />
                Preview
              </h2>

              <div className="rounded-xl bg-slate-50 p-4">
                {/* Preview header */}

                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-blue-100">
                    <Megaphone className="h-7 w-7 text-blue-600" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${categoryStyles[previewCategory].badge}`}
                      >
                        {previewCategory}
                      </span>

                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          priority === "Urgent"
                            ? "bg-red-100 text-red-600"
                            : priority === "Normal"
                              ? "bg-blue-100 text-blue-600"
                              : "bg-red-100 text-red-600"
                        }`}
                      >
                        {priority.toUpperCase()}
                      </span>
                    </div>

                    <h3 className="mt-3 text-base font-bold text-slate-900">
                      {previewTitle}
                    </h3>

                    <p className="mt-2 text-sm leading-relaxed text-slate-500">
                      {previewDescription}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {previewDate}
                      </span>

                      <span className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        By HR Team
                      </span>
                    </div>
                  </div>
                </div>

                {/* Preview attachment */}

                {attachment && (
                  <div className="mt-5 border-t border-slate-200 pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Paperclip className="h-4 w-4 text-slate-500" />

                        <div>
                          <p className="text-xs font-semibold text-slate-700">
                            Attachment
                          </p>

                          <p className="mt-1 text-sm text-blue-600">
                            {attachment.name}
                          </p>
                        </div>
                      </div>

                      <Download className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tips --------------------------------------------------------- */}

            <div className="rounded-xl border border-slate-200 bg-blue-50/60 p-5">
              <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
                <Lightbulb aria-hidden="true" className="h-5 w-5" />
                Tips
              </h2>

              <ul className="space-y-2 pl-5 text-sm leading-relaxed text-slate-600">
                <li>
                  Keep the title short and clear.
                </li>

                <li>
                  Choose the right category and priority.
                </li>

                <li>
                  Use the audience option if the announcement is
                  for specific departments.
                </li>

                <li>
                  You can attach files like PDFs, documents or
                  images.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {isConfirmingPublish && (
          <ConfirmDialog
            title={editingAnnouncement ? "Update this announcement?" : "Publish this announcement?"}
            message={publishConfirmationMessage()}
            confirmLabel={editingAnnouncement ? "Update" : "Publish"}
            isWorking={isPublishing}
            onConfirm={() => void handlePublish()}
            onCancel={() => setIsConfirmingPublish(false)}
          />
        )}
      </div>
    );
  }

  // ==========================================================================
  // ANNOUNCEMENT LIST
  // ==========================================================================

  return (
    <div className="flex w-full flex-col gap-5 pb-10">
      {/* Header ------------------------------------------------------------- */}

      <div className="flex flex-col gap-3 border-b border-[#E5E7EB] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[20px] font-semibold leading-tight text-[#111827]">
            Announcements
          </h1>
          <p className="mt-1 text-[13px] text-[#6B7280]">
            Share important updates, policies and news with your team
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={handleCreateAnnouncement} leftIcon={<Plus className="h-4 w-4" />}>
          Create Announcement
        </Button>
      </div>

      {error && (
        <ErrorState
          title="Could not load announcements"
          message={error}
          onRetry={() => {
            setError("");
            setRefreshKey((key) => key + 1);
          }}
          className="max-w-none rounded-xl border border-[#FECACA] bg-white py-4"
        />
      )}

      {/* Closes itself after a few seconds, so no timer is needed here. */}
      <NoticePopup
        notice={successMessage ? { type: "success", text: successMessage } : null}
        onDismiss={() => setSuccessMessage("")}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="min-h-[128px] rounded-xl border border-[#E5E7EB] bg-white p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-3">
                    <Skeleton className="h-3 w-28 rounded" />
                    <Skeleton className="h-8 w-16 rounded" />
                    <Skeleton className="h-3 w-24 rounded" />
                  </div>
                  <Skeleton className="h-9 w-9 rounded-lg" />
                </div>
              </div>
            ))
          : announcementKpis.map((card) => (
              <div key={card.label} className="flex min-h-[128px] flex-col rounded-xl border border-[#E5E7EB] bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-medium text-[#6B7280]">{card.label}</p>
                    <p className="mt-2 text-[28px] font-semibold leading-none text-[#111827]">{card.value}</p>
                  </div>
                  <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.tone}`}>{card.icon}</span>
                </div>
                <p className="mt-auto pt-3 text-[12px] text-[#6B7280]">{card.helper}</p>
              </div>
            ))}
      </div>

      {restoredDraftAvailable && !showCreateForm && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <FileText className="h-4 w-4 shrink-0 text-amber-600" />

          <p className="min-w-0 flex-1 text-sm font-medium text-amber-800">
            You have an unfinished announcement.
          </p>

          <button
            type="button"
            onClick={handleResumeDraft}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700"
          >
            Resume
          </button>

          <button
            type="button"
            onClick={handleDiscardDraft}
            className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
          >
            Discard
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        {/* Main column ------------------------------------------------------ */}

        <section className="min-w-0 rounded-xl border border-[#E5E7EB] bg-white p-5 lg:col-span-8">
          {/* Tabs */}

          <div className="mb-4 overflow-x-auto">
            <SharedTabs
              variant="underline"
              activeTab={activeTab}
              onChange={(tab) =>
                handleCategoryFilterChange(
                  tab === "All" ? "All Categories" : (tab as QuickCategory),
                )
              }
              tabs={tabs.map((tab) => ({
                id: tab,
                label: tab,
                badge:
                  tab === "All"
                    ? announcementList.length
                    : announcementList.filter((item) => item.category === tab).length,
              }))}
              className="min-w-max"
            />
          </div>

          {/* Search and filters */}

          <div className="mb-5 flex flex-col gap-2 lg:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />

              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search announcements..."
                className="h-9 w-full rounded-lg border border-[#D1D5DB] bg-white pl-9 pr-3 text-[13px] text-[#111827] outline-none placeholder:text-[#9CA3AF] focus:border-[#2563EB] focus:ring-[3px] focus:ring-[#DBEAFE]"
              />
            </div>
            <Select
              aria-label="Filter by category"
              value={quickCategory}
              onChange={(event) => {
                handleCategoryFilterChange(event.target.value as QuickCategory);
                setCurrentPage(1);
              }}
              wrapperClassName="w-full lg:w-[160px]"
              className="h-9 text-[13px]"
              options={[
                { value: "All Categories", label: "Category" },
                { value: "Company News", label: "Company News" },
                { value: "HR & Policy", label: "HR & Policy" },
                { value: "Events", label: "Events" },
                { value: "IT & System", label: "IT & System" },
              ]}
            />
            <Select
              aria-label="Filter by date range"
              value={quickDateRange}
              onChange={(event) => {
                setQuickDateRange(event.target.value as DateRangeKey);
                setCurrentPage(1);
              }}
              wrapperClassName="w-full lg:w-[150px]"
              className="h-9 text-[13px]"
              options={[
                { value: "All Time", label: "Date Range" },
                { value: "Last 7 Days", label: "Last 7 Days" },
                { value: "Last 30 Days", label: "Last 30 Days" },
                { value: "Last 90 Days", label: "Last 90 Days" },
              ]}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearQuickFilters}
              disabled={!hasActiveQuickFilters && !search}
              leftIcon={<RotateCcw className="h-4 w-4" />}
              className="shrink-0 border border-transparent"
            >
              Clear Filters
            </Button>
          </div>

          {/* Announcement cards */}

          <div className="flex min-h-[420px] flex-col">
            {isLoading && (
              Array.from({ length: rowsPerPage }).map((_, index) => (
                <div key={index} className="flex gap-3 border-b border-[#E5E7EB] py-4">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1 space-y-3">
                    <Skeleton className="h-3 w-40 rounded" />
                    <Skeleton className="h-4 w-2/3 rounded" />
                    <Skeleton className="h-3 w-full rounded" />
                  </div>
                </div>
              ))
            )}

            {!isLoading && paginatedAnnouncements.map((a) => {
              const style = categoryStyles[a.category];

              return (
                <div
                  key={a.id}
                  className="border-b border-[#E5E7EB] px-1 py-4 transition hover:bg-[#F9FAFB]"
                >
                  <div className="flex gap-3">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${style.iconBg}`}
                    >
                      {style.icon}
                    </span>

                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-block rounded-full px-2.5 py-1 text-[12px] font-medium ${style.badge}`}
                      >
                        {a.category}
                      </span>

                      {a.priority !== "Normal" && (
                        <span className="inline-block rounded-full bg-[#FEF2F2] px-2.5 py-1 text-[12px] font-medium text-[#B91C1C]">
                          {a.priority}
                        </span>
                      )}
                        </div>

                        <h3 className="mb-1 flex items-center gap-1.5 text-[14px] font-semibold text-[#111827]">
                          {a.pinned && <Pin className="h-4 w-4 shrink-0 text-[#2563EB]" aria-label="Pinned" />}
                          <span className="truncate">{a.title}</span>
                        </h3>

                        <p className="mb-2 line-clamp-2 text-[13px] leading-5 text-[#6B7280]">
                          {a.description}
                        </p>

                        <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[12px] text-[#6B7280]" title={audienceTooltip(a)}>
                          <span className="font-medium text-[#9CA3AF]">To:</span>
                          {a.audience === "All Employees" ? (
                            <span>All employees</span>
                          ) : audienceNames(a).length === 0 ? (
                            <span>No recipients selected</span>
                          ) : (
                            <>
                              {audienceNames(a).slice(0, 3).map((name) => (
                                <Avatar key={name} name={name} size="xs" />
                              ))}
                              {audienceNames(a).length > 3 && (
                                <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[12px]">
                                  +{audienceNames(a).length - 3} more
                                </span>
                              )}
                              <span className="ml-1">{a.audience === "Department-wise" ? "departments" : "employees"}</span>
                            </>
                          )}
                        </div>


                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[#6B7280]">
                          <span
                            className="flex items-center gap-1"
                            title={
                              "Publishes on " + formatDateOnly(a.publishDate)
                            }
                          >
                             <Clock className="h-4 w-4" />
                             {formatDateOnly(a.publishDate)}
                          </span>

                          <span className="flex items-center gap-1">
                             <User className="h-4 w-4" />
                            By {a.author}
                          </span>
                        </div>


                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void handleTogglePinned(a)}
                            className={`flex h-8 w-8 items-center justify-center rounded-md transition hover:bg-[#EFF6FF] ${a.pinned ? "text-[#2563EB]" : "text-[#9CA3AF] hover:text-[#2563EB]"}`}
                            title={a.pinned ? "Unpin announcement" : "Pin announcement"}
                            aria-label={a.pinned ? "Unpin announcement" : "Pin announcement"}
                          >
                            <Pin className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditAnnouncement(a)}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-[#6B7280] hover:bg-[#EFF6FF] hover:text-[#2563EB]"
                            title="Edit announcement"
                            aria-label="Edit announcement"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => requestDeleteAnnouncement(a)}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-[#6B7280] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
                            title="Delete announcement"
                            aria-label="Delete announcement"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openAnnouncement(a)}
                            className="flex items-center gap-1 text-[12px] font-medium text-[#2563EB] hover:text-[#1D4ED8]"
                          >
                            View Details
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {!isLoading && filtered.length === 0 && (
              <EmptyState
                icon={<Megaphone className="h-4 w-4" />}
                title={announcementList.length === 0 ? "No announcements yet" : "No matching announcements"}
                description={announcementList.length === 0 ? "Create an announcement to share an update with your team." : "Try a different search or clear the filters."}
                action={announcementList.length === 0 ? <Button variant="primary" size="sm" onClick={handleCreateAnnouncement} leftIcon={<Plus className="h-4 w-4" />}>Create Announcement</Button> : <Button variant="ghost" size="sm" onClick={handleClearQuickFilters} leftIcon={<RotateCcw className="h-4 w-4" />}>Clear Filters</Button>}
                className="max-w-none py-10"
              />
            )}
          </div>

          {/* Pagination */}

          <div className="mt-4 flex flex-col gap-3 border-t border-[#E5E7EB] pt-4 text-[12px] text-[#6B7280] md:flex-row md:items-center md:justify-between">
            <p>Showing {showingFrom}-{showingTo} of {filtered.length} announcements</p>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <label className="flex items-center gap-2">
                Rows per page
                <Select
                  aria-label="Rows per page"
                  value={String(rowsPerPage)}
                  onChange={(event) => {
                    setRowsPerPage(Number(event.target.value));
                    setCurrentPage(1);
                  }}
                  wrapperClassName="w-[72px]"
                  className="h-8 text-[12px]"
                  options={[
                    { value: "5", label: "5" },
                    { value: "10", label: "10" },
                    { value: "25", label: "25" },
                  ]}
                />
              </label>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={safeCurrentPage === 1}
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    className="h-8 rounded-full border border-[#E5E7EB] px-3 text-[12px] hover:bg-[#F3F4F6] disabled:bg-[#F3F4F6] disabled:text-[#D1D5DB]"
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={`flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-[12px] font-medium ${page === safeCurrentPage ? "bg-[#2563EB] text-white" : "text-[#6B7280] hover:bg-[#F3F4F6]"}`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={safeCurrentPage === totalPages}
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    className="h-8 rounded-full border border-[#E5E7EB] px-3 text-[12px] hover:bg-[#F3F4F6] disabled:bg-[#F3F4F6] disabled:text-[#D1D5DB]"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Right sidebar --------------------------------------------------- */}

        <aside className="flex flex-col gap-5 lg:col-span-4 lg:sticky lg:top-6">
          {/* Pinned */}

          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-[14px] font-semibold text-[#111827]">
                <Pin className="h-4 w-4 text-[#6B7280]" />
                Pinned Announcements
              </h3>

              {pinnedItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSidebarModal("pinned")}
                  className="text-[12px] font-medium text-[#2563EB] hover:text-[#1D4ED8]"
                >
                  View All
                </button>
              )}
            </div>

            {pinnedItems.length === 0 ? (
              <EmptyState icon={<Pin className="h-4 w-4" />} title="No pinned announcements" description="Pinned updates will appear here." className="max-w-none py-5" />
            ) : (
              <div className="flex flex-col gap-3">
                {pinnedItems.slice(0, SIDEBAR_PREVIEW_COUNT).map((p) => {
                  const style = categoryStyles[p.category];

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => openAnnouncement(p)}
                      className="flex items-center gap-2.5 rounded-lg text-left transition hover:bg-slate-50"
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${style.iconBg}`}
                      >
                        {style.icon}
                      </span>

                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold text-[#111827]">
                          {p.title}
                        </span>

                        <span className="block text-[12px] text-[#6B7280]">
                          {formatDateOnly(p.publishDate)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent */}

          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-[14px] font-semibold text-[#111827]">
                <Clock className="h-4 w-4 text-[#6B7280]" />
                Recent Announcements
              </h3>

              {recentItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSidebarModal("recent")}
                  className="text-[12px] font-medium text-[#2563EB] hover:text-[#1D4ED8]"
                >
                  View All
                </button>
              )}
            </div>

            {recentItems.length === 0 ? (
              <EmptyState icon={<Clock className="h-4 w-4" />} title="No recent announcements" description="New announcements will appear here." className="max-w-none py-5" />
            ) : (
              <div className="flex flex-col gap-3">
                {recentItems.slice(0, SIDEBAR_PREVIEW_COUNT).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => openAnnouncement(r)}
                    className="flex items-start gap-2.5 rounded-lg text-left transition hover:bg-slate-50"
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotStyles[r.category]}`}
                    />

                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-[#111827]">
                        {r.title}
                      </span>

                      <span className="block text-[12px] text-[#6B7280]">
                        {formatRelativeDate(r.createdAt)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {sidebarModal && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sidebar-modal-title"
          onClick={() => setSidebarModal(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2
                id="sidebar-modal-title"
                className="text-base font-semibold text-slate-900"
              >
                {sidebarModal === "pinned"
                  ? "Pinned Announcements"
                  : "Recent Announcements"}
              </h2>

              <button
                type="button"
                onClick={() => setSidebarModal(null)}
                className="flex h-8 w-8 items-center justify-center rounded text-slate-400 hover:bg-slate-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-5">
              <div className="flex flex-col gap-2">
                {(sidebarModal === "pinned" ? pinnedItems : recentItems).map(
                  (item) => {
                    const style = categoryStyles[item.category];

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openAnnouncement(item)}
                        className="flex items-center gap-3 rounded border border-slate-100 p-3 text-left transition hover:bg-slate-50"
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded ${style.iconBg}`}
                        >
                          {style.icon}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-800">
                            {item.title}
                          </span>

                          <span className="block text-xs text-slate-400">
                            {item.category} • {formatDateOnly(item.publishDate)}
                          </span>
                        </span>

                        {item.pinned && <Pin className="h-4 w-4 shrink-0 text-blue-500" />}
                      </button>
                    );
                  },
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedAnnouncement && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="announcement-details-title"
          onClick={() => setSelectedAnnouncement(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <span
                  className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${categoryStyles[selectedAnnouncement.category].badge}`}
                >
                  {selectedAnnouncement.category}
                </span>
                <h2 id="announcement-details-title" className="mt-3 text-xl font-bold text-slate-900">
                  {selectedAnnouncement.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAnnouncement(null)}
                className="rounded p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close announcement details"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                Published {selectedAnnouncement.date}
              </span>
              <span
                className="flex items-center gap-1.5"
                title="Announcement created at this time"
              >
                <Clock className="h-4 w-4" />
                Created {formatDateTime(selectedAnnouncement.createdAt)}
              </span>
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4" />
                By {selectedAnnouncement.author}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
                {selectedAnnouncement.priority}
              </span>
            </div>

            <p className="mt-6 whitespace-pre-wrap text-sm leading-7 text-slate-600">
              {selectedAnnouncement.description}
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-400">Audience</p>
                <p className="font-medium text-slate-700">
                  {selectedAnnouncement.audience === "All Employees"
                    ? "All Employees (everyone)"
                    : audienceLabel(selectedAnnouncement)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Expiry date</p>
                <p className="font-medium text-slate-700">
                  {selectedAnnouncement.expiryDate || "No expiry date"}
                </p>
              </div>

              {selectedAnnouncement.audience === "Department-wise" && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-slate-400">Departments</p>

                  {selectedAnnouncement.targetDepartments.length === 0 ? (
                    <p className="font-medium text-slate-700">
                      No departments selected
                    </p>
                  ) : (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {selectedAnnouncement.targetDepartments.map((id) => (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                        >
                          <Building2 className="h-3 w-3" />
                          {departmentNameById(id)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {selectedAnnouncement.audience === "Custom" && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-slate-400">Employees</p>

                  {selectedAnnouncement.targetEmployees.length === 0 ? (
                    <p className="font-medium text-slate-700">
                      No employees selected
                    </p>
                  ) : (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {selectedAnnouncement.targetEmployees.map((id) => (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700"
                        >
                          <Users className="h-3 w-3" />
                          {employeeNameById(id)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>


            {selectedAnnouncement.attachment && (
              <a
                href={`http://localhost:8000${selectedAnnouncement.attachment.url}`}
                target="_blank"
                rel="noreferrer"
                className="mt-5 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100"
              >
                <Paperclip className="h-4 w-4" />
                {selectedAnnouncement.attachment.filename}
                <Download className="ml-auto h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete this announcement?"
          message={`"${pendingDelete.title}" will be removed permanently and will no longer be visible to its audience.`}
          confirmLabel="Delete"
          isWorking={isDeleting}
          tone="danger"
          icon={<Trash2 className="h-5 w-5 text-red-600" />}
          onConfirm={() => void handleDeleteAnnouncement()}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
