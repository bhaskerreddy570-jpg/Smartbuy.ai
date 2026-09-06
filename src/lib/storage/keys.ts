export function buildStorageKey(userId: string, fileId: string): string {
  return `users/${userId}/files/${fileId}`;
}
