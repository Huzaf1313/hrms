import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  MoreVertical,
  Search,
  X,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { api, ApiError, downloadFile } from "../../services/api";

interface EmployeeDocument {
  id: string;
  employee_id: string;
  document_name: string;
  document_type: string;
  file_url: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

interface EmployeeDocumentSummary {
  total_documents: number;
  categories: Record<string, number>;
}

interface EmployeeDocumentsResponse {
  documents: EmployeeDocument[];
  summary: EmployeeDocumentSummary;
}

const DOCUMENTS_PER_PAGE = 7;

const CATEGORY_TABS = [
  "All Documents",
  "Payslips",
  "Tax & Payroll",
  "Employment",
  "Leave & Attendance",
  "Other",
] as const;

type CategoryTab = (typeof CATEGORY_TABS)[number];

export default function EmployeeDocuments() {
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [summary, setSummary] = useState<EmployeeDocumentSummary>({
    total_documents: 0,
    categories: {},
  });

  const [activeTab, setActiveTab] =
    useState<CategoryTab>("All Documents");

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedDocument, setSelectedDocument] =
    useState<EmployeeDocument | null>(null);

  const [loadingDocument, setLoadingDocument] = useState(false);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [downloadingId, setDownloadingId] =
    useState<string | null>(null);

  /*
   * Fetch employee documents from the real backend.
   *
   * The API endpoint:
   * GET /employee-documents
   *
   * Optional query parameters:
   * search
   * document_type
   */
  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError("");

      const documentType =
        activeTab === "All Documents" ? undefined : activeTab;

      const response =
        await api.get<EmployeeDocumentsResponse>(
          "/employee-documents",
          {
            search: searchTerm.trim() || undefined,
            document_type: documentType,
          }
        );

      setDocuments(response.documents ?? []);

