/**
 * MFA is intentionally disabled for the current admin implementation.
 * This module preserves a stable extension point for future TOTP/WebAuthn support.
 */

export type AdminMfaVerificationResult =
  | { status: 'disabled' }
  | { status: 'verified' }
  | { status: 'required' }
  | { status: 'failed'; reason: string };

export function isAdminMfaEnforcementEnabled(): boolean {
  return false;
}

export function isAdminMfaRequiredForUser(admin: {
  mfaEnabled: boolean;
}): boolean {
  void admin.mfaEnabled;
  return false;
}

export async function verifyAdminMfa(params: {
  adminUserId: string;
  code?: string;
}): Promise<AdminMfaVerificationResult> {
  void params;
  return { status: 'disabled' };
}

export async function assertAdminMfaSatisfied(params: {
  adminUserId: string;
  mfaEnabled: boolean;
  code?: string;
}): Promise<AdminMfaVerificationResult> {
  void params;
  return { status: 'disabled' };
}
