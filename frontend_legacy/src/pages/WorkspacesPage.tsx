import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, FolderOpen, Calendar } from "lucide-react";
import { workspacesApi } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { PageTransition, staggerContainer, staggerItem } from "@/components/PageTransition";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonCard } from "@/components/Skeletons";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ApiClientError } from "@/services/apiClient";

const createSchema = z.object({
  name: z.string().min(2, "Min 2 chars").max(120),
  description: z.string().max(2000).optional(),
});

type CreateForm = z.infer<typeof createSchema>;

export default function WorkspacesPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: workspaces, isLoading, error, refetch } = useQuery({
    queryKey: ["workspaces"],
    queryFn: workspacesApi.list,
  });

  const createMutation = useMutation({
    mutationFn: workspacesApi.create,
    onSuccess: (ws) => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      toast({ title: "Workspace created", description: ws.name });
      setOpen(false);
      navigate(`/workspaces/${ws.id}`);
    },
    onError: (err) => {
      toast({ title: "Error", description: err instanceof ApiClientError ? String(err.detail) : "Failed to create workspace", variant: "destructive" });
    },
  });

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateForm>({ resolver: zodResolver(createSchema) });

  const onSubmit = (data: CreateForm) => createMutation.mutate(data);

  return (
    <PageTransition className="container max-w-5xl py-8 px-4">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Workspaces</h1>
          <p className="text-sm text-muted-foreground mt-1">Your secure knowledge environments</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />New workspace</Button>
          </DialogTrigger>
          <DialogContent className="glass-panel border-border">
            <DialogHeader><DialogTitle className="font-display">Create workspace</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ws-name">Name</Label>
                <Input id="ws-name" placeholder="Project Alpha" {...register("name")} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="ws-desc">Description (optional)</Label>
                <Textarea id="ws-desc" placeholder="What's this workspace for?" rows={3} {...register("description")} />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating…" : "Create workspace"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <SkeletonCard count={6} />
      ) : error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !workspaces?.length ? (
        <EmptyState icon={FolderOpen} title="No workspaces yet" description="Create your first workspace to start uploading and analyzing documents." actionLabel="Create workspace" onAction={() => setOpen(true)} />
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((ws) => (
            <motion.button
              key={ws.id}
              variants={staggerItem}
              onClick={() => navigate(`/workspaces/${ws.id}`)}
              className="glass-panel rounded-xl p-5 text-left transition-all hover:border-primary/30 hover:shadow-[var(--shadow-glow-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                <FolderOpen className="h-5 w-5" />
              </div>
              <h3 className="font-display font-semibold text-foreground truncate">{ws.name}</h3>
              {ws.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{ws.description}</p>}
              <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {new Date(ws.created_at).toLocaleDateString()}
              </div>
            </motion.button>
          ))}
        </motion.div>
      )}
    </PageTransition>
  );
}
