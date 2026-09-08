export function mapFetchClientError(error: unknown, fallback: string): string {
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return fallback;
  }

  if (error instanceof Error) {
    if (error.message === 'Failed to fetch') {
      return fallback;
    }
    return error.message;
  }

  return fallback;
}

export function mapFilesLoadClientError(error: unknown): string {
  return mapFetchClientError(error, 'Unable to load files. Please try again.');
}

export function mapUploadTransferClientError(error: unknown): string {
  return mapFetchClientError(
    error,
    'Unable to upload file to storage. Please try again.',
  );
}
