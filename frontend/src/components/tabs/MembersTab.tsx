import { useState } from "react";
import { UserPlus, Search, Mail, Crown } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useInviteMember,
  useMembers,
  useUpdateMemberRole,
  type Member,
  type WorkspaceRole,
} from "@/hooks/api";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const ROLES: WorkspaceRole[] = ["owner", "analyst", "reviewer", "guest"];

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["owner", "analyst", "reviewer", "guest"]),
});

type InviteForm = z.infer<typeof inviteSchema>;

function initials(input: string) {
  const local = input.split("@")[0];
  return local
    .split(/[.\-_ ]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || input.slice(0, 2).toUpperCase();
}

const palette = [
  "bg-brand text-brand-foreground",
  "bg-warning/80 text-warning-foreground",
  "bg-destructive/80 text-destructive-foreground",
  "bg-surface text-foreground border border-border",
];

export function MembersTab({ workspaceId }: { workspaceId: string }) {
  const { data: members, isLoading } = useMembers(workspaceId);
  const invite = useInviteMember(workspaceId);
  const updateRole = useUpdateMemberRole(workspaceId);
  const [q, setQ] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: "guest" },
  });

  const filtered = (members ?? []).filter((m) =>
    (m.user_email ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  async function onInvite(data: InviteForm) {
    try {
      await invite.mutateAsync(data);
      toast.success("Member invited");
      setInviteOpen(false);
      reset({ role: "guest" });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Failed to invite member");
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage access and roles for workspace members.
          </p>
        </div>
        <Dialog open={inviteOpen} onOpenChange={(open) => {
          setInviteOpen(open);
          if (!open) {
            reset({ role: "guest" });
          }
        }}>
          <DialogTrigger asChild>
            <Button className="inline-flex items-center gap-2">
              <UserPlus size={16} />
              Invite Member
            </Button>
          </DialogTrigger>
          <DialogContent className="border-border bg-surface">
            <DialogHeader>
              <DialogTitle className="font-semibold">Invite member</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Grant workspace access and assign role permissions to a team member.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onInvite)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input id="invite-email" type="email" placeholder="colleague@example.com" {...register("email")} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">Role</Label>
                <Select value={watch("role")} onValueChange={(value) => setValue("role", value as WorkspaceRole)}>
                  <SelectTrigger id="invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role} value={role} className="capitalize">
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={invite.isPending}>
                {invite.isPending ? "Inviting…" : "Send invite"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-surface border border-border rounded-xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Roster
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search members…"
              className="bg-background border border-border rounded-md pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand w-56 transition-base"
            />
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-muted-foreground">
              <th className="text-left font-medium px-5 py-3">User Email</th>
              <th className="text-left font-medium px-5 py-3">Role</th>
              <th className="text-right font-medium px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={3} className="px-5 py-10 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-10 text-center text-muted-foreground">
                  No members found.
                </td>
              </tr>
            )}
            {filtered.map((m, i) => (
              <MemberRow
                key={m.id}
                m={m}
                colorIdx={i}
                onRoleChange={async (role) => {
                  try {
                    await updateRole.mutateAsync({ userId: m.user_id, role });
                    toast.success("Role updated");
                  } catch (err: any) {
                    toast.error(err?.response?.data?.detail ?? "Failed to update role");
                  }
                }}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MemberRow({
  m,
  colorIdx,
  onRoleChange,
}: {
  m: Member;
  colorIdx: number;
  onRoleChange: (role: WorkspaceRole) => void;
}) {
  return (
    <tr className="border-t border-border hover:bg-background/40 transition-base">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "w-7 h-7 rounded text-xs font-bold flex items-center justify-center font-mono",
              palette[colorIdx % palette.length],
            )}
          >
            {initials(m.full_name ?? (m.user_email ?? ""))}
          </span>
          <span className="font-mono">{m.user_email}</span>
        </div>
      </td>
      <td className="px-5 py-3.5">
          {m.role === "owner" ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-brand/30 bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand">
              <Crown size={12} /> Owner
            </span>
          ) : (
            <Select value={m.role} onValueChange={(value) => onRoleChange(value as WorkspaceRole)}>
              <SelectTrigger className="w-32 h-8 text-xs capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.filter((role) => role !== "owner").map((role) => (
                  <SelectItem key={role} value={role} className="capitalize">
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
      </td>
      <td className="px-5 py-3.5">
          <div className="flex justify-end text-xs text-muted-foreground">
            Joined {new Date(m.joined_at).toLocaleDateString()}
          </div>
      </td>
    </tr>
  );
}
