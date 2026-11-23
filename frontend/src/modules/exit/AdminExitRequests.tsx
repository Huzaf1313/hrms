import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  LogOut,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  UserMinus,
  Wallet,
} from "lucide-react";

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
import { EXIT_TYPES, EXIT_TYPE_META } from "./types";
import type { ExitRequest, ExitRequestSummary, ExitType } from "./types";
import type { Department } from "../departments/types";

type View = "all" | ExitType;

const TABS: Array<{ id: View; label: string }> = [
  { id: "all", label: "All Requests" },
  ...EXIT_TYPES.map((type) => ({ id: type as View, label: type })),
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmRequest, setDeleteConfirmRequest] =
  useState<ExitRequest | null>(null);
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

  const deleteRequest = (request: ExitRequest) => {
    setDeleteConfirmRequest(request);
  };

  const confirmDeleteRequest = async () => {
    if (!deleteConfirmRequest || deletingId) return;

    const request = deleteConfirmRequest;

    setDeletingId(request.id);

    try {
      await adminExitRequestService.remove(request.id);

      setDeleteConfirmRequest(null);
      refresh();

      setNotice({
        type: "success",
        text: `${request.employee_name}'s exit request deleted.`,
      });
    } catch (cause: unknown) {
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
        noteClass: "text-slate-500",
        icon: <LogOut className="h-5 w-5 text-blue-600" />,
        iconBg: "bg-blue-50",
        iconClass: "text-blue-600",
      },
      ...EXIT_TYPES.map((type) => ({
        label: type,
        value: totalFor(type),
        note: `${percent(totalFor(type), overallTotal)} of total`,
        noteClass:
          type === "Termination" ? "text-rose-600" : "text-slate-500",
        icon: <FileText className={`h-5 w-5 ${EXIT_TYPE_META[type].dot.replace("bg-", "text-")}`} />,
        iconBg: `${EXIT_TYPE_META[type].dot.replace("bg-", "bg-")}/10`,
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
      noteClass: string,
      icon: StatCardSpec["icon"],
      iconBg: string,
    ): StatCardSpec => ({
      label,
      value,
      note,
      noteClass,
      icon,
      iconBg,
      iconClass: "text-current",
    });

    const counterIcon = <LogOut className="h-5 w-5 text-blue-600" />;

    if (view === "Termination") {
      return [
        card(
          "Total Terminations",
          total,
          "All terminations on record",
          "text-slate-500",
          counterIcon,
          "bg-blue-50",
        ),
        card(
          "In Progress",
          inProgress,
          `${percent(inProgress, total)} of total`,
          "text-blue-600",
          <SlidersHorizontal className="h-5 w-5 text-blue-600" />,
          "bg-cyan-50",
        ),
        card(
          "Completed",
          completed,
          `${percent(completed, total)} of total`,
          "text-emerald-600",
          <LogOut className="h-5 w-5 text-emerald-600" />,
          "bg-emerald-50",
        ),
        card(
          "Pending Clearance",
          pending,
          `${percent(pending, total)} of total`,
          "text-amber-600",
          <Wallet className="h-5 w-5 text-amber-600" />,
          "bg-amber-50",
        ),
      ];
    }

    if (view === "Resignation") {
      return [
        card(
          "Total Resignations",
          total,
          "All resignations on record",
          "text-slate-500",
          counterIcon,
          "bg-blue-50",
        ),
        card(
          "In Clearance",
          inProgress,
          `${percent(inProgress, total)} of total`,
          "text-blue-600",
          <SlidersHorizontal className="h-5 w-5 text-blue-600" />,
          "bg-emerald-50",
        ),
        card(
          "Pending Settlement",
          pending,
          `${percent(pending, total)} of total`,
          "text-amber-600",
          <Wallet className="h-5 w-5 text-amber-600" />,
          "bg-amber-50",
        ),
        card(
          "Completed",
          completed,
          `${percent(completed, total)} of total`,
          "text-emerald-600",
          <LogOut className="h-5 w-5 text-emerald-600" />,
          "bg-emerald-50",
        ),
      ];
    }

    // Termination, and any type the app does not know about, share this row.
    return [
      card(
        `Total ${view}`,
        total,
        "All recorded on record",
        "text-slate-500",
        counterIcon,
        "bg-blue-50",
      ),
      card(
        "Pending",
        pending,
        `${percent(pending, total)} of total`,
        "text-amber-600",
        <SlidersHorizontal className="h-5 w-5 text-amber-600" />,
        "bg-amber-50",
      ),
      card(
        "In Progress",
        inProgress,
        `${percent(inProgress, total)} of total`,
        "text-blue-600",
        <SlidersHorizontal className="h-5 w-5 text-blue-600" />,
        "bg-cyan-50",
      ),
      card(
        "Completed",
        completed,
        `${percent(completed, total)} of total`,
        "text-emerald-600",
        <LogOut className="h-5 w-5 text-emerald-600" />,
        "bg-emerald-50",
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
    <div className="px-5 pb-10 pt-8 sm:px-8 xl:px-10">
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {!isOverview && (
            <button
              type="button"
              onClick={() => changeView("all")}
              aria-label="Back to all exit requests"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}

          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold text-slate-900 sm:text-3xl">
              {heading.title}
            </h1>
            <p className="mt-1 text-sm text-slate-500">{heading.subtitle}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setCreating("any")}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Create Exit Request
        </button>
      </div>

      <InlineNoticeBanner notice={notice} onDismiss={() => setNotice(null)} />

      {isOverview && (
        <div className="mb-5">
          <ExitProcessFlow />
        </div>
      )}

      {/* KPI row */}
      <StatCards
        cards={typedCards}
        className={
          isOverview
            ? "mb-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
            : "mb-5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
        }
      />

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-1 border-b border-slate-200">
        {TABS.map((tab) => {
          const active = view === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => changeView(tab.id)}
              className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                active
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={draft.search}
                onChange={(event) => setDraft((d) => ({ ...d, search: event.target.value }))}
                placeholder="Search employee name, ID..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="relative">
              <select
                value={draft.status}
                aria-label="Filter by status"
                onChange={(event) =>
                  setDraft((d) => ({ ...d, status: event.target.value as ExitFilters["status"] }))
                }
                className="h-10 w-40 appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">All Status</option>
                {EXIT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>

            <button
              type="button"
              disabled={requests.length === 0}
              onClick={() =>
                downloadExitCsv(
                  requests,
                  isOverview ? "exit-requests.csv" : `exit-${view.toLowerCase()}.csv`,
                )
              }
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>

          {/* Requests table */}
          <Panel
            title={isOverview ? "Recent Exit Requests" : `${view} Requests`}
            bodyClassName="p-0"
            action={
              !isOverview ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
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
              onDelete={deleteRequest}
              deletingId={deletingId}
              variant={tableVariant}
              emptyMessage={
                isOverview
                  ? "No exit requests match the current filters."
                  : `No ${view.toLowerCase()} requests match the current filters.`
              }
            />

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
              <p className="text-sm text-slate-500">
                Showing {firstRow} to {lastRow} of {total} entries
              </p>

              {pages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Previous page"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <span className="px-2 text-sm font-semibold text-blue-600">
                    {page} / {pages}
                  </span>

                  <button
                    type="button"
                    aria-label="Next page"
                    disabled={page >= pages}
                    onClick={() => setPage((p) => Math.min(pages, p + 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:bg-slate-50 disabled:opacity-40"
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
            <button
              type="button"
              onClick={() => setCreating(view)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:border-blue-400 hover:text-blue-600"
            >
              <UserMinus className="h-4 w-4" />
              Record a {view.toLowerCase()}
            </button>
          )}
        </aside>
      </div>

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

      {deleteConfirmRequest && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-exit-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>

              <div>
                <h3
                  id="delete-exit-title"
                  className="text-lg font-semibold text-slate-900"
                >
                  Delete Exit Request?
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Are you sure you want to delete{" "}
                  <span className="font-semibold text-slate-900">
                    {deleteConfirmRequest.employee_name}
                  </span>
                  's exit request? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={deletingId !== null}
                onClick={() => setDeleteConfirmRequest(null)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={deletingId !== null}
                onClick={() => void confirmDeleteRequest()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingId !== null ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}