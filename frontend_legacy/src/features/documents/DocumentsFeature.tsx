import { useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Upload, FileText, File, X } from "lucide-react";
import { documentsApi } from "@/services/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonList } from "@/components/Skeletons";
import { StatusBadge } from "@/components/StatusBadge";
import { staggerContainer, staggerItem } from "@/components/PageTransition";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { DocumentPublic } from "@/types/api";
import { ApiClientError } from "@/services/apiClient";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function DocumentsFeature() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dragOver, setDragOver] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentPublic | null>(null);

  const { data: documents, isLoading, error, refetch } = useQuery({
    queryKey: ["documents", workspaceId],
    queryFn: () => documentsApi.list(workspaceId!),
    enabled: !!workspaceId,
    refetchInterval: (query) => {
      const docs = query.state.data;
      if (docs?.some(d => d.status === "processing" || d.status === "pending" || d.status === "queued")) return 3000;
      return false;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => documentsApi.upload(workspaceId!, file),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["documents", workspaceId] });
      toast({ title: "Uploaded", description: res.document.filename });
    },
    onError: (err) => {
      toast({ title: "Upload failed", description: err instanceof ApiClientError ? String(err.detail) : "An error occurred", variant: "destructive" });
    },
  });

  const handleFiles = useCallback((files: FileList | File[]) => {
    Array.from(files).forEach(f => uploadMutation.mutate(f));
  }, [uploadMutation]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <motion.div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}
      >
        <Upload className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Drag & drop files here</p>
        <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
        <input
          type="file"
          multiple
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        {uploadMutation.isPending && (
          <div className="mt-3">
            <div className="mx-auto h-1.5 w-48 overflow-hidden rounded-full bg-muted">
              <motion.div className="h-full rounded-full bg-primary" initial={{ width: "10%" }} animate={{ width: "90%" }} transition={{ duration: 2 }} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Uploading…</p>
          </div>
        )}
      </motion.div>

      {/* List */}
      {isLoading ? (
        <SkeletonList rows={4} />
      ) : error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !documents?.length ? (
        <EmptyState icon={FileText} title="No documents" description="Upload your first document to get started with AI analysis." />
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-2">
          {documents.map((doc) => (
            <motion.button
              key={doc.id}
              variants={staggerItem}
              onClick={() => setSelectedDoc(doc)}
              className="glass-panel w-full rounded-lg p-4 flex items-center gap-4 text-left hover:border-primary/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info">
                <File className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{doc.filename}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(doc.file_size_bytes)} · {new Date(doc.created_at).toLocaleDateString()}</p>
              </div>
              <StatusBadge status={doc.status} />
            </motion.button>
          ))}
        </motion.div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedDoc} onOpenChange={() => setSelectedDoc(null)}>
        <DialogContent className="glass-panel border-border">
          <DialogHeader><DialogTitle className="font-display">{selectedDoc?.filename}</DialogTitle></DialogHeader>
          {selectedDoc && (
            <div className="space-y-3 text-sm">
              <Row label="Status"><StatusBadge status={selectedDoc.status} /></Row>
              <Row label="Size">{formatBytes(selectedDoc.file_size_bytes)}</Row>
              <Row label="Type">{selectedDoc.content_type || "Unknown"}</Row>
              <Row label="SHA-256"><code className="font-mono text-xs text-muted-foreground break-all">{selectedDoc.checksum_sha256}</code></Row>
              <Row label="Uploaded">{new Date(selectedDoc.created_at).toLocaleString()}</Row>
              <Row label="Updated">{new Date(selectedDoc.updated_at).toLocaleString()}</Row>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <div className="text-right">{children}</div>
    </div>
  );
}
