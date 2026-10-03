import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/knowledge")({
  beforeLoad: () => {
    throw redirect({ to: "/admin", search: { session: "", tab: "knowledge" } });
  },
  component: () => null,
});
