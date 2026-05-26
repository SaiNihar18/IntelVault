import { Outlet, NavLink, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, LogOut, User, ChevronDown, LayoutGrid } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { workspaceId } = useParams();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-panel border-b border-border/50">
        <div className="flex h-14 items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/workspaces")} className="flex items-center gap-2 text-foreground hover:opacity-80 transition-opacity">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--gradient-primary)" }}>
                <Shield className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-display text-lg font-bold hidden sm:inline">IntelVault</span>
            </button>

            {workspaceId && (
              <>
                <span className="text-border">/</span>
                <Button variant="ghost" size="sm" onClick={() => navigate("/workspaces")} className="text-muted-foreground hover:text-foreground">
                  <LayoutGrid className="mr-1.5 h-4 w-4" />
                  Workspaces
                </Button>
              </>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-primary">
                  <User className="h-3.5 w-3.5" />
                </div>
                <span className="hidden sm:inline text-sm text-foreground">{user?.email}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium text-foreground">{user?.email}</p>
                <p className="text-xs text-muted-foreground">Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
