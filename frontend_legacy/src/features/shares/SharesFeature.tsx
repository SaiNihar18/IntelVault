import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Link2, Copy, Check, Trash2, ExternalLink, Share2 } from "lucide-react";
import { sharesApi, documentsApi } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonList } from "@/components/Skeletons";
import { staggerContainer, staggerItem } from "@/components/PageTransition";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ApiClientError } from "@/services/apiClient";
import type { DocumentPublic, ShareLinkPublic } from "@/types/api";
import { cn } from "@/lib/utils";

const createShareSchema = z.object({
  expires_in_hours: z.coerce.number().min(1).max(720),
  max_uses: z.preprocess(
    (value) => {
      if (value === "" || value === undefined || value === null) return null;
      return value;
    },
    z.coerce.number().int().min(1).nullable(),
  ),
});

export default function SharesFeature() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: documents } = useQuery({
    queryKey: ["documents", workspaceId],
    queryFn: () => documentsApi.list(workspaceId!),
    enabled: !!workspaceId,
  });

  const { data: sharesData, isLoading, error, refetch } = useQuery({
    queryKey: ["shares", workspaceId, selectedDocId],
    queryFn: () => sharesApi.list(workspaceId!, selectedDocId!),
    enabled: !!workspaceId && !!selectedDocId,
  });

  const createMutation = useMutation({
    mutationFn: (data: { expires_in_hours: number; max_uses: number | null }) =>
      sharesApi.create(workspaceId!, selectedDocId!, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["shares", workspaceId, selectedDocId] });
      toast({ title: "Share link created" });
      setCreateOpen(false);
      const publicUrl = `${window.location.origin}/shares/${res.share_token}`;
      copyToClipboard(publicUrl, res.link.id);
    },
    onError: (err) => {
      toast({ title: "Error", description: err instanceof ApiClientError ? String(err.detail) : "Failed", variant: "destructive" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (linkId: string) => sharesApi.revoke(workspaceId!, selectedDocId!, linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shares", workspaceId, selectedDocId] });
      toast({ title: "Share link revoked" });
    },
  });

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(createShareSchema),
    defaultValues: { expires_in_hours: 24 },
  });

  const links = sharesData?.links || [];

  return (
    <div className="space-y-6">
      {/* Doc selector */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2 flex-1 min-w-[200px]">
          <Label>Select document</Label>
          <Select value={selectedDocId || ""} onValueChange={setSelectedDocId}>
            <SelectTrigger><SelectValue placeholder="Choose a document…" /></SelectTrigger>
            <SelectContent>
              {documents?.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.filename}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedDocId && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Link2 className="mr-2 h-4 w-4" />Create link</Button>
            </DialogTrigger>
            <DialogContent className="glass-panel border-border">
              <DialogHeader><DialogTitle className="font-display">Create share link</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit((data) => createMutation.mutate({ expires_in_hours: data.expires_in_hours, max_uses: data.max_uses ?? null }))} className="space-y-4">
                <div className="space-y-2">
                  <Label>Expires in (hours)</Label>
                  <Input type="number" {...register("expires_in_hours")} />
                  {errors.expires_in_hours && <p className="text-xs text-destructive">{errors.expires_in_hours.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Max uses (optional)</Label>
                  <Input type="number" {...register("max_uses")} placeholder="Unlimited" />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating…" : "Create link"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Links list */}
      {!selectedDocId ? (
        <EmptyState icon={Share2} title="Select a document" description="Choose a document above to manage its share links." />
      ) : isLoading ? (
        <SkeletonList rows={3} />
      ) : error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !links.length ? (
        <EmptyState icon={Link2} title="No share links" description="Create a share link for this document." actionLabel="Create link" onAction={() => setCreateOpen(true)} />
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-2">
          {links.map(link => (
            <ShareRow key={link.id} link={link} copiedId={copiedId} onCopy={copyToClipboard} onRevoke={() => revokeMutation.mutate(link.id)} />
          ))}
        </motion.div>
      )}
    </div>
  );
}

function ShareRow({ link, copiedId, onCopy, onRevoke }: { link: ShareLinkPublic; copiedId: string | null; onCopy: (url: string, id: string) => void; onRevoke: () => void }) {
  const isExpired = new Date(link.expires_at) < new Date();
  const isInactive = link.is_revoked || isExpired || (link.max_uses !== null && link.use_count >= link.max_uses);

  return (
    <motion.div
      variants={staggerItem}
      className={cn("glass-panel rounded-lg p-4 flex items-center gap-4", isInactive && "opacity-60")}
    >
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", isInactive ? "bg-muted" : "bg-accent/10 text-accent")}>
        <Link2 className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground truncate">{link.id.slice(0, 8)}…</span>
          {link.is_revoked && <span className="text-xs bg-destructive/20 text-destructive px-1.5 py-0.5 rounded">Revoked</span>}
          {isExpired && !link.is_revoked && <span className="text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded">Expired</span>}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Uses: {link.use_count}{link.max_uses !== null ? `/${link.max_uses}` : ""} · Expires: {new Date(link.expires_at).toLocaleString()}
        </p>
      </div>
      <div className="flex gap-1">
        {!isInactive && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onRevoke()}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>
    </motion.div>
  );
}
