import { createFileRoute, Navigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { DocumentsTab } from "@/components/tabs/DocumentsTab";
import { ChatTab } from "@/components/tabs/ChatTab";
import { MembersTab } from "@/components/tabs/MembersTab";
import { SharesTab } from "@/components/tabs/SharesTab";
import { AuditTab } from "@/components/tabs/AuditTab";

const TABS = {
  documents: DocumentsTab,
  chat: ChatTab,
  members: MembersTab,
  shares: SharesTab,
  audit: AuditTab,
} as const;

type TabKey = keyof typeof TABS;

export const Route = createFileRoute("/_authenticated/workspaces/$workspaceId/$tab")({
  component: WorkspaceTabPage,
});

function WorkspaceTabPage() {
  const { workspaceId, tab } = Route.useParams();
  if (!(tab in TABS)) {
    return (
      <Navigate
        to="/workspaces/$workspaceId/$tab"
        params={{ workspaceId, tab: "documents" }}
      />
    );
  }
  const Tab = TABS[tab as TabKey];
  return (
    <AppLayout>
      <Tab workspaceId={workspaceId} />
    </AppLayout>
  );
}
