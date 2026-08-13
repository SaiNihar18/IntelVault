import { useMemo, useRef, useState } from "react";
import {
  UploadCloud,
  FileText,
  Search,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  X,
  Info,
  Trash2,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import {
  useDocuments,
  useUploadDocument,
  useDeleteDocument,
  downloadDocument,
  type DocumentItem,
} from "@/hooks/api";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function formatSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 ** 2).toFixed(1)} MB`;
}
function formatDate(s: string) {
  const d = new Date(s);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DocumentsTab({ workspaceId }: { workspaceId: string }) {
  const { data: documents, isLoading, error, refetch } = useDocuments(workspaceId);
  const upload = useUploadDocument(workspaceId);
  const deleteMutation = useDeleteDocument(workspaceId);
  const fileInput = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedDocument, setSelectedDocument] = useState<DocumentItem | null>(null);

  const filtered = useMemo(
    () =>
      (documents ?? []).filter((document) =>
        document.filename.toLowerCase().includes(query.toLowerCase()),
      ),
    [documents, query],
  );

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      try {
        await upload.mutateAsync(file);
        toast.success(`Uploaded ${file.name}`);
      } catch (err: any) {
        toast.error(err?.response?.data?.detail ?? `Failed: ${file.name}`);
      }
    }
  }

  const isBusy = filtered.some(
    (document) => document.status === "processing" || document.status === "uploaded",
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="inline-flex items-center gap-2 bg-brand text-brand-foreground rounded-md px-4 py-2 text-sm font-semibold uppercase tracking-wide hover:opacity-90 transition-base"
        >
          <UploadCloud size={16} />
          Upload Document
        </button>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInput.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-base",
          drag
            ? "border-brand bg-brand/5"
            : "border-border bg-surface/40 hover:border-brand/50",
        )}
      >
        <div className="w-14 h-14 rounded-lg bg-surface border border-border flex items-center justify-center mb-4">
          <UploadCloud className="text-brand" size={24} />
        </div>
        <p className="text-foreground">
          Drag &amp; drop documents here or click to browse.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Supports PDF, TXT, Images, Markdown, Code (Max 50MB)
        </p>
        <input
          ref={fileInput}
          type="file"
          multiple
            accept=".pdf,.txt,.md,.csv,.json,.py,.log,.png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      <div className="bg-surface border border-border rounded-xl">
        <div className="flex flex-col gap-3 px-5 py-4 border-b border-border md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-semibold">Workspace documents</h3>
            <p className="text-xs text-muted-foreground">
              {isBusy ? "Processing updates are being checked automatically." : "Current document inventory."}
            </p>
          </div>
          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search documents…"
              className="w-full bg-background border border-border rounded-md pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand transition-base"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                <th className="text-left font-medium px-5 py-3">File</th>
                <th className="text-left font-medium px-5 py-3">Status</th>
                <th className="text-left font-medium px-5 py-3">Size</th>
                <th className="text-left font-medium px-5 py-3">Created</th>
                <th className="text-right font-medium px-5 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && error && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                    Failed to load documents.
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => refetch()}
                        className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-foreground hover:border-brand/60 transition-base"
                      >
                        Retry
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {!isLoading && !error && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                    No documents yet.
                  </td>
                </tr>
              )}
              {filtered.map((document) => (
                <tr
                  key={document.id}
                  onClick={() => setSelectedDocument(document)}
                  className="cursor-pointer border-t border-border hover:bg-background/40 transition-base"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <FileText size={16} className="text-brand/80 shrink-0" />
                      <span className="font-mono">{document.filename}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={document.status} />
                  </td>
                  <td className="px-5 py-3.5 font-mono text-muted-foreground">
                    {formatSize(document.file_size_bytes)}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-muted-foreground">
                    {formatDate(document.created_at)}
                  </td>
                  <td className="px-5 py-3.5 text-right text-xs text-brand">
                    Open details
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!selectedDocument} onOpenChange={(open) => !open && setSelectedDocument(null)}>
        <DialogContent className="border-border bg-surface max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-semibold">Document details</DialogTitle>
          </DialogHeader>
          {selectedDocument && (
            <div className="space-y-4 text-sm">
              <DetailRow label="Filename" value={selectedDocument.filename} />
              <DetailRow label="Status" value={<StatusBadge status={selectedDocument.status} />} />
              <DetailRow label="Type" value={selectedDocument.content_type ?? "Unknown"} />
              <DetailRow label="Size" value={formatSize(selectedDocument.file_size_bytes)} />
              <DetailRow label="Checksum" value={<code className="break-all font-mono text-xs text-muted-foreground">{selectedDocument.checksum_sha256}</code>} />
              <DetailRow label="Uploaded" value={formatDate(selectedDocument.created_at)} />
              <DetailRow label="Updated" value={formatDate(selectedDocument.updated_at)} />
              {selectedDocument.status === "failed" && (selectedDocument as any).error_message && (
                <div className="border-t border-destructive/20 pt-4 space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-destructive flex items-center gap-1.5">
                    <AlertCircle size={12} />
                    Processing Error Details
                  </span>
                  <pre className="bg-destructive/5 text-destructive border border-destructive/10 rounded-md p-3 text-xs font-mono max-h-48 overflow-y-auto whitespace-pre-wrap break-all">
                    {(selectedDocument as any).error_message}
                  </pre>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-border pt-4 mt-6">
                <button
                  type="button"
                  disabled={deleteMutation.isPending}
                  onClick={async () => {
                    if (confirm(`Are you sure you want to delete ${selectedDocument.filename}?`)) {
                      try {
                        await deleteMutation.mutateAsync(selectedDocument.id);
                        toast.success("Document deleted successfully");
                        setSelectedDocument(null);
                      } catch (err: any) {
                        toast.error(err?.message || "Failed to delete document");
                      }
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-md bg-destructive/10 text-destructive border border-destructive/20 px-3 py-2 text-xs font-semibold uppercase tracking-wide hover:bg-destructive/20 disabled:opacity-50 transition-base cursor-pointer"
                >
                  <Trash2 size={14} /> Delete
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        toast.info("Starting download...");
                        await downloadDocument(workspaceId, selectedDocument);
                        toast.success("Download started");
                      } catch (err: any) {
                        toast.error(err?.message || "Failed to download document");
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-md bg-brand text-brand-foreground px-3 py-2 text-xs font-semibold uppercase tracking-wide hover:opacity-90 transition-base cursor-pointer"
                  >
                    <Download size={14} /> Download
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDocument(null)}
                    className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-foreground hover:border-brand/60 transition-base cursor-pointer"
                  >
                    <X size={14} /> Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: DocumentItem["status"] }) {
  const map = {
    uploaded: {
      cls: "bg-muted/40 text-muted-foreground border-border",
      icon: RefreshCw,
      label: "Uploaded",
    },
    ready: {
      cls: "bg-brand/10 text-brand border-brand/30",
      icon: CheckCircle2,
      label: "Ready",
    },
    processing: {
      cls: "bg-warning/10 text-warning border-warning/30",
      icon: RefreshCw,
      label: "Processing",
    },
    failed: {
      cls: "bg-destructive/10 text-destructive border-destructive/30",
      icon: AlertCircle,
      label: "Failed",
    },
  } as const;
  const c = (map as any)[status] ?? map.ready;
  const Icon = c.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border font-medium",
        c.cls,
      )}
    >
      <Icon size={12} />
      {c.label}
    </span>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <div className="text-right break-all">{value}</div>
    </div>
  );
}
