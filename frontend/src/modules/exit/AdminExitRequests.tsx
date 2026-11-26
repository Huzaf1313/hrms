import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  FileText,
  Flag,
  Layers,
  LogOut,
  PlayCircle,
  Plus,
  Search,
  SlidersHorizontal,
  UserMinus,
  Wallet,
  X,
} from "lucide-react";

import { Button } from "../../components/ui/Button";
import { PageHeading } from "../../components/ui/PageHeading";
import CreateExitRequestModal from "./CreateExitRequestModal";
import ExitDetailModal from "./ExitDetailModal";
import ExitRequestsTable from "./ExitRequestsTable";
import ExitTypeDonut from "./ExitTypeDonut";
import {
  ErrorState,
  InlineNoticeBanner,
  Panel,
  StatCards,
  type StatCardSpec,
} from "./ExitUi";
import {
  EMPTY_EXIT_FILTERS,
  EXIT_STATUSES,
  hasActiveFilters,
  percent,
  useDialogA11y,
  type ExitFilters,
  type InlineNotice,
} from "./exitUiUtils";
import { ExitProcessFlow } from "./ExitSideRail";
import { departmentService } from "../departments/departmentService";
import {
  adminExitRequestService,
  downloadExitCsv,
} from "./exitRequestService";
import { ApiError } from "../../services/api";
import { EXIT_TYPES } from "./types";
import type { ExitRequest, ExitRequestSummary, ExitType } from "./types";
import type { Department } from "../departments/types";

type View = "all" | ExitType;

const TABS: Array<{ id: View; label: string; icon: typeof Layers }> = [
  { id: "all", label: "All Requests", icon: Layers },
  { id: "Resignation", label: "Resignation", icon: FileText },
  { id: "Termination", label: "Termination", icon: UserMinus },
];

const PAGE_SIZE = 5;

/** How long the filters settle before the list refetches, in ms. */
const FILTER_DEBOUNCE_MS = 250;

/** yyyy-mm-dd bounds sent to the API, widened to cover the whole day. */
function toIsoStart(date: string): string | undefined {
  return date ? `${date}T00:00:00.000Z` : undefined;
}

function toIsoEnd(date: string): string | undefined {
  return date ? `${date}T23:59:59.999Z` : undefined;
}

function errorText(cause: unknown, fallback: string): string {
  return cause instanceof ApiError ? cause.message : fallback;
}

