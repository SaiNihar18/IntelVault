import { apiClient } from "./apiClient";
import type {
  TokenPair, UserPublic, LoginRequest, RegisterRequest,
  WorkspacePublic, WorkspaceDetail, WorkspaceMemberPublic,
  CreateWorkspaceRequest, InviteMemberRequest, UpdateRoleRequest,
  DocumentPublic, ChatSessionPublic, ChatMessagePublic, ChatResponse, ChatRequest,
  ShareLinkPublic, ShareLinkCreateResponse, CreateShareRequest,
  AuditEventPublic,
} from "@/types/api";
import { saveTokens, getRefreshToken, clearTokens } from "./tokenStore";

// Auth
export const authApi = {
  register: (data: RegisterRequest) => apiClient.post<TokenPair>("/auth/register", data, false).then(t => { saveTokens(t); return t; }),
  login: (data: LoginRequest) => apiClient.post<TokenPair>("/auth/login", data, false).then(t => { saveTokens(t); return t; }),
  logout: async () => {
    const rt = getRefreshToken();
    if (rt) await apiClient.post("/auth/logout", { refresh_token: rt }).catch(() => {});
    clearTokens();
  },
  me: () => apiClient.get<UserPublic>("/auth/me"),
};

// Workspaces
export const workspacesApi = {
  list: () => apiClient.get<WorkspacePublic[]>("/workspaces"),
  get: (id: string) => apiClient.get<WorkspaceDetail>(`/workspaces/${id}`),
  create: (data: CreateWorkspaceRequest) => apiClient.post<WorkspacePublic>("/workspaces", data),
  members: (id: string) => apiClient.get<WorkspaceMemberPublic[]>(`/workspaces/${id}/members`),
  inviteMember: (wsId: string, data: InviteMemberRequest) => apiClient.post<WorkspaceMemberPublic>(`/workspaces/${wsId}/members`, data),
  updateRole: (wsId: string, userId: string, data: UpdateRoleRequest) => apiClient.patch<WorkspaceMemberPublic>(`/workspaces/${wsId}/members/${userId}/role`, data),
};

// Documents
export const documentsApi = {
  list: (wsId: string) => apiClient.get<DocumentPublic[]>(`/workspaces/${wsId}/documents`),
  get: (wsId: string, docId: string) => apiClient.get<DocumentPublic>(`/workspaces/${wsId}/documents/${docId}`),
  upload: (wsId: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return apiClient.upload<{ document: DocumentPublic }>(`/workspaces/${wsId}/documents`, fd);
  },
};

// Chat
export const chatApi = {
  sessions: (wsId: string, limit = 20) => apiClient.get<{ sessions: ChatSessionPublic[] }>(`/workspaces/${wsId}/chat/sessions?limit=${limit}`),
  messages: (wsId: string, sessionId: string, limit = 100) => apiClient.get<{ chat_session_id: string; messages: ChatMessagePublic[] }>(`/workspaces/${wsId}/chat/sessions/${sessionId}/messages?limit=${limit}`),
  ask: (wsId: string, data: ChatRequest) => apiClient.post<ChatResponse>(`/workspaces/${wsId}/chat/messages`, data),
};

// Shares
export const sharesApi = {
  create: (wsId: string, docId: string, data: CreateShareRequest) => apiClient.post<ShareLinkCreateResponse>(`/workspaces/${wsId}/documents/${docId}/shares`, data),
  list: (wsId: string, docId: string) => apiClient.get<{ links: ShareLinkPublic[] }>(`/workspaces/${wsId}/documents/${docId}/shares?limit=100`),
  revoke: (wsId: string, docId: string, linkId: string) => apiClient.delete<ShareLinkPublic>(`/workspaces/${wsId}/documents/${docId}/shares/${linkId}`),
  publicGet: (token: string) => apiClient.get<{ document: DocumentPublic }>(`/shares/${token}`, false),
  publicDownload: (token: string) => `${import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api/v1"}/shares/${token}/download`,
};

// Audit
export const auditApi = {
  list: (wsId: string, limit = 100) => apiClient.get<{ events: AuditEventPublic[] }>(`/workspaces/${wsId}/audit?limit=${limit}`),
};
