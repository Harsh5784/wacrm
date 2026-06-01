ALTER TABLE "campaign_leads" DROP CONSTRAINT IF EXISTS "campaign_leads_leadId_fkey";
ALTER TABLE "campaign_leads"
  ADD CONSTRAINT "campaign_leads_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_leadId_fkey";
ALTER TABLE "messages"
  ADD CONSTRAINT "messages_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
