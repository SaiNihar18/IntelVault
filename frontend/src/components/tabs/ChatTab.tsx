import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Paperclip,
  Tag,
  Send,
  Link as LinkIcon,
  FileText,
  Bot,
} from "lucide-react";
import {
  useChatMessages,
  useChatSessions,
  useSendChatMessage,
  type ChatMessage,
} from "@/hooks/api";
import { cn } from "@/lib/utils";

function relTime(s: string) {
  const d = new Date(s);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "2-digit" });
}

export function ChatTab({ workspaceId }: { workspaceId: string }) {
  const { data: sessions } = useChatSessions(workspaceId);
  const sessionsArray = Array.isArray(sessions) ? sessions : (sessions as any)?.sessions ?? [];
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const { data: messages } = useChatMessages(workspaceId, activeSession);
  const send = useSendChatMessage(workspaceId);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeSession && sessionsArray[0]) setActiveSession(sessionsArray[0].id);
  }, [sessionsArray, activeSession]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function handleSend() {
    const q = input.trim();
    if (!q || send.isPending) return;
    setInput("");
    try {
      const res = await send.mutateAsync({
        question: q,
        chat_session_id: activeSession ?? undefined,
      });
      if (!activeSession) setActiveSession(res.chat_session_id);
    } catch {
      /* surface via toast happens in caller if needed */
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 h-[calc(100vh-9rem)]">
      {/* Sessions */}
      <aside className="bg-surface border border-border rounded-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-sm">Recent Sessions</h3>
          <button
            type="button"
            onClick={() => setActiveSession(null)}
            className="text-brand hover:opacity-80 transition-base"
            aria-label="New session"
          >
            <Plus size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessionsArray.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSession(s.id)}
              className={cn(
                "w-full text-left p-3 rounded-md border transition-base",
                activeSession === s.id
                  ? "border-brand bg-brand/5"
                  : "border-transparent hover:bg-background/60",
              )}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span
                  className={cn(
                    "text-sm font-medium truncate",
                    activeSession === s.id && "text-brand",
                  )}
                >
                  {s.title}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {relTime(s.updated_at)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">
                Open session • {new Date(s.created_at).toLocaleDateString()}
              </p>
            </button>
          ))}
          {!sessions?.length && (
            <p className="text-xs text-muted-foreground p-4 text-center">
              No conversations yet. Ask a question to get started.
            </p>
          )}
        </div>
      </aside>

      {/* Conversation */}
      <section className="bg-surface border border-border rounded-xl flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-5" ref={scrollRef}>
          {!activeSession && !messages?.length && (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground gap-2">
              <Bot size={32} className="text-brand" />
              <p>Ask IntelVault AI about your workspace documents.</p>
            </div>
          )}
          {messages?.map((m) => <MessageBubble key={m.id} m={m} />)}
          {send.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-brand animate-pulse-dot" />
              IntelVault AI is thinking…
            </div>
          )}
        </div>

        <div className="border-t border-border p-4 space-y-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask IntelVault AI about your workspace documents…"
            rows={2}
            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-brand transition-base"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-muted-foreground">
              <button type="button" aria-label="Attach" className="hover:text-foreground transition-base">
                <Paperclip size={16} />
              </button>
              <button type="button" aria-label="Tag" className="hover:text-foreground transition-base">
                <Tag size={16} />
              </button>
              <span className="text-xs flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse-dot" />
                Ready
              </span>
            </div>
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || send.isPending}
              className="bg-brand text-brand-foreground p-2 rounded-md hover:opacity-90 disabled:opacity-40 transition-base"
              aria-label="Send"
            >
              <Send size={16} />
            </button>
          </div>
          <p className="text-xs text-center text-muted-foreground">
            IntelVault AI can make mistakes. Verify critical information in source documents.
          </p>
        </div>
      </section>
    </div>
  );
}

function MessageBubble({ m }: { m: ChatMessage }) {
  if (m.role === "user") {
    return (
      <div className="flex flex-col items-end animate-fade-up">
        <div className="bg-background border border-border rounded-xl px-4 py-3 max-w-[80%] text-sm">
          {m.content}
        </div>
        <span className="text-xs text-muted-foreground mt-1">
          User • {relTime(m.created_at)}
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start animate-fade-up">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-6 h-6 bg-brand/15 border border-brand/40 rounded flex items-center justify-center">
          <Bot size={13} className="text-brand" />
        </div>
        <span className="text-sm font-semibold text-brand">IntelVault AI</span>
      </div>
      <div className="bg-background border border-border rounded-xl px-4 py-3.5 max-w-[85%] text-sm space-y-3">
        <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
        {m.sources && m.sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/60">
            {m.sources.map((s, i) => (
              <button
                key={i}
                type="button"
                title={s.content}
                className="inline-flex items-center gap-1.5 text-xs font-mono bg-brand/10 hover:bg-brand/20 text-brand border border-brand/30 px-2 py-1 rounded transition-base"
              >
                <FileText size={11} />
                {s.document_filename}
                {s.page_number != null && <span className="opacity-80">(Pg {s.page_number})</span>}
                <LinkIcon size={11} className="opacity-70" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