      setSummary(
        response.summary ?? {
          total_documents: 0,
          categories: {},
        }
      );
    } catch (err) {
      console.error("Failed to fetch employee documents:", err);

      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(
          "Unable to load your documents. Please try again."
        );
      }

      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  /*
   * Load documents whenever the selected category changes.
   *
   * Search is handled separately with a small debounce below.
   */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchDocuments();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [activeTab, searchTerm]);

  /*
   * Reset pagination whenever the result set changes.
   */
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm]);

  /*
   * Backend already filters the data.
   *
   * We still keep this memo for pagination and to ensure the
   * component remains easy to extend later.
   */
  const filteredDocuments = useMemo(() => {
    return documents;
  }, [documents]);

  /*
   * Pagination.
   */
  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredDocuments.length / DOCUMENTS_PER_PAGE
    )
  );

  const safeCurrentPage = Math.min(
    currentPage,
    totalPages
  );

  const paginatedDocuments = filteredDocuments.slice(
    (safeCurrentPage - 1) * DOCUMENTS_PER_PAGE,
    safeCurrentPage * DOCUMENTS_PER_PAGE
  );

  /*
   * Recent documents:
   *
   * We use the three newest documents rather than inventing
   * a "recent" field that doesn't exist in the backend.
   */
  const recentDocuments = useMemo(() => {
    return [...documents]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      )
      .slice(0, 3).length;
  }, [documents]);

  /*
   * Format dates consistently.
   */
  const formatDate = (date: string) => {
    if (!date) {
      return "-";
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "-";
    }

    return parsedDate.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  /*
   * Format file sizes returned by the backend.
   */
  const formatFileSize = (size: number | null) => {
    if (!size || size <= 0) {
      return "-";
    }

    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  /*
   * Determine a display-friendly category.
   */
  const getCategoryLabel = (document: EmployeeDocument) => {
    return document.document_type || "Other";
  };

  /*
   * Fetch one document from the backend.
   *
   * GET /employee-documents/{document_id}
   */
  const handleView = async (document: EmployeeDocument) => {
    try {
      setOpenMenuId(null);
      setLoadingDocument(true);

      const response =
        await api.get<EmployeeDocument>(
          `/employee-documents/${document.id}`
        );

      setSelectedDocument(response);
    } catch (err) {
      console.error("Failed to load document:", err);

      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to load the document.");
      }
    } finally {
      setLoadingDocument(false);
    }
  };

  /*
   * Download the actual document.
   *
   * If file_url is an API-relative path, use the existing
   * downloadFile helper so the access token and refresh logic
   * are preserved.
   *
   * If file_url is an absolute URL, open/download that URL.
   */
  const handleDownload = async (
    document: EmployeeDocument
  ) => {
    try {
      setOpenMenuId(null);
      setDownloadingId(document.id);
      setError("");

      if (!document.file_url) {
        throw new ApiError(
          "No file is available for this document.",
          404
        );
      }

      /*
       * Absolute file URLs are usually storage URLs.
       */
      if (
        document.file_url.startsWith("http://") ||
        document.file_url.startsWith("https://")
      ) {
        const anchor = window.document.createElement("a");

        anchor.href = document.file_url;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";

        if (document.file_name) {
          anchor.download = document.file_name;
        }

        window.document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();

        return;
      }

      /*
       * API-relative file URL.
       */
      const blob = await downloadFile(
        document.file_url
      );

      const blobUrl = URL.createObjectURL(blob);

      const anchor = window.document.createElement("a");

      anchor.href = blobUrl;
      anchor.download =
        document.file_name ||
        document.document_name ||
        "document";

      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Failed to download document:", err);

      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(
          "Unable to download the document. Please try again."
        );
      }
    } finally {
      setDownloadingId(null);
    }
  };

  /*
   * Change category.
   */
  const handleTabChange = (tab: CategoryTab) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setOpenMenuId(null);
  };

  /*
   * Retry after an error.
   */
  const handleRetry = () => {
    fetchDocuments();
  };

  /*
   * Category count from backend summary.
   */
  const getCategoryCount = (category: string) => {
    return summary.categories?.[category] ?? 0;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          My Documents
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          View and manage your employment-related documents.
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-red-800">
              Unable to load documents
            </p>

            <p className="mt-1 text-sm text-red-700">
              {error}
            </p>
          </div>

          <button
            type="button"
            onClick={handleRetry}
            className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-red-700 shadow-sm ring-1 ring-red-200 hover:bg-red-50"
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Total Documents */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Total Documents
              </p>

              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {loading ? "—" : summary.total_documents}
              </p>
            </div>

            <div className="rounded-xl bg-slate-100 p-3">
              <Archive className="h-5 w-5 text-slate-600" />
            </div>
          </div>
        </div>

        {/* Recent Documents */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Recent Documents
              </p>

              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {loading ? "—" : recentDocuments}
              </p>
            </div>

            <div className="rounded-xl bg-slate-100 p-3">
              <FileText className="h-5 w-5 text-slate-600" />
            </div>
          </div>
        </div>

        {/* Pending Actions */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Pending Actions
              </p>

              <p className="mt-2 text-2xl font-semibold text-slate-900">
                0
              </p>

              <p className="mt-1 text-xs text-slate-400">
                No pending status is provided by the API
              </p>
            </div>

            <div className="rounded-xl bg-slate-100 p-3">
              <Archive className="h-5 w-5 text-slate-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Documents Section */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Search */}
        <div className="border-b border-slate-200 p-5">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              type="text"
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(event.target.value)
              }
              placeholder="Search documents..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-10 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:bg-white"
            />

            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                title="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="overflow-x-auto border-b border-slate-200">
          <div className="flex min-w-max px-5">
            {CATEGORY_TABS.map((tab) => {
              const count =
                tab === "All Documents"
                  ? summary.total_documents
                  : getCategoryCount(tab);

              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleTabChange(tab)}
                  className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${
                    activeTab === tab
                      ? "border-slate-900 text-slate-900"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {tab}

                  {!loading && count > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                        activeTab === tab
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex min-h-[350px] items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-slate-500" />

              <p className="text-sm text-slate-500">
                Loading documents...
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Document Name
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Category
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Date
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      File
                    </th>

                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedDocuments.map((document) => (
                    <tr
                      key={document.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                    >
                      {/* Document Name */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg bg-slate-100 p-2">
                            <FileText className="h-4 w-4 text-slate-600" />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">
                              {document.document_name}
                            </p>

                            {document.file_name && (
                              <p className="mt-0.5 truncate text-xs text-slate-400">
                                {document.file_name}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-5 py-4">
                        <span className="text-sm text-slate-600">
                          {getCategoryLabel(document)}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-5 py-4">
                        <p className="text-sm text-slate-600">
                          {formatDate(document.created_at)}
                        </p>
                      </td>

                      {/* File Info */}
                      <td className="px-5 py-4">
                        <div>
                          <p className="text-sm text-slate-600">
                            {document.mime_type || "File"}
                          </p>

                          <p className="mt-0.5 text-xs text-slate-400">
                            {formatFileSize(document.file_size)}
                          </p>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          {/* View */}
                          <button
                            type="button"
                            title="View document"
                            onClick={() =>
                              handleView(document)
                            }
                            disabled={loadingDocument}
                            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {/* Download */}
                          <button
                            type="button"
                            title="Download document"
                            onClick={() =>
                              handleDownload(document)
                            }
                            disabled={
                              downloadingId === document.id
                            }
                            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {downloadingId === document.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </button>

                          {/* More */}
                          <div className="relative">
                            <button
                              type="button"
                              title="More actions"
                              onClick={() =>
                                setOpenMenuId((current) =>
                                  current === document.id
                                    ? null
                                    : document.id
                                )
                              }
                              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>

                            {openMenuId === document.id && (
                              <div className="absolute right-0 z-20 mt-1 w-40 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleView(document)
                                  }
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                >
                                  <Eye className="h-4 w-4" />
                                  View
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDownload(document)
                                  }
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                >
                                  <Download className="h-4 w-4" />
                                  Download
                                </button>

                                {document.file_url && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);

                                      if (
                                        document.file_url.startsWith(
                                          "http://"
                                        ) ||
                                        document.file_url.startsWith(
                                          "https://"
                                        )
                                      ) {
                                        window.open(
                                          document.file_url,
                                          "_blank",
                                          "noopener,noreferrer"
                                        );
                                      }
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                    Open File
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {/* Empty State */}
                  {paginatedDocuments.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-5 py-16 text-center"
                      >
                        <div className="flex flex-col items-center">
                          <div className="rounded-full bg-slate-100 p-4">
                            <FileText className="h-6 w-6 text-slate-400" />
                          </div>

                          <p className="mt-4 text-sm font-medium text-slate-700">
                            No documents found
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            {searchTerm
                              ? "Try changing your search."
                              : "There are no documents in this category."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filteredDocuments.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-500">
                  Showing{" "}
                  {(safeCurrentPage - 1) *
                    DOCUMENTS_PER_PAGE +
                    1}{" "}
                  to{" "}
                  {Math.min(
                    safeCurrentPage *
                      DOCUMENTS_PER_PAGE,
                    filteredDocuments.length
                  )}{" "}
                  of {filteredDocuments.length} documents
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={safeCurrentPage === 1}
                    onClick={() =>
                      setCurrentPage((page) =>
                        Math.max(1, page - 1)
                      )
                    }
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <span className="min-w-[80px] text-center text-sm text-slate-600">
                    Page {safeCurrentPage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={
                      safeCurrentPage === totalPages
                    }
                    onClick={() =>
                      setCurrentPage((page) =>
                        Math.min(
                          totalPages,
                          page + 1
                        )
                      )
                    }
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Document Details Modal */}
      {selectedDocument && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setSelectedDocument(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white shadow-xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Document Details
                </h2>

                <p className="mt-0.5 text-xs text-slate-500">
                  {selectedDocument.file_name ||
                    selectedDocument.document_name}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedDocument(null)
                }
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-5 p-5">
              <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-4">
                <div className="rounded-xl bg-white p-3 shadow-sm">
                  <FileText className="h-6 w-6 text-slate-600" />
                </div>

                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-slate-900">
                    {selectedDocument.document_name}
                  </h3>

                  <p className="mt-1 text-xs text-slate-500">
                    {selectedDocument.document_type ||
                      "Other"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400">
                    Category
                  </p>

                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {selectedDocument.document_type ||
                      "Other"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    Uploaded
                  </p>

                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {formatDate(
                      selectedDocument.created_at
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    File Name
                  </p>

                  <p className="mt-1 truncate text-sm font-medium text-slate-700">
                    {selectedDocument.file_name || "-"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    File Size
                  </p>

                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {formatFileSize(
                      selectedDocument.file_size
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    File Type
                  </p>

                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {selectedDocument.mime_type || "-"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    Uploaded By
                  </p>

                  <p className="mt-1 truncate text-sm font-medium text-slate-700">
                    {selectedDocument.uploaded_by || "-"}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() =>
                  setSelectedDocument(null)
                }
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() =>
                  handleDownload(selectedDocument)
                }
                className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                <Download className="h-4 w-4" />
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}