import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Users, UserPlus, Crown, Mail } from "lucide-react";
import { workspacesApi } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonList } from "@/components/Skeletons";
import { staggerContainer, staggerItem } from "@/components/PageTransition";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ApiClientError } from "@/services/apiClient";
import type { WorkspaceRole, WorkspaceMemberPublic } from "@/types/api";
import { cn } from "@/lib/utils";

const ROLES: WorkspaceRole[] = ["owner", "analyst", "reviewer", "guest"];

const roleColors: Record<WorkspaceRole, string> = {
  owner: "bg-warning/20 text-warning",
  analyst: "bg-primary/20 text-primary",
  reviewer: "bg-secondary/20 text-secondary",
  guest: "bg-muted text-muted-foreground",
};

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["owner", "analyst", "reviewer", "guest"]),
});

type InviteForm = z.infer<typeof inviteSchema>;

export default function MembersFeature() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data: members, isLoading, error, refetch } = useQuery({
    queryKey: ["members", workspaceId],
    queryFn: () => workspacesApi.members(workspaceId!),
    enabled: !!workspaceId,
  });

  const inviteMutation = useMutation({
    mutationFn: (data: InviteForm) => workspacesApi.inviteMember(workspaceId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members", workspaceId] });
      toast({ title: "Member invited" });
      setInviteOpen(false);
      reset();
    },
    onError: (err) => {
      toast({ title: "Invite failed", description: err instanceof ApiClientError ? String(err.detail) : "An error occurred", variant: "destructive" });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: WorkspaceRole }) =>
      workspacesApi.updateRole(workspaceId!, userId, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members", workspaceId] });
      toast({ title: "Role updated" });
    },
    onError: (err) => {
      toast({ title: "Update failed", description: err instanceof ApiClientError ? String(err.detail) : "Permission denied", variant: "destructive" });
    },
  });

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: "analyst" },
  });

  if (isLoading) return <SkeletonList rows={4} />;
  if (error) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="font-display text-lg font-semibold text-foreground">Members ({members?.length || 0})</h2>
        <Dialog open={inviteOpen} onOpenChange={(v) => { setInviteOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><UserPlus className="mr-2 h-4 w-4" />Invite</Button>
          </DialogTrigger>
          <DialogContent className="glass-panel border-border">
            <DialogHeader><DialogTitle className="font-display">Invite member</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit((data) => inviteMutation.mutate(data))} className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" placeholder="colleague@example.com" {...register("email")} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={watch("role")} onValueChange={(v) => setValue("role", v as WorkspaceRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={inviteMutation.isPending}>
                {inviteMutation.isPending ? "Inviting…" : "Send invite"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!members?.length ? (
        <EmptyState icon={Users} title="No members" description="Invite team members to collaborate." actionLabel="Invite" onAction={() => setInviteOpen(true)} />
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-2">
          {members.map(member => (
            <motion.div key={member.id} variants={staggerItem} className="glass-panel rounded-lg p-4 flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Mail className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{member.user_email}</p>
                <p className="text-xs text-muted-foreground">Joined {new Date(member.joined_at).toLocaleDateString()}</p>
              </div>
              <Select
                value={member.role}
                onValueChange={(v) => updateRoleMutation.mutate({ userId: member.user_id, role: v as WorkspaceRole })}
              >
                <SelectTrigger className={cn("w-28 h-8 text-xs", roleColors[member.role])}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
