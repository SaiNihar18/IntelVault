import { type ReactNode, useState } from "react";
import { Link, useParams, useRouterState } from "@tanstack/react-router";
import {
  FileText,
  MessageSquare,
  Users,
  Share2,
  History,
  Settings,
  User as UserIcon,
  ChevronRight,
  LogOut,
  Laptop,
  Activity,
} from "lucide-react";
import { Brand } from "./Brand";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/hooks/api";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const NAV = [
  { to: "documents", label: "Documents", icon: FileText },
  { to: "chat", label: "AI Chat", icon: MessageSquare },
  { to: "members", label: "Members", icon: Users },
  { to: "shares", label: "Shares", icon: Share2 },
  { to: "audit", label: "Audit Log", icon: History },
] as const;

export function AppLayout({
  children,
  headerRight,
}: {
  children: ReactNode;
  headerRight?: ReactNode;
}) {
  const params = useParams({ strict: false }) as { workspaceId?: string };
  const workspaceId = params.workspaceId ?? "";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, logout } = useAuth();
  const { data: workspaceDetail } = useWorkspace(workspaceId);
  const workspace = workspaceDetail?.workspace;

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const currentNav = NAV.find((n) => pathname.endsWith(`/${n.to}`));

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r border-border bg-sidebar">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <Link to="/workspaces" className="block group">
            <Brand size="md" showSubtitle />
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = pathname.endsWith(`/${to}`);
            return (
              <Link
                key={to}
                to="/workspaces/$workspaceId/$tab"
                params={{ workspaceId, tab: to }}
                className={cn(
                  "group flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-base cursor-pointer",
                  active
                    ? "bg-sidebar-accent text-brand"
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60",
                )}
              >
                <Icon
                  size={16}
                  strokeWidth={2}
                  className="transition-transform duration-300 group-hover:scale-110 group-hover:translate-x-0.5"
                />
                <span className="uppercase tracking-wide text-xs">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pb-4 pt-2 border-t border-sidebar-border space-y-1">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-base cursor-pointer"
          >
            <Settings size={16} />
            <span>Settings</span>
          </button>
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-base cursor-pointer"
          >
            <UserIcon size={16} />
            <span className="truncate">{user?.email ?? "User Profile"}</span>
          </button>
          <button
            type="button"
            onClick={() => logout()}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-destructive hover:bg-destructive/10 transition-base cursor-pointer mt-2"
          >
            <LogOut size={16} />
            <span className="font-semibold uppercase tracking-wider text-xs">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 flex items-center justify-between px-5 border-b border-border bg-background/70 backdrop-blur sticky top-0 z-10">
          <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
            <Link
              to="/workspaces"
              className="hover:text-foreground transition-base truncate"
            >
              {workspace?.name ?? "Workspace"}
            </Link>
            {currentNav && (
              <>
                <ChevronRight size={14} className="opacity-50 shrink-0" />
                <span className="text-brand font-medium truncate">
                  {currentNav.label}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">{headerRight}</div>
        </header>

        <main className="flex-1 p-6 md:p-8 animate-fade-up">{children}</main>
      </div>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="border-border bg-surface max-w-md">
          <DialogHeader>
            <DialogTitle className="font-semibold text-lg flex items-center gap-2">
              <Settings size={18} className="text-brand" />
              Application Settings
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm text-foreground">
            <div className="space-y-1.5 border-b border-border/40 pb-3">
              <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Workspace Mode</div>
              <div className="flex items-center justify-between">
                <span>Current Workspace</span>
                <span className="font-medium text-brand">{workspace?.name ?? "N/A"}</span>
              </div>
            </div>

            <div className="space-y-1.5 border-b border-border/40 pb-3">
              <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Preferences</div>
              <div className="flex items-center justify-between">
                <span>Theme</span>
                <span className="inline-flex items-center gap-1.5 text-xs bg-sidebar-accent text-brand px-2.5 py-1 rounded-md font-mono">
                  <Laptop size={12} /> Dark Mode
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Infrastructure Status</div>
              <div className="space-y-2 pt-1 font-mono text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>OCR Ingestion</span>
                  <span className="text-emerald-500 font-semibold">Active</span>
                </div>
                <div className="flex justify-between">
                  <span>Embeddings Provider</span>
                  <span>Gemini Embedding 2</span>
                </div>
                <div className="flex justify-between">
                  <span>Vector Dimension</span>
                  <span>128-d</span>
                </div>
                <div className="flex justify-between">
                  <span>Retrieval Weight (Lexical)</span>
                  <span>25%</span>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Profile Dialog */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="border-border bg-surface max-w-md">
          <DialogHeader>
            <DialogTitle className="font-semibold text-lg flex items-center gap-2">
              <UserIcon size={18} className="text-brand" />
              User Profile
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-4 border-b border-border/30">
            <div className="w-16 h-16 rounded-full bg-brand/10 border border-brand/40 flex items-center justify-center text-brand text-2xl font-bold font-mono mb-3">
              {user?.email ? user.email.slice(0, 2).toUpperCase() : "US"}
            </div>
            <div className="font-mono text-sm font-semibold">{user?.email}</div>
            <div className="text-xs text-muted-foreground mt-1">Authenticated Member</div>
          </div>
          <div className="space-y-3 py-3 text-sm text-foreground">
            <div className="flex justify-between">
              <span className="text-muted-foreground">User ID</span>
              <span className="font-mono text-xs text-muted-foreground truncate max-w-56" title={user?.id}>
                {user?.id ?? "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Account Status</span>
              <span className="inline-flex items-center gap-1 text-xs text-emerald-500 font-semibold">
                <Activity size={12} className="animate-pulse" /> Verified
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Active Sessions</span>
              <span className="text-muted-foreground font-mono text-xs">1 active connection</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
