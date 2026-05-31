import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";

/* ============================== Types ============================== */

export type WorkspaceRole = "owner" | "analyst" | "reviewer" | "guest";

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface Member {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  joined_at: string;
  user_email: string;
  full_name?: string | null;
}

export interface WorkspaceDetail {
  workspace: Workspace;
  members: Member[];
}

export interface CreateWorkspaceRequest {
  name: string;
  description?: string | null;
}

export interface InviteMemberRequest {
  email: string;
  role: WorkspaceRole;
}

export interface UpdateRoleRequest {
  role: WorkspaceRole;
}

export interface DocumentItem {
  id: string;
  workspace_id: string;
  uploaded_by_user_id: string;
  filename: string;
  content_type: string | null;
  file_size_bytes: number;
  checksum_sha256: string;
  status: "uploaded" | "processing" | "ready" | "failed" | string;
  created_at: string;
  updated_at: string;
  // Compatibility aliases for older UI code.
  name?: string;
  size_bytes?: number;
  mime_type?: string | null;
}

export interface ChatSession {
  id: string;
  workspace_id: string;
  created_by_user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  preview?: string;
}

export interface ChatSource {
  chunk_id: string;
  document_id: string;
  document_filename: string;
  version_number: number;
  page_number: number | null;
  source_type: string | null;
  score: number;
  content: string;
  // Compatibility aliases.
  document_name?: string;
  page?: number | null;
  snippet?: string;
}

export interface ChatMessage {
  id: string;
  chat_session_id: string;
  role: "user" | "assistant";
  content: string;
  sources: ChatSource[] | null;
  created_at: string;
}

export interface ChatRequest {
  question: string;
  chat_session_id?: string | null;
  debug_retrieval?: boolean;
  document_ids?: string[] | null;
}

export interface ChatResponse {
  chat_session_id: string;
  user_message_id: string;
  assistant_message_id: string;
  answer: string;
  sources: ChatSource[];
  retrieval_debug: Record<string, unknown> | null;
}

export interface Share {
  id: string;
  workspace_id: string;
  document_id: string;
  created_by_user_id: string;
  expires_at: string;
  max_uses: number | null;
  use_count: number;
  is_revoked: boolean;
  created_at: string;
  last_used_at: string | null;
}

export interface ShareLinkCreateRequest {
  expires_in_hours: number;
  max_uses: number | null;
}

export interface ShareLinkCreateResponse {
  link: Share;
  share_token: string;
  share_url: string;
}

export interface PublicShare {
  document: DocumentItem;
}

export interface AuditEntry {
  id: string;
  workspace_id: string;
  event_type: string;
  actor_user_id: string | null;
  document_id: string | null;
  chat_session_id: string | null;
  event_metadata: Record<string, unknown>;
  created_at: string;
  // Compatibility aliases for older UI code.
  user_email?: string;
  user_name?: string;
  action?: string;
  target?: string;
  ip_address?: string;
}

/* ============================ Workspaces =========================== */

export const wsKeys = {
  all: ["workspaces"] as const,
  detail: (id: string) => ["workspaces", id] as const,
};

export function useWorkspaces() {
  return useQuery({
    queryKey: wsKeys.all,
    queryFn: async () => (await apiClient.get<Workspace[]>("/workspaces")).data,
  });
}

export function useWorkspace(id: string | undefined) {
  return useQuery({
    queryKey: id ? wsKeys.detail(id) : ["workspaces", "none"],
    enabled: !!id,
    queryFn: async () =>
      (await apiClient.get<WorkspaceDetail>(`/workspaces/${id}`)).data,
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateWorkspaceRequest) =>
      (await apiClient.post<Workspace>("/workspaces", input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: wsKeys.all }),
  });
}

/* ============================ Documents ============================ */

const docKeys = {
  list: (ws: string) => ["documents", ws] as const,
};

export function useDocuments(workspaceId: string) {
  return useQuery({
    queryKey: docKeys.list(workspaceId),
    enabled: !!workspaceId,
    refetchInterval: (query) => {
      const docs = query.state.data as DocumentItem[] | undefined;
      if (!docs?.length) return false;
      return docs.some((doc) => doc.status === "processing" || doc.status === "uploaded")
        ? 3000
        : false;
    },
    queryFn: async () =>
      (
        await apiClient.get<DocumentItem[]>(
          `/workspaces/${workspaceId}/documents`,
        )
      ).data,
  });
}

export function useUploadDocument(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await apiClient.post<{ document: DocumentItem }>(
        `/workspaces/${workspaceId}/documents`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: docKeys.list(workspaceId) }),
  });
}

export function useDeleteDocument(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/workspaces/${workspaceId}/documents/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: docKeys.list(workspaceId) }),
  });
}

