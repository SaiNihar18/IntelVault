import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});

function IndexRedirect() {
  const { isAuthenticated, isHydrating } = useAuth();
  if (isHydrating) {
    return (
      <div className="min-h-screen flex items-center justify-center iv-grid-bg">
        <div className="text-muted-foreground text-sm font-mono animate-pulse-dot">
          Initializing IntelVault…
        </div>
      </div>
    );
  }
  return <Navigate to={isAuthenticated ? "/workspaces" : "/login"} />;
}
