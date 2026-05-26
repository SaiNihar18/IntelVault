import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Brand } from "@/components/Brand";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await register(email, password, name);
      toast.success("Account created");
      navigate({ to: "/workspaces" });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center iv-grid-bg p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md bg-surface/60 backdrop-blur border border-border rounded-xl p-8 space-y-6 animate-fade-up shadow-lg"
      >
        <div className="flex flex-col items-center text-center space-y-3">
          <Brand size="md" />
          <h2 className="text-2xl font-semibold tracking-tight">
            Create your vault
          </h2>
          <p className="text-sm text-muted-foreground">
            Spin up your first secure workspace in seconds.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Full Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ada Lovelace"
            className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand transition-base"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Email Address</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="w-full bg-background border border-border rounded-md px-3 py-2.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand transition-base"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Password</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="w-full bg-background border border-border rounded-md px-3 py-2.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand transition-base"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand text-brand-foreground rounded-md py-2.5 font-semibold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60 transition-base"
        >
          {loading ? "Creating…" : "Create Account"}
          {!loading && <ArrowRight size={16} />}
        </button>

        <p className="text-sm text-center text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-brand hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
