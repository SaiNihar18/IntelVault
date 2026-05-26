import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { FileText, Download, AlertTriangle } from "lucide-react";
import { sharesApi } from "@/services/api";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ErrorState";
import { LoadingScreen } from "@/components/LoadingScreen";
import { PageTransition } from "@/components/PageTransition";
import { StatusBadge } from "@/components/StatusBadge";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function PublicSharePage() {
  const { shareToken } = useParams<{ shareToken: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-share", shareToken],
    queryFn: () => sharesApi.publicGet(shareToken!),
    enabled: !!shareToken,
    retry: false,
  });

  if (isLoading) return <LoadingScreen />;
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <PageTransition>
          <div className="glass-panel rounded-2xl p-8 max-w-md text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
              <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>
            <h1 className="font-display text-xl font-bold text-foreground mb-2">Link unavailable</h1>
            <p className="text-sm text-muted-foreground">This share link may have expired, been revoked, or reached its maximum uses.</p>
          </div>
        </PageTransition>
      </div>
    );
  }

  const doc = data?.document;
  if (!doc) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 left-1/2 h-[800px] w-[800px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
      </div>
      <PageTransition>
        <div className="relative z-10 glass-panel rounded-2xl p-8 max-w-md w-full text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-info/10">
            <FileText className="h-7 w-7 text-info" />
          </div>
          <h1 className="font-display text-xl font-bold text-foreground mb-1">{doc.filename}</h1>
          <div className="flex justify-center gap-3 mb-6">
            <StatusBadge status={doc.status} />
            <span className="text-xs text-muted-foreground">{formatBytes(doc.file_size_bytes)}</span>
          </div>
          <Button asChild className="w-full">
            <a href={sharesApi.publicDownload(shareToken!)} download>
              <Download className="mr-2 h-4 w-4" />
              Download file
            </a>
          </Button>
        </div>
      </PageTransition>
    </div>
  );
}
