import { PortalEmptyState } from "@/components/portal/empty-state";

export default function TrashPage() {
  return (
    <PortalEmptyState
      title="Trash"
      description="Deleted files are permanently removed at this time. A recoverable trash feature is not enabled yet."
      actionHref="/files"
      actionLabel="Back to files"
    />
  );
}
