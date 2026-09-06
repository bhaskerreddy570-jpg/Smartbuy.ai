const SENSITIVE_METADATA_KEY_PATTERN =
  /password|token|secret|session|cookie|authorization|credential|aws|database/i;

export function sanitizeAuditMetadata(
  metadata?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!metadata) {
    return undefined;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_METADATA_KEY_PATTERN.test(key)) {
      continue;
    }

    sanitized[key] = value;
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export function metadataContainsSensitiveValues(
  metadata: Record<string, unknown>,
): boolean {
  return Object.keys(metadata).some((key) =>
    SENSITIVE_METADATA_KEY_PATTERN.test(key),
  );
}
