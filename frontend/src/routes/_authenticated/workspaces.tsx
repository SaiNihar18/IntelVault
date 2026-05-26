import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, FolderOpen, Calendar, ShieldCheck, LogOut, X } from "lucide-react";
import { toast } from "sonner";
import { Brand } from "@/components/Brand";
import { useAuth } from "@/lib/auth";
import { useCreateWorkspace, useWorkspaces } from "@/hooks/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/workspaces")({
  component: WorkspacesPage,
});

function WorkspacesPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { data: workspaces, isLoading } = useWorkspaces();
  const createWs = useCreateWorkspace();
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");

  // If the current URL is a child workspace route (e.g. /workspaces/:id/...),
  // render the child Outlet so the workspace shell can take over the page.
  // This prevents the parent workspaces list from rendering above the child.
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const isWorkspaceChildRoute = /^\/workspaces\/[^\/]+\/.+/.test(pathname);
  if (isWorkspaceChildRoute) {
    return <Outlet />;
  }

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

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 flex items-center justify-between px-6 border-b border-border">
        <Brand size="md" />
        <div className="flex items-center gap-3 text-sm">
          <span className="font-mono text-muted-foreground">{user?.email}</span>
          <span className="w-2 h-2 rounded-full bg-brand animate-pulse-dot" />
          <ShieldCheck size={16} className="text-brand" />
          <button
            type="button"
            onClick={() => logout()}
            className="text-muted-foreground hover:text-foreground transition-base"
            aria-label="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 animate-fade-up">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">My Workspaces</h1>
            <p className="text-muted-foreground mt-2">
              Select a workspace to access its documents, chat, and members.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-2 bg-brand text-brand-foreground rounded-md px-4 py-2.5 font-semibold hover:opacity-90 transition-base self-start"
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {workspaces.map((ws) => (
              <Link
                key={ws.id}
                to="/workspaces/$workspaceId/$tab"
                params={{ workspaceId: ws.id, tab: "documents" }}
                className="group block rounded-xl border border-border bg-surface p-6 hover:border-brand/60 hover:shadow-glow transition-base"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <FolderOpen size={18} />
                </div>
                <h2 className="text-2xl font-semibold tracking-tight mb-5 group-hover:text-brand transition-base">
                  {ws.name}
                </h2>
                {ws.description && (
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {ws.description}
                  </p>
                )}
                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar size={14} />
                  Created {new Date(ws.created_at).toLocaleDateString()}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <Outlet />

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
              <button onClick={() => setShowNew(false)} aria-label="Close">
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
                className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground transition-base"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={createWs.isPending}
                className="px-4 py-2 rounded-md bg-brand text-brand-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-base"
              >
                {createWs.isPending ? "Creating…" : "Create"}
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
    <div className="border border-dashed border-border rounded-xl p-12 text-center">
      <ShieldCheck className="mx-auto text-brand mb-4" size={36} />
      <h3 className="text-lg font-semibold">No workspaces yet</h3>
      <p className="text-sm text-muted-foreground mt-1 mb-5">
        Create your first secure workspace to start managing documents.
      </p>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-2 bg-brand text-brand-foreground rounded-md px-4 py-2.5 font-semibold hover:opacity-90 transition-base"
      >
        <Plus size={18} /> Create Workspace
      </button>
    </div>
  );
}
