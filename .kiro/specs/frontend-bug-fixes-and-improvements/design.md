# Design Document: Frontend Bug Fixes and Improvements

## Overview

This design addresses critical bugs and implements UI improvements in the frontend application built with React, TypeScript, and TanStack Router. The application consists of a workspace-based architecture where users can manage documents, chat with AI, manage team members, create share links, and view audit logs.

The primary issues stem from improper route parameter handling, layout component structure, missing functionality in tab components, and lack of interactive animations. This design maintains the TanStack Router architecture while fixing navigation, implementing missing features, and enhancing the user experience with smooth animations.

## Architecture

### Current Architecture

The application uses a file-based routing system with TanStack Router:

```
routes/
  __root.tsx                    # Root layout with auth provider
  _authenticated.tsx            # Auth guard layout
  _authenticated/
    workspaces.tsx              # Workspace list page
    workspaces.$workspaceId.index.tsx    # Redirects to documents tab
    workspaces.$workspaceId.$tab.tsx     # Tab router component
```

The `AppLayout` component wraps all workspace tab content and provides:
- Sidebar navigation with tab links
- Header breadcrumb showing workspace and current tab
- Settings and Profile modals
- Sign out functionality

### Navigation Flow

1. User clicks workspace card → Navigate to `/workspaces/{id}/documents`
2. Route matches `workspaces.$workspaceId.$tab.tsx`
3. Component extracts `workspaceId` and `tab` from params
4. Renders `AppLayout` with appropriate tab component as children
5. AppLayout uses params to highlight active tab and fetch workspace data

### Key Issues Identified

1. **Route Parameter Extraction**: AppLayout uses `useParams({ strict: false })` which may not properly extract typed parameters
2. **Tab Component Props**: Tab components receive `workspaceId` as prop but may not be using it correctly for API calls
3. **Missing Icon Imports**: ChatTab references undefined icons (Paperclip, Tag, LinkIcon)
4. **Share Link Display**: SharesTab creates links but doesn't display the full URL prominently
5. **Audit Filter**: Filter button exists but has no implementation
6. **Animation Absence**: No hover effects on interactive elements

## Components and Interfaces

### AppLayout Component

**Purpose**: Provides consistent layout for all workspace tabs with sidebar navigation and header.

**Props**:
```typescript
interface AppLayoutProps {
  children: ReactNode;
  headerRight?: ReactNode;
}
```

**State**:
- `settingsOpen: boolean` - Controls settings modal visibility
- `profileOpen: boolean` - Controls profile modal visibility

**Key Behaviors**:
- Extracts `workspaceId` from route params using `useParams`
- Fetches workspace details using `useWorkspace(workspaceId)`
- Renders navigation links with active state based on current pathname
- Provides modal overlays for settings and profile

**Required Changes**:
1. Use strict param extraction: `useParams({ from: '/workspaces/$workspaceId/$tab' })`
2. Add hover animations to Brand component and navigation items
3. Enhance sign out button styling for better visibility

### Tab Components

All tab components follow this interface:

```typescript
interface TabProps {
  workspaceId: string;
}
```

#### ChatTab

**Purpose**: Enables AI-powered chat with document context.

**State**:
- `activeSession: string | null` - Currently selected chat session
- `input: string` - User's message input
- `scrollRef: RefObject<HTMLDivElement>` - Auto-scroll to latest message

**API Hooks**:
- `useChatSessions(workspaceId)` - Fetches all chat sessions
- `useChatMessages(workspaceId, sessionId)` - Fetches messages for active session
- `useSendChatMessage(workspaceId)` - Sends message and creates session if needed

**Required Changes**:
1. Import missing icons: `Paperclip`, `Tag`, `Link` from lucide-react
2. Ensure `workspaceId` is passed correctly to all API hooks
3. Handle new session creation properly (set activeSession after first message)
4. Display document sources with proper formatting

#### SharesTab

**Purpose**: Manages public share links for documents.

**State**:
- `selectedDocId: string` - Currently selected document
- `createOpen: boolean` - Controls create dialog visibility
- `lastShareUrl: string | null` - Most recently created share URL

**API Hooks**:
- `useDocuments(workspaceId)` - Fetches workspace documents
- `useDocumentShareLinks(workspaceId, documentId)` - Fetches shares for selected document
- `useCreateShareLink(workspaceId, documentId)` - Creates new share link
- `useRevokeShareLink(workspaceId, documentId)` - Revokes existing share

**Required Changes**:
1. Display `lastShareUrl` prominently after creation with copy button
2. Ensure share URL includes full origin: `${window.location.origin}/shares/${token}`
3. Auto-copy to clipboard on creation
4. Show success toast with clear messaging

#### AuditTab

**Purpose**: Displays immutable audit log with search and filtering.

**State**:
- `query: string` - Search query for filtering
- `page: number` - Current pagination page
- `filterOpen: boolean` - Controls filter panel visibility (NEW)
- `eventTypeFilter: string[]` - Selected event types (NEW)
- `dateRangeFilter: { start: Date | null, end: Date | null }` - Date range (NEW)

**API Hooks**:
- `useAuditLog(workspaceId)` - Fetches all audit entries

**Required Changes**:
1. Implement filter panel with event type checkboxes
2. Add date range picker for filtering by timestamp
3. Apply filters to the existing `filtered` memo
4. Persist filter state in component

### Brand Component

**Purpose**: Displays application logo and branding.

**Props**:
```typescript
interface BrandProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  interactive?: boolean;  // NEW: enables hover animations
}
```

**Required Changes**:
1. Add `interactive` prop to enable hover effects
2. Implement CSS transitions for scale and glow on hover
3. Use `transition-transform duration-200 ease-out` for smooth animation

## Data Models

### Route Parameters

```typescript
// TanStack Router generates these types
type WorkspaceTabParams = {
  workspaceId: string;
  tab: 'documents' | 'chat' | 'members' | 'shares' | 'audit';
}
```

### Chat Models

```typescript
interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  sources?: Array<{
    document_filename: string;
    page_number?: number;
    content: string;
  }>;
}

interface SendMessageRequest {
  question: string;
  chat_session_id?: string;
}

interface SendMessageResponse {
  chat_session_id: string;
  message: ChatMessage;
}
```

### Share Models

```typescript
interface Share {
  id: string;
  share_token: string;
  share_url?: string;  // May be null, construct if needed
  document_id: string;
  created_at: string;
  expires_at: string;
  max_uses: number | null;
  use_count: number;
  is_revoked: boolean;
}

interface CreateShareRequest {
  expires_in_hours: number;
  max_uses: number | null;
}

interface CreateShareResponse extends Share {
  share_url: string;  // Backend should return this
}
```

### Audit Models

```typescript
interface AuditEntry {
  id: string;
  event_type: string;
  actor_user_id: string | null;
  document_id?: string;
  chat_session_id?: string;
  event_metadata: Record<string, any>;
  created_at: string;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

