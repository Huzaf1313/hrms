import { useCallback, useEffect, useRef, useState } from "react";
import {
    Download,
    Eye,
    FileText,
    Loader2,
    Trash2,
    Upload,
    X,
} from "lucide-react";

import { isHrAdmin } from "../../lib/access";
import { api, downloadFile } from "../../services/api";

interface EmployeeDocument {
    id: string;
    document_name: string;
    document_type: string;
    file_name: string;
    file_size: number | null;
    mime_type?: string | null;
    created_at: string;
    source?: string | null;
    uploaded_by?: string | null;
}

interface DocumentsResponse {
    documents: EmployeeDocument[];
    summary: { total_documents: number; categories: Record<string, number> };
}

export default function AdminEmployeeDocuments({
    employeeId,
}: {
    employeeId: string;
}) {
    // Only HR and the super admin may delete an employee's documents.
    const canDelete = isHrAdmin();
    const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
    const [name, setName] = useState("");
    const [type, setType] = useState("Employment");
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [viewingId, setViewingId] = useState<string | null>(null);
    const [preview, setPreview] = useState<{
        document: EmployeeDocument;
        url: string;
    } | null>(null);
    const [message, setMessage] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const loadDocuments = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.get<DocumentsResponse>("/employee-documents", {
                employee_id: employeeId,
            });
            setDocuments(data.documents);
        } catch {
            setMessage("Unable to load employee documents.");
        } finally {
            setLoading(false);
        }
    }, [employeeId]);

    useEffect(() => {
        // The request updates component state after the external API responds.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadDocuments();
    }, [loadDocuments]);

    useEffect(() => {
        return () => {
            if (preview?.url) URL.revokeObjectURL(preview.url);
        };
    }, [preview]);

    async function uploadDocument() {
        if (!file || !name.trim()) {
            setMessage("Enter a document name and select a file.");
            return;
        }

        setUploading(true);
        setMessage("");

        try {
            const form = new FormData();
            form.append("employee_id", employeeId);
            form.append("document_name", name.trim());
            form.append("document_type", type);
            form.append("file", file);
            await api.postForm("/employee-documents", form);
            setName("");
            setFile(null);
            if (inputRef.current) inputRef.current.value = "";
            await loadDocuments();
        } catch {
            setMessage("Unable to upload this document.");
        } finally {
            setUploading(false);
        }
    }

    async function downloadDocument(document: EmployeeDocument) {
        const blob = await downloadFile(
            `/employee-documents/${document.id}/download`,
        );
        const url = URL.createObjectURL(blob);
        const link = window.document.createElement("a");
        link.href = url;
        link.download = document.file_name || document.document_name;
        window.document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async function viewDocument(document: EmployeeDocument) {
        setViewingId(document.id);
        setMessage("");

        try {
            const blob = await downloadFile(
                `/employee-documents/${document.id}/preview`,
            );
            const url = URL.createObjectURL(blob);

            setPreview((current) => {
                if (current) URL.revokeObjectURL(current.url);
                return { document, url };
            });
        } catch {
            setMessage("Unable to view this document.");
        } finally {
            setViewingId(null);
        }
    }

    async function deleteDocument(document: EmployeeDocument) {
        setDeletingId(document.id);
        setMessage("");

        try {
            await api.delete<null>(`/employee-documents/${document.id}`);
            await loadDocuments();
        } catch {
            setMessage("Unable to delete this document.");
        } finally {
            setDeletingId(null);
        }
    }

    return (
        <div className="h-full rounded-3xl bg-white p-6 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-800">
                <FileText size={20} className="text-gray-700" />
                Employee Documents
            </h3>

            <div className="grid gap-3 md:grid-cols-[1fr_160px_1fr_auto]">
                <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Document name"
                    className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#2563eb]"
                />
                <select
                    value={type}
                    onChange={(event) => setType(event.target.value)}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2563eb]"
                >
                    <option>Employment</option>
                    <option>Identity</option>
                    <option>Education</option>
                    <option>Certificates</option>
                    <option>Tax & Payroll</option>
                    <option>Other</option>
                </select>
                <input
                    ref={inputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                    className="min-w-0 rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
                <button
                    type="button"
                    onClick={uploadDocument}
                    disabled={uploading}
                    className="flex items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    Upload
                </button>
            </div>

            {message && <p className="mt-3 text-xs text-red-600">{message}</p>}

            {loading ? (
                <p className="mt-5 text-sm text-gray-400">Loading documents...</p>
            ) : documents.length === 0 ? (
                <p className="mt-5 text-sm text-gray-400">No documents uploaded.</p>
            ) : (
                <div className="mt-5 space-y-5">
                    {([
                        ["employee", "Documents Uploaded by Employee"],
                        ["hr_admin", "Documents Uploaded by HR"],
                    ] as const).map(([source, heading]) => {
                        const sourceDocuments = documents.filter((document) =>
                            source === "employee"
                                ? document.source === "employee" || document.source === "employee_upload"
                                : document.source === source,
                        );

                        return (
                            <section key={source}>
                                <h4 className="mb-2 text-sm font-semibold text-gray-700">{heading}</h4>
                                {sourceDocuments.length === 0 ? (
                                    <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-400">
                                        No documents in this section.
                                    </p>
                                ) : (
                                    <div className="divide-y divide-gray-100">
                                        {sourceDocuments.map((document) => (
                                            <div key={document.id} className="flex items-center justify-between gap-3 py-3">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium text-gray-800">{document.document_name}</p>
                                                    <p className="text-xs text-gray-400">
                                                        {document.document_type} · {document.file_name} · {document.uploaded_by || "Unknown uploader"}
                                                    </p>
                                                </div>
                                                <div className="flex shrink-0 items-center gap-1">
                                                    <button
                                                        type="button"
                                                        title="View document"
                                                        aria-label={`View ${document.document_name}`}
                                                        onClick={() => void viewDocument(document)}
                                                        disabled={viewingId === document.id}
                                                        className="rounded-lg p-2 text-gray-500 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50"
                                                    >
                                                        {viewingId === document.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Eye className="h-4 w-4" />
                                                        )}
                                                    </button>

                                                    <button
                                                        type="button"
                                                        title="Download document"
                                                        aria-label={`Download ${document.document_name}`}
                                                        onClick={() => void downloadDocument(document)}
                                                        disabled={
                                                            deletingId === document.id ||
                                                            viewingId === document.id
                                                        }
                                                        className="rounded-lg p-2 text-gray-500 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50"
                                                    >
                                                        <Download className="h-4 w-4" />
                                                    </button>

                                                    {/* Managers are view-only here; the server
                              refuses their deletes as well. */}
                                                    {canDelete && (
                                                        <button
                                                            type="button"
                                                            title="Delete document"
                                                            aria-label={`Delete ${document.document_name}`}
                                                            onClick={() => void deleteDocument(document)}
                                                            disabled={
                                                                deletingId === document.id ||
                                                                viewingId === document.id
                                                            }
                                                            className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                                        >
                                                            {deletingId === document.id ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="h-4 w-4" />
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        );
                    })}
                </div>
            )}

            {preview && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Preview ${preview.document.document_name}`}
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setPreview(null);
                        }
                    }}
                >
                    <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                            <div className="min-w-0">
                                <h3 className="truncate font-semibold text-gray-900">
                                    {preview.document.document_name}
                                </h3>
                                <p className="text-xs text-gray-500">
                                    {preview.document.file_name}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPreview(null)}
                                aria-label="Close preview"
                                className="rounded p-2 text-gray-500 hover:bg-gray-100"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {preview.document.mime_type?.startsWith("image/") ? (
                            <div className="flex min-h-96 items-center justify-center overflow-auto bg-gray-50 p-6">
                                <img
                                    src={preview.url}
                                    alt={preview.document.document_name}
                                    className="max-h-[70vh] max-w-full object-contain"
                                />
                            </div>
                        ) : preview.document.mime_type === "application/pdf" ? (
                            <iframe
                                src={preview.url}
                                title={preview.document.document_name}
                                className="h-[70vh] w-full"
                            />
                        ) : (
                            <div className="flex flex-col items-center gap-3 p-12 text-center">
                                <FileText className="h-12 w-12 text-gray-400" />
                                <p className="text-sm text-gray-600">
                                    Preview is unavailable for this file type.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => void downloadDocument(preview.document)}
                                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                                >
                                    <Download className="h-4 w-4" />
                                    Download file
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
