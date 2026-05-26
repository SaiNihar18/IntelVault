import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; className: string }> = {
  processing: { label: "Processing", className: "bg-warning/20 text-warning" },
  ready: { label: "Ready", className: "bg-success/20 text-success" },
  failed: { label: "Failed", className: "bg-destructive/20 text-destructive" },
  pending: { label: "Pending", className: "bg-info/20 text-info" },
  queued: { label: "Queued", className: "bg-muted text-muted-foreground" },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status.toLowerCase()] || { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", config.className, className)}>
      {config.label}
    </span>
  );
}
