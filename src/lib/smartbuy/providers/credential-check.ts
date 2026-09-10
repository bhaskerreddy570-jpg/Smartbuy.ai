import type { ProviderDefinition } from './definitions';

export function hasAuthorizedCredentials(def: ProviderDefinition): boolean {
  if (!def.envCredentialKeys?.length) return false;
  return def.envCredentialKeys.some((key) => {
    const value = process.env[key];
    return typeof value === 'string' && value.trim().length > 0;
  });
}