export async function downloadDocument(workspaceId: string, doc: DocumentItem) {
  const response = await apiClient.get(
    `/workspaces/${workspaceId}/documents/${doc.id}/download`,
    { responseType: "blob" }
  );
  const blob = new Blob([response.data], { type: doc.content_type || "application/octet-stream" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = doc.filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/* ============================== Chat =============================== */

const chatKeys = {
  sessions: (ws: string) => ["chat", ws, "sessions"] as const,
  messages: (ws: string, sid: string) => ["chat", ws, "messages", sid] as const,
};

export function useChatSessions(workspaceId: string) {
  return useQuery({
    queryKey: chatKeys.sessions(workspaceId),
    enabled: !!workspaceId,
    queryFn: async () =>
      (
        await apiClient.get<{ sessions: ChatSession[] }>(
          `/workspaces/${workspaceId}/chat/sessions`,
        )
      ).data.sessions,
  });
}

export function useChatMessages(workspaceId: string, sessionId: string | null) {
  return useQuery({
    queryKey: sessionId
      ? chatKeys.messages(workspaceId, sessionId)
      : ["chat", workspaceId, "messages", "none"],
    enabled: !!workspaceId && !!sessionId,
    queryFn: async () =>
      (
        await apiClient.get<{ chat_session_id: string; messages: ChatMessage[] }>(
          `/workspaces/${workspaceId}/chat/sessions/${sessionId}/messages`,
        )
      ).data.messages,
  });
}

export function useSendChatMessage(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ChatRequest) => {
      const { data } = await apiClient.post<ChatResponse>(
        `/workspaces/${workspaceId}/chat/messages`,
        input,
      );
      return data;
    },
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: chatKeys.sessions(workspaceId) });
      qc.setQueryData(
        chatKeys.messages(workspaceId, data.chat_session_id),
        (old: ChatMessage[] | undefined) => {
          const existing = old || [];
          if (existing.some((m) => m.id === data.user_message_id)) {
            return existing;
          }
          return [
            ...existing,
            {
              id: data.user_message_id,
              chat_session_id: data.chat_session_id,
              role: "user",
              content: variables.question,
              created_at: new Date().toISOString(),
              sources: null,
            },
            {
              id: data.assistant_message_id,
              chat_session_id: data.chat_session_id,
              role: "assistant",
              content: data.answer,
              created_at: new Date().toISOString(),
              sources: data.sources || [],
            },
          ];
        }
      );
      qc.invalidateQueries({
        queryKey: chatKeys.messages(workspaceId, data.chat_session_id),
      });
    },
  });
}

/* ============================== Members ============================ */

const memberKeys = {
  list: (ws: string) => ["members", ws] as const,
};

export function useMembers(workspaceId: string) {
  return useQuery({
    queryKey: memberKeys.list(workspaceId),
    enabled: !!workspaceId,
    queryFn: async () =>
      (await apiClient.get<Member[]>(`/workspaces/${workspaceId}/members`)).data,
  });
}

export function useInviteMember(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: InviteMemberRequest) => {
      const { data: response } = await apiClient.post<Member>(
        `/workspaces/${workspaceId}/members`,
        data,
      );
      return response;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: memberKeys.list(workspaceId) }),
  });
}

export function useUpdateMemberRole(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: WorkspaceRole }) => {
      const { data } = await apiClient.patch<Member>(
        `/workspaces/${workspaceId}/members/${userId}/role`,
        { role } satisfies UpdateRoleRequest,
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: memberKeys.list(workspaceId) }),
  });
}

// Legacy compatibility only. The backend does not expose a delete-member endpoint.
export function useRemoveMember(_workspaceId: string) {
  return useMutation({
    mutationFn: async (_memberId: string) => {
      throw new Error("Member removal is not supported by this backend");
    },
  });
}

/* ============================== Shares ============================= */

const shareKeys = {
  document: (ws: string, docId: string | undefined) => ["shares", ws, docId ?? "none"] as const,
};

export function useDocumentShareLinks(workspaceId: string, documentId: string | undefined) {
  return useQuery({
    queryKey: shareKeys.document(workspaceId, documentId),
    enabled: !!workspaceId && !!documentId,
    queryFn: async () =>
      (
        await apiClient.get<{ links: Share[] }>(
          `/workspaces/${workspaceId}/documents/${documentId}/shares`,
        )
      ).data.links,
  });
}

export function useCreateShareLink(workspaceId: string, documentId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: ShareLinkCreateRequest) => {
      if (!documentId) {
        throw new Error("Document must be selected before creating a share link");
      }
      const { data: response } = await apiClient.post<ShareLinkCreateResponse>(
        `/workspaces/${workspaceId}/documents/${documentId}/shares`,
        data,
      );
      return response;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: shareKeys.document(workspaceId, documentId) }),
  });
}

export function useRevokeShareLink(workspaceId: string, documentId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (shareId: string) => {
      if (!documentId) {
        throw new Error("Document must be selected before revoking a share link");
      }
      const { data } = await apiClient.delete<Share>(
        `/workspaces/${workspaceId}/documents/${documentId}/shares/${shareId}`,
      );
      return data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: shareKeys.document(workspaceId, documentId) }),
  });
}

// Legacy compatibility only. The backend does not expose workspace-wide shares.
export function useWorkspaceShares(_workspaceId: string) {
  return useQuery({
    queryKey: ["shares", "legacy"],
    enabled: false,
    queryFn: async () => [] as Share[],
  });
}

// Legacy compatibility only. The backend does not expose workspace-wide revoke.
export function useRevokeShare(_workspaceId: string) {
  return useMutation({
    mutationFn: async (_shareId: string) => {
      throw new Error("Legacy workspace-wide share revocation is not supported by this backend");
    },
  });
}

export function usePublicShare(
  token: string | undefined,
  options?: Partial<UseQueryOptions<PublicShare>>,
) {
  return useQuery({
    queryKey: ["public-share", token],
    enabled: !!token,
    queryFn: async () => (await apiClient.get<PublicShare>(`/shares/${token}`)).data,
    ...options,
  });
}

/* =============================== Audit ============================= */

export function useAuditLog(workspaceId: string) {
  return useQuery({
    queryKey: ["audit", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () =>
      (
        await apiClient.get<{ events: AuditEntry[] }>(
          `/workspaces/${workspaceId}/audit`,
        )
      ).data.events,
  });
}
