import { PortalEmptyState } from "@/components/portal/empty-state";

export default function StarredPage() {
  return (
    <PortalEmptyState
      title="Starred files"
      description="Starred files are not available yet. Files you mark as favorites will appear here in a future update."
      actionHref="/files"
      actionLabel="Browse files"
    />
  );
}
