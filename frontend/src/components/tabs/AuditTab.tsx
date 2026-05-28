import { useMemo, useState } from "react";
import { Search, ChevronLeft, ChevronRight, Bot, FileText, MessageSquare } from "lucide-react";
import { useAuditLog, type AuditEntry } from "@/hooks/api";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ACTION_STYLES: Record<string, string> = {
  UPLOADED: "text-brand",
  ACCESSED: "text-foreground",
  MODIFIED_ROLE: "text-warning",
  BACKUP_COMPLETE: "text-foreground",
  DELETED: "text-destructive",
};

function initials(email?: string) {
  if (!email) return "SY";
  const local = email.split("@")[0];
  const parts = local.split(/[.\-_]/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? local[1] ?? "")).toUpperCase();
}

const avatarColors = [
  "bg-warning/80 text-warning-foreground",
  "bg-destructive/80 text-destructive-foreground",
  "bg-brand text-brand-foreground",
  "bg-surface border border-border text-foreground",
];

export function AuditTab({ workspaceId }: { workspaceId: string }) {
  const { data: entries, isLoading } = useAuditLog(workspaceId);
  const entriesArray = Array.isArray(entries) ? entries : (entries as any)?.events ?? [];
  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const eventTypes = useMemo(() => {
    return [...new Set(entriesArray.map((e: any) => e.event_type))];
  }, [entriesArray]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return (entriesArray ?? []).filter((e) => {
      if (filterType !== "all" && e.event_type !== filterType) {
        return false;
      }
      return (
        !q ||
        e.event_type.toLowerCase().includes(q) ||
        e.actor_user_id?.toLowerCase().includes(q) ||
        e.document_id?.toLowerCase().includes(q) ||
        e.chat_session_id?.toLowerCase().includes(q) ||
        JSON.stringify(e.event_metadata).toLowerCase().includes(q)
      );
    });
  }, [entriesArray, query, filterType]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const start = filtered.length ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, filtered.length);

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Audit Log</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Immutable record of all administrative and system actions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search logs…"
              className="bg-surface border border-border rounded-md pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand w-60 transition-base"
            />
          </div>
          <Select
            value={filterType}
            onValueChange={(val) => {
              setFilterType(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px] bg-surface border-border">
              <SelectValue placeholder="All Events" />
            </SelectTrigger>
            <SelectContent className="bg-surface border-border">
              <SelectItem value="all">All Events</SelectItem>
              {eventTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-muted-foreground">
              <th className="text-left font-medium px-5 py-3">Timestamp (UTC)</th>
              <th className="text-left font-medium px-5 py-3">Event</th>
              <th className="text-left font-medium px-5 py-3">Actor</th>
              <th className="text-left font-medium px-5 py-3">Related</th>
              <th className="text-right font-medium px-5 py-3">Metadata</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {!isLoading && paged.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">No entries.</td></tr>
            )}
            {paged.map((e, i) => (
              <AuditRow key={e.id} e={e} colorIdx={i} />
            ))}
          </tbody>
        </table>

        <div className="flex items-center justify-between px-5 py-3 border-t border-border text-xs text-muted-foreground">
          <span>
            Showing {start}-{end} of {filtered.length} entries
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded hover:bg-background disabled:opacity-30 transition-base"
              aria-label="Previous"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage((p) => (end < filtered.length ? p + 1 : p))}
              disabled={end >= filtered.length}
              className="p-1.5 rounded hover:bg-background disabled:opacity-30 transition-base"
              aria-label="Next"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuditRow({ e, colorIdx }: { e: AuditEntry; colorIdx: number }) {
  const eventType = e.event_type ?? e.action ?? "event";
  const actionClass = ACTION_STYLES[eventType] ?? "text-foreground";
  const isSystem = !e.actor_user_id;
  const metadataText = JSON.stringify(e.event_metadata ?? {}, null, 0);
  return (
    <tr className="border-t border-border hover:bg-background/40 transition-base">
      <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground whitespace-nowrap">
        {new Date(e.created_at).toISOString().replace("T", " ").replace("Z", "")}
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          {isSystem ? (
            <span className="w-6 h-6 rounded-full bg-surface border border-border flex items-center justify-center">
              <Bot size={12} className="text-muted-foreground" />
            </span>
          ) : (
            <span
              className={cn(
                "w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center font-mono",
                avatarColors[colorIdx % avatarColors.length],
              )}
            >
              {initials(e.actor_user_id ?? undefined)}
            </span>
          )}
          <span className="text-sm">
            {isSystem ? "System Agent" : shortId(e.actor_user_id)}
          </span>
        </div>
      </td>
      <td className="px-5 py-3.5">
        <span className="font-mono text-xs">
          <span className={cn("font-semibold", actionClass)}>{eventType}</span>
        </span>
      </td>
      <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">
        <div className="space-y-1">
          {e.document_id && <div className="flex items-center gap-1"><FileText size={12} />{shortId(e.document_id)}</div>}
          {e.chat_session_id && <div className="flex items-center gap-1"><MessageSquare size={12} />{shortId(e.chat_session_id)}</div>}
        </div>
      </td>
      <td className="px-5 py-3.5 text-right font-mono text-xs text-muted-foreground">
        <span title={metadataText} className="inline-block max-w-72 truncate">
          {metadataText === "{}" ? "—" : metadataText}
        </span>
      </td>
    </tr>
  );
}

function shortId(value?: string | null) {
  if (!value) return "—";
  return `${value.slice(0, 8)}…`;
}
