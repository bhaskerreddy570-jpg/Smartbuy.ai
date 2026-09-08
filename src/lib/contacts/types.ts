export type ContactPhone = {
  label?: string;
  value: string;
};

export type ContactEmail = {
  label?: string;
  value: string;
};

export type ContactAddress = {
  label?: string;
  street?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
};

export type ContactPayload = {
  givenName?: string;
  familyName?: string;
  middleName?: string;
  prefix?: string;
  suffix?: string;
  organization?: string;
  jobTitle?: string;
  phones: ContactPhone[];
  emails: ContactEmail[];
  addresses: ContactAddress[];
  notes?: string;
  website?: string;
  birthday?: string;
  photoMimeType?: string;
  photoBase64?: string;
};

export type DeviceContactChange = {
  localContactId: string;
  operation: 'upsert' | 'delete';
  payload?: ContactPayload;
  localModifiedAt?: string;
  lastKnownCloudVersion?: string;
};

export type CloudContactChange = {
  cloudContactId: string;
  syncVersion: string;
  operation: 'upsert' | 'delete';
  displayName?: string | null;
  payload?: ContactPayload;
  updatedAt: string;
  deletedAt?: string | null;
};

export type ContactSyncResult = {
  applied: number;
  skipped: number;
  conflicts: Array<{
    conflictId: string;
    cloudContactId: string;
    localContactId?: string;
  }>;
  cloudChanges: CloudContactChange[];
  nextCursor: string;
  serverTime: string;
};

export type ContactBackupSummary = {
  automaticBackupEnabled: boolean;
  contactCount: number;
  contactStorageBytes: string;
  lastSuccessfulBackupAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  syncCursor: string;
};
