export type PerformanceSpan = {
  label: string;
  durationMs: number;
};

export async function measureAsync<T>(
  label: string,
  operation: () => Promise<T>,
): Promise<{ result: T; durationMs: number }> {
  const started = performance.now();
  const result = await operation();
  return {
    result,
    durationMs: Math.round(performance.now() - started),
  };
}

export function logPerformanceSpans(scope: string, spans: PerformanceSpan[]) {
  if (process.env.NODE_ENV === 'production') {
    const slow = spans.filter((span) => span.durationMs >= 250);
    if (slow.length === 0) {
      return;
    }
    console.info(`[perf:${scope}]`, Object.fromEntries(slow.map((s) => [s.label, s.durationMs])));
    return;
  }

  console.info(`[perf:${scope}]`, Object.fromEntries(spans.map((s) => [s.label, s.durationMs])));
}
