"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const ai_controller_1 = require("../controllers/ai.controller");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/status', ai_controller_1.getGeminiStatus);
router.post('/generate-message', ai_controller_1.generateMessage);
router.post('/campaign-draft', ai_controller_1.generateCampaignDraft);
router.get('/follow-up/:leadId', ai_controller_1.getFollowUpSuggestions);
router.post('/score-lead/:leadId', ai_controller_1.scoreLead);
router.post('/reply-suggestions', ai_controller_1.getReplySuggestions);
router.post('/chat', ai_controller_1.chat);
exports.default = router;
//# sourceMappingURL=ai.routes.js.map