import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Send, MessageSquare, Plus, ChevronDown, ChevronRight, FileText, Bug } from "lucide-react";
import { chatApi } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonList, SkeletonBlock } from "@/components/Skeletons";
import { staggerContainer, staggerItem } from "@/components/PageTransition";
import type { ChatMessagePublic, ChatSource, ChatResponse } from "@/types/api";
import { ApiClientError } from "@/services/apiClient";
import { cn } from "@/lib/utils";

export default function ChatFeature() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [debugMode, setDebugMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ["chat-sessions", workspaceId],
    queryFn: () => chatApi.sessions(workspaceId!),
    enabled: !!workspaceId,
  });

  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ["chat-messages", workspaceId, selectedSessionId],
    queryFn: () => chatApi.messages(workspaceId!, selectedSessionId!),
    enabled: !!workspaceId && !!selectedSessionId,
  });

  const askMutation = useMutation({
    mutationFn: (q: string) => chatApi.ask(workspaceId!, { question: q, chat_session_id: selectedSessionId, debug_retrieval: debugMode }),
    onSuccess: (res: ChatResponse) => {
      setSelectedSessionId(res.chat_session_id);
      queryClient.invalidateQueries({ queryKey: ["chat-sessions", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["chat-messages", workspaceId, res.chat_session_id] });
      setQuestion("");
    },
    onError: (err) => {
      toast({ title: "Failed to send", description: err instanceof ApiClientError ? String(err.detail) : "An error occurred", variant: "destructive" });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesData]);

  const sessions = sessionsData?.sessions || [];
  const messages = messagesData?.messages || [];

  const handleSend = () => {
    const q = question.trim();
    if (!q) return;
    askMutation.mutate(q);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-280px)] min-h-[400px]">
      {/* Sessions sidebar */}
      <div className="w-64 shrink-0 glass-panel rounded-xl flex flex-col overflow-hidden hidden md:flex">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Sessions</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedSessionId(null)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessionsLoading ? (
            <div className="space-y-2 p-2"><SkeletonBlock className="h-10" count={5} /></div>
          ) : !sessions.length ? (
            <p className="p-3 text-xs text-muted-foreground text-center">No sessions yet</p>
          ) : (
            sessions.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedSessionId(s.id)}
                className={cn(
                  "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  selectedSessionId === s.id ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <p className="truncate font-medium">{s.title}</p>
                <p className="text-xs text-muted-foreground">{new Date(s.updated_at).toLocaleDateString()}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat main */}
      <div className="flex-1 glass-panel rounded-xl flex flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!selectedSessionId && !askMutation.isPending ? (
            <EmptyState icon={MessageSquare} title="Start a conversation" description="Ask questions about your documents using AI-powered retrieval." />
          ) : messagesLoading ? (
            <div className="space-y-3"><SkeletonBlock className="h-16" count={3} /></div>
          ) : (
            <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-4">
              {messages.map(msg => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {askMutation.isPending && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/20 text-secondary">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div className="glass-panel rounded-xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1">
                      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }} className="h-2 w-2 rounded-full bg-secondary" />
                      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }} className="h-2 w-2 rounded-full bg-secondary" />
                      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }} className="h-2 w-2 rounded-full bg-secondary" />
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-4">
          <div className="flex gap-2">
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your documents…"
              className="min-h-[44px] max-h-32 resize-none"
              rows={1}
            />
            <Button onClick={handleSend} disabled={!question.trim() || askMutation.isPending} size="icon" className="shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => setDebugMode(!debugMode)}
              className={cn("flex items-center gap-1 text-xs transition-colors", debugMode ? "text-warning" : "text-muted-foreground hover:text-foreground")}
            >
              <Bug className="h-3 w-3" />
              Debug retrieval
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessagePublic }) {
  const isUser = message.role === "user";
  const [debugOpen, setDebugOpen] = useState(false);

  return (
    <motion.div variants={staggerItem} className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
        isUser ? "bg-primary/20 text-primary" : "bg-secondary/20 text-secondary"
      )}>
        {isUser ? <span className="text-xs font-bold">U</span> : <MessageSquare className="h-4 w-4" />}
      </div>
      <div className={cn("max-w-[75%] space-y-2", isUser && "text-right")}>
        <div className={cn(
          "rounded-xl px-4 py-3 text-sm",
          isUser ? "bg-primary/10 rounded-tr-sm" : "glass-panel rounded-tl-sm"
        )}>
          <p className="whitespace-pre-wrap text-foreground">{message.content}</p>
        </div>

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Sources:</p>
            {message.sources.map((src, i) => (
              <SourceCard key={i} source={src as ChatSource} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function SourceCard({ source }: { source: ChatSource }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className="w-full text-left glass-panel rounded-lg px-3 py-2 text-xs hover:border-primary/20 transition-colors"
    >
      <div className="flex items-center gap-2">
        <FileText className="h-3 w-3 text-info shrink-0" />
        <span className="truncate text-foreground font-medium">{source.document_filename}</span>
        {source.page_number && <span className="text-muted-foreground">p.{source.page_number}</span>}
        <span className="ml-auto text-muted-foreground">{(source.score * 100).toFixed(0)}%</span>
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.p
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-2 text-muted-foreground overflow-hidden"
          >
            {source.content}
          </motion.p>
        )}
      </AnimatePresence>
    </button>
  );
}
