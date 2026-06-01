import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  getCampaigns, getCampaign, createCampaign, updateCampaign,
  deleteCampaign, startCampaign, pauseCampaign, resumeCampaign, getCampaignStats,
  getCampaignLeads, updateCampaignLeadStatus, getCampaignAvailableLeads, sendUnsentCampaignLeads,
  estimateCampaign,
} from '../controllers/campaign.controller';

const router = Router();
router.use(authenticate);

router.get('/', getCampaigns);
router.post('/', createCampaign);
router.post('/estimate', estimateCampaign);
router.get('/available-leads', getCampaignAvailableLeads);
router.get('/:id', getCampaign);
router.put('/:id', updateCampaign);
router.delete('/:id', deleteCampaign);
router.post('/:id/start', startCampaign);
router.post('/:id/pause', pauseCampaign);
router.post('/:id/resume', resumeCampaign);
router.post('/:id/send-unsent', sendUnsentCampaignLeads);
router.get('/:id/stats', getCampaignStats);
router.get('/:id/leads', getCampaignLeads);
router.put('/:id/leads/:leadId/status', updateCampaignLeadStatus);

export default router;
