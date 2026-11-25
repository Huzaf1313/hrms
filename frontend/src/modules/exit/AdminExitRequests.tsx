import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Layers,
  LogOut,
  Plus,
  Search,
  SlidersHorizontal,
  UserMinus,
  Wallet,
  X,
} from "lucide-react";

import { Button } from "../../components/ui/Button";
import CreateExitRequestModal from "./CreateExitRequestModal";
import ExitDetailModal from "./ExitDetailModal";
import ExitQuickFilters from "./ExitQuickFilters";
import ExitRequestsTable, {
  type ExitTableVariant,
} from "./ExitRequestsTable";
import ExitTypeDonut from "./ExitTypeDonut";
import ResignationPanel from "./ResignationPanel";
import TerminationPanel from "./TerminationPanel";
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
  request,
  deleting,
  onCancel,
  onConfirm,
}: {
  request: ExitRequest;
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

        <div className="px-6 py-5 text-[13px] text-[#4B5563]">
          Delete {request.employee_name ?? request.employee_id}&apos;s exit request? This cannot be undone.
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#E5E7EB] bg-[#F9FAFB] px-6 py-3.5">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={deleting}
            className="h-8 px-3 text-[12px] font-medium shadow-none"
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onConfirm}
            isLoading={deleting}
            className="h-8 px-3 text-[12px] font-medium text-[#9B1C1C] border-[#F8B4B4] hover:bg-[#FDE8E8] hover:border-[#F8B4B4] shadow-none"
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
  const [departments, setDepartments] = useState<Department[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<ExitRequest | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ExitRequest | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<InlineNotice>(null);
  const [creating, setCreating] = useState<ExitType | "any" | null>(null);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  // Departments populate the rail's dropdown once; they rarely change.
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

  // Filters apply as they are changed. The debounce keeps a half-typed search
  // term from firing a request per keystroke, and any filter change restarts
  // the list from the first page.
  useEffect(() => {
    const timer = setTimeout(() => {
      setApplied(draft);
      setPage(1);
    }, FILTER_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [draft]);

  // Requests + summary. The tab drives the exit type, and the single-type tabs
  // scope the summary too so their KPI cards count only that type.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const exitType = view === "all" ? undefined : view;

    const load = async () => {
      const [list, stats] = await Promise.all([
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
      ]);

      if (!active) return;

      setRequests(list.items);
      setTotal(list.total);
      setPages(list.pages);
      setSummary(stats);
      setError(null);
    };

    load()
      .catch((cause: unknown) => {
        if (active) setError(errorText(cause, "Unable to load exit requests."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [view, applied, page, version]);

  // Any filter change starts the list from the first page again.
  const changeView = (next: View) => {
    setView(next);
    setPage(1);
  };

  const resetFilters = () => {
    setDraft(EMPTY_EXIT_FILTERS);
    changeView("all");
  };

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
    (type: ExitType) => summary?.by_type?.[type] ?? 0,
    [summary],
  );

  const overallTotal = summary?.total ?? 0;

  const overviewCards: StatCardSpec[] = useMemo(
    () => [
      {
        label: "Total Exit Requests",
        value: overallTotal,
        note: "All recorded exits",
        noteClass: "text-[#6B7280]",
        icon: <LogOut className="h-4 w-4 shrink-0 text-[#2F5FD0]" />,
        iconBg: "bg-[#E8EEFB]",
        iconClass: "text-[#2F5FD0]",
      },
      ...EXIT_TYPES.map((type) => ({
        label: type,
        value: totalFor(type),
        note: `${percent(totalFor(type), overallTotal)} of total`,
        noteClass: "text-[#6B7280]",
        icon: (
          <FileText
            className={`h-4 w-4 shrink-0 ${type === "Termination" ? "text-[#9B1C1C]" : "text-[#2F5FD0]"
              }`}
          />
        ),
        iconBg: type === "Termination" ? "bg-[#FDE8E8]" : "bg-[#E8EEFB]",
        iconClass: "text-current",
      })),
    ],
    [overallTotal, totalFor],
  );

  /** Single-type tabs get their own four-card row with type-relevant labels. */
  const typedCards: StatCardSpec[] = useMemo(() => {
    if (view === "all") return overviewCards;

    const total = summary?.total ?? 0;
    const pending = summary?.pending ?? 0;
    const inProgress = summary?.in_progress ?? 0;
    const completed = summary?.completed ?? 0;

    const card = (
      label: string,
      value: number,
      note: string,
      icon: StatCardSpec["icon"],
      iconBg: string,
    ): StatCardSpec => ({
      label,
      value,
      note,
      noteClass: "text-[#6B7280]",
      icon,
      iconBg,
      iconClass: "text-current",
    });

    const counterIcon = <LogOut className="h-4 w-4 shrink-0 text-[#2F5FD0]" />;

    if (view === "Termination") {
      return [
        card(
          "Total Terminations",
          total,
          "All terminations on record",
          counterIcon,
          "bg-[#E8EEFB]",
        ),
        card(
          "In Progress",
          inProgress,
          `${percent(inProgress, total)} of total`,
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-[#2F5FD0]" />,
          "bg-[#E8EEFB]",
        ),
        card(
          "Completed",
          completed,
          `${percent(completed, total)} of total`,
          <LogOut className="h-4 w-4 shrink-0 text-[#03543F]" />,
          "bg-[#DEF7EC]",
        ),
        card(
          "Pending Clearance",
          pending,
          `${percent(pending, total)} of total`,
          <Wallet className="h-4 w-4 shrink-0 text-[#92400E]" />,
          "bg-[#FEF3C7]",
        ),
      ];
    }

    if (view === "Resignation") {
      return [
        card(
          "Total Resignations",
          total,
          "All resignations on record",
          counterIcon,
          "bg-[#E8EEFB]",
        ),
        card(
          "In Clearance",
          inProgress,
          `${percent(inProgress, total)} of total`,
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-[#2F5FD0]" />,
          "bg-[#E8EEFB]",
        ),
        card(
          "Pending Settlement",
          pending,
          `${percent(pending, total)} of total`,
          <Wallet className="h-4 w-4 shrink-0 text-[#92400E]" />,
          "bg-[#FEF3C7]",
        ),
        card(
          "Completed",
          completed,
          `${percent(completed, total)} of total`,
          <LogOut className="h-4 w-4 shrink-0 text-[#03543F]" />,
          "bg-[#DEF7EC]",
        ),
      ];
    }

    return [
      card(
        `Total ${view}`,
        total,
        "All recorded on record",
        counterIcon,
        "bg-[#E8EEFB]",
      ),
      card(
        "Pending",
        pending,
        `${percent(pending, total)} of total`,
        <SlidersHorizontal className="h-4 w-4 shrink-0 text-[#92400E]" />,
        "bg-[#FEF3C7]",
      ),
      card(
        "In Progress",
        inProgress,
        `${percent(inProgress, total)} of total`,
        <SlidersHorizontal className="h-4 w-4 shrink-0 text-[#2F5FD0]" />,
        "bg-[#E8EEFB]",
      ),
      card(
        "Completed",
        completed,
        `${percent(completed, total)} of total`,
        <LogOut className="h-4 w-4 shrink-0 text-[#03543F]" />,
        "bg-[#DEF7EC]",
      ),
    ];
  }, [view, summary, overviewCards]);

  const isOverview = view === "all";
  const tableVariant: ExitTableVariant = isOverview ? "overview" : "typed";

  const heading = isOverview
    ? { title: "Exit / Offboarding", subtitle: "Manage employee resignation, termination and other exit processes." }
    : view === "Termination"
      ? { title: "Termination Management", subtitle: "Handle terminations and exit-related processes." }
      : { title: "Exit / Offboarding Management", subtitle: `Manage ${view.toLowerCase()} and clearance processes.` };

  const firstRow = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const lastRow = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1280px] mx-auto px-4 sm:px-6 py-4">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-lg border border-[#E5E7EB] shadow-none">
        <div className="flex min-w-0 items-center gap-3">
          {!isOverview && (
            <button
              type="button"
              onClick={() => changeView("all")}
              aria-label="Back to all exit requests"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#E4E6E1] bg-white text-[#4B5563] transition hover:bg-[#F0F1EE] hover:text-[#111827] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5FD0]"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}

          <div className="flex flex-col gap-0.5 min-w-0">
            <h1 className="truncate text-[18px] font-semibold text-[#111827]">
              {heading.title}
            </h1>
            <p className="text-xs text-[#4B5563]">{heading.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center shrink-0">
          <Button
            variant="primary"
            onClick={() => setCreating("any")}
            className="inline-flex flex-row items-center justify-center gap-2 whitespace-nowrap h-10 px-4 text-sm font-medium shadow-none [&>span]:inline-flex [&>span]:flex-row [&>span]:items-center [&>span]:justify-center [&>span]:gap-2"
          >
            <Plus className="w-[18px] h-[18px] shrink-0" />
            <span>Create Exit Request</span>
          </Button>
        </div>
      </div>

      <InlineNoticeBanner notice={notice} onDismiss={() => setNotice(null)} />

      {isOverview && <ExitProcessFlow />}

      {/* KPI Section */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
            EXIT OVERVIEW
          </h2>
        </div>

        <StatCards
          cards={typedCards}
          className={
            isOverview
              ? "grid-cols-1 md:grid-cols-3"
              : "grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
          }
        />
      </div>

      {/* Tabs + Main Grid */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 border-b border-[#E5E7EB] overflow-x-auto">
          {TABS.map((tab) => {
            const active = view === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => changeView(tab.id)}
                className={`flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2.5 text-[13px] font-medium transition-colors cursor-pointer border-b-2 -mb-[1px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5FD0] ${active
                  ? "border-[#2F5FD0] text-[#2F5FD0]"
                  : "border-transparent text-[#4B5563] hover:text-[#111827] hover:border-[#D1D5DB]"
                  }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7B8794]" />
                <input
                  type="text"
                  value={draft.search}
                  onChange={(event) => setDraft((d) => ({ ...d, search: event.target.value }))}
                  placeholder="Search employee name, ID..."
                  aria-label="Search employee name, ID"
                  className="h-8 w-full rounded-md border border-[#E5E7EB] bg-white pl-8 pr-3 text-[12px] text-[#111827] outline-none transition placeholder:text-[#7B8794] focus:border-[#2F5FD0] focus:ring-1 focus:ring-[#2F5FD0]"
                />
              </div>

              <div className="relative">
                <select
                  value={draft.status}
                  aria-label="Filter by status"
                  onChange={(event) =>
                    setDraft((d) => ({ ...d, status: event.target.value as ExitFilters["status"] }))
                  }
                  className="h-8 w-40 appearance-none rounded-md border border-[#E5E7EB] bg-white pl-2.5 pr-7 text-[12px] text-[#111827] outline-none transition focus:border-[#2F5FD0] focus:ring-1 focus:ring-[#2F5FD0] cursor-pointer"
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

              <Button
                variant="outline"
                size="sm"
                disabled={requests.length === 0}
                onClick={() =>
                  downloadExitCsv(
                    requests,
                    isOverview ? "exit-requests.csv" : `exit-${view.toLowerCase()}.csv`,
                  )
                }
                leftIcon={<Download className="h-3.5 w-3.5 shrink-0" />}
                className="h-8 px-3 text-[12px] font-medium shadow-none whitespace-nowrap"
              >
                Export
              </Button>
            </div>

            {/* Requests table */}
            <Panel
              title={isOverview ? "Recent Exit Requests" : `${view} Requests`}
              bodyClassName="p-0"
              action={
                !isOverview ? (
                  <span className="inline-flex items-center rounded-full bg-[#F3F4F6] border border-[#E5E7EB] px-2 py-0.5 text-[11px] font-medium text-[#4B5563]">
                    {view}
                  </span>
                ) : undefined
              }
            >
              <ExitRequestsTable
                requests={requests}
                loading={loading}
                error={error}
                onOpen={setSelected}
                onDelete={setConfirmDelete}
                deletingId={deletingId}
                variant={tableVariant}
                emptyMessage={
                  isOverview
                    ? "No exit requests match the current filters."
                    : `No ${view.toLowerCase()} requests match the current filters.`
                }
              />

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB] bg-white px-6 py-3.5">
                <p className="text-[12px] text-[#6B7280] tabular-nums">
                  Showing {firstRow} to {lastRow} of {total} entries
                </p>

                {pages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label="Previous page"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-[#E4E6E1] bg-white text-[#7B8794] transition hover:bg-[#F0F1EE] hover:text-[#1F2933] disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5FD0]"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>

                    <span className="px-2 text-[12px] font-medium text-[#111827] tabular-nums">
                      {page} / {pages}
                    </span>

                    <button
                      type="button"
                      aria-label="Next page"
                      disabled={page >= pages}
                      onClick={() => setPage((p) => Math.min(pages, p + 1))}
                      className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-[#E4E6E1] bg-white text-[#7B8794] transition hover:bg-[#F0F1EE] hover:text-[#1F2933] disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5FD0]"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </Panel>

            {error && !loading && (
              <ErrorState message={error} />
            )}

            {/* Type-specific panels */}
            {view === "Resignation" && (
              <ResignationPanel requests={requests} onOpenRequest={setSelected} />
            )}

            {view === "Termination" && (
              <TerminationPanel
                requests={requests}
                summary={summary}
                onOpenRequest={setSelected}
                onInitiateTermination={() => setCreating("Termination")}
              />
            )}
          </div>

          {/* Right rail */}
          <aside className="flex min-w-0 flex-col gap-4">
            <ExitQuickFilters
              filters={draft}
              departments={departments}
              onChange={setDraft}
              onReset={resetFilters}
            />

            <ExitTypeDonut
              byType={summary?.by_type ?? {}}
              total={summary?.by_type ? Object.values(summary.by_type).reduce((a, b) => a + b, 0) : 0}
            />

            {!isOverview && (
              <Button
                variant="outline"
                onClick={() => setCreating(view)}
                leftIcon={<UserMinus className="h-4 w-4 shrink-0" />}
                className="h-9 w-full border-dashed text-[12px] font-medium shadow-none"
              >
                Record a {view.toLowerCase()}
              </Button>
            )}
          </aside>
        </div>
      </div>

      {confirmDelete && (
        <DeleteConfirmDialog
          request={confirmDelete}
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