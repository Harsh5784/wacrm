import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { generateMessage, getFollowUpSuggestions, scoreLead, getReplySuggestions, chat, getGeminiStatus, generateCampaignDraft } from '../controllers/ai.controller';

const router = Router();
router.use(authenticate);

router.get('/status', getGeminiStatus);
router.post('/generate-message', generateMessage);
router.post('/campaign-draft', generateCampaignDraft);
router.get('/follow-up/:leadId', getFollowUpSuggestions);
router.post('/score-lead/:leadId', scoreLead);
router.post('/reply-suggestions', getReplySuggestions);
router.post('/chat', chat);

export default router;
