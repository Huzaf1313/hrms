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
  const total = totalItems !== undefined ? totalItems : data.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div
      className={`flex flex-col w-full rounded-[8px] border border-[#E4E6E1] bg-white overflow-hidden shadow-none ${className}`}
    >
      {/* Panel Title Header */}
      {title && (
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E4E6E1] bg-white shrink-0">
          {typeof title === "string" ? (
            <h3 className="text-[14px] font-semibold text-[#1F2933]">{title}</h3>
          ) : (
            title
          )}
        </div>
      )}

      {/* Toolbar */}
      {hasToolbar && (
        <div className="flex flex-row items-center flex-wrap gap-3 px-6 py-4 border-b border-[#E4E6E1] bg-white w-full">
          {onSearchChange && (
            <div className="relative flex-1 min-w-[220px] max-w-[320px] shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 shrink-0 text-[#7B8794]" />
              <input
                type="text"
                value={searchQuery ?? ""}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full h-10 pl-9 pr-3 text-sm bg-[#F6F7F5] rounded-[6px] border border-[#E4E6E1] text-[#1F2933] placeholder:text-[#7B8794] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2F5FD0] focus:border-[#2F5FD0] transition-colors"
              />
            </div>
          )}
          {filters}
          {actions && <div className="flex items-center gap-3 shrink-0 ml-auto">{actions}</div>}
        </div>
      )}

      {/* Table Container */}
      <div className="overflow-x-auto w-full">
        <table className="min-w-[960px] w-full border-collapse text-left text-sm">
          <thead
            className={`${
              stickyHeader ? "sticky top-0 z-10" : ""
            } h-11 border-b border-[#E4E6E1] text-[#7B8794] font-medium text-xs normal-case tracking-[0.02em]`}
          >
            <tr className="h-11">
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
                    className={`h-11 px-6 py-0 bg-[#F6F7F5] font-medium text-xs text-[#7B8794] normal-case select-none align-middle tracking-[0.02em] ${alignClass} ${
                      col.sortable ? "cursor-pointer hover:bg-[#F0F1EE] transition-colors" : ""
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
                        <span className="text-[#7B8794]">
                          {sortColumn === col.key ? (
                            sortDirection === "asc" ? (
                              <ChevronUp className="w-3.5 h-3.5 shrink-0 text-[#2F5FD0]" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 shrink-0 text-[#2F5FD0]" />
                            )
                          ) : (
                            <ChevronsUpDown className="w-3.5 h-3.5 shrink-0 text-[#7B8794]/50" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4E6E1] bg-white text-[#1F2933]">
            {isLoading ? (
              <TableRowSkeleton rows={5} columns={columns.length} />
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center">
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
                  className={`min-h-[64px] h-[64px] transition-colors hover:bg-[#FAFAF8] ${
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
                        className={`px-6 py-3 text-sm text-[#1F2933] whitespace-nowrap align-middle ${alignClass}`}
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
      {page !== undefined && onPageChange && (
        <div className="flex justify-between items-center px-6 py-4 border-t border-[#E4E6E1] bg-white">
          <div className="text-[13px] text-[#7B8794]">
            Showing{" "}
            <span className="font-medium text-[#1F2933]">
              {data.length > 0 ? (page - 1) * pageSize + 1 : 0}
            </span>{" "}
            to{" "}
            <span className="font-medium text-[#1F2933]">
              {Math.min(page * pageSize, total)}
            </span>{" "}
            of{" "}
            <span className="font-medium text-[#1F2933]">{total}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="w-8 h-8 flex items-center justify-center rounded-[6px] border border-[#E4E6E1] text-[#7B8794] hover:text-[#1F2933] hover:bg-[#F0F1EE] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4 shrink-0" />
            </button>
            <span className="mx-2 text-[13px] font-medium text-[#1F2933]">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="w-8 h-8 flex items-center justify-center rounded-[6px] border border-[#E4E6E1] text-[#7B8794] hover:text-[#1F2933] hover:bg-[#F0F1EE] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;
