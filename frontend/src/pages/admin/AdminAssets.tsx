import { useCallback, useEffect, useRef, useState } from "react";
import type { DependencyList, ReactNode } from "react";
import { TableSkeleton } from "../../components/ui";
import {
  BarChart3,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  Laptop,
  MoreVertical,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

import {
  ASSET_CATEGORIES,
  ASSET_CATEGORY_ICONS,
  initialsForAsset,
} from "../../components/admin/assetData";
import AssetAllocationDetailModal, {
  type AllocationDetailTarget,
} from "../../components/admin/assets/AssetAllocationDetailModal";
import AssetAssignModal from "../../components/admin/assets/AssetAssignModal";
import AssetDeleteModal from "../../components/admin/assets/AssetDeleteModal";
import AssetDetailModal from "../../components/admin/assets/AssetDetailModal";
import AssetFormModal from "../../components/admin/assets/AssetFormModal";
import AssetReturnModal from "../../components/admin/assets/AssetReturnModal";
import MarkReturnedModal from "../../components/admin/assets/MarkReturnedModal";
import NoticePopup, { type Notice } from "../../components/admin/assets/NoticePopup";
import { assetService } from "../../services/assetService";
import {
  ASSET_STATUS_LABELS,
  ASSET_STATUS_ORDER,
  type AllocationRow,
  type Asset,
  type AssetCategory,
  type AssetRequest,
  type AssetRequestStatus,
  type AssetStatus,
  type AssetStats,
  type CategoryCount,
  type Paginated,
} from "../../types/asset";

const PANEL_CLASS = "rounded-2xl border border-gray-100 bg-white p-6 shadow-sm";

// KPI cards are narrow, so they clip instead of letting the big number
// overflow into the neighbouring card.
const KPI_CARD_CLASS =
  "min-w-0 overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm";

const FILTER_CONTROL_CLASS =
  "h-10 w-full appearance-none rounded-full border border-gray-200 bg-white px-4 pr-9 text-sm " +
  "text-gray-700 transition hover:border-gray-300 focus:border-[#2563eb] focus:outline-none " +
  "focus:ring-2 focus:ring-[#2563eb]/10";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Renders "2025-05-19" and ISO timestamps as "19 May 2025". */
function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }

  const [year, month, day] = value.split("T")[0].split("-").map(Number);

  if (!year || !month || !day || !MONTHS[month - 1]) {
    return "-";
  }

  return `${String(day).padStart(2, "0")} ${MONTHS[month - 1]} ${year}`;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

/** The server caps a page at 100, so the report walks past it. */
const REPORT_PAGE_SIZE = 100;

/** Quotes a CSV cell, doubling any embedded quotes. */
function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);

  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * The asset register as CSV.
 *
 * Built from a full walk of the filtered list rather than the page on screen,
 * so the report is the whole answer and not just what happened to fit.
 */
