import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, FolderOpen, Calendar, ShieldCheck, LogOut, X, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Brand } from "@/components/Brand";
import { useAuth } from "@/lib/auth";
import { useCreateWorkspace, useDeleteWorkspace, useWorkspaces, type Workspace } from "@/hooks/api";

export const Route = createFileRoute("/_authenticated/workspaces/")({
  component: WorkspacesIndexPage,
});

function WorkspacesIndexPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { data: workspaces, isLoading } = useWorkspaces();
  const createWs = useCreateWorkspace();
  const deleteWs = useDeleteWorkspace();
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [wsToDelete, setWsToDelete] = useState<Workspace | null>(null);

  async function handleCreate() {
    if (!name.trim()) return;
    try {
      const ws = await createWs.mutateAsync({ name: name.trim() });
      toast.success("Workspace created");
      setShowNew(false);
      setName("");
      navigate({
        to: "/workspaces/$workspaceId/$tab",
        params: { workspaceId: ws.id, tab: "documents" },
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Could not create workspace");
    }
  }

  async function handleDelete() {
    if (!wsToDelete) return;
    try {
      await deleteWs.mutateAsync(wsToDelete.id);
      toast.success(`Workspace "${wsToDelete.name}" deleted`);
      setWsToDelete(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Could not delete workspace");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 flex items-center justify-between px-6 border-b border-border bg-background/50 backdrop-blur">
        <Brand size="md" />
        <div className="flex items-center gap-4 text-sm">
          <span className="font-mono text-muted-foreground hidden sm:inline">{user?.email}</span>
          <span className="w-2 h-2 rounded-full bg-brand animate-pulse-dot" />
          <ShieldCheck size={16} className="text-brand" />
          <button
            type="button"
            onClick={() => logout()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-destructive/30 text-destructive bg-destructive/5 hover:bg-destructive/15 text-xs font-semibold uppercase tracking-wider transition-base cursor-pointer"
            aria-label="Sign out"
          >
            <LogOut size={13} />
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 animate-fade-up">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/75 bg-clip-text text-transparent">My Workspaces</h1>
            <p className="text-muted-foreground mt-2">
              Select a workspace to access its documents, chat, and members.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-2 bg-brand text-brand-foreground rounded-md px-4 py-2.5 font-semibold hover:opacity-95 shadow-glow-sm hover:shadow-glow transition-all duration-300 hover:-translate-y-0.5 cursor-pointer self-start"
          >
            <Plus size={18} />
            Create New Workspace
          </button>
        </div>

        {isLoading ? (
          <SkeletonGrid />
        ) : !workspaces || workspaces.length === 0 ? (
          <EmptyState onCreate={() => setShowNew(true)} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workspaces.map((ws) => (
              <div
                key={ws.id}
                className="group relative flex flex-col justify-between rounded-xl border border-border bg-surface p-6 hover:border-brand/60 hover:shadow-glow transition-all duration-300 hover:-translate-y-1 hover:bg-surface/80"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand transition-transform duration-350 group-hover:scale-110 group-hover:rotate-6">
                      <FolderOpen size={18} />
                    </div>
                    {user && ws.created_by_user_id === user.id && (
                      <button
                        type="button"
                        title="Delete Workspace"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setWsToDelete(ws);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all cursor-pointer"
                        aria-label="Delete workspace"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <Link
                    to="/workspaces/$workspaceId/$tab"
                    params={{ workspaceId: ws.id, tab: "documents" }}
                    className="block"
                  >
                    <h2 className="text-2xl font-semibold tracking-tight mb-3 group-hover:text-brand transition-base">
                      {ws.name}
                    </h2>
                    {ws.description && (
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-4 leading-relaxed">
                        {ws.description}
                      </p>
                    )}
                  </Link>
                </div>
                <Link
                  to="/workspaces/$workspaceId/$tab"
                  params={{ workspaceId: ws.id, tab: "documents" }}
                  className="pt-4 flex items-center gap-2 text-xs text-muted-foreground border-t border-border/30"
                >
                  <Calendar size={14} />
                  Created {new Date(ws.created_at).toLocaleDateString()}
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>

      {showNew && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-up"
          onClick={() => setShowNew(false)}
        >
          <div
            className="w-full max-w-md bg-surface border border-border rounded-xl p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">New Workspace</h3>
              <button onClick={() => setShowNew(false)} aria-label="Close" className="cursor-pointer">
                <X size={18} className="text-muted-foreground hover:text-foreground" />
              </button>
            </div>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Workspace name"
              className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand transition-base"
            />
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShowNew(false)}
                className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground transition-base cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={createWs.isPending}
                className="px-4 py-2 rounded-md bg-brand text-brand-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-base cursor-pointer"
              >
                {createWs.isPending ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {wsToDelete && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-up"
          onClick={() => !deleteWs.isPending && setWsToDelete(null)}
        >
          <div
            className="w-full max-w-md bg-surface border border-destructive/30 rounded-xl p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-full bg-destructive/15 text-destructive shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Delete Workspace?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Are you sure you want to delete <strong className="text-foreground">{wsToDelete.name}</strong>?
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground bg-destructive/5 border border-destructive/20 rounded-md p-3 leading-relaxed">
              This action is permanent and cannot be undone. All documents, uploaded files, extracted embeddings, AI chat sessions, and member shares in this workspace will be immediately deleted.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={deleteWs.isPending}
                onClick={() => setWsToDelete(null)}
                className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground transition-base cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteWs.isPending}
                onClick={handleDelete}
                className="px-4 py-2 rounded-md bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90 transition-base cursor-pointer disabled:opacity-50"
              >
                {deleteWs.isPending ? "Deleting…" : "Delete Workspace"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-44 rounded-xl border border-border bg-surface/60 animate-pulse"
        />
      ))}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="border border-dashed border-border rounded-xl p-12 text-center bg-surface/10">
      <ShieldCheck className="mx-auto text-brand mb-4" size={36} />
      <h3 className="text-lg font-semibold">No workspaces yet</h3>
      <p className="text-sm text-muted-foreground mt-1 mb-5">
        Create your first secure workspace to start managing documents.
      </p>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-2 bg-brand text-brand-foreground rounded-md px-4 py-2.5 font-semibold hover:opacity-90 shadow-glow-sm transition-base cursor-pointer"
      >
        <Plus size={18} /> Create Workspace
      </button>
    </div>
  );
}
