import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Brand } from "@/components/Brand";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back");
      navigate({ to: "/workspaces" });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Invalid credentials");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 iv-grid-bg">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between p-10 border-r border-border">
        <Brand size="md" />
        <div className="space-y-6 max-w-md animate-fade-up">
          <h1 className="text-5xl font-bold tracking-tight leading-[1.05]">
            Secure
            <br />
            Infrastructure
            <br />
            Management
          </h1>
          <p className="text-muted-foreground">
            Access your high-performance workspace, manage deployments, and audit
            logs with enterprise-grade security.
          </p>
          <pre className="font-mono text-xs leading-6 text-muted-foreground bg-surface border border-border rounded-md p-4">
{`$ sys_auth --mode=secure --env=production
> Initializing encrypted session...
> Standby for user credentials.`}
          </pre>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>© 2026 IntelVault Systems</span>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand animate-pulse-dot" />
            System Status: Operational
          </span>
        </div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6 lg:p-10">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-md space-y-6 animate-fade-up"
        >
          <div className="lg:hidden mb-8">
            <Brand size="md" />
          </div>
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Welcome back</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your credentials to access your vault.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@intelvault.io"
              className="w-full bg-surface border border-border rounded-md px-3 py-2.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand transition-base"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Password</label>
              <button
                type="button"
                className="text-xs text-brand hover:underline"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-surface border border-border rounded-md px-3 py-2.5 pr-10 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand transition-base"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-base"
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand text-brand-foreground rounded-md py-2.5 font-semibold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60 transition-base"
          >
            {loading ? "Signing in…" : "Sign In"}
            {!loading && <ArrowRight size={16} />}
          </button>

          <p className="text-sm text-center text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/register" className="text-brand hover:underline">
              Create an account
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
