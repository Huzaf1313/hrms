import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  FileUp,
  FolderOpen,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { api, ApiError, downloadFile } from "../../services/api";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeading } from "../../components/ui/PageHeading";
import { Select } from "../../components/ui/Select";
import { Skeleton } from "../../components/ui/Skeleton";
import { Tabs } from "../../components/ui/Tabs";

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
  | "Education"
  | "Certificates"
  | "Experience"
  | "Identity"
  | "Employment"
  | "Payslips"
  | "Tax & Payroll"
  | "Leave & Attendance"
  | "Other";

const CATEGORY_TABS: CategoryTab[] = [
  "All Documents",
  "Identity",
  "Education",
  "Certificates",
  "Experience",
  "Employment",
  "Payslips",
  "Tax & Payroll",
  "Leave & Attendance",
  "Other",
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

const QUICK_DOCUMENT_PRESETS = [
  { name: "Aadhaar Card", category: "Identity" },
  { name: "PAN Card", category: "Identity" },
  { name: "12th Marksheet", category: "Education" },
  { name: "Resume / CV", category: "Experience" },
];

function inferCategoryFromFilename(filename: string): string | null {
  const lower = filename.toLowerCase();
  if (/aadhaar|aadhar|pan\b|passport|voter|license|id/.test(lower)) return "Identity";
  if (/marksheet|degree|diploma|10th|12th|transcript|college/.test(lower)) return "Education";
  if (/cert|course|award/.test(lower)) return "Certificates";
  if (/resume|cv\b|experience|relieving|offer/.test(lower)) return "Experience";
  if (/payslip|salary/.test(lower)) return "Payslips";
  if (/tax|form16|form_16|tds|itr/.test(lower)) return "Tax & Payroll";
  return null;
}

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
  const [pendingDeleteDoc, setPendingDeleteDoc] =
    useState<EmployeeDocument | null>(null);

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadDocumentName, setUploadDocumentName] = useState("");
  const [uploadCategory, setUploadCategory] = useState("Education");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [uploadValidationError, setUploadValidationError] = useState("");
  const [uploadNotice, setUploadNotice] = useState("");
  const [pageSuccessNotice, setPageSuccessNotice] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedFilePreviewUrl = useMemo(() => {
    if (!selectedFile || !selectedFile.type.startsWith("image/")) {
      return null;
    }
    return URL.createObjectURL(selectedFile);
  }, [selectedFile]);

  useEffect(() => {
    if (!selectedFilePreviewUrl) return;
    return () => URL.revokeObjectURL(selectedFilePreviewUrl);
  }, [selectedFilePreviewUrl]);

  useEffect(() => {
    if (!uploadModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isUploading) {
        setUploadModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [uploadModalOpen, isUploading]);

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

  const [prevDocFilterKey, setPrevDocFilterKey] = useState(`${activeTab}|${searchTerm}`);
  const docFilterKey = `${activeTab}|${searchTerm}`;
  if (docFilterKey !== prevDocFilterKey) {
    setPrevDocFilterKey(docFilterKey);
    setCurrentPage(1);
    setLoading(true);
    setError("");
  }

  useEffect(() => {
    let active = true;
    const documentType =
      activeTab === "All Documents" ? undefined : activeTab;

    void api
      .get<EmployeeDocumentsResponse>("/employee-documents", {
        search: searchTerm.trim() || undefined,
        document_type: documentType,
      })
      .then((response) => {
        if (!active) return;
        setDocuments(response.documents ?? []);
        setSummary(
          response.summary ?? {
            total_documents: 0,
            categories: {},
          }
        );
        setError("");
      })
      .catch((err) => {
        if (!active) return;
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
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
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

  const personalUploadCount = useMemo(() => {
    return documents.filter(
      (doc) => doc.source === "employee" || doc.source === "employee_upload"
    ).length;
  }, [documents]);

  const hrAssignedCount = useMemo(() => {
    return Math.max(0, documents.length - personalUploadCount);
  }, [documents.length, personalUploadCount]);

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
      setPendingDeleteDoc(null);
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
    setIsDraggingFile(false);
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
    if (!uploadDocumentName.trim()) {
      const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ");
      setUploadDocumentName(baseName.slice(0, 150));
    }
    const inferred = inferCategoryFromFilename(file.name);
    if (inferred) {
      setUploadCategory(inferred);
    }
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

    const uploadedTitle = uploadDocumentName.trim();
    const formData = new FormData();
    formData.append("document_name", uploadedTitle);
    formData.append("document_type", uploadCategory);
    formData.append("file", selectedFile);

    try {
      setIsUploading(true);

      await api.postForm("/employee-documents", formData);

      // Refresh the employee's document list and summary.
      await fetchDocuments();

      closeUploadModal();
      setPageSuccessNotice(`"${uploadedTitle}" uploaded successfully.`);
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
    <div className="flex w-full flex-col gap-5 pb-10">
      {/* Slim Page Header */}
      <PageHeading
        title="View, organize, and securely upload your employment and identity documents."
        actions={
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={openUploadModal}
            disabled={isUploading}
            leftIcon={<Upload className="h-4 w-4" />}
          >
            Upload Document
          </Button>
        }
      />

      {/* Page success banner */}
      {pageSuccessNotice && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-[2px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={17} className="shrink-0 text-emerald-600" />
            <span className="font-medium">{pageSuccessNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setPageSuccessNotice("")}
            aria-label="Dismiss upload notice"
            className="rounded p-1 text-emerald-700 hover:bg-emerald-100"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-[2px] border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-rose-600" />
            <p className="text-sm text-rose-700">{error}</p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRetry}
          >
            Retry
          </Button>
        </div>
      )}

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Total Documents",
            value: summary.total_documents,
            helper: "Files stored in your profile",
            icon: FileText,
            tone: "bg-blue-50 text-[#2563EB]",
          },
          {
            label: "My Uploads",
            value: personalUploadCount,
            helper: "Uploaded by you",
            icon: Upload,
            tone: "bg-emerald-50 text-emerald-600",
          },
          {
            label: "HR / Company Docs",
            value: hrAssignedCount,
            helper: "Assigned by HR & Payroll",
            icon: FolderOpen,
            tone: "bg-purple-50 text-purple-600",
          },
          {
            label: "Recent Additions",
            value: recentDocuments,
            helper: "Most recent uploads",
            icon: Archive,
            tone: "bg-amber-50 text-amber-600",
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="flex min-h-[124px] flex-col rounded-[2px] border-2 border-[#E5E7EB] bg-white p-5 shadow-kpi shadow-kpi-hover transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-medium text-[#6B7280]">{card.label}</p>
                  <p className="mt-2 text-[26px] font-semibold leading-none text-[#111827]">
                    {loading ? "—" : card.value}
                  </p>
                </div>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${card.tone}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-auto pt-3 text-[12px] text-[#6B7280]">{card.helper}</p>
            </div>
          );
        })}
      </div>

      {/* Document list */}
      <div className="overflow-hidden rounded-[2px] border border-[#E5E7EB] bg-white">
        <div className="border-b border-[#E5E7EB] px-5 pt-4 pb-0">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-[14px] font-semibold text-[#111827]">
                Your Documents
              </h2>
              <p className="mt-0.5 text-[12px] text-[#6B7280]">
                Browse documents assigned to your profile or uploaded by you.
              </p>
            </div>

            <div className="relative w-full lg:max-w-xs">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search documents..."
                aria-label="Search documents"
                className="h-9 w-full rounded-lg border border-[#D1D5DB] bg-white pl-9 pr-8 text-[13px] text-[#111827] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#2563EB] focus:ring-[3px] focus:ring-[#DBEAFE]"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#111827]"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <Tabs
              variant="underline"
              activeTab={activeTab}
              onChange={(tab) => handleTabChange(tab as CategoryTab)}
              tabs={CATEGORY_TABS.map((tab) => ({
                id: tab,
                label: tab,
                badge: loading ? undefined : getCategoryCount(tab),
              }))}
              className="min-w-max"
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-[2px]" />
            ))}
          </div>
        ) : paginatedDocuments.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<FolderOpen className="h-5 w-5" />}
              title={
                searchTerm.trim()
                  ? "No matching documents"
                  : activeTab === "All Documents"
                    ? "No documents uploaded yet"
                    : `No documents in ${activeTab}`
              }
              description={
                searchTerm.trim()
                  ? "Try a different search term or switch back to All Documents."
                  : "Upload your personal certificates, IDs, or records so everything stays organized in one place."
              }
              action={
                searchTerm.trim() ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchTerm("")}
                  >
                    Clear Search
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={openUploadModal}
                    leftIcon={<Plus className="h-4 w-4" />}
                  >
                    Upload Document
                  </Button>
                )
              }
              className="max-w-none py-8"
            />
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
                                onClick={() => setPendingDeleteDoc(document)}
                                className="rounded-lg p-2 text-rose-500 transition hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
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
            className="my-auto w-full max-w-lg overflow-hidden rounded-[2px] bg-white shadow-2xl"
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
                  <div className="flex items-center gap-4 rounded-[2px] bg-gray-50 p-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[2px] bg-blue-100 text-blue-600">
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
          className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-xs"
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
            className="my-auto w-full max-w-lg overflow-hidden rounded-[2px] border border-[#E5E7EB] bg-white shadow-2xl"
          >
            {/* Modal header */}
            <div className="flex items-start justify-between border-b border-[#E5E7EB] px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB]">
                  <FileUp size={20} />
                </div>

                <div>
                  <h2
                    id="upload-document-title"
                    className="text-[15px] font-semibold text-[#111827]"
                  >
                    Upload Document
                  </h2>
                  <p className="mt-0.5 text-[12px] text-[#6B7280]">
                    Drag &amp; drop a file or pick one to add to your profile.
                  </p>
                </div>
              </div>

              <button
                type="button"
                aria-label="Close upload modal"
                onClick={closeUploadModal}
                disabled={isUploading}
                className="rounded-lg p-1.5 text-[#6B7280] transition hover:bg-[#F3F4F6] hover:text-[#111827] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            {/* Upload form */}
            <form onSubmit={handleUploadSubmit}>
              <div className="space-y-4 p-5">
                {/* Step 1: Drag & Drop File Selection */}
                <div>
                  <label
                    htmlFor="upload-document-file"
                    className="mb-1.5 block text-xs font-medium text-[#374151]"
                  >
                    File <span className="text-rose-500">*</span>
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

                  {selectedFile ? (
                    <div className="flex items-center justify-between gap-3 rounded-[2px] border border-[#2563EB]/30 bg-[#EFF6FF]/40 p-3.5">
                      <div className="flex min-w-0 items-center gap-3">
                        {selectedFilePreviewUrl ? (
                          <img
                            src={selectedFilePreviewUrl}
                            alt={selectedFile.name}
                            className="h-12 w-12 shrink-0 rounded-lg border border-[#E5E7EB] object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[2px] bg-blue-100 text-[11px] font-bold uppercase text-[#2563EB]">
                            {selectedFile.name.split(".").pop()?.slice(0, 4) || "FILE"}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-[#111827]">
                            {selectedFile.name}
                          </p>
                          <p className="mt-0.5 text-[11px] text-[#6B7280]">
                            {formatFileSize(selectedFile.size)} · Ready to upload
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                        >
                          Change
                        </Button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          disabled={isUploading}
                          aria-label="Remove selected file"
                          className="rounded-lg p-1.5 text-[#6B7280] hover:bg-rose-50 hover:text-rose-600"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => !isUploading && fileInputRef.current?.click()}
                      onKeyDown={(event) => {
                        if ((event.key === "Enter" || event.key === " ") && !isUploading) {
                          event.preventDefault();
                          fileInputRef.current?.click();
                        }
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        if (!isUploading) setIsDraggingFile(true);
                      }}
                      onDragLeave={() => setIsDraggingFile(false)}
                      onDrop={(event) => {
                        event.preventDefault();
                        setIsDraggingFile(false);
                        if (!isUploading) {
                          handleFileSelection(event.dataTransfer.files?.[0] ?? null);
                        }
                      }}
                      className={`flex w-full cursor-pointer flex-col items-center justify-center rounded-[2px] border-2 border-dashed px-5 py-6 text-center transition ${isDraggingFile
                        ? "border-[#2563EB] bg-blue-50/70"
                        : "border-[#D1D5DB] bg-[#F9FAFB]/70 hover:border-[#2563EB]/60 hover:bg-blue-50/30"
                        }`}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-[#2563EB]">
                        <Upload size={19} />
                      </div>
                      <p className="mt-2.5 text-[13px] font-semibold text-[#111827]">
                        Click to browse or drag &amp; drop
                      </p>
                      <p className="mt-1 text-[11px] text-[#6B7280]">
                        PDF, PNG, JPG, WEBP, DOC, DOCX, XLS, XLSX · Max 10 MB
                      </p>
                    </div>
                  )}
                </div>

                {/* Quick Document Presets */}
                <div>
                  <p className="mb-1.5 text-[11px] font-medium text-[#6B7280]">
                    Quick fill common documents
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_DOCUMENT_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        disabled={isUploading}
                        onClick={() => {
                          setUploadDocumentName(preset.name);
                          setUploadCategory(preset.category);
                          setUploadValidationError("");
                        }}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${uploadDocumentName === preset.name
                          ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]"
                          : "border-[#E5E7EB] bg-[#F9FAFB] text-[#4B5563] hover:bg-white"
                          }`}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step 2: Name & Category Side-by-Side */}
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="upload-document-name"
                      className="mb-1.5 block text-xs font-medium text-[#374151]"
                    >
                      Document Name <span className="text-rose-500">*</span>
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
                      placeholder="e.g. Aadhaar Card"
                      className="h-10 w-full rounded-[6px] border border-[#E4E6E1] bg-white px-3 text-sm text-[#1F2933] outline-none transition placeholder:text-[#7B8794] hover:border-[#D1D5DB] focus:border-[#2F5FD0] focus:ring-1 focus:ring-[#2F5FD0] disabled:cursor-not-allowed disabled:bg-[#F6F7F5]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="upload-document-category"
                      className="mb-1.5 block text-xs font-medium text-[#374151]"
                    >
                      Category <span className="text-rose-500">*</span>
                    </label>

                    <Select
                      id="upload-document-category"
                      value={uploadCategory}
                      onChange={(event) => {
                        setUploadCategory(event.target.value);
                        setUploadValidationError("");
                        setUploadNotice("");
                      }}
                      disabled={isUploading}
                      options={UPLOAD_CATEGORIES.map((category) => ({
                        value: category,
                        label: category,
                      }))}
                    />
                  </div>
                </div>

                {/* Validation error */}
                {uploadValidationError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-[2px] border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700"
                  >
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <p>{uploadValidationError}</p>
                  </div>
                )}

                {/* Upload success message */}
                {uploadNotice && (
                  <div
                    role="status"
                    className="flex items-start gap-2 rounded-[2px] border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-700"
                  >
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                    <p>{uploadNotice}</p>
                  </div>
                )}
              </div>

              {/* Compact Modal Footer */}
              <div className="flex flex-col gap-3 border-t border-[#E5E7EB] bg-[#F9FAFB] px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <span className="flex items-center gap-1.5 text-[11px] text-[#6B7280]">
                  <ShieldCheck size={14} className="text-[#2563EB]" />
                  Encrypted upload · Max 10 MB
                </span>

                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={closeUploadModal}
                    disabled={isUploading}
                  >
                    Cancel
                  </Button>

                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isUploading}
                    leftIcon={!isUploading ? <Upload size={14} /> : undefined}
                  >
                    {isUploading ? "Uploading..." : "Upload Document"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document preview modal */}
      {previewDocument && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 sm:p-6">
          <div className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2px] bg-white shadow-2xl">
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
      {/* Delete confirmation modal */}
      {pendingDeleteDoc && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deletingId) {
              setPendingDeleteDoc(null);
            }
          }}
        >
          <div className="w-full max-w-sm rounded-[2px] bg-white p-6 shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <Trash2 size={22} />
            </div>
            <h2 className="mt-4 text-center text-base font-semibold text-[#111827]">
              Delete Document?
            </h2>
            <p className="mt-1.5 text-center text-xs leading-relaxed text-[#6B7280]">
              Remove <span className="font-semibold text-[#111827]">{pendingDeleteDoc.document_name}</span>? This cannot be undone.
            </p>
            <div className="mt-5 flex justify-center gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPendingDeleteDoc(null)}
                disabled={Boolean(deletingId)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => void handleDelete(pendingDeleteDoc)}
                isLoading={deletingId === pendingDeleteDoc.id}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
