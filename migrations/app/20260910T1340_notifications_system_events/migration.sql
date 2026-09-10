-- Additive migration: Notification and SystemEvent tables
-- Apply after init migration when database is available.

CREATE TABLE IF NOT EXISTS "notification" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "channel" TEXT NOT NULL DEFAULT 'IN_APP' CHECK ("channel" IN ('EMAIL', 'PUSH', 'IN_APP')),
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "readAt" TIMESTAMPTZ,
  "metadata" TEXT NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "notification_userId_idx" ON "notification"("userId");
CREATE INDEX IF NOT EXISTS "notification_createdAt_idx" ON "notification"("createdAt");

CREATE TABLE IF NOT EXISTS "systemEvent" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "eventType" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'INFO',
  "message" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "systemEvent_eventType_idx" ON "systemEvent"("eventType");
CREATE INDEX IF NOT EXISTS "systemEvent_createdAt_idx" ON "systemEvent"("createdAt");
