import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Search,
  X,
  Loader2,
  Upload,
  FileUp,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  Trash2,
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
  source?: string | null;
}

interface EmployeeDocumentSummary {
  total_documents: number;
  categories: Record<string, number>;
}

interface EmployeeDocumentsResponse {
  documents: EmployeeDocument[];
  summary: EmployeeDocumentSummary;
}

type CategoryTab =
  | "All Documents"
  | "Payslips"
  | "Tax & Payroll"
  | "Employment"
  | "Leave & Attendance";

const CATEGORY_TABS: CategoryTab[] = [
  "All Documents",
  "Payslips",
  "Tax & Payroll",
  "Employment",
  "Leave & Attendance",
];

const DOCUMENTS_PER_PAGE = 8;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
];

const UPLOAD_CATEGORIES = [
  "Education",
  "Certificates",
  "Experience",
  "Identity",
  "Employment",
  "Payslips",
  "Tax & Payroll",
  "Leave & Attendance",
  "Other",
];

export default function EmployeeDocuments() {
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [summary, setSummary] = useState<EmployeeDocumentSummary>({
    total_documents: 0,
    categories: {},
  });

  const [activeTab, setActiveTab] = useState<CategoryTab>("All Documents");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDocument, setSelectedDocument] =
    useState<EmployeeDocument | null>(null);
  const [loadingDocument, setLoadingDocument] = useState(false);
  const [previewDocument, setPreviewDocument] =
    useState<EmployeeDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMimeType, setPreviewMimeType] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadDocumentName, setUploadDocumentName] = useState("");
  const [uploadCategory, setUploadCategory] = useState("Education");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadValidationError, setUploadValidationError] = useState("");
  const [uploadNotice, setUploadNotice] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const documentType =
        activeTab === "All Documents" ? undefined : activeTab;

      const response = await api.get<EmployeeDocumentsResponse>(
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
        setError("Unable to load your documents. Please try again.");
      }

      setDocuments([]);
      setSummary({
        total_documents: 0,
        categories: {},
      });
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchTerm]);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const filteredDocuments = useMemo(() => documents, [documents]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredDocuments.length / DOCUMENTS_PER_PAGE)
  );

  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedDocuments = filteredDocuments.slice(
    (safeCurrentPage - 1) * DOCUMENTS_PER_PAGE,
    safeCurrentPage * DOCUMENTS_PER_PAGE
  );

  const recentDocuments = useMemo(() => {
    return [...documents]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .slice(0, 3).length;
  }, [documents]);

  const formatDate = (date: string) => {
    if (!date) return "-";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) return "-";

    return parsedDate.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatFileSize = (size: number | null) => {
    if (!size || size <= 0) return "-";
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getCategoryLabel = (document: EmployeeDocument) => {
    return document.document_type || "Other";
  };

  const handleView = async (document: EmployeeDocument) => {
    try {
      setLoadingDocument(true);
      setError("");

      const blob = await downloadFile(
        `/employee-documents/${document.id}/download?inline=true`
      );

      const blobUrl = URL.createObjectURL(blob);

      setPreviewMimeType(
        document.mime_type || blob.type || "application/octet-stream"
      );
      setPreviewDocument(document);
      setPreviewUrl(blobUrl);
    } catch (err) {
      console.error("Failed to preview document:", err);

      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to preview the document. Please try again.");
      }
    } finally {
      setLoadingDocument(false);
    }
  };

  const handleDownload = async (document: EmployeeDocument) => {
    try {
      setDownloadingId(document.id);
      setError("");

      const blob = await downloadFile(
        `/employee-documents/${document.id}/download`
      );

      const blobUrl = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");

      anchor.href = blobUrl;
      anchor.download =
        document.file_name || document.document_name || "document";

      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 1000);
    } catch (err) {
      console.error("Failed to download document:", err);

      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to download the document. Please try again.");
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (document: EmployeeDocument) => {
    try {
      setDeletingId(document.id);
      setError("");

      await api.delete<null>(`/employee-documents/${document.id}`);
      await fetchDocuments();
    } catch (err) {
      console.error("Failed to delete document:", err);

      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to delete the document. Please try again.");
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handleTabChange = (tab: CategoryTab) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const handleRetry = () => {
    void fetchDocuments();
  };

  const getCategoryCount = (category: string) => {
    if (category === "All Documents") {
      return summary.total_documents;
    }

    return summary.categories?.[category] ?? 0;
  };

  const resetUploadForm = () => {
    setUploadDocumentName("");
    setUploadCategory("Education");
    setSelectedFile(null);
    setUploadValidationError("");
    setUploadNotice("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const closeUploadModal = () => {
    setUploadModalOpen(false);
    resetUploadForm();
  };

  const openUploadModal = () => {
    resetUploadForm();
    setUploadModalOpen(true);
  };

  const handleFileSelection = (file: File | null) => {
    setUploadValidationError("");
    setUploadNotice("");
    setSelectedFile(null);

    if (!file) return;

    const extension = file.name
      .slice(file.name.lastIndexOf("."))
      .toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      setUploadValidationError(
        "Unsupported file type. Please select a PDF, image, Word, or Excel file."
      );

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      return;
    }

    if (file.size === 0) {
      setUploadValidationError(
        "The selected file is empty. Please choose another file."
      );
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setUploadValidationError(
        "The file exceeds the 10 MB limit. Please select a smaller file."
      );

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      return;
    }

    setSelectedFile(file);
  };

  const handleUploadSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setUploadValidationError("");
    setUploadNotice("");

    if (!uploadDocumentName.trim()) {
      setUploadValidationError("Please enter a document name.");
      return;
    }

    if (uploadDocumentName.trim().length > 150) {
      setUploadValidationError(
        "The document name cannot exceed 150 characters."
      );
      return;
    }

    if (!selectedFile) {
      setUploadValidationError("Please select a file to continue.");
      return;
    }

    const formData = new FormData();
    formData.append("document_name", uploadDocumentName.trim());
    formData.append("document_type", uploadCategory);
    formData.append("file", selectedFile);

    try {
      setIsUploading(true);

      await api.postForm("/employee-documents", formData);

      // Refresh the employee's document list and summary.
      await fetchDocuments();

      // Reset the upload form.
      setUploadDocumentName("");
      setSelectedFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setUploadNotice("Document uploaded successfully.");
    } catch (err) {
      console.error("Document upload failed:", err);

      setUploadValidationError(
        err instanceof ApiError
          ? err.message
          : "Unable to upload your document. Please try again."
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Page header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded bg-blue-50 text-blue-600">
            <FolderOpen size={23} />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              My Documents
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              View and manage your employment-related documents.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openUploadModal}
          disabled={isUploading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Upload size={17} />
          Upload Document
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="mt-0.5 shrink-0 text-red-600" />
            <p className="text-sm text-red-700">{error}</p>
          </div>

          <button
            type="button"
            onClick={handleRetry}
            className="self-start rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 sm:self-auto"
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">
                Total Documents
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {loading ? "—" : summary.total_documents}
              </p>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded bg-blue-50 text-blue-600">
              <FileText size={23} />
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Documents currently available to you
          </p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">
                Recent Documents
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {loading ? "—" : recentDocuments}
              </p>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <Archive size={23} />
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Most recent 3 documents, or fewer if unavailable
          </p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">
                Pending Actions
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900">0</p>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <CheckCircle2 size={23} />
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Pending document status is not currently provided by the API
          </p>
        </div>
      </div>

      {/* Document list */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Your Documents
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Browse the documents associated with your employee profile.
              </p>
            </div>

            <div className="relative w-full lg:max-w-sm">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search documents..."
                aria-label="Search documents"
                className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {CATEGORY_TABS.map((tab) => {
              const active = activeTab === tab;

              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleTabChange(tab)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition ${active
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                    }`}
                >
                  {tab}
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-xs ${active
                        ? "bg-white/20 text-white"
                        : "bg-white text-gray-600"
                      }`}
                  >
                    {loading ? "—" : getCategoryCount(tab)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-8">
            <Loader2 size={30} className="animate-spin text-blue-600" />
            <p className="text-sm text-gray-500">Loading your documents...</p>
          </div>
        ) : paginatedDocuments.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              <FolderOpen size={30} />
            </div>
            <h3 className="mt-4 text-base font-semibold text-gray-900">
              No documents found
            </h3>
            <p className="mt-2 max-w-md text-sm text-gray-500">
              {searchTerm.trim()
                ? "Try another search term or select a different category."
                : "Documents assigned to your profile and documents uploaded by you will appear here."}
            </p>

            {searchTerm.trim() && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Document Name
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Category
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Date Added
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      File
                    </th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {paginatedDocuments.map((document) => (
                    <tr
                      key={document.id}
                      className="transition hover:bg-gray-50/80"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                            <FileText size={19} />
                          </div>

                          <div className="min-w-0">
                            <p className="max-w-xs truncate text-sm font-semibold text-gray-900">
                              {document.document_name}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              {document.source === "employee_upload"
                                ? "Employee uploaded"
                                : "Available document"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                          {getCategoryLabel(document)}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">
                        {formatDate(document.created_at)}
                      </td>

                      <td className="px-5 py-4">
                        <div className="max-w-48">
                          <p className="truncate text-sm text-gray-700">
                            {document.file_name || "File unavailable"}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {formatFileSize(document.file_size)}
                          </p>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="Preview document"
                            aria-label={`Preview ${document.document_name}`}
                            onClick={() => void handleView(document)}
                            className="rounded-lg p-2 text-gray-500 transition hover:bg-blue-50 hover:text-blue-600"
                          >
                            <Eye size={18} />
                          </button>

                          <button
                            type="button"
                            title="Download document"
                            aria-label={`Download ${document.document_name}`}
                            disabled={downloadingId === document.id}
                            onClick={() => void handleDownload(document)}
                            className="rounded-lg p-2 text-gray-500 transition hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50"
                          >
                            {downloadingId === document.id ? (
                              <Loader2 size={18} className="animate-spin" />
                            ) : (
                              <Download size={18} />
                            )}
                          </button>

                          {/* Delete document button */}
                          {(document.source === "employee" ||
                            document.source === "employee_upload") && (
                              <button
                                type="button"
                                title="Delete document"
                                aria-label={`Delete ${document.document_name}`}
                                disabled={deletingId === document.id}
                                onClick={() => void handleDelete(document)}
                                className="rounded-lg p-2 text-red-500 transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {deletingId === document.id ? (
                                  <Loader2 size={18} className="animate-spin" />
                                ) : (
                                  <Trash2 size={18} />
                                )}
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col gap-3 border-t border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-500">
                Showing{" "}
                <span className="font-medium text-gray-700">
                  {(safeCurrentPage - 1) * DOCUMENTS_PER_PAGE + 1}
                </span>{" "}
                to{" "}
                <span className="font-medium text-gray-700">
                  {Math.min(
                    safeCurrentPage * DOCUMENTS_PER_PAGE,
                    filteredDocuments.length
                  )}
                </span>{" "}
                of{" "}
                <span className="font-medium text-gray-700">
                  {filteredDocuments.length}
                </span>{" "}
                documents
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safeCurrentPage <= 1}
                  onClick={() =>
                    setCurrentPage((page) => Math.max(1, page - 1))
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>

                <span className="min-w-20 text-center text-sm text-gray-600">
                  Page {safeCurrentPage} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() =>
                    setCurrentPage((page) => Math.min(totalPages, page + 1))
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Document details modal */}
      {(selectedDocument || loadingDocument) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-gray-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !loadingDocument) {
              setSelectedDocument(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="document-details-title"
            className="my-auto w-full max-w-lg overflow-hidden rounded bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-gray-200 px-6 py-5">
              <div>
                <h2
                  id="document-details-title"
                  className="text-lg font-semibold text-gray-900"
                >
                  Document Details
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Information about this document
                </p>
              </div>

              <button
                type="button"
                aria-label="Close document details"
                onClick={() => setSelectedDocument(null)}
                disabled={loadingDocument}
                className="rounded p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50"
              >
                <X size={19} />
              </button>
            </div>

            {loadingDocument ? (
              <div className="flex min-h-52 items-center justify-center gap-3">
                <Loader2 size={24} className="animate-spin text-blue-600" />
                <span className="text-sm text-gray-500">
                  Loading document details...
                </span>
              </div>
            ) : selectedDocument ? (
              <>
                <div className="space-y-5 p-6">
                  <div className="flex items-center gap-4 rounded-xl bg-gray-50 p-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                      <FileText size={24} />
                    </div>

                    <div className="min-w-0">
                      <h3 className="break-words font-semibold text-gray-900">
                        {selectedDocument.document_name}
                      </h3>
                      <p className="mt-1 break-all text-sm text-gray-500">
                        {selectedDocument.file_name || "No filename available"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        Category
                      </p>
                      <p className="mt-1.5 text-sm font-medium text-gray-900">
                        {getCategoryLabel(selectedDocument)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        Date Added
                      </p>
                      <p className="mt-1.5 text-sm font-medium text-gray-900">
                        {formatDate(selectedDocument.created_at)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        File Size
                      </p>
                      <p className="mt-1.5 text-sm font-medium text-gray-900">
                        {formatFileSize(selectedDocument.file_size)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        File Type
                      </p>
                      <p className="mt-1.5 break-all text-sm font-medium text-gray-900">
                        {selectedDocument.mime_type || "Not provided"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        Uploaded By
                      </p>
                      <p className="mt-1.5 break-words text-sm font-medium text-gray-900">
                        {selectedDocument.uploaded_by || "Not specified"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        Document Source
                      </p>
                      <p className="mt-1.5 text-sm font-medium text-gray-900">
                        {selectedDocument.source === "employee_upload"
                          ? "Employee upload"
                          : "Existing document"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedDocument(null)}
                    className="rounded border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
                  >
                    Close
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleDownload(selectedDocument)}
                    disabled={downloadingId === selectedDocument.id}
                    className="inline-flex items-center justify-center gap-2 rounded bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                  >
                    {downloadingId === selectedDocument.id ? (
                      <Loader2 size={17} className="animate-spin" />
                    ) : (
                      <Download size={17} />
                    )}
                    Download
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Employee document upload modal */}
      {uploadModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-gray-950/60 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isUploading) {
              closeUploadModal();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-document-title"
            className="my-auto w-full max-w-xl overflow-hidden rounded bg-white shadow-2xl"
          >
            {/* Modal header */}
            <div className="flex items-start justify-between border-b border-gray-200 px-6 py-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-blue-50 text-blue-600">
                  <FileUp size={23} />
                </div>

                <div>
                  <h2
                    id="upload-document-title"
                    className="text-lg font-semibold text-gray-900"
                  >
                    Upload Document
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Upload a document to add it to your employee profile.
                  </p>
                </div>
              </div>

              <button
                type="button"
                aria-label="Close upload modal"
                onClick={closeUploadModal}
                disabled={isUploading}
                className="rounded p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={19} />
              </button>
            </div>

            {/* Upload form */}
            <form onSubmit={handleUploadSubmit}>
              <div className="space-y-5 p-6">
                {/* Document name */}
                <div>
                  <label
                    htmlFor="upload-document-name"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Document Name <span className="text-red-500">*</span>
                  </label>

                  <input
                    id="upload-document-name"
                    type="text"
                    value={uploadDocumentName}
                    onChange={(event) => {
                      setUploadDocumentName(event.target.value);
                      setUploadValidationError("");
                      setUploadNotice("");
                    }}
                    maxLength={150}
                    disabled={isUploading}
                    placeholder="e.g. 12th Marksheet, Aadhaar Card, PAN Card"
                    className="w-full rounded border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100"
                  />

                  <p className="mt-1.5 text-xs text-gray-500">
                    Enter a clear name so you can identify the document later.
                  </p>
                </div>

                {/* Document category */}
                <div>
                  <label
                    htmlFor="upload-document-category"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Document Category <span className="text-red-500">*</span>
                  </label>

                  <select
                    id="upload-document-category"
                    value={uploadCategory}
                    onChange={(event) => {
                      setUploadCategory(event.target.value);
                      setUploadValidationError("");
                      setUploadNotice("");
                    }}
                    disabled={isUploading}
                    className="w-full rounded border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100"
                  >
                    {UPLOAD_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                {/* File selection */}
                <div>
                  <label
                    htmlFor="upload-document-file"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Select File <span className="text-red-500">*</span>
                  </label>

                  <input
                    ref={fileInputRef}
                    id="upload-document-file"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
                    disabled={isUploading}
                    onChange={(event) =>
                      handleFileSelection(event.target.files?.[0] ?? null)
                    }
                    className="sr-only"
                  />

                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full flex-col items-center justify-center rounded border-2 border-dashed border-gray-300 bg-gray-50 px-5 py-7 text-center transition hover:border-blue-400 hover:bg-blue-50/50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                      <Upload size={23} />
                    </div>

                    {selectedFile ? (
                      <>
                        <span className="mt-3 max-w-full break-all text-sm font-semibold text-gray-900">
                          {selectedFile.name}
                        </span>
                        <span className="mt-1 text-xs text-gray-500">
                          {formatFileSize(selectedFile.size)} · Click to change
                          file
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="mt-3 text-sm font-semibold text-gray-800">
                          Click to select a file
                        </span>
                        <span className="mt-1 text-xs text-gray-500">
                          PDF, PNG, JPG, WEBP, DOC, DOCX, XLS, XLSX
                        </span>
                        <span className="mt-1 text-xs text-gray-500">
                          Maximum file size: 10 MB
                        </span>
                      </>
                    )}
                  </button>
                </div>

                {/* Validation error */}
                {uploadValidationError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                  >
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    <p>{uploadValidationError}</p>
                  </div>
                )}

                {/* Upload success message */}
                {uploadNotice && (
                  <div
                    role="status"
                    className="flex items-start gap-2 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700"
                  >
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                    <p>{uploadNotice}</p>
                  </div>
                )}

                {/* Upload information */}
                <div className="rounded border border-blue-100 bg-blue-50 p-3.5">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle
                      size={18}
                      className="mt-0.5 shrink-0 text-blue-600"
                    />
                    <div>
                      <p className="text-sm font-semibold text-blue-900">
                        Secure document upload
                      </p>
                      <p className="mt-1 text-xs leading-5 text-blue-800">
                        Your document will be securely uploaded and associated
                        with your employee profile. Only supported file types
                        up to 10 MB are accepted.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal footer */}
              <div className="flex flex-col-reverse gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeUploadModal}
                  disabled={isUploading}
                  className="rounded border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isUploading}
                  className="inline-flex items-center justify-center gap-2 rounded bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={17} className="animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload size={17} />
                      Upload Document
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document preview modal */}
      {previewDocument && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 sm:p-6">
          <div className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-5 py-4">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-gray-900">
                  {previewDocument.document_name}
                </h2>
                <p className="mt-1 truncate text-xs text-gray-500">
                  {previewDocument.file_name}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setPreviewDocument(null);
                  setPreviewUrl(null);
                  setPreviewMimeType("");
                }}
                className="shrink-0 rounded p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
                aria-label="Close document preview"
                title="Close preview"
              >
                <X size={20} />
              </button>
            </div>

            {/* Preview content */}
            <div className="min-h-[400px] flex-1 overflow-auto bg-gray-100">
              {previewUrl && previewMimeType === "application/pdf" ? (
                <iframe
                  src={previewUrl}
                  title={previewDocument.document_name}
                  className="h-[75vh] min-h-[400px] w-full border-0"
                />
              ) : previewUrl && previewMimeType.startsWith("image/") ? (
                <div className="flex min-h-[400px] items-center justify-center p-4">
                  <img
                    src={previewUrl}
                    alt={previewDocument.document_name}
                    className="max-h-[75vh] max-w-full rounded-lg object-contain"
                  />
                </div>
              ) : (
                <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
                  <FileText size={52} className="text-gray-400" />

                  <h3 className="mt-4 text-base font-semibold text-gray-900">
                    Preview not available
                  </h3>

                  <p className="mt-2 max-w-md text-sm text-gray-500">
                    This file format cannot be previewed directly in your
                    browser. Download the document to open it.
                  </p>

                  <button
                    type="button"
                    onClick={() => void handleDownload(previewDocument)}
                    disabled={downloadingId === previewDocument.id}
                    className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                  >
                    {downloadingId === previewDocument.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Download size={16} />
                    )}
                    Download document
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-5 py-3">
              <span className="truncate text-xs text-gray-500">
                {formatFileSize(previewDocument.file_size)}
              </span>
              <button
                type="button"
                onClick={() => void handleDownload(previewDocument)}
                disabled={downloadingId === previewDocument.id}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                <Download size={16} />
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
