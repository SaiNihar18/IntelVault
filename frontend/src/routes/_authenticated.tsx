import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { isAuthenticated, isHydrating, serverStatus } = useAuth();

  if (isHydrating) {
    return (
      <div className="min-h-screen flex items-center justify-center iv-grid-bg">
        <div className="text-center space-y-4">
          <div className="text-muted-foreground text-sm font-mono animate-pulse-dot">
            Verifying session…
          </div>
          {serverStatus === "waking_up" && (
            <p className="text-xs text-muted-foreground/60 font-sans max-w-xs mx-auto animate-fade-in">
              Waking up backend server on Render... (this may take up to a minute)
            </p>
          )}
        </div>
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  return <Outlet />;
}
