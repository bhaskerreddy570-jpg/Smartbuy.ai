import Link from "next/link";

type EmptyStateProps = {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
};

export function PortalEmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: EmptyStateProps) {
  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      <div className="portal-empty-state portal-card min-h-[320px] justify-center">
        <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/20">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-8 w-8">
            <path d="M12 8v8M8 12h8" strokeLinecap="round" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        </span>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
        {actionHref && actionLabel ? (
          <Link href={actionHref} className="portal-primary-button mt-6 inline-flex">
            {actionLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
