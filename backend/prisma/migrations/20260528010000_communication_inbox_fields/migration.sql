CREATE TYPE "CustomerStatus" AS ENUM (
  'NEW_LEAD',
  'INTERESTED',
  'NOT_INTERESTED',
  'FOLLOW_UP_PENDING',
  'CALLBACK',
  'CONVERTED',
  'CLOSED',
  'NO_RESPONSE'
);

CREATE TYPE "MessageMediaType" AS ENUM (
  'TEXT',
  'IMAGE',
  'AUDIO',
  'VIDEO',
  'DOCUMENT'
);

ALTER TABLE "leads"
  ADD COLUMN "customerStatus" "CustomerStatus" NOT NULL DEFAULT 'NEW_LEAD',
  ADD COLUMN "followUpAt" TIMESTAMP(3),
  ADD COLUMN "lastContactedAt" TIMESTAMP(3),
  ADD COLUMN "lastRepliedAt" TIMESTAMP(3),
  ADD COLUMN "unreadCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "assignedToId" TEXT;

ALTER TABLE "messages"
  ADD COLUMN "mediaType" "MessageMediaType" NOT NULL DEFAULT 'TEXT',
  ADD COLUMN "mediaUrl" TEXT,
  ADD COLUMN "fileName" TEXT,
  ADD COLUMN "mimeType" TEXT;

CREATE INDEX "leads_orgId_customerStatus_idx" ON "leads"("orgId", "customerStatus");
CREATE INDEX "leads_orgId_followUpAt_idx" ON "leads"("orgId", "followUpAt");

ALTER TABLE "leads"
  ADD CONSTRAINT "leads_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
