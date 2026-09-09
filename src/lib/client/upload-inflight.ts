let activeUploadId: string | null = null;

export function beginClientUpload(clientUploadId: string): boolean {
  if (activeUploadId) {
    return false;
  }
  activeUploadId = clientUploadId;
  return true;
}

export function endClientUpload(clientUploadId: string): void {
  if (activeUploadId === clientUploadId) {
    activeUploadId = null;
  }
}

export function isClientUploadInFlight(): boolean {
  return activeUploadId !== null;
}

export function createClientUploadId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