function buildAssetsCsv(assets: Asset[]): string {
  const headers = [
    "Asset Tag",
    "Name",
    "Category",
    "Brand / Model",
    "Serial Number",
    "Status",
    "Assigned To",
    "Employee ID",
    "Department",
    "Issue Date",
    "Purchase Date",
    "Purchase Cost",
    "Vendor",
    "Warranty Expiry",
  ];

  const rows = assets.map((asset) => [
    asset.asset_tag,
    asset.name,
    asset.category,
    asset.brand_model,
    asset.serial_number,
    ASSET_STATUS_LABELS[asset.status] ?? asset.status,
    asset.assigned_to_name,
    asset.assigned_to_employee_id,
    asset.department_name,
    asset.issue_date,
    asset.purchase_date,
    asset.purchase_cost,
    asset.vendor,
    asset.warranty_expiry,
  ]);

  // The BOM is what makes Excel open a UTF-8 CSV without mangling names.
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function downloadBlob(csv: string, filename: string) {
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** "assets-report-2026-10-14.csv", so repeat exports do not overwrite each other. */
function reportFilename(): string {
  return `assets-report-${new Date().toISOString().slice(0, 10)}.csv`;
}

/**
 * Fetches an asset endpoint and tracks its loading/error state.
 *
 * Filtering and paging are applied by the server, so the caller passes the
 * query state as `deps`. Responses are stamped with the query they belong to
 * and a mismatch is ignored, so a slow reply for the previous filter can never
 * overwrite the results the user is already looking at.
 */
function useAssetQuery<T>(
  run: () => Promise<T>,
  deps: DependencyList,
): { data: T | null; loading: boolean; error: string | null } {
  const key = deps.join("|");

  const [state, setState] = useState<{
    key: string | null;
    data: T | null;
    error: string | null;
  }>({ key: null, data: null, error: null });

  useEffect(() => {
    let active = true;

    run()
      .then((data) => {
        if (active) {
          setState({ key, data, error: null });
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setState({
            key,
            data: null,
            error: cause instanceof Error ? cause.message : "Something went wrong",
          });
        }
      });

    return () => {
      active = false;
    };
    // `run` is rebuilt on every render, so the serialised deps are the real
    // trigger here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const settled = state.key !== null && state.key === key;

  return {
    data: settled ? state.data : null,
    error: settled ? state.error : null,
    loading: !settled,
  };
}

function PanelState({
  loading,
  error,
  empty,
  emptyMessage,
  children,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyMessage: string;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className="py-4">
        <TableSkeleton rows={4} columns={5} />
      </div>
    );
  }

  if (error) {
    return <p className="py-10 text-center text-sm text-rose-500">{error}</p>;
  }

  if (empty) {
    return <p className="py-10 text-center text-sm text-gray-500">{emptyMessage}</p>;
  }

  return <>{children}</>;
}

const assetStatusStyles: Record<AssetStatus, string> = {
  in_use: "bg-emerald-50 text-emerald-600",
  available: "bg-blue-50 text-blue-600",
  pending_return: "bg-orange-50 text-orange-500",
  maintenance: "bg-violet-50 text-violet-600",
};

const requestStatusStyles: Record<AssetRequestStatus, string> = {
  pending: "bg-orange-50 text-orange-500",
  approved: "bg-emerald-50 text-emerald-600",
  rejected: "bg-rose-50 text-rose-600",
};

function AssetStatusBadge({ status }: { status: AssetStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${assetStatusStyles[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {ASSET_STATUS_LABELS[status]}
    </span>
  );
}

function RequestStatusBadge({ status }: { status: AssetRequestStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium ${requestStatusStyles[status]}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function PersonAvatar({ name }: { name: string }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e0e7ff] text-[10px] font-bold text-[#4338ca]">
      {initialsForAsset(name)}
    </span>
  );
}

function SectionTitle({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <h3 className="shrink-0 text-[15px] font-bold text-gray-900">{title}</h3>
      {action}
    </div>
  );
}

function ViewAllLink({
  onClick,
  label = "View All →",
}: {
  onClick?: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 whitespace-nowrap text-[11px] font-semibold text-[#2563eb] hover:underline"
    >
      {label}
    </button>
  );
}

/** Page numbers to render around the current page, with ellipsis for the rest. */
function pageWindow(page: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= 5) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const start = Math.min(Math.max(page - 1, 1), pageCount - 4);
  const pages = Array.from({ length: 5 }, (_, index) => start + index);

  return [
    ...(start > 1 ? [1, "gap" as const] : []),
    ...pages,
    ...(start + 4 < pageCount ? ["gap" as const, pageCount] : []),
  ];
}

function Pagination({
  page,
  pageCount,
  onPageChange,
  summary,
  className = "mt-5",
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  summary: string;
  /** `mt-auto` pins the footer to the bottom of a full-height panel. */
  className?: string;
}) {
  if (pageCount <= 1) {
    return <p className={`${className} text-sm text-gray-500`}>{summary}</p>;
  }

  return (
    <div className={`${className} flex flex-wrap items-center justify-between gap-3`}>
      <p className="text-sm text-gray-500">{summary}</p>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Previous page"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition hover:bg-gray-50 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {pageWindow(page, pageCount).map((entry, index) =>
          entry === "gap" ? (
            <span key={`gap-${index}`} className="px-1 text-sm text-gray-400">
              &hellip;
            </span>
          ) : (
            <button
              key={entry}
              type="button"
              onClick={() => onPageChange(entry)}
              aria-current={entry === page ? "page" : undefined}
              className={`flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-sm font-semibold transition ${
                entry === page
                  ? "border-[#2563eb] bg-[#2563eb] text-white"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {entry}
            </button>
          ),
        )}

        <button
          type="button"
          aria-label="Next page"
          disabled={page === pageCount}
          onClick={() => onPageChange(page + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition hover:bg-gray-50 disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Overview                                  */
/* -------------------------------------------------------------------------- */

const PAGE_SIZE = 7;

/** How many rows "View All Assets" pulls back in one page. */
const ALL_ASSETS_LIMIT = 100;

interface OverviewFilters {
  search: string;
  category: string;
  status: string;
  page: number;
}

const EMPTY_FILTERS: OverviewFilters = { search: "", category: "", status: "", page: 1 };

function AssetOverview({
  filters,
  onFiltersChange,
  version,
  showAll,
  onToggleShowAll,
  onViewAsset,
  onEditAsset,
  onReturnAsset,
  onDeleteAsset,
}: {
  filters: OverviewFilters;
  onFiltersChange: (next: OverviewFilters) => void;
  version: number;
  showAll: boolean;
  onToggleShowAll: () => void;
  onViewAsset: (asset: Asset) => void;
  onEditAsset: (asset: Asset) => void;
  onReturnAsset: (asset: Asset) => void;
  onDeleteAsset: (asset: Asset) => void;
}) {
  const { search, category: categoryFilter, status: statusFilter, page } = filters;

  // "Show all" is a single oversized page rather than a paginated walk, so the
  // page control collapses out of the way while it is on.
  const activePage = showAll ? 1 : page;
  const limit = showAll ? ALL_ASSETS_LIMIT : PAGE_SIZE;

  const [menu, setMenu] = useState<{ id: string; top: number; left: number } | null>(
    null,
  );

  const { data, loading, error } = useAssetQuery<Paginated<Asset>>(
    () =>
      assetService.listAssets({
        search: search.trim() || undefined,
        category: (categoryFilter || undefined) as AssetCategory | undefined,
        status: (statusFilter || undefined) as AssetStatus | undefined,
        page: activePage,
        limit,
      }),
    [search, categoryFilter, statusFilter, activePage, limit, version],
  );

  const visibleAssets = data?.items ?? [];
  const total = data?.total ?? 0;

  // The dropdown is anchored to the row id, so the row it refers to has to be
  // resolved from the loaded page.
  const menuAsset = visibleAssets.find((entry) => entry.id === menu?.id) ?? null;

  const pageCount = showAll ? 1 : Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(activePage, pageCount);

  const firstRow = total ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const lastRow = showAll ? total : Math.min(currentPage * PAGE_SIZE, total);

  /** Anchored to the viewport so the scroll container cannot clip it. */
  function toggleMenu(id: string, trigger: HTMLButtonElement) {
    if (menu?.id === id) {
      setMenu(null);
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const menuWidth = 160;
    const menuHeight = 180;

    const left = Math.min(
      Math.max(rect.right - menuWidth, 16),
      Math.max(16, window.innerWidth - menuWidth - 16),
    );

    const top = Math.min(
      Math.max(rect.bottom + 4, 16),
      Math.max(16, window.innerHeight - menuHeight - 16),
    );

    setMenu({
      id,
      top,
      left,
    });
  }

  function setFilter<K extends keyof OverviewFilters>(
    key: K,
    value: OverviewFilters[K],
  ) {
    onFiltersChange({ ...filters, [key]: value });
  }

  return (
    // `h-full` lets the card fill its grid band so Asset Overview and Asset
    // Allocation stay the same size; the table itself keeps its natural height.
    <div className={`${PANEL_CLASS} flex h-full min-w-0 flex-col`}>
      <SectionTitle
        title="Asset Overview"
        action={
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 lg:w-auto lg:flex-nowrap">
            <button
              type="button"
              onClick={onToggleShowAll}
              className={`h-10 shrink-0 whitespace-nowrap rounded-full border px-4 text-xs font-semibold transition ${
                showAll
                  ? "border-[#2563eb] bg-[#2563eb] text-white hover:bg-blue-700"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900"
              }`}
            >
              {showAll ? "Show Less" : "View All Assets"}
            </button>

            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(event) => setFilter("category", event.target.value)}
                aria-label="Filter by category"
                className={`${FILTER_CONTROL_CLASS} w-full sm:w-36`}
              >
                <option value="">All Categories</option>
                {ASSET_CATEGORIES.map((category) => (
                  <option key={category.label} value={category.label}>
                    {category.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>

            <div className="relative">
              <select
                value={statusFilter}
                onChange={(event) => setFilter("status", event.target.value)}
                aria-label="Filter by status"
                className={`${FILTER_CONTROL_CLASS} w-full sm:w-32`}
              >
                <option value="">All Status</option>
                {ASSET_STATUS_ORDER.map((status) => (
                  <option key={status} value={status}>
                    {ASSET_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>

            <div className="relative w-full sm:w-auto sm:flex-1 lg:w-64">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(event) => setFilter("search", event.target.value)}
                placeholder="Search by name or ID"
                className="h-10 w-full rounded-full border border-gray-200 pl-10 pr-4 text-sm text-gray-700 transition hover:border-gray-300 focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/10"
              />
            </div>
          </div>
        }
      />

      <PanelState
        loading={loading}
        error={error}
        empty={visibleAssets.length === 0}
        emptyMessage={
          search || categoryFilter || statusFilter
            ? "No assets match the current filters."
            : "No assets yet. Use Add Asset to record your first one."
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-bold uppercase tracking-wide text-gray-600">
                <th className="whitespace-nowrap px-2.5 pb-3">Asset ID</th>
                <th className="whitespace-nowrap px-2.5 pb-3">Asset Name</th>
                <th className="whitespace-nowrap px-2.5 pb-3">Category</th>
                <th className="hidden whitespace-nowrap px-2.5 pb-3 2xl:table-cell">
                  Brand / Model
                </th>
                <th className="whitespace-nowrap px-2.5 pb-3">Assigned To</th>
                <th className="hidden whitespace-nowrap px-2.5 pb-3 min-[1700px]:table-cell">
                  Issue Date
                </th>
                <th className="whitespace-nowrap px-2.5 pb-3">Status</th>
                <th className="whitespace-nowrap px-2.5 pb-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {visibleAssets.map((asset) => (
                <AssetRow
                  key={asset.id}
                  asset={asset}
                  menuOpen={menu?.id === asset.id}
                  onOpenMenu={(trigger) => toggleMenu(asset.id, trigger)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </PanelState>

      <Pagination
        page={currentPage}
        pageCount={pageCount}
        onPageChange={(next) => setFilter("page", next)}
        className="mt-auto pt-5"
        summary={`Showing ${firstRow} to ${lastRow} of ${total} assets`}
      />

      {/* Rendered outside the scroll container, which would clip it. */}
      {menu && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={() => setMenu(null)}
            className="fixed inset-0 z-40 cursor-default"
          />

          <div
            style={{ top: menu.top, left: menu.left }}
            className="fixed z-50 w-40 rounded-xl border border-gray-100 bg-white p-1 shadow-lg"
          >
            {menuAsset && (
              <>
                <MenuItem
                  icon={Eye}
                  label="View details"
                  onClick={() => {
                    onViewAsset(menuAsset);
                    setMenu(null);
                  }}
                />
                <MenuItem
                  icon={Pencil}
                  label="Edit asset"
                  onClick={() => {
                    onEditAsset(menuAsset);
                    setMenu(null);
                  }}
                />
                <MenuItem
                  icon={RotateCcw}
                  label="Request return"
                  onClick={() => {
                    onReturnAsset(menuAsset);
                    setMenu(null);
                  }}
                />
                {/* The API refuses to delete an asset somebody still holds, so the
                    action is withheld rather than offered as a guaranteed 409. */}
                {!menuAsset.assigned_to_employee_id && (
                  <MenuItem
                    icon={Trash2}
                    label="Delete asset"
                    tone="danger"
                    onClick={() => {
                      onDeleteAsset(menuAsset);
                      setMenu(null);
                    }}
                  />
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function AssetRow({
  asset,
  menuOpen,
  onOpenMenu,
}: {
  asset: Asset;
  menuOpen: boolean;
  onOpenMenu: (trigger: HTMLButtonElement) => void;
}) {
  const Icon = ASSET_CATEGORY_ICONS[asset.category] ?? Package;

  return (
    <tr className="border-b border-gray-50 last:border-0">
      <td className="whitespace-nowrap px-2.5 py-4 font-semibold text-[#2563eb]">
        {asset.asset_tag}
      </td>

      <td className="px-2.5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
            <Icon className="h-4 w-4 shrink-0 text-[#2563eb]" />
          </span>
          <span className="whitespace-nowrap font-semibold text-gray-900">{asset.name}</span>
        </div>
      </td>

      <td className="whitespace-nowrap px-2.5 py-4 text-gray-600">{asset.category}</td>
      <td className="hidden whitespace-nowrap px-2.5 py-4 text-gray-600 2xl:table-cell">
        {asset.brand_model ?? "-"}
      </td>

      <td className="whitespace-nowrap px-2.5 py-4 text-gray-600">
        {asset.assigned_to_name ?? "-"}
      </td>

      <td className="hidden whitespace-nowrap px-2.5 py-4 text-gray-600 min-[1700px]:table-cell">
        {formatDate(asset.issue_date)}
      </td>

      <td className="px-2.5 py-4">
        <AssetStatusBadge status={asset.status} />
      </td>

      <td className="px-2.5 py-4">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={(event) => onOpenMenu(event.currentTarget)}
            aria-label={`Actions for ${asset.asset_tag}`}
            aria-expanded={menuOpen}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-50 hover:text-gray-600"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  tone = "default",
}: {
  icon: typeof Eye;
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs font-medium transition ${
        tone === "danger"
          ? "text-rose-600 hover:bg-rose-50 hover:text-rose-700"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      }`}
    >
      <Icon
        className={`h-3.5 w-3.5 shrink-0 ${tone === "danger" ? "text-rose-400" : "text-gray-400"}`}
      />
      {label}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*                        Categories, requests, quick actions                 */
/* -------------------------------------------------------------------------- */

const DONUT_RADIUS = 62;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;
const DONUT_STROKE_WIDTH = 22;

function AssetCategoriesPanel({
  categoryCounts,
  total,
}: {
  categoryCounts: CategoryCount[];
  total: number;
}) {
  const countByCategory = new Map(
    categoryCounts.map((entry) => [entry.category, entry.count]),
  );

  const counts = ASSET_CATEGORIES.map((meta) => countByCategory.get(meta.label) ?? 0);

  // Driven by ASSET_CATEGORIES rather than the response order, so the donut
  // slices and legend colours always match regardless of what the API returns.
  const segments = ASSET_CATEGORIES.map((meta, index) => {
    const count = counts[index];
    const dash = total ? (count / total) * DONUT_CIRCUMFERENCE : 0;
    const offset = counts
      .slice(0, index)
      .reduce(
        (sum, previous) => sum + (total ? (previous / total) * DONUT_CIRCUMFERENCE : 0),
        0,
      );

    return { ...meta, count, dash, offset };
  });

  return (
    <div className={`${PANEL_CLASS} flex h-full min-w-0 flex-col`}>
      <SectionTitle title="Asset Categories" />

      <div className="flex flex-1 items-center gap-3">
        <svg
          viewBox="0 0 160 160"
          className="h-[100px] w-[100px] shrink-0"
          role="img"
          aria-label="Asset distribution by category"
        >
          <g transform="translate(80, 80) rotate(-90)">
            <circle
              r={DONUT_RADIUS}
              fill="none"
              stroke="#f8fafc"
              strokeWidth={DONUT_STROKE_WIDTH}
            />

            {segments.map((segment) => (
              <circle
                key={segment.label}
                r={DONUT_RADIUS}
                fill="none"
                stroke={segment.color}
                strokeWidth={DONUT_STROKE_WIDTH}
                strokeDasharray={`${segment.dash} ${DONUT_CIRCUMFERENCE - segment.dash}`}
                strokeDashoffset={-segment.offset}
              />
            ))}
          </g>

          <text x="80" y="76" textAnchor="middle" className="fill-gray-900 text-[20px] font-bold">
            {total}
          </text>
          <text x="80" y="93" textAnchor="middle" className="fill-gray-400 text-[9px]">
            Total Assets
          </text>
        </svg>

        <ul className="min-w-0 flex-1 space-y-1">
          {segments.map((segment) => (
            <li key={segment.label} className="flex items-center gap-2 text-[11px]">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: segment.color }}
              />
              <span className="min-w-0 flex-1 truncate text-gray-600">{segment.label}</span>
              <span className="shrink-0 font-semibold text-gray-800">{segment.count}</span>
              <span className="w-11 shrink-0 text-right text-gray-400">
                {((segment.count / Math.max(1, total)) * 100).toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const RECENT_ALLOCATION_LIMIT = 5;

const ALL_ALLOCATIONS_LIMIT = 100;

/**
 * Who was handed what, most recently first.
 *
 * This reads the assets that currently have a holder rather than the request
 * queue: an allocation has happened by the time it shows up here, whereas a
 * request is only an intention.
 */
function RecentAllocationPanel({ version }: { version: number }) {
  const [showAll, setShowAll] = useState(false);
  const limit = showAll ? ALL_ALLOCATIONS_LIMIT : RECENT_ALLOCATION_LIMIT;

  const { data, loading, error } = useAssetQuery<Asset[]>(
    () => assetService.listRecentAllocations(limit),
    [limit, version],
  );

  const allocations = data ?? [];

  return (
    <div className={`${PANEL_CLASS} flex h-full min-w-0 flex-col`}>
      <SectionTitle
        title="Recent Allocation"
        action={
          <ViewAllLink
            onClick={() => setShowAll((previous) => !previous)}
            label={showAll ? "Show Less ←" : "View All →"}
          />
        }
      />

      <PanelState
        loading={loading}
        error={error}
        empty={allocations.length === 0}
        emptyMessage="Nothing has been allocated yet."
      >
        <ul className="flex flex-1 flex-col gap-2.5">
          {allocations.map((asset) => (
            <li
              key={asset.id}
              className="flex items-center gap-2.5 rounded-2xl border border-gray-100 p-2.5"
            >
              <PersonAvatar name={asset.assigned_to_name ?? "?"} />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">
                  {asset.assigned_to_name ?? "Unassigned"}
                </p>
                <p className="truncate text-[11px] text-gray-400">
                  {asset.asset_tag} - {asset.name}
                </p>
                <p className="mt-0.5 text-[11px] text-gray-400">
                  Allocated on {formatDate(asset.issue_date)}
                </p>
              </div>

              <AssetStatusBadge status={asset.status} />
            </li>
          ))}
        </ul>
      </PanelState>
    </div>
  );
}

interface QuickAction {
  /** Stable across label changes, so a tile keeps its identity while busy. */
  id: string;
  label: string;
  icon: typeof Plus;
  iconBg: string;
  iconColor: string;
  /** Undefined marks a decorative button that is not wired up yet. */
  run?: () => void;
  /** Marks a wired tile that is temporarily unavailable. */
  busy?: boolean;
}

interface QuickActionsPanelProps {
  onAdd: () => void;
  onAssign: () => void;
  onReturn: () => void;
  onViewAll: () => void;
  onGenerateReport: () => void;
  /** True while the report is being assembled, so the tile can show progress. */
  generatingReport: boolean;
}

function QuickActionsPanel({
  onAdd,
  onAssign,
  onReturn,
  onViewAll,
  onGenerateReport,
  generatingReport,
}: QuickActionsPanelProps) {
  const actions: QuickAction[] = [
    {
      id: "add",
      label: "Add Asset",
      icon: Plus,
      iconBg: "bg-blue-50",
      iconColor: "text-[#2563eb]",
      run: onAdd,
    },
    {
      id: "assign",
      label: "Assign Asset",
      icon: UserPlus,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      run: onAssign,
    },
    {
      id: "return",
      label: "Request Return",
      icon: RotateCcw,
      iconBg: "bg-orange-50",
      iconColor: "text-orange-500",
      run: onReturn,
    },
    {
      id: "view-all",
      label: "View All Assets",
      icon: Eye,
      iconBg: "bg-violet-50",
      iconColor: "text-violet-600",
      run: onViewAll,
    },
    {
      id: "generate-report",
      label: generatingReport ? "Building..." : "Generate Report",
      icon: BarChart3,
      iconBg: "bg-cyan-50",
      iconColor: "text-cyan-600",
      run: generatingReport ? undefined : onGenerateReport,
      busy: generatingReport,
    },
    {
      id: "settings",
      label: "Asset Settings",
      icon: Settings2,
      iconBg: "bg-slate-100",
      iconColor: "text-slate-500",
    },
  ];

  return (
    <div className={`${PANEL_CLASS} flex h-full min-w-0 flex-col`}>
      <SectionTitle title="Quick Actions" />

      {/* 3 columns x 2 rows, with `auto-rows-fr` so the two rows split the
          height the panel is given by the grid. */}
      <div className="grid flex-1 grid-cols-3 auto-rows-fr gap-3">
        {actions.map((action) => {
          const Icon = action.icon;
          const disabled = !action.run;

          return (
            <button
              key={action.id}
              type="button"
              disabled={disabled}
              onClick={action.run}
              title={
                disabled
                  ? action.busy
                    ? "Generating the report"
                    : "Not available yet"
                  : undefined
              }
              className={`flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl border border-gray-100 p-2.5 text-center transition ${
                disabled
                  ? `cursor-not-allowed opacity-45 ${action.busy ? "animate-pulse" : ""}`
                  : "hover:bg-gray-50"
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${action.iconBg}`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${action.iconColor}`} />
              </span>
              <span className="min-w-0 text-[10px] font-medium leading-tight text-gray-700">
                {action.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                            Allocation & returns                           */
/* -------------------------------------------------------------------------- */

type AllocationTab = "employee" | "department";

const ALLOCATION_PAGE_SIZE = 5;

function AssetAllocationPanel({
  version,
  onViewAllocation,
}: {
  version: number;
  onViewAllocation: (target: AllocationDetailTarget) => void;
}) {
  const [tab, setTab] = useState<AllocationTab>("employee");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);

  const { data, loading, error } = useAssetQuery<Paginated<AllocationRow>>(
    () =>
      assetService.getAllocation({
        view: tab,
        search: search.trim() || undefined,
        category: (categoryFilter || undefined) as AssetCategory | undefined,
        page,
        limit: ALLOCATION_PAGE_SIZE,
      }),
    [tab, search, categoryFilter, page, version],
  );

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  const pageCount = Math.max(1, Math.ceil(total / ALLOCATION_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);

  const firstRow = total ? (currentPage - 1) * ALLOCATION_PAGE_SIZE + 1 : 0;
  const lastRow = Math.min(currentPage * ALLOCATION_PAGE_SIZE, total);

  const tabClass = (value: AllocationTab) =>
    `border-b-2 pb-2 text-sm font-medium transition ${
      tab === value
        ? "border-[#2563eb] text-[#2563eb]"
        : "border-transparent text-gray-500 hover:text-gray-700"
    }`;

  function resetFilters() {
    setSearch("");
    setCategoryFilter("");
    setPage(1);
  }

  return (
    <div className={`${PANEL_CLASS} flex h-full min-w-0 flex-col`}>
      <SectionTitle title="Asset Allocation" />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setTab("employee");
              setPage(1);
            }}
            className={tabClass("employee")}
          >
            By Employee
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("department");
              setPage(1);
            }}
            className={tabClass("department")}
          >
            By Department
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={tab === "employee" ? "Search employee..." : "Search department..."}
              className="h-10 w-44 rounded-full border border-gray-200 pl-9 pr-3 text-[10px] text-gray-700 transition hover:border-gray-300 focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/10"
            />
          </div>

          <div className="relative">
            <select
              value={categoryFilter}
              onChange={(event) => {
                setCategoryFilter(event.target.value);
                setPage(1);
              }}
              aria-label="Filter allocation by asset category"
              className={`${FILTER_CONTROL_CLASS} w-24 text-[10px]`}
            >
              <option value="">All Assets</option>
              {ASSET_CATEGORIES.map((category) => (
                <option key={category.label} value={category.label}>
                  {category.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        </div>
      </div>

      <PanelState
        loading={loading}
        error={error}
        empty={rows.length === 0}
        emptyMessage="No records match the current filters."
      >
        <div className="min-h-0 flex-1">
          <table className="h-full w-full table-fixed text-left text-[11px]">
            <thead>
              <tr className="bg-[#f1f5fb] text-[9px] font-bold uppercase tracking-wide text-[#1e3a8a]">
                {tab === "employee" ? (
                  <>
                    <th className="w-[26%] rounded-l-xl px-1.5 py-2.5 leading-tight">
                      Employee ID
                    </th>
                    <th className="w-[34%] px-1.5 py-2.5 leading-tight">Employee Name</th>
                    <th className="w-[20%] px-1.5 py-2.5 leading-tight">Assets Assigned</th>
                    <th className="w-[20%] rounded-r-xl px-1.5 py-2.5 text-right leading-tight">
                      View
                    </th>
                  </>
                ) : (
                  <>
                    <th className="w-[36%] rounded-l-xl px-2 py-2.5 leading-tight">
                      Department
                    </th>
                    <th className="w-[21%] px-2 py-2.5 leading-tight">Employees</th>
                    <th className="w-[28%] px-2 py-2.5 leading-tight">Assets Assigned</th>
                    <th className="w-[15%] rounded-r-xl px-2 py-2.5 text-right leading-tight">
                      View
                    </th>
                  </>
                )}
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-gray-50 last:border-0">
                  {tab === "employee" ? (
                    <>
                      <td className="truncate px-1.5 py-5 font-semibold text-[#2563eb]">
                        {row.id}
                      </td>
                      <td className="truncate px-1.5 py-5 font-semibold text-gray-900">
                        {row.name}
                      </td>
                      <td className="truncate px-1.5 py-5 text-gray-600">{row.asset_count}</td>
                    </>
                  ) : (
                    <>
                      <td className="truncate px-2 py-5 font-semibold text-gray-900">
                        {row.name}
                      </td>
                      <td className="truncate px-2 py-5 text-gray-600">{row.employees}</td>
                      <td className="truncate px-2 py-5 text-gray-600">{row.asset_count}</td>
                    </>
                  )}

                  <td className="px-1.5 py-5 text-right">
                    <button
                      type="button"
                      onClick={() => onViewAllocation({ view: tab, row })}
                      className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-[#2563eb] transition hover:bg-blue-100"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelState>

      <Pagination
        page={currentPage}
        pageCount={pageCount}
        onPageChange={setPage}
        className="mt-4"
        summary={`Showing ${firstRow} to ${lastRow} of ${total} ${
          tab === "employee" ? "employees" : "departments"
        }`}
      />

      {error && (
        <button
          type="button"
          onClick={resetFilters}
          className="mt-2 text-xs font-semibold text-[#2563eb] hover:underline"
        >
          Reset filters
        </button>
      )}
    </div>
  );
}

function AssetReturnRequestsPanel({
  version,
  onConfirmReturn,
}: {
  version: number;
  onConfirmReturn: (request: AssetRequest) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const limit = showAll ? ALL_ALLOCATIONS_LIMIT : 5;

  const { data, loading, error } = useAssetQuery<Paginated<AssetRequest>>(
    () => assetService.listRequests({ request_type: "return", limit }),
    [limit, version],
  );

  const requests = data?.items ?? [];

  // A return request sits on Pending until the admin confirms receipt, and only
  // then does the asset actually leave the employee. Both halves have to hold
  // for the action to be offered: still pending on the request, and still held
  // by somebody on the asset (`asset_status` is resolved by the API for
  // exactly this reason).
  const canMarkReturned = (request: AssetRequest) =>
    request.status === "pending" &&
    request.asset_id !== null &&
    (request.asset_status === "in_use" || request.asset_status === "pending_return");

  return (
    <div className={`${PANEL_CLASS} flex h-full min-w-0 flex-col`}>
      <SectionTitle
        title="Asset Return Requests"
        action={
          <ViewAllLink
            onClick={() => setShowAll((previous) => !previous)}
            label={showAll ? "Show Less ←" : "View All →"}
          />
        }
      />

      <PanelState
        loading={loading}
        error={error}
        empty={requests.length === 0}
        emptyMessage="No return requests yet."
      >
        <div className="min-h-0 flex-1">
          <table className="w-full table-fixed text-left text-[11px]">
            <thead>
              <tr className="bg-[#f1f5fb] text-[9px] font-bold uppercase tracking-wide text-[#1e3a8a]">
                <th className="w-[22%] rounded-l-xl px-1 py-2.5 leading-tight">Request ID</th>
                <th className="w-[24%] px-1 py-2.5 leading-tight">Asset Name</th>
                <th className="w-[22%] px-1 py-2.5 leading-tight">Employee</th>
                <th className="w-[15%] px-1 py-2.5 text-right leading-tight">Status</th>
                <th className="w-[17%] rounded-r-xl px-1 py-2.5 text-right leading-tight">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {requests.map((request) => (
                <tr key={request.id} className="border-b border-gray-50 last:border-0">
                  <td className="truncate px-1 py-3 font-semibold text-[#2563eb]">
                    {request.request_tag}
                  </td>
                  <td className="truncate px-1 py-3 text-gray-700">{request.asset_name}</td>
                  <td className="truncate px-1 py-3 text-gray-600">{request.employee_name}</td>
                  <td className="px-1 py-3 text-right">
                    <RequestStatusBadge status={request.status} />
                  </td>
                  <td className="px-1 py-3 text-right">
                    {canMarkReturned(request) ? (
                      <button
                        type="button"
                        onClick={() => onConfirmReturn(request)}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-600 transition hover:bg-emerald-100"
                      >
                        <Check className="h-3 w-3" />
                        Mark Returned
                      </button>
                    ) : (
                      <span className="text-[10px] text-gray-300">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelState>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    Page                                    */
/* -------------------------------------------------------------------------- */

type ModalState =
  | { kind: "form"; asset: Asset | null }
  | { kind: "assign"; assetId?: string }
  | { kind: "return"; assetId?: string }
  | { kind: "detail"; asset: Asset }
  | { kind: "allocation"; target: AllocationDetailTarget }
  | { kind: "delete"; asset: Asset }
  | { kind: "markReturned"; request: AssetRequest }
  | null;

export default function AdminAssets() {
  const [version, setVersion] = useState(0);
  const [filters, setFilters] = useState<OverviewFilters>(EMPTY_FILTERS);
  const [showAllAssets, setShowAllAssets] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const overviewRef = useRef<HTMLDivElement>(null);

  const { data: stats, error: statsError } = useAssetQuery<AssetStats>(
    () => assetService.getStats(),
    [version],
  );

  // Every panel watches `version`, so one bump refetches stats, categories,
  // assets, allocation and requests together after a mutation.
  function refresh() {
    setVersion((previous) => previous + 1);
  }

  async function handleSaved(message: string) {
    refresh();
    setNotice({ type: "success", text: message });
  }

  function handleViewAllAssets() {
    setShowAllAssets(true);
    setFilters(EMPTY_FILTERS);
    overviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /**
   * Exports the asset register as CSV.
   *
   * The filters in the overview panel are respected, so the report matches what
   * the admin was looking at - but it walks every page of the match instead of
   * exporting only the rows on screen.
   */
  async function handleGenerateReport() {
    if (generatingReport) return;

    setGeneratingReport(true);

    const params = {
      search: filters.search.trim() || undefined,
      category: (filters.category || undefined) as AssetCategory | undefined,
      status: (filters.status || undefined) as AssetStatus | undefined,
    };

    try {
      const collected: Asset[] = [];
      let page = 1;
      let total = 0;

      // The endpoint caps a page at 100, so walk until the rows run out. The
      // empty-page break guards against a server that reports a total it will
      // not actually hand over.
      do {
        const batch = await assetService.listAssets({
          ...params,
          page,
          limit: REPORT_PAGE_SIZE,
        });

        collected.push(...batch.items);
        total = batch.total;
        page += 1;

        if (batch.items.length === 0) break;
      } while (collected.length < total);

      if (collected.length === 0) {
        setNotice({
          type: "error",
          text: "No assets match the current filters to report on.",
        });
        return;
      }

      downloadBlob(buildAssetsCsv(collected), reportFilename());
      setNotice({
        type: "success",
        text: `Report generated with ${formatCount(collected.length)} asset${collected.length === 1 ? "" : "s"}.`,
      });
    } catch {
      setNotice({
        type: "error",
        text: "Unable to generate the asset report.",
      });
    } finally {
      setGeneratingReport(false);
    }
  }

  // Wrapped in useCallback because the popup restarts its auto-dismiss timer
  // whenever onDismiss changes identity. An inline arrow would keep resetting
  // the countdown on every render and the popup would never disappear.
  const dismissNotice = useCallback(() => {
    setNotice(null);
  }, []);

  const counts = {
    total: stats?.total_assets ?? 0,
    // Pending returns are still in somebody's hands, so they count as assigned
    // here exactly as they did when this was computed client-side.
    assigned: (stats?.in_use ?? 0) + (stats?.pending_return ?? 0),
    available: stats?.available ?? 0,
    pendingReturn: stats?.pending_return ?? 0,
    categories: ASSET_CATEGORIES.length,
  };

  const share = (value: number) =>
    counts.total ? `${((value / counts.total) * 100).toFixed(1)}% of total` : "0% of total";

  const statCards = [
    {
      label: "Total Assets",
      value: formatCount(counts.total),
      note: "↑ 5% from last month",
      noteClass: "text-emerald-600",
      icon: Laptop,
      iconBg: "bg-blue-50",
      iconColor: "text-[#2563eb]",
    },
    {
      label: "Assigned",
      value: formatCount(counts.assigned),
      note: share(counts.assigned),
      noteClass: "text-emerald-600",
      icon: Users,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
    },
    {
      label: "Available",
      value: formatCount(counts.available),
      note: share(counts.available),
      noteClass: "text-rose-600",
      icon: Package,
      iconBg: "bg-amber-50",
      iconColor: "text-orange-500",
    },
    {
      label: "Pending Return",
      value: formatCount(counts.pendingReturn),
      note: share(counts.pendingReturn),
      noteClass: "text-rose-600",
      icon: Clock,
      iconBg: "bg-rose-50",
      iconColor: "text-rose-500",
    },
    {
      label: "Asset Categories",
      value: String(counts.categories),
      icon: FileText,
      iconBg: "bg-violet-50",
      iconColor: "text-violet-600",
    },
  ];

  return (
    // `overflow-x-hidden` is a backstop only: the panels all carry `min-w-0`
    // so they cannot exceed their grid track, but a single wide descendant
    // anywhere below would otherwise scroll the whole page sideways.
    <div className="overflow-x-hidden px-5 pb-10 pt-8 sm:px-8 xl:px-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 xl:text-4xl">Asset Management</h1>
          <p className="mt-1 text-gray-500">
            Track, assign and manage company assets assigned to employees.
          </p>
        </div>
      </div>

      {statsError && (
        <p className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
          Could not load asset summary: {statsError}
        </p>
      )}

      <NoticePopup notice={notice} onDismiss={dismissNotice} />

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {statCards.map((card) => {
          const Icon = card.icon;

          return (
            <div key={card.label} className={KPI_CARD_CLASS}>
              <div className="flex items-start gap-3">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.iconBg}`}
                >
                  <Icon className={`h-5 w-5 shrink-0 ${card.iconColor}`} />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-gray-900">{card.label}</p>
                  <p className="mt-1 truncate text-2xl font-bold leading-tight text-gray-900">
                    {card.value}
                  </p>
                  {/* Only the cards that carry a note render one, so a card
                      without it leaves no blank line behind. */}
                  {card.note && (
                    <p className={`mt-0.5 truncate text-xs font-semibold ${card.noteClass}`}>
                      {card.note}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Two bands with different column templates: the top band keeps the wide
          layout (Overview + 340px rail), while the bottom band is a 50/50 split
          so Asset Allocation takes exactly half the page and Return Requests /
          Quick Actions share the other half. */}
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div ref={overviewRef} className="min-w-0 scroll-mt-24">
            <AssetOverview
              filters={filters}
              onFiltersChange={setFilters}
              version={version}
              showAll={showAllAssets}
              onToggleShowAll={() => setShowAllAssets((previous) => !previous)}
              onViewAsset={(asset) => setModal({ kind: "detail", asset })}
              onEditAsset={(asset) => setModal({ kind: "form", asset })}
              onReturnAsset={(asset) => setModal({ kind: "return", assetId: asset.id })}
              onDeleteAsset={(asset) => setModal({ kind: "delete", asset })}
            />
          </div>

          <div className="grid min-w-0 items-stretch gap-6 xl:grid-rows-[minmax(auto,1fr)_minmax(auto,1fr)]">
            <AssetCategoriesPanel
              categoryCounts={stats?.category_counts ?? []}
              total={stats?.total_assets ?? 0}
            />
            <RecentAllocationPanel version={version} />
          </div>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-2">
          <AssetAllocationPanel
            version={version}
            onViewAllocation={(target) => setModal({ kind: "allocation", target })}
          />

          {/* Return Requests keeps its natural height, Quick Actions absorbs the
              remainder so the pair matches Asset Allocation's height. `1fr` has a
              min-content floor, so the band grows rather than clipping. */}
          <div className="grid min-w-0 items-stretch gap-6 xl:grid-rows-[auto_1fr]">
            <AssetReturnRequestsPanel
              version={version}
              onConfirmReturn={(request) => setModal({ kind: "markReturned", request })}
            />
            <QuickActionsPanel
              onAdd={() => setModal({ kind: "form", asset: null })}
              onAssign={() => setModal({ kind: "assign" })}
              onReturn={() => setModal({ kind: "return" })}
              onViewAll={handleViewAllAssets}
              onGenerateReport={handleGenerateReport}
              generatingReport={generatingReport}
            />
          </div>
        </div>
      </div>

      {modal?.kind === "form" && (
        <AssetFormModal
          asset={modal.asset}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {modal?.kind === "assign" && (
        <AssetAssignModal
          assetId={modal.assetId}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {modal?.kind === "return" && (
        <AssetReturnModal
          assetId={modal.assetId}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {modal?.kind === "detail" && (
        <AssetDetailModal asset={modal.asset} onClose={() => setModal(null)} />
      )}

      {modal?.kind === "allocation" && (
        <AssetAllocationDetailModal
          target={modal.target}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.kind === "markReturned" && (
        <MarkReturnedModal
          request={modal.request}
          onClose={() => setModal(null)}
          onConfirmed={handleSaved}
        />
      )}

      {modal?.kind === "delete" && (
        <AssetDeleteModal
          asset={modal.asset}
          onClose={() => setModal(null)}
          onDeleted={handleSaved}
        />
      )}
    </div>
  );
}