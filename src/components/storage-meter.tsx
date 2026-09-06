type StorageMeterProps = {
  usedLabel: string;
  quotaLabel: string;
  used: bigint;
  quota: bigint;
};

export function StorageMeter({
  usedLabel,
  quotaLabel,
  used,
  quota,
}: StorageMeterProps) {
  const percentage =
    quota > BigInt(0)
      ? Math.min(Number((used * BigInt(100)) / quota), 100)
      : 0;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Storage usage
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {usedLabel}
            <span className="text-base font-normal text-zinc-500 dark:text-zinc-400">
              {" "}
              of {quotaLabel}
            </span>
          </p>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {percentage.toFixed(1)}% used
        </p>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
        <div
          className="h-full rounded-full bg-blue-600 transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </section>
  );
}
