import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/workspaces/$workspaceId/")({
  component: () => {
    const { workspaceId } = Route.useParams();
    return (
      <Navigate
        to="/workspaces/$workspaceId/$tab"
        params={{ workspaceId, tab: "documents" }}
      />
    );
  },
});
