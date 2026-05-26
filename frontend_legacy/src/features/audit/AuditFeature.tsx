import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Shield, Clock, Info } from "lucide-react";
import { auditApi } from "@/services/api";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonList } from "@/components/Skeletons";
import { staggerContainer, staggerItem } from "@/components/PageTransition";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const eventColors: Record<string, string> = {
  "document.uploaded": "bg-info/20 text-info",
  "document.processed": "bg-success/20 text-success",
  "document.failed": "bg-destructive/20 text-destructive",
  "member.invited": "bg-secondary/20 text-secondary",
  "share.created": "bg-accent/20 text-accent",
  "share.revoked": "bg-warning/20 text-warning",
  "chat.message": "bg-primary/20 text-primary",
};

export default function AuditFeature() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [filter, setFilter] = useState<string>("all");
  const [limit, setLimit] = useState(100);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["audit", workspaceId, limit],
    queryFn: () => auditApi.list(workspaceId!, limit),
    enabled: !!workspaceId,
  });

  const events = useMemo(() => data?.events ?? [], [data?.events]);
  const eventTypes = useMemo(() => [...new Set(events.map(e => e.event_type))], [events]);
  const filtered = filter === "all" ? events : events.filter(e => e.event_type === filter);

  if (isLoading) return <SkeletonList rows={6} />;
  if (error) return <ErrorState onRetry={() => refetch()} />;
  if (!events.length) return <EmptyState icon={Shield} title="No audit events" description="Activity in this workspace will be logged here." />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            {eventTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[25, 50, 100].map(n => <SelectItem key={n} value={String(n)}>{n} events</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-2">
        {filtered.map(event => (
          <motion.div key={event.id} variants={staggerItem} className="glass-panel rounded-lg p-4 flex items-center gap-4">
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", eventColors[event.event_type] || "bg-muted text-muted-foreground")}>
              <Shield className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{event.event_type}</span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 cursor-default">
                    <Clock className="h-3 w-3" />
                    {relativeTime(event.created_at)}
                  </p>
                </TooltipTrigger>
                <TooltipContent>{new Date(event.created_at).toLocaleString()}</TooltipContent>
              </Tooltip>
            </div>
            {Object.keys(event.event_metadata).length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className="text-muted-foreground hover:text-foreground transition-colors">
                    <Info className="h-4 w-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="glass-panel border-border max-w-sm">
                  <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all">{JSON.stringify(event.event_metadata, null, 2)}</pre>
                </PopoverContent>
              </Popover>
            )}
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
