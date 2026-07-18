import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});

function IndexRedirect() {
  const { isAuthenticated, isHydrating, serverStatus } = useAuth();
  if (isHydrating) {
    return (
      <div className="min-h-screen flex items-center justify-center iv-grid-bg">
        <div className="text-center space-y-4">
          <div className="text-muted-foreground text-sm font-mono animate-pulse-dot">
            Initializing IntelVault…
          </div>
          {serverStatus === "waking_up" && (
            <p className="text-xs text-muted-foreground/60 font-sans max-w-xs mx-auto animate-fade-in">
              Connecting to backend services. Waking up the server, this may take up to a minute if the server was inactive.
            </p>
          )}
        </div>
      </div>
    );
  }
  return <Navigate to={isAuthenticated ? "/workspaces" : "/login"} />;
}
