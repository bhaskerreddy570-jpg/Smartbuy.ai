import { getCustomerStorageUsageByCategory } from '@/lib/storage/category-usage';
import {
  listLargeReadyFiles,
  listRecentReadyFiles,
  listRecentlyAccessedFiles,
  listSecureReadyFiles,
} from '@/lib/storage/file-insights';
import { listRecentCustomerSecurityEvents } from '@/lib/security/customer-events';
import { listCustomerSessions } from '@/lib/security/customer-sessions';

export type SecurityCenterData = {
  status: {
    label: string;
    description: string;
    level: 'good' | 'review';
  };
  secureFileCount: number;
  sessions: Array<{
    id: string;
    deviceLabel: string | null;
    platform: string | null;
    browser: string | null;
    lastActiveAt: string | null;
    createdAt: string;
    revokedAt: string | null;
    isCurrent: boolean;
  }>;
  events: Array<{
    id: string;
    eventType: string;
    riskLevel: string;
    createdAt: string;
    metadata: Record<string, unknown> | null;
  }>;
  storageRecommendations: Array<{
    id: string;
    name: string;
    sizeLabel: string;
    reason: string;
  }>;
};

function formatEventLabel(eventType: string): string {
  return eventType
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export async function getSecurityCenterData(
  userId: string,
  currentSessionId?: string | null,
): Promise<SecurityCenterData> {
  const [sessions, events, usage, largeFiles, secureFiles] = await Promise.all([
    listCustomerSessions(userId),
    listRecentCustomerSecurityEvents(userId, 15),
    getCustomerStorageUsageByCategory(userId),
    listLargeReadyFiles(userId, 5),
    listSecureReadyFiles(userId, 1),
  ]);

  const activeSessions = sessions.filter((session) => !session.revokedAt);
  const hasRisk = events.some(
    (event) => event.riskLevel === 'MEDIUM' || event.eventType === 'UNUSUAL_ACTIVITY',
  );

  return {
    status: {
      level: hasRisk ? 'review' : 'good',
      label: hasRisk ? 'Review recommended' : 'Good',
      description: hasRisk
        ? 'Unusual activity was detected recently. Please review your sessions and recent activity.'
        : 'No unusual activity detected.',
    },
    secureFileCount: usage?.secureFileCount ?? secureFiles.length,
    sessions: activeSessions.map((session) => ({
      id: session.id,
      deviceLabel: session.deviceLabel,
      platform: session.platform,
      browser: session.browser,
      lastActiveAt: session.lastActiveAt,
      createdAt: session.createdAt,
      revokedAt: session.revokedAt,
      isCurrent: session.id === currentSessionId,
    })),
    events: events.map((event) => ({
      id: event.id,
      eventType: formatEventLabel(event.eventType),
      riskLevel: event.riskLevel,
      createdAt: event.createdAt,
      metadata: event.metadata ? (JSON.parse(event.metadata) as Record<string, unknown>) : null,
    })),
    storageRecommendations: largeFiles.slice(0, 3).map((file) => ({
      id: file.id,
      name: file.name,
      sizeLabel: `${(Number(file.size) / (1024 * 1024)).toFixed(1)} MB`,
      reason: 'Large file using significant storage space',
    })),
  };
}

export async function getOverviewSmartAccess(userId: string) {
  const [recentUploads, recentlyOpened, secureFiles, largeFiles] = await Promise.all([
    listRecentReadyFiles(userId, 6),
    listRecentlyAccessedFiles(userId, 6),
    listSecureReadyFiles(userId, 6),
    listLargeReadyFiles(userId, 5),
  ]);

  return {
    recentUploads,
    recentlyOpened,
    secureFiles,
    largeFiles,
  };
}
