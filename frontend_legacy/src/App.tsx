import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import WorkspacesPage from "@/pages/WorkspacesPage";
import WorkspaceDashboard from "@/pages/WorkspaceDashboard";
import DocumentsFeature from "@/features/documents/DocumentsFeature";
import ChatFeature from "@/features/chat/ChatFeature";
import SharesFeature from "@/features/shares/SharesFeature";
import AuditFeature from "@/features/audit/AuditFeature";
import MembersFeature from "@/features/members/MembersFeature";
import PublicSharePage from "@/pages/PublicSharePage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/shares/:shareToken" element={<PublicSharePage />} />

            {/* Protected */}
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/workspaces" element={<WorkspacesPage />} />
              <Route path="/workspaces/:workspaceId" element={<WorkspaceDashboard />}>
                <Route index element={<Navigate to="documents" replace />} />
                <Route path="documents" element={<DocumentsFeature />} />
                <Route path="chat" element={<ChatFeature />} />
                <Route path="shares" element={<SharesFeature />} />
                <Route path="audit" element={<AuditFeature />} />
                <Route path="members" element={<MembersFeature />} />
              </Route>
            </Route>

            <Route path="/" element={<Navigate to="/workspaces" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
