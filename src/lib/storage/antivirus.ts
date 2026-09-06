export type AntivirusScanRequest = {
  userId: string;
  fileId: string;
  storageKey: string;
  fileName: string;
  size: bigint;
  mimeType: string;
};

export type AntivirusScanResult =
  | { status: 'skipped'; reason: string }
  | { status: 'clean' }
  | { status: 'infected'; reason: string }
  | { status: 'pending'; reason: string };

/**
 * Optional post-upload scanning hook. Disabled by default until a provider is approved.
 * When enabled without a provider, uploads continue and the skip reason is logged.
 */
export async function runAntivirusScanHook(
  request: AntivirusScanRequest,
): Promise<AntivirusScanResult> {
  if (process.env.ANTIVIRUS_SCAN_ENABLED !== 'true') {
    return {
      status: 'skipped',
      reason: 'Antivirus scanning is disabled (set ANTIVIRUS_SCAN_ENABLED=true to enable)',
    };
  }

  const provider = process.env.ANTIVIRUS_PROVIDER?.trim();
  if (!provider) {
    return {
      status: 'skipped',
      reason: 'No antivirus provider configured (set ANTIVIRUS_PROVIDER when approved)',
    };
  }

  // Provider implementations will plug in here after approval.
  console.info('Antivirus hook invoked without provider implementation', {
    provider,
    fileId: request.fileId,
    userId: request.userId,
  });

  return {
    status: 'skipped',
    reason: `Provider "${provider}" is not implemented yet`,
  };
}
