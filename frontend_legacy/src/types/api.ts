// Auth
export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  expires_in: number;
}

export interface UserPublic {
  id: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface LogoutRequest {
  refresh_token: string;
}

// Workspaces
export interface WorkspacePublic {
  id: string;
  name: string;
  description: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMemberPublic {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  joined_at: string;
  user_email: string;
}

export type WorkspaceRole = "owner" | "analyst" | "reviewer" | "guest";

export interface WorkspaceDetail {
  workspace: WorkspacePublic;
  members: WorkspaceMemberPublic[];
}

export interface CreateWorkspaceRequest {
  name: string;
  description?: string;
}

export interface InviteMemberRequest {
  email: string;
  role: WorkspaceRole;
}

export interface UpdateRoleRequest {
  role: WorkspaceRole;
}

// Documents
export interface DocumentPublic {
  id: string;
  workspace_id: string;
  uploaded_by_user_id: string;
  filename: string;
  content_type: string | null;
  file_size_bytes: number;
  checksum_sha256: string;
  status: string;
  created_at: string;
  updated_at: string;
}

// Chat
export interface ChatSessionPublic {
  id: string;
  workspace_id: string;
  created_by_user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessagePublic {
  id: string;
  chat_session_id: string;
  role: "user" | "assistant";
  content: string;
  sources: ChatSource[] | null;
  created_at: string;
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
}

export interface ChatRequest {
  question: string;
  chat_session_id: string | null;
  debug_retrieval: boolean;
}

export interface ChatResponse {
  chat_session_id: string;
  user_message_id: string;
  assistant_message_id: string;
  answer: string;
  sources: ChatSource[];
  retrieval_debug: Record<string, unknown> | null;
}

// Shares
export interface ShareLinkPublic {
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

export interface ShareLinkCreateResponse {
  link: ShareLinkPublic;
  share_token: string;
  share_url: string;
}

export interface CreateShareRequest {
  expires_in_hours: number;
  max_uses: number | null;
}

// Audit
export interface AuditEventPublic {
  id: string;
  workspace_id: string;
  event_type: string;
  actor_user_id: string | null;
  document_id: string | null;
  chat_session_id: string | null;
  event_metadata: Record<string, unknown>;
  created_at: string;
}

// Health
export interface HealthResponse {
  status: string;
  service: string;
}

export interface ReadyResponse {
  status: string;
  database: string;
}

// API Error
export interface ApiError {
  detail: string | { msg: string; type: string }[];
  status: number;
}
