CREATE TYPE "PaymentStatus" AS ENUM (
  'CREATED',
  'PAID',
  'FAILED',
  'EXPIRED',
  'MANUAL'
);

CREATE TABLE "payments" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
  "plan" "PlanType" NOT NULL,
  "razorpayOrderId" TEXT,
  "razorpayPaymentId" TEXT,
  "razorpaySignature" TEXT,
  "notes" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payments_orgId_status_idx" ON "payments"("orgId", "status");

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
