import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
} from "lucide-react";
import { EmptyState } from "./EmptyState";
import { TableRowSkeleton } from "./Skeleton";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  width?: string;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  render?: (row: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  title?: React.ReactNode;
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  // Toolbar features
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  // Pagination
  page?: number;
  pageSize?: number;
  totalItems?: number;
  onPageChange?: (newPage: number) => void;
  // Sorting
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (columnKey: string) => void;
  className?: string;
  stickyHeader?: boolean;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  title,
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyTitle = "No records found",
  emptyDescription = "There is no data to display for the current filter criteria.",
  emptyAction,
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters,
  actions,
  page,
  pageSize = 10,
  totalItems,
  onPageChange,
  sortColumn,
  sortDirection,
  onSort,
  className = "",
  stickyHeader = true,
  onRowClick,
}: DataTableProps<T>) {
  const hasToolbar = onSearchChange || filters || actions;
  const totalPages =
    totalItems !== undefined && pageSize
      ? Math.max(1, Math.ceil(totalItems / pageSize))
      : undefined;

  return (
    <div className={`flex flex-col w-full rounded-[6px] border border-[#E5E7EB] bg-white overflow-hidden shadow-none ${className}`}>
      {/* Panel Title Header */}
      {title && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB] bg-white">
          {typeof title === "string" ? (
            <h3 className="text-[14px] font-semibold text-[#111827]">{title}</h3>
          ) : (
            title
          )}
        </div>
      )}

      {/* Toolbar */}
      {hasToolbar && (
        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-b border-[#E5E7EB] bg-[#F9FAFB]/50 overflow-x-auto flex-nowrap">
          <div className="flex items-center gap-2 flex-nowrap shrink-0">
            {onSearchChange && (
              <div className="relative w-48 sm:w-56 shrink-0">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#9CA3AF]" />
                <input
                  type="text"
                  value={searchQuery ?? ""}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full h-[32px] pl-8 pr-2.5 text-[13px] bg-white rounded-[6px] border border-[#E5E7EB] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
            {filters}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}

      {/* Table Container */}
      <div className="overflow-x-auto w-full">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead
            className={`${
              stickyHeader ? "sticky top-0 z-10" : ""
            } bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#6B7280] font-semibold text-[12px] normal-case tracking-normal`}
          >
            <tr>
              {columns.map((col) => {
                const alignClass =
                  col.align === "right"
                    ? "text-right"
                    : col.align === "center"
                    ? "text-center"
                    : "text-left";

                return (
                  <th
                    key={col.key}
                    style={{ width: col.width }}
                    className={`px-3.5 py-2.5 font-semibold text-[12px] text-[#6B7280] normal-case select-none ${alignClass} ${
                      col.sortable ? "cursor-pointer hover:bg-slate-100/80 transition-colors" : ""
                    }`}
                    onClick={() => {
                      if (col.sortable && onSort) {
                        onSort(col.key);
                      }
                    }}
                  >
                    <div
                      className={`inline-flex items-center gap-1.5 ${
                        col.align === "right"
                          ? "justify-end"
                          : col.align === "center"
                          ? "justify-center"
                          : "justify-start"
                      }`}
                    >
                      <span>{col.header}</span>
                      {col.sortable && (
                        <span className="text-[#9CA3AF]">
                          {sortColumn === col.key ? (
                            sortDirection === "asc" ? (
                              <ChevronUp className="w-3.5 h-3.5 text-blue-600" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
                            )
                          ) : (
                            <ChevronsUpDown className="w-3 h-3 text-[#D1D5DB]" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white text-[#111827]">
            {isLoading ? (
              <TableRowSkeleton rows={5} columns={columns.length} />
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  <EmptyState
                    title={emptyTitle}
                    description={emptyDescription}
                    action={emptyAction}
                  />
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr
                  key={keyExtractor(row)}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`h-[44px] transition-colors hover:bg-[#F9FAFB] border-b border-[#E5E7EB] last:border-b-0 ${
                    onRowClick ? "cursor-pointer" : ""
                  }`}
                >
                  {columns.map((col) => {
                    const alignClass =
                      col.align === "right"
                        ? "text-right"
                        : col.align === "center"
                        ? "text-center"
                        : "text-left";

                    return (
                      <td
                        key={col.key}
                        className={`px-3.5 py-0 text-[13px] text-[#111827] whitespace-nowrap align-middle ${alignClass}`}
                      >
                        {col.render
                          ? col.render(row, rowIndex)
                          : (row as Record<string, unknown>)[col.key] != null
                          ? String((row as Record<string, unknown>)[col.key])
                          : "-"}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages !== undefined && page !== undefined && onPageChange && (
        <div className="flex items-center justify-between px-3.5 py-2.5 border-t border-slate-200 bg-slate-50/50 text-xs text-slate-500">
          <div>
            Showing{" "}
            <span className="font-medium text-slate-700">
              {data.length > 0 ? (page - 1) * pageSize + 1 : 0}
            </span>{" "}
            to{" "}
            <span className="font-medium text-slate-700">
              {Math.min(page * pageSize, totalItems ?? 0)}
            </span>{" "}
            of{" "}
            <span className="font-medium text-slate-700">{totalItems ?? 0}</span> entries
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1 || isLoading}
              onClick={() => onPageChange(page - 1)}
              className="inline-flex items-center justify-center p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-slate-700 font-medium">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || isLoading}
              onClick={() => onPageChange(page + 1)}
              className="inline-flex items-center justify-center p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
