import { useMemo, useState } from "react";
import { Link2, FileText, Folder, Image as ImageIcon, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useCreateShareLink,
  useDocumentShareLinks,
  useDocuments,
  useRevokeShareLink,
  type Share,
} from "@/hooks/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

type CreateShareForm = z.infer<typeof createShareSchema>;

function iconFor(filename?: string) {
  if (!filename) return Folder;
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return Folder;
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return ImageIcon;
  if (["pdf", "doc", "docx", "txt", "md"].includes(ext)) return FileText;
  return Folder;
}

function statusLabel(link: Share) {
  const expiresAt = new Date(link.expires_at);
  const isExpired = expiresAt < new Date();
  if (link.is_revoked) return { label: "Revoked", color: "bg-destructive/20 text-destructive" };
  if (isExpired) return { label: "Expired", color: "bg-warning/20 text-warning" };
  if (link.max_uses !== null && link.use_count >= link.max_uses) {
    return { label: "Depleted", color: "bg-muted/50 text-muted-foreground" };
  }
  return { label: "Active", color: "bg-brand/10 text-brand" };
}

export function SharesTab({ workspaceId }: { workspaceId: string }) {
  const { data: documents } = useDocuments(workspaceId);
  const [selectedDocId, setSelectedDocId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const selectedDocument = useMemo(
    () => documents?.find((document) => document.id === selectedDocId) ?? null,
    [documents, selectedDocId],
  );

  const { data: shares, isLoading } = useDocumentShareLinks(workspaceId, selectedDocument?.id);
  const createShare = useCreateShareLink(workspaceId, selectedDocument?.id);
  const revokeShare = useRevokeShareLink(workspaceId, selectedDocument?.id);
  const [lastShareUrl, setLastShareUrl] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateShareForm>({
    resolver: zodResolver(createShareSchema),
    defaultValues: { expires_in_hours: 24, max_uses: null },
  });

  async function handleCreate(data: CreateShareForm) {
    if (!selectedDocument) return;
    try {
      const response = await createShare.mutateAsync({
        expires_in_hours: data.expires_in_hours,
        max_uses: data.max_uses ?? null,
      });
      const url = response.share_url ?? `${window.location.origin}/shares/${response.share_token}`;
      try { await navigator.clipboard.writeText(url); } catch {}
      setLastShareUrl(url);
      toast.success("Share link created and copied");
      setCreateOpen(false);
      reset({ expires_in_hours: 24, max_uses: null });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Failed to create share link");
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Active Shares</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage secure public links for workspace documents.
          </p>
        </div>

        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) reset({ expires_in_hours: 24, max_uses: null });
          }}
        >
          <DialogTrigger asChild>
            <Button disabled={!selectedDocument} className="inline-flex items-center gap-2">
              <Plus size={16} /> Create Link
            </Button>
          </DialogTrigger>
          <DialogContent className="border-border bg-surface">
            <DialogHeader>
              <DialogTitle className="font-semibold">Create share link</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(handleCreate)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="share-expiry">Expires in (hours)</Label>
                <Input id="share-expiry" type="number" min={1} max={720} {...register("expires_in_hours")} />
                {errors.expires_in_hours && <p className="text-xs text-destructive">{errors.expires_in_hours.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="share-uses">Max uses</Label>
                <Input id="share-uses" type="number" min={1} placeholder="Unlimited" {...register("max_uses")} />
              </div>
              <Button type="submit" className="w-full" disabled={createShare.isPending || !selectedDocument}>
                {createShare.isPending ? "Creating…" : "Create link"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <div className="space-y-2">
          <Label>Select document</Label>
          <Select value={selectedDocId} onValueChange={setSelectedDocId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a document…" />
            </SelectTrigger>
            <SelectContent>
              {(documents ?? []).map((document) => (
                <SelectItem key={document.id} value={document.id}>
                  {document.filename}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedDocument && (
          <div className="rounded-lg border border-border bg-background/60 px-4 py-3 text-xs text-muted-foreground">
            Selected: <span className="text-foreground font-medium">{selectedDocument.filename}</span>
          </div>
        )}
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-muted-foreground">
              <th className="text-left font-medium px-5 py-3">Document</th>
              <th className="text-left font-medium px-5 py-3">Uses</th>
              <th className="text-left font-medium px-5 py-3">Expiration</th>
              <th className="text-left font-medium px-5 py-3">State</th>
              <th className="text-right font-medium px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!selectedDocument ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                  Select a document to manage its share links.
                </td>
              </tr>
            ) : isLoading ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">Loading…</td>
              </tr>
            ) : !shares || shares.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                  No active shares for this document.
                </td>
              </tr>
            ) : (
              shares.map((link) => {
                const Icon = iconFor(selectedDocument.filename);
                const state = statusLabel(link);
                return (
                  <tr key={link.id} className="border-t border-border hover:bg-background/40 transition-base">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Icon size={16} className="text-brand/80" />
                        <span className="font-mono">{selectedDocument.filename}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">
                      {link.use_count}{link.max_uses !== null ? ` / ${link.max_uses}` : ""}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">
                      {new Date(link.expires_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ${state.color}`}>
                        {state.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          aria-label="Revoke share"
                          onClick={async () => {
                            if (!confirm("Revoke this share link?")) return;
                            try {
                              await revokeShare.mutateAsync(link.id);
                              toast.success("Share revoked");
                            } catch (err: any) {
                              toast.error(err?.response?.data?.detail ?? "Failed to revoke share");
                            }
                          }}
                          className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-base"
                        >
                          <Trash2 size={14} /> Revoke
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selectedDocument && (
        <div className="rounded-lg border border-border bg-background/60 px-4 py-3 text-xs text-muted-foreground flex items-center gap-2">
          <Link2 size={14} className="text-brand" />
          Copy the public URL immediately after creation. Existing links can be revoked here, but the backend does not expose historical token values.
        </div>
      )}

      {lastShareUrl && (
        <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm mt-4 max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="truncate">
            <div className="text-xs text-muted-foreground">Share URL</div>
            <a href={lastShareUrl} target="_blank" rel="noreferrer" className="text-sm text-brand font-medium truncate block">{lastShareUrl}</a>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                try { await navigator.clipboard.writeText(lastShareUrl); toast.success("Link copied"); } catch { toast.error("Failed to copy"); }
              }}
              className="inline-flex items-center gap-2 rounded-md px-3 py-2 bg-background border border-border text-xs"
            >
              Copy link
            </button>
            <button
              onClick={() => setLastShareUrl(null)}
              className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
