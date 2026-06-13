import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Paperclip,
  Send,
  Link as LinkIcon,
  FileText,
  Bot,
  X,
  Check,
  Loader2,
  Trash2,
} from "lucide-react";
import {
  useChatMessages,
  useChatSessions,
  useSendChatMessage,
  useDocuments,
  useUploadDocument,
  useDeleteChatSession,
  type ChatMessage,
} from "@/hooks/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  const [hasSelectedInitial, setHasSelectedInitial] = useState(false);
  const { data: messages } = useChatMessages(workspaceId, activeSession);
  const send = useSendChatMessage(workspaceId);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: documents } = useDocuments(workspaceId);
  const uploadDoc = useUploadDocument(workspaceId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const deleteSession = useDeleteChatSession(workspaceId);

  useEffect(() => {
    setHasSelectedInitial(false);
    setActiveSession(null);
    setSelectedDocs([]);
    setPendingQuestion(null);
  }, [workspaceId]);

  useEffect(() => {
    if (sessionsArray.length > 0 && !activeSession && !hasSelectedInitial) {
      setActiveSession(sessionsArray[0].id);
      setHasSelectedInitial(true);
    }
  }, [sessionsArray, activeSession, hasSelectedInitial]);


  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, pendingQuestion]);

  async function handleSend() {
    const q = input.trim();
    if (!q || send.isPending) return;
    setInput("");
    setPendingQuestion(q);
    try {
      const res = await send.mutateAsync({
        question: q,
        chat_session_id: activeSession ?? undefined,
        document_ids: selectedDocs.length > 0 ? selectedDocs : undefined,
      });
      if (!activeSession) setActiveSession(res.chat_session_id);
    } catch {
      /* surface via toast happens in caller if needed */
    } finally {
      setPendingQuestion(null);
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
            <div
              key={s.id}
              className={cn(
                "group relative w-full p-3 rounded-md border transition-base flex items-center justify-between gap-2",
                activeSession === s.id
                  ? "border-brand bg-brand/5"
                  : "border-transparent hover:bg-background/60",
              )}
            >
              <button
                type="button"
                onClick={() => setActiveSession(s.id)}
                className="flex-1 min-w-0 text-left cursor-pointer"
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
                <p className="text-xs text-muted-foreground line-clamp-1">
                  Open session • {new Date(s.created_at).toLocaleDateString()}
                </p>
              </button>

              <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                {deletingSessionId === s.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await deleteSession.mutateAsync(s.id);
                          if (activeSession === s.id) {
                            setActiveSession(null);
                          }
                          toast.success("Conversation deleted");
                        } catch {
                          toast.error("Failed to delete conversation");
                        } finally {
                          setDeletingSessionId(null);
                        }
                      }}
                      className="text-brand hover:scale-110 p-0.5 rounded cursor-pointer"
                      title="Confirm delete"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingSessionId(null);
                      }}
                      className="text-muted-foreground hover:scale-110 p-0.5 rounded cursor-pointer"
                      title="Cancel"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingSessionId(s.id);
                    }}
                    className="text-muted-foreground hover:text-destructive hover:scale-115 p-0.5 rounded transition-all cursor-pointer"
                    title="Delete conversation"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
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
          {pendingQuestion && (
            <div className="flex flex-col items-end animate-fade-up">
              <div className="bg-background border border-border rounded-xl px-4 py-3 max-w-[80%] text-sm opacity-70">
                {pendingQuestion}
              </div>
              <span className="text-xs text-muted-foreground mt-1 font-mono text-[10px] animate-pulse">
                Sending to IntelVault AI…
              </span>
            </div>
          )}
          {send.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 animate-fade-in">
              <span className="w-2 h-2 rounded-full bg-brand animate-pulse-dot" />
              IntelVault AI is thinking…
            </div>
          )}
        </div>

        <div className="border-t border-border p-4 space-y-3">
          {/* Selected documents pills */}
          {selectedDocs.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pb-2 border-b border-border/40">
              {selectedDocs.map((docId) => {
                const doc = documents?.find((d) => d.id === docId);
                if (!doc) return null;
                return (
                  <div
                    key={docId}
                    className="inline-flex items-center gap-1.5 text-xs font-mono bg-brand/10 border border-brand/20 text-brand px-2.5 py-1 rounded-md animate-fade-in"
                  >
                    <FileText size={11} />
                    <span className="truncate max-w-44">{doc.filename}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedDocs(selectedDocs.filter((id) => id !== docId))}
                      className="hover:bg-brand/20 rounded p-0.5 transition-base cursor-pointer"
                      aria-label="Remove attachment"
                    >
                      <X size={10} />
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => setSelectedDocs([])}
                className="text-[10px] text-muted-foreground hover:text-foreground underline transition-base cursor-pointer px-1 self-center"
              >
                Clear all
              </button>
            </div>
          )}

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
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowAttachMenu(!showAttachMenu)}
                  aria-label="Attach"
                  className={cn(
                    "hover:text-foreground transition-all duration-300 hover:scale-115 active:scale-95 cursor-pointer relative flex items-center justify-center w-6 h-6 rounded hover:bg-sidebar-accent/60",
                    selectedDocs.length > 0 && "text-brand bg-brand/5"
                  )}
                >
                  <Paperclip size={16} />
                  {selectedDocs.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-brand text-[9px] font-bold text-brand-foreground rounded-full flex items-center justify-center animate-fade-in border border-background">
                      {selectedDocs.length}
                    </span>
                  )}
                </button>

                {showAttachMenu && (
                  <div className="absolute bottom-8 left-0 w-72 bg-surface border border-border rounded-xl p-4 shadow-xl z-20 animate-fade-up">
                    <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Attach context files</span>
                      <button
                        type="button"
                        onClick={() => setShowAttachMenu(false)}
                        className="text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadDoc.isPending}
                      className="w-full flex items-center justify-center gap-2 border border-dashed border-border hover:border-brand/50 hover:bg-brand/5 py-2 py-2 rounded-lg text-xs font-semibold mb-3 cursor-pointer text-brand transition-base"
                    >
                      {uploadDoc.isPending ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Plus size={12} />
                      )}
                      Upload file to chat
                    </button>
                    
                    <div className="max-h-40 overflow-y-auto space-y-1 pr-0.5">
                      {!documents?.length ? (
                        <div className="text-center text-xs text-muted-foreground py-4">No workspace files found.</div>
                      ) : (
                        documents.map((doc) => {
                          const selected = selectedDocs.includes(doc.id);
                          return (
                            <button
                              key={doc.id}
                              type="button"
                              onClick={() => {
                                if (selected) {
                                  setSelectedDocs(selectedDocs.filter((id) => id !== doc.id));
                                } else {
                                  setSelectedDocs([...selectedDocs, doc.id]);
                                }
                              }}
                              className={cn(
                                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs transition-base cursor-pointer border border-transparent",
                                selected ? "bg-brand/10 border-brand/20 text-brand font-medium" : "hover:bg-background text-muted-foreground hover:text-foreground"
                              )}
                            >
                              <FileText size={12} className={selected ? "text-brand" : "text-muted-foreground"} />
                              <span className="truncate flex-1 font-mono text-[11px]">{doc.filename}</span>
                              {selected && <Check size={12} className="text-brand shrink-0" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={async (e) => {
                  const files = e.target.files;
                  if (!files || files.length === 0) return;
                  const file = files[0];
                  try {
                    toast.promise(uploadDoc.mutateAsync(file), {
                      loading: `Uploading ${file.name} to workspace...`,
                      success: (res: any) => {
                        setSelectedDocs((prev) => [...prev, res.document.id]);
                        return `Uploaded and attached ${file.name}`;
                      },
                      error: (err) => err?.response?.data?.detail ?? `Failed to upload ${file.name}`
                    });
                  } catch {
                    // Handled in promise
                  }
                }}
              />

              <span className="text-xs flex items-center gap-1.5 ml-1">
                <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse-dot" />
                Ready
              </span>
            </div>
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || send.isPending}
              className="bg-brand text-brand-foreground p-2 rounded-md hover:opacity-90 disabled:opacity-40 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
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
          {m.sources && m.sources.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2 mt-2 border-t border-border/40">
              {m.sources.map((s: any, i) => (
                <div
                  key={i}
                  className="inline-flex items-center gap-1 text-[11px] font-mono bg-brand/5 text-brand/80 border border-brand/20 px-1.5 py-0.5 rounded"
                >
                  <FileText size={10} />
                  <span>{s.document_filename || s.filename || "Attached document"}</span>
                </div>
              ))}
            </div>
          )}
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
