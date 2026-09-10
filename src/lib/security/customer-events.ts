// Security event logging stub — extend when audit requirements are defined.
export async function recordCustomerSecurityEvent(_params: {
  userId: string;
  eventType: string;
  riskLevel?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  // No-op for SmartBuy AI v1
}