function DeleteConfirmDialog({
  deleting,
  onCancel,
  onConfirm,
}: {
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useDialogA11y(true, dialogRef, () => {
    if (!deleting) onCancel();
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !deleting) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-exit-dialog-title"
        className="w-full max-w-md overflow-hidden rounded border border-[#E5E7EB] bg-white shadow-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] px-6 py-4">
          <h2 id="delete-exit-dialog-title" className="text-[15px] font-semibold text-[#111827]">
            Delete Exit Request
          </h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[#6B7280] transition hover:bg-[#F0F1EE] hover:text-[#111827] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5FD0] disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 text-sm text-[#4B5563]">
          Delete this exit request? This cannot be undone.
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#E5E7EB] bg-[#F9FAFB] px-6 py-3.5">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={deleting}
            className="h-9 px-3.5 text-[13px] font-medium shadow-none"
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onConfirm}
            isLoading={deleting}
            className="h-9 px-3.5 text-[13px] font-medium text-[#9B1C1C] border-[#F8B4B4] hover:bg-[#FDE8E8] hover:border-[#F8B4B4] shadow-none"
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminExitRequests() {
  const [view, setView] = useState<View>("all");
  const [draft, setDraft] = useState<ExitFilters>(EMPTY_EXIT_FILTERS);
  const [applied, setApplied] = useState<ExitFilters>(EMPTY_EXIT_FILTERS);
  const [page, setPage] = useState(1);

  const [requests, setRequests] = useState<ExitRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [summary, setSummary] = useState<ExitRequestSummary | null>(null);
  const [overallSummary, setOverallSummary] = useState<ExitRequestSummary | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<ExitRequest | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ExitRequest | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<InlineNotice>(null);
  const [creating, setCreating] = useState<ExitType | "any" | null>(null);
  const [version, setVersion] = useState(0);
  const fetchIdRef = useRef(0);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  // Departments populate the toolbar dropdown once; they rarely change.
  useEffect(() => {
    let active = true;

    departmentService
      .listAll()
      .then((rows) => {
        if (active) setDepartments(rows);
      })
      .catch(() => {
        if (active) setDepartments([]);
      });

    return () => {
      active = false;
    };
  }, []);

  // Debounce draft filter changes; skip initial mount when draft === applied.
  useEffect(() => {
    const unchanged =
      draft.search === applied.search &&
      draft.status === applied.status &&
      draft.department_id === applied.department_id &&
      draft.from === applied.from &&
      draft.to === applied.to;

    if (unchanged) return;

    const timer = setTimeout(() => {
      setApplied(draft);
      setPage(1);
    }, FILTER_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [draft, applied]);

  const fetchKey = `${view}|${applied.status}|${applied.department_id}|${applied.from}|${applied.to}|${applied.search}|${page}|${version}`;
  const [prevFetchKey, setPrevFetchKey] = useState(fetchKey);
  if (fetchKey !== prevFetchKey) {
    setPrevFetchKey(fetchKey);
    setLoading(true);
    setError(null);
  }

  // Requests + summary. Guarded by fetchIdRef so out-of-order responses never
  // leave stale rows or stuck skeleton loading state.
  useEffect(() => {
    const currentFetchId = ++fetchIdRef.current;

    const exitType = view === "all" ? undefined : view;

    const load = async () => {
      const [list, stats, allStats] = await Promise.all([
        adminExitRequestService.list({
          page,
          limit: PAGE_SIZE,
          exit_type: exitType,
          status: applied.status || undefined,
          department_id: applied.department_id || undefined,
          submitted_from: toIsoStart(applied.from),
          submitted_to: toIsoEnd(applied.to),
          search: applied.search.trim() || undefined,
        }),
        adminExitRequestService.summary(exitType),
        exitType ? adminExitRequestService.summary() : Promise.resolve(null),
      ]);

      if (fetchIdRef.current !== currentFetchId) return;

      setRequests(list.items);
      setTotal(list.total);
      setPages(list.pages);
      setSummary(stats);
      setOverallSummary(allStats ?? stats);
      setError(null);
    };

    load()
      .catch((cause: unknown) => {
        if (fetchIdRef.current === currentFetchId) {
          setError(errorText(cause, "Unable to load exit requests."));
        }
      })
      .finally(() => {
        if (fetchIdRef.current === currentFetchId) {
          setLoading(false);
        }
      });
  }, [view, applied, page, version]);

  const changeView = useCallback((next: View) => {
    setView((prev) => {
      if (prev === next) return prev;
      setRequests([]);
      setTotal(0);
      setPage(1);
      setSelectedRowId(null);
      return next;
    });
  }, []);

  const handleQuickStatus = async (
    request: ExitRequest,
    nextStatus: "In Progress" | "Completed",
  ) => {
    try {
      await adminExitRequestService.updateStatus(request.id, nextStatus);
      refresh();
      setNotice({
        type: "success",
        text: `${request.employee_name ?? request.employee_id} moved to ${nextStatus}.`,
      });
    } catch (cause: unknown) {
      setNotice({
        type: "error",
        text: errorText(cause, "Unable to update exit request status."),
      });
    }
  };

  const resetFilters = () => {
    setDraft(EMPTY_EXIT_FILTERS);
    setApplied(EMPTY_EXIT_FILTERS);
    setPage(1);
  };

  const toggleStatusFilter = useCallback((status: ExitFilters["status"]) => {
    setDraft((prev) => ({
      ...prev,
      status: prev.status === status ? "" : status,
    }));
  }, []);

  const executeDelete = async (request: ExitRequest) => {
    setDeletingId(request.id);

    try {
      await adminExitRequestService.remove(request.id);
      setConfirmDelete(null);
      refresh();

      setNotice({
        type: "success",
        text: `${request.employee_name ?? request.employee_id}'s exit request deleted.`,
      });
    } catch (cause: unknown) {
      setConfirmDelete(null);
      setNotice({
        type: "error",
        text: errorText(cause, "Unable to delete the exit request."),
      });
    } finally {
      setDeletingId(null);
    }
  };

  const totalFor = useCallback(
    (type: ExitType) => (overallSummary ?? summary)?.by_type?.[type] ?? 0,
    [overallSummary, summary],
  );

  const overallTotal = (overallSummary ?? summary)?.total ?? 0;

  const overviewCards: StatCardSpec[] = useMemo(
    () => [
      {
        label: "Total Requests",
        value: overallTotal,
        note: "All recorded exits",
        noteClass: "text-[#6B7280]",
        icon: <LogOut className="h-4 w-4 shrink-0 text-[#2F5FD0]" />,
        iconBg: "bg-[#E8EEFB]",
        iconClass: "text-[#2F5FD0]",
      },
      ...EXIT_TYPES.map((type) => ({
        label: type === "Resignation" ? "Resignations" : "Terminations",
        value: totalFor(type),
        note: `${percent(totalFor(type), overallTotal)} of total`,
        noteClass: "text-[#6B7280]",
        icon: (
          <FileText
            className={`h-4 w-4 shrink-0 ${type === "Termination" ? "text-[#9B1C1C]" : "text-[#2F5FD0]"}`}
          />
        ),
        iconBg: type === "Termination" ? "bg-[#FDE8E8]" : "bg-[#E8EEFB]",
        iconClass: "text-current",
        onClick: () => changeView(type),
      })),
      {
        label: "Pending / In Progress",
        value: ((overallSummary ?? summary)?.pending ?? 0) + ((overallSummary ?? summary)?.in_progress ?? 0),
        note: "Active exit queue",
        noteClass: "text-[#6B7280]",
        icon: <SlidersHorizontal className="h-4 w-4 shrink-0 text-[#92400E]" />,
        iconBg: "bg-[#FEF3C7]",
        iconClass: "text-[#92400E]",
        active: draft.status === "Pending",
        onClick: () => toggleStatusFilter("Pending"),
      },
    ],
    [overallTotal, totalFor, overallSummary, summary, draft.status, toggleStatusFilter, changeView],
  );

  /** Single-type tabs get their own four-card row with type-relevant labels. */
  const typedCards: StatCardSpec[] = useMemo(() => {
    if (view === "all") return overviewCards;

    const scopedTotal = summary?.total ?? 0;
    const pending = summary?.pending ?? 0;
    const inProgress = summary?.in_progress ?? 0;
    const completed = summary?.completed ?? 0;

    const card = (
      label: string,
      value: number,
      note: string,
      icon: StatCardSpec["icon"],
      iconBg: string,
      statusToFilter?: ExitFilters["status"],
    ): StatCardSpec => ({
      label,
      value,
      note,
      noteClass: "text-[#6B7280]",
      icon,
      iconBg,
      iconClass: "text-current",
      active: statusToFilter ? draft.status === statusToFilter : false,
      onClick: statusToFilter ? () => toggleStatusFilter(statusToFilter) : undefined,
    });

    const counterIcon = <LogOut className="h-4 w-4 shrink-0 text-[#2F5FD0]" />;

    if (view === "Termination") {
      return [
        card(
          "Total Terminations",
          scopedTotal,
          "All terminations on record",
          counterIcon,
          "bg-[#E8EEFB]",
        ),
        card(
          "In Progress",
          inProgress,
          `${percent(inProgress, scopedTotal)} of total`,
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-[#2F5FD0]" />,
          "bg-[#E8EEFB]",
          "In Progress",
        ),
        card(
          "Completed",
          completed,
          `${percent(completed, scopedTotal)} of total`,
          <LogOut className="h-4 w-4 shrink-0 text-[#03543F]" />,
          "bg-[#DEF7EC]",
          "Completed",
        ),
        card(
          "Pending Clearance",
          pending,
          `${percent(pending, scopedTotal)} of total`,
          <Wallet className="h-4 w-4 shrink-0 text-[#92400E]" />,
          "bg-[#FEF3C7]",
          "Pending",
        ),
      ];
    }

    return [
      card(
        "Total Resignations",
        scopedTotal,
        "All resignations on record",
        counterIcon,
        "bg-[#E8EEFB]",
      ),
      card(
        "In Clearance",
        inProgress,
        `${percent(inProgress, scopedTotal)} of total`,
        <SlidersHorizontal className="h-4 w-4 shrink-0 text-[#2F5FD0]" />,
        "bg-[#E8EEFB]",
        "In Progress",
      ),
      card(
        "Pending Settlement",
        pending,
        `${percent(pending, scopedTotal)} of total`,
        <Wallet className="h-4 w-4 shrink-0 text-[#92400E]" />,
        "bg-[#FEF3C7]",
        "Pending",
      ),
      card(
        "Completed",
        completed,
        `${percent(completed, scopedTotal)} of total`,
        <LogOut className="h-4 w-4 shrink-0 text-[#03543F]" />,
        "bg-[#DEF7EC]",
        "Completed",
      ),
    ];
  }, [view, summary, overviewCards, draft.status, toggleStatusFilter]);

  const isOverview = view === "all";
  const activeRow = useMemo(
    () => requests.find((item) => item.id === selectedRowId) ?? null,
    [requests, selectedRowId],
  );

  const tabCountFor = (tabId: View) => {
    if (tabId === "all") return overallTotal;
    return totalFor(tabId);
  };

  const noRowTooltip = "Select a request from the table first";

  const quickActions = [
    {
      label: "Approve Resignation",
      icon: PlayCircle,
      iconBg: "bg-[#ECFDF5]",
      iconColor: "text-[#059669]",
      enabled: activeRow?.status === "Pending",
      disabledReason: !activeRow
        ? noRowTooltip
        : activeRow.status === "In Progress"
          ? "Already approved and in clearance"
          : `Not available for ${activeRow.status.toLowerCase()} requests`,
      onClick: () => activeRow && setSelected(activeRow),
    },
    {
      label: "Update Clearance",
      icon: ClipboardCheck,
      iconBg: "bg-[#EFF6FF]",
      iconColor: "text-[#2563EB]",
      enabled: activeRow?.status === "In Progress",
      disabledReason: !activeRow
        ? noRowTooltip
        : activeRow.status === "Pending"
          ? "Approve the request first to start clearance"
          : `Clearance is closed for ${activeRow.status.toLowerCase()} requests`,
      onClick: () => activeRow && setSelected(activeRow),
    },
    {
      label: "Process Final Settlement",
      icon: Wallet,
      iconBg: "bg-[#F5F3FF]",
      iconColor: "text-[#7C3AED]",
      enabled: activeRow?.status === "In Progress",
      disabledReason: !activeRow
        ? noRowTooltip
        : activeRow.status === "Pending"
          ? "Available after clearance is started"
          : `Not available for ${activeRow.status.toLowerCase()} requests`,
      onClick: () => activeRow && setSelected(activeRow),
    },
    {
      label: "Initiate Termination",
      icon: Flag,
      iconBg: "bg-[#FEF2F2]",
      iconColor: "text-[#DC2626]",
      enabled: Boolean(activeRow),
      disabledReason: noRowTooltip,
      onClick: () => setCreating("Termination"),
    },
    {
      label: "Export Exit Report",
      icon: FileSpreadsheet,
      iconBg: "bg-[#F0FDFA]",
      iconColor: "text-[#0D9488]",
      enabled: requests.length > 0,
      disabledReason: "No visible exit requests to export",
      onClick: () =>
        downloadExitCsv(
          requests,
          isOverview ? "exit-requests.csv" : `exit-${view.toLowerCase()}.csv`,
        ),
    },
  ];

  const firstRow = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const lastRow = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="flex flex-col gap-6 w-full min-w-0 pb-10">
      {/* A. Page header (consistent across all 3 tabs, no back arrow) */}
      <PageHeading
        title="Manage employee resignation, termination and other exit processes."
        actions={
          <Button
            variant="primary"
            onClick={() => setCreating(isOverview ? "any" : view)}
            className="inline-flex flex-row items-center justify-center gap-2 whitespace-nowrap h-10 px-4 text-sm font-medium shadow-none [&>span]:inline-flex [&>span]:flex-row [&>span]:items-center [&>span]:justify-center [&>span]:gap-2"
          >
            <Plus className="w-[18px] h-[18px] shrink-0" />
            <span>Create Exit Request</span>
          </Button>
        }
      />

      <InlineNoticeBanner notice={notice} onDismiss={() => setNotice(null)} />

      {/* B. Stats row: always 4 equal-width cards */}
      <div className="flex flex-col gap-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          EXIT OVERVIEW
        </h2>

        <StatCards cards={typedCards} />
      </div>

      {/* C. Tabs (never shift vertically) */}
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2 border-b border-[#E5E7EB] overflow-x-auto overflow-y-hidden scrollbar-hidden max-w-full">
          {TABS.map((tab) => {
            const active = view === tab.id;
            const Icon = tab.icon;
            const count = tabCountFor(tab.id);

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => changeView(tab.id)}
                className={`flex items-center gap-2 shrink-0 whitespace-nowrap px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer border-b-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5FD0] ${active
                  ? "border-[#2F5FD0] text-[#2F5FD0]"
                  : "border-transparent text-[#4B5563] hover:text-[#111827] hover:border-[#D1D5DB]"
                  }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
                <span
                  className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${active
                    ? "bg-[#EFF6FF] text-[#2F5FD0]"
                    : "bg-slate-100 text-slate-600"
                    }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* D. Unified Toolbar */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-center">
            <div className="flex items-center gap-2 flex-1 min-w-[180px]">
              <div className="relative flex-1 min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7B8794]" />
                <input
                  type="text"
                  value={draft.search}
                  onChange={(event) => setDraft((d) => ({ ...d, search: event.target.value }))}
                  placeholder="Search employee name, ID..."
                  aria-label="Search employee name, ID"
                  className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white pl-9 pr-3 text-sm text-[#111827] outline-none transition placeholder:text-[#7B8794] hover:border-[#D1D5DB] focus:border-[#2F5FD0] focus:ring-1 focus:ring-[#2F5FD0]"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setMobileFiltersOpen((prev) => !prev)}
                leftIcon={<SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />}
                className="h-9 px-3 text-xs font-medium lg:hidden shrink-0"
              >
                Filters
              </Button>
            </div>

            <div
              className={`${mobileFiltersOpen ? "flex" : "hidden"
                } lg:flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2`}
            >
              <div className="relative">
                <select
                  value={draft.status}
                  aria-label="Filter by status"
                  onChange={(event) =>
                    setDraft((d) => ({ ...d, status: event.target.value as ExitFilters["status"] }))
                  }
                  className="h-9 w-full sm:w-36 appearance-none rounded-lg border border-[#E5E7EB] bg-white pl-3 pr-8 text-xs text-[#111827] outline-none transition hover:border-[#D1D5DB] focus:border-[#2F5FD0] focus:ring-1 focus:ring-[#2F5FD0] cursor-pointer"
                >
                  <option value="">All Status</option>
                  {EXIT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6B7280]" />
              </div>

              <div className="relative">
                <select
                  value={draft.department_id}
                  aria-label="Filter by department"
                  onChange={(event) =>
                    setDraft((d) => ({ ...d, department_id: event.target.value }))
                  }
                  className="h-9 w-full sm:w-40 appearance-none rounded-lg border border-[#E5E7EB] bg-white pl-3 pr-8 text-xs text-[#111827] outline-none transition hover:border-[#D1D5DB] focus:border-[#2F5FD0] focus:ring-1 focus:ring-[#2F5FD0] cursor-pointer"
                >
                  <option value="">All Departments</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6B7280]" />
              </div>

              <div className="flex items-center gap-1.5">
                <div className="relative flex-1 sm:flex-none">
                  <CalendarRange className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6B7280]" />
                  <input
                    type="date"
                    aria-label="Submitted from"
                    value={draft.from}
                    onChange={(event) => setDraft((d) => ({ ...d, from: event.target.value }))}
                    className="h-9 w-full sm:w-[134px] rounded-lg border border-[#E5E7EB] bg-white pl-8 pr-2 text-xs text-[#111827] outline-none transition hover:border-[#D1D5DB] focus:border-[#2F5FD0] focus:ring-1 focus:ring-[#2F5FD0]"
                  />
                </div>
                <span className="text-xs text-slate-400">–</span>
                <div className="relative flex-1 sm:flex-none">
                  <CalendarRange className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6B7280]" />
                  <input
                    type="date"
                    aria-label="Submitted to"
                    value={draft.to}
                    onChange={(event) => setDraft((d) => ({ ...d, to: event.target.value }))}
                    className="h-9 w-full sm:w-[134px] rounded-lg border border-[#E5E7EB] bg-white pl-8 pr-2 text-xs text-[#111827] outline-none transition hover:border-[#D1D5DB] focus:border-[#2F5FD0] focus:ring-1 focus:ring-[#2F5FD0]"
                  />
                </div>
              </div>

              {hasActiveFilters(draft) && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="h-9 px-2.5 text-xs font-medium text-[#2F5FD0] hover:underline whitespace-nowrap cursor-pointer"
                >
                  Reset
                </button>
              )}

              <Button
                variant="outline"
                size="sm"
                disabled={requests.length === 0}
                title={requests.length === 0 ? "No rows available to export" : "Export visible exit requests to CSV"}
                onClick={() =>
                  downloadExitCsv(
                    requests,
                    isOverview ? "exit-requests.csv" : `exit-${view.toLowerCase()}.csv`,
                  )
                }
                leftIcon={<Download className="h-3.5 w-3.5 shrink-0" />}
                className="h-9 px-3 text-xs font-medium shadow-none whitespace-nowrap"
              >
                Export
              </Button>
            </div>
          </div>
        </div>

        {/* E. Main Content: Full-width flow */}
        <div className="flex flex-col gap-5">
          {/* Compact centered stepper strip (same position across all tabs) */}
          <ExitProcessFlow status={activeRow?.status ?? null} />

          {/* Full-width Requests table */}
          <Panel
            title={isOverview ? "Recent Exit Requests" : `${view} Requests`}
            bodyClassName="p-0"
            action={
              <span className="inline-flex items-center rounded-full bg-[#EFF6FF] border border-[#DBEAFE] px-2.5 py-0.5 text-xs font-medium text-[#2F5FD0] tabular-nums">
                {total} {total === 1 ? "request" : "requests"}
              </span>
            }
          >
            <ExitRequestsTable
              requests={requests}
              loading={loading}
              error={error}
              selectedId={activeRow?.id ?? null}
              onSelect={(req) =>
                setSelectedRowId((prev) => (prev === req.id ? null : req.id))
              }
              onOpen={setSelected}
              onQuickStatus={(req, next) => void handleQuickStatus(req, next)}
              onDelete={setConfirmDelete}
              onCreate={() => setCreating(isOverview ? "any" : view)}
              deletingId={deletingId}
              emptyMessage={
                isOverview
                  ? "No exit requests found."
                  : `No ${view.toLowerCase()} requests found.`
              }
            />

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB] bg-white px-6 py-3.5">
              <p className="text-xs text-[#6B7280] tabular-nums">
                Showing {firstRow} to {lastRow} of {total} entries
              </p>

              {pages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Previous page"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E4E6E1] bg-white text-[#7B8794] transition hover:bg-[#F0F1EE] hover:text-[#1F2933] disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5FD0]"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <span className="px-2 text-xs font-medium text-[#111827] tabular-nums">
                    {page} / {pages}
                  </span>

                  <button
                    type="button"
                    aria-label="Next page"
                    disabled={page >= pages}
                    onClick={() => setPage((p) => Math.min(pages, p + 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E4E6E1] bg-white text-[#7B8794] transition hover:bg-[#F0F1EE] hover:text-[#1F2933] disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5FD0]"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </Panel>

          {activeRow && (
            <Panel
              title="Exit Process Checklist"
              description={`Clearance steps for ${activeRow.employee_name ?? activeRow.employee_id}.`}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelected(activeRow)}
                  className="h-8 px-3 text-[13px] font-medium shadow-none"
                >
                  Open Drawer
                </Button>
              }
            >
              {activeRow.handover_tasks.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No clearance steps recorded for this request yet.
                </p>
              ) : (
                <ul className="divide-y divide-[#E5E7EB]">
                  {activeRow.handover_tasks.map((task, idx) => (
                    <li
                      key={`${task.task}-${idx}`}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-[#111827] truncate">
                          {idx + 1}. {task.task}
                        </p>
                        {task.remarks && (
                          <p className="text-xs text-slate-500 truncate">{task.remarks}</p>
                        )}
                      </div>
                      <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                        {task.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {error && !loading && requests.length > 0 && <ErrorState message={error} />}

          {/* Bottom 2-column row: Exit Requests by Type | Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <ExitTypeDonut
              byType={(overallSummary ?? summary)?.by_type ?? {}}
              total={overallTotal}
            />

            <Panel
              title="Quick Actions"
              className="h-full"
              description={
                activeRow
                  ? `Actions for: ${activeRow.employee_name ?? activeRow.employee_id}`
                  : "Select a request from the table first."
              }
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {quickActions.map((action, index) => {
                  const Icon = action.icon;
                  const isExport = index === quickActions.length - 1;
                  return (
                    <button
                      key={action.label}
                      type="button"
                      disabled={!action.enabled}
                      title={!action.enabled ? action.disabledReason : undefined}
                      onClick={action.onClick}
                      className={`flex h-10 w-full items-center gap-3 rounded-xl border px-3.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5FD0] ${
                        isExport ? "sm:col-span-2 sm:w-[calc(50%-0.375rem)] sm:mx-auto" : ""
                      } ${
                        action.enabled
                          ? "border-[#E5E7EB] bg-white text-[#1F2937] hover:border-[#CBD5E1] hover:bg-[#F8FAFC] cursor-pointer"
                          : "cursor-not-allowed border-[#E5E7EB] bg-[#F8FAFC] text-[#94A3B8] opacity-75"
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${action.iconBg} ${action.iconColor}`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                      </span>
                      <span className="min-w-0 flex-1 text-[13px] font-medium leading-tight truncate">
                        {action.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Panel>
          </div>
        </div>
      </div>

      {confirmDelete && (
        <DeleteConfirmDialog
          deleting={deletingId === confirmDelete.id}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => void executeDelete(confirmDelete)}
        />
      )}

      {selected && (
        <ExitDetailModal
          key={selected.id}
          request={selected}
          onClose={() => setSelected(null)}
          onChanged={(message) => {
            refresh();
            setNotice({ type: "success", text: message });
          }}
        />
      )}

      {creating && (
        <CreateExitRequestModal
          lockedType={creating === "any" ? undefined : creating}
          onClose={() => setCreating(null)}
          onCreated={(message) => {
            refresh();
            setNotice({ type: "success", text: message });
          }}
        />
      )}
    </div>
  );
}