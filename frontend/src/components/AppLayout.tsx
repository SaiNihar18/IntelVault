import { type ReactNode } from "react";
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
} from "lucide-react";
import { Brand } from "./Brand";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/hooks/api";
import { cn } from "@/lib/utils";

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
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-base",
                  active
                    ? "bg-sidebar-accent text-brand"
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60",
                )}
              >
                <Icon size={16} strokeWidth={2} />
                <span className="uppercase tracking-wide text-xs">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pb-4 pt-2 border-t border-sidebar-border space-y-1">
          <button
            type="button"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-brand bg-sidebar-accent/40 hover:bg-sidebar-accent transition-base"
          >
            <Settings size={16} />
            <span>Settings</span>
          </button>
          <button
            type="button"
            onClick={() => logout()}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-base"
          >
            <UserIcon size={16} />
            <span className="truncate">{user?.email ?? "User Profile"}</span>
            <LogOut size={14} className="ml-auto opacity-60" />
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
    </div>
  );
}
