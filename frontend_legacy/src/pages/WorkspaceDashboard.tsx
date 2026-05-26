import { useParams, NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FileText, MessageSquare, Share2, Shield, Users } from "lucide-react";
import { workspacesApi } from "@/services/api";
import { PageTransition } from "@/components/PageTransition";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonBlock } from "@/components/Skeletons";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "documents", label: "Documents", icon: FileText },
  { to: "chat", label: "Chat", icon: MessageSquare },
  { to: "shares", label: "Shares", icon: Share2 },
  { to: "audit", label: "Audit", icon: Shield },
  { to: "members", label: "Members", icon: Users },
];

export default function WorkspaceDashboard() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => workspacesApi.get(workspaceId!),
    enabled: !!workspaceId,
  });

  if (error) return <div className="container py-8"><ErrorState onRetry={() => refetch()} /></div>;

  return (
    <PageTransition>
      <div className="border-b border-border">
        <div className="container max-w-6xl px-4 pt-6 pb-0">
          {isLoading ? (
            <div className="space-y-2 mb-4">
              <SkeletonBlock className="h-7 w-48" />
              <SkeletonBlock className="h-4 w-72" />
            </div>
          ) : (
            <div className="mb-4">
              <h1 className="font-display text-2xl font-bold text-foreground">{data?.workspace.name}</h1>
              {data?.workspace.description && <p className="mt-1 text-sm text-muted-foreground">{data.workspace.description}</p>}
            </div>
          )}

          <nav className="flex gap-1 overflow-x-auto" role="tablist">
            {tabs.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "documents"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap",
                    isActive
                      ? "bg-muted text-foreground border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      <div className="container max-w-6xl px-4 py-6">
        <Outlet />
      </div>
    </PageTransition>
  );
}
