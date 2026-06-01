"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chat = exports.getGeminiStatus = exports.generateCampaignDraft = exports.getReplySuggestions = exports.scoreLead = exports.getFollowUpSuggestions = exports.generateMessage = void 0;
const prisma_1 = require("../lib/prisma");
const gemini_1 = require("../lib/gemini");
const systemContext = `You are an expert WhatsApp marketing assistant for Indian businesses.
You help generate personalized, natural-sounding messages in Hindi and English (Hinglish supported).
Keep messages conversational, brief, and effective. Avoid spammy language.
Format responses as clean JSON when asked for structured data. No markdown code fences.`;
async function getAIProfile(orgId) {
    const org = await prisma_1.prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true, settings: true },
    });
    const settings = org?.settings || {};
    const business = settings.businessProfile || {};
    const apiKey = settings.ai?.geminiApiKey || null;
    const businessContext = [
        `Organization: ${org?.name || 'Business'}`,
        business.category ? `Business category: ${business.category}` : '',
        business.description ? `Company description: ${business.description}` : '',
        business.whatWeDo ? `What business does: ${business.whatWeDo}` : '',
        business.services ? `Services offered: ${business.services}` : '',
        business.products ? `Products offered: ${business.products}` : '',
        business.pricing ? `Pricing: ${business.pricing}` : '',
        business.salesPitch ? `Sales pitch: ${business.salesPitch}` : '',
        business.workingHours ? `Working hours: ${business.workingHours}` : '',
        business.supportDetails ? `Support details: ${business.supportDetails}` : '',
    ].filter(Boolean).join('\n');
    return { apiKey, businessContext };
}
async function generateText(prompt, orgId) {
    const { apiKey, businessContext } = await getAIProfile(orgId);
    return (0, gemini_1.generateWithOptionalKey)(`${systemContext}\n\n${businessContext}\n\n${prompt}`, apiKey);
}
function sendAIError(res, error, fallback) {
    const message = error?.message || fallback;
    if (message.includes('429') || message.includes('quota') || message.includes('RESOURCE_EXHAUSTED')) {
        return res.status(429).json({
            success: false,
            message: 'Gemini quota exceeded for the configured API key/project. Add a different Gemini API key or enable billing/quota in Google AI Studio.',
        });
    }
    if (message.includes('API_KEY') || message.includes('not set')) {
        return res.status(400).json({
            success: false,
            message: 'Gemini API key not configured. Add GEMINI_API_KEY_1 to backend/.env',
        });
    }
    if (message.includes('404') && message.includes('models/')) {
        return res.status(400).json({
            success: false,
            message: `Gemini model "${gemini_1.geminiModelName}" is not available for this API key/project. Set GEMINI_MODEL in backend/.env to an available model.`,
        });
    }
    return res.status(500).json({ success: false, message: `${fallback}: ${message}` });
}
const generateMessage = async (req, res) => {
    try {
        const { purpose, business, language = 'english', tone = 'professional', context } = req.body;
        const prompt = `Generate 3 WhatsApp message variations for:
Purpose: ${purpose}
Business: ${business || 'our company'}
Language: ${language}
Tone: ${tone}
Context: ${context || 'general outreach'}

Use variables {{name}}, {{city}}, {{company}} where appropriate.
Return ONLY valid JSON like: {"messages":["msg1","msg2","msg3"]}`;
        const raw = await generateText(prompt, req.user.orgId);
        let messages = [];
        try {
            const cleaned = raw.replace(/```json|```/g, '').trim();
            messages = JSON.parse(cleaned).messages || [raw];
        }
        catch {
            messages = [(0, gemini_1.cleanAIText)(raw)];
        }
        res.json({ success: true, data: { messages: messages.map(gemini_1.cleanAIText).filter(Boolean) } });
    }
    catch (error) {
        console.error('generateMessage error:', error.message);
        return sendAIError(res, error, 'AI generation failed');
    }
};
exports.generateMessage = generateMessage;
const getFollowUpSuggestions = async (req, res) => {
    try {
        const { leadId } = req.params;
        const lead = await prisma_1.prisma.lead.findFirst({
            where: { id: leadId, orgId: req.user.orgId },
            include: {
                notes: { orderBy: { createdAt: 'desc' }, take: 3 },
                activities: { orderBy: { createdAt: 'desc' }, take: 5 },
                messages: { orderBy: { createdAt: 'desc' }, take: 3 },
            },
        });
        if (!lead)
            return res.status(404).json({ success: false, message: 'Lead not found' });
        const prompt = `Suggest 3 WhatsApp follow-up messages and one recommended next action for this lead.
Lead: ${lead.name}, Stage: ${lead.stage}, Category: ${lead.category || 'Unknown'}, City: ${lead.city || 'Unknown'}
Recent Activity: ${lead.activities[0]?.description || 'None'}
Notes: ${lead.notes.map(n => n.content.substring(0, 80)).join('; ') || 'None'}
Messages: ${lead.messages.map(m => `${m.direction}: ${m.content.substring(0, 120)}`).join('; ') || 'None'}

Return ONLY valid JSON: {"suggestions":[{"message":"...","timing":"...","reason":"..."}]}`;
        const raw = await generateText(prompt, req.user.orgId);
        let suggestions = [];
        try {
            const cleaned = raw.replace(/```json|```/g, '').trim();
            suggestions = JSON.parse(cleaned).suggestions || [];
        }
        catch {
            suggestions = [{ message: (0, gemini_1.cleanAIText)(raw), timing: 'Today', reason: 'AI suggestion' }];
        }
        res.json({ success: true, data: { suggestions } });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get suggestions' });
    }
};
exports.getFollowUpSuggestions = getFollowUpSuggestions;
const scoreLead = async (req, res) => {
    try {
        const { leadId } = req.params;
        const lead = await prisma_1.prisma.lead.findFirst({
            where: { id: leadId, orgId: req.user.orgId },
            include: {
                activities: { take: 10 },
                messages: { take: 5 },
            },
        });
        if (!lead)
            return res.status(404).json({ success: false, message: 'Lead not found' });
        const prompt = `Score this sales lead from 0-100 based on conversion potential. Detect hot/warm/cold intent and best next action timing.
Lead info: name=${lead.name}, stage=${lead.stage}, source=${lead.source}, category=${lead.category || 'Unknown'},
activities=${lead.activities.length}, messages=${lead.messages.length}, city=${lead.city || 'Unknown'}

Return ONLY valid JSON: {"score":75,"temperature":"hot|warm|cold","reasoning":"short reason","nextAction":"recommended action","bestReplyTiming":"..."}`;
        const raw = await generateText(prompt, req.user.orgId);
        let scoreData = { score: 50, temperature: 'warm', reasoning: 'Average lead', nextAction: 'Follow up', bestReplyTiming: 'Today' };
        try {
            const cleaned = raw.replace(/```json|```/g, '').trim();
            scoreData = JSON.parse(cleaned);
        }
        catch { }
        await prisma_1.prisma.lead.update({ where: { id: leadId }, data: { score: scoreData.score } });
        await prisma_1.prisma.activity.create({
            data: { type: 'SCORE_UPDATED', description: `AI score: ${scoreData.score}`, leadId, userId: req.user.id },
        });
        res.json({ success: true, data: scoreData });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Lead scoring failed' });
    }
};
exports.scoreLead = scoreLead;
const getReplySuggestions = async (req, res) => {
    try {
        const { incomingMessage, leadName, context } = req.body;
        const prompt = `Suggest 3 WhatsApp reply options for this message.
From: ${leadName || 'Customer'}
Message: "${incomingMessage}"
Context: ${context || 'business inquiry'}

Return ONLY valid JSON: {"replies":[{"text":"...","intent":"close_deal|nurture|info|schedule"}]}`;
        const raw = await generateText(prompt, req.user.orgId);
        let replies = [];
        try {
            const cleaned = raw.replace(/```json|```/g, '').trim();
            replies = JSON.parse(cleaned).replies || [];
        }
        catch {
            replies = [{ text: (0, gemini_1.cleanAIText)(raw), intent: 'info' }];
        }
        res.json({ success: true, data: { replies } });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get reply suggestions' });
    }
};
exports.getReplySuggestions = getReplySuggestions;
const generateCampaignDraft = async (req, res) => {
    try {
        const { goal, audience, offer, language = 'hinglish', tone = 'professional' } = req.body;
        const prompt = `Create one WhatsApp campaign draft.
Goal: ${goal || 'lead outreach'}
Audience: ${audience || 'local business owners'}
Offer: ${offer || 'product/service introduction'}
Language: ${language}
Tone: ${tone}

Use variables {{name}}, {{city}}, {{company}}, {{category}} where useful.
Return ONLY valid JSON: {"name":"short campaign name","description":"short description","messageTemplate":"whatsapp-ready message"}`;
        const raw = await generateText(prompt, req.user.orgId);
        let draft;
        try {
            draft = JSON.parse(raw.replace(/```json|```/g, '').trim());
        }
        catch {
            draft = {
                name: goal ? `${goal} Campaign` : 'AI WhatsApp Campaign',
                description: audience || 'AI generated campaign',
                messageTemplate: (0, gemini_1.cleanAIText)(raw),
            };
        }
        res.json({ success: true, data: draft });
    }
    catch (error) {
        return sendAIError(res, error, 'AI campaign generation failed');
    }
};
exports.generateCampaignDraft = generateCampaignDraft;
const getGeminiStatus = async (req, res) => {
    try {
        const keys = (0, gemini_1.getKeyStatus)();
        const hasKey = keys.length > 0;
        res.json({
            success: true,
            data: {
                configured: hasKey,
                model: gemini_1.geminiModelName,
                status: hasKey ? 'ready' : 'missing_api_key',
                keys: keys.map(({ index, active, fails }) => ({ index, active, fails })),
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
exports.getGeminiStatus = getGeminiStatus;
const chat = async (req, res) => {
    try {
        const { messages, context } = req.body;
        if (!Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ success: false, message: 'Messages are required' });
        }
        const history = messages.slice(0, -1).map((m) => ({
            role: (m.role === 'assistant' ? 'model' : 'user'),
            parts: [{ text: String(m.content || '') }],
        }));
        const lastMessage = messages[messages.length - 1]?.content || '';
        const { apiKey, businessContext } = await getAIProfile(req.user.orgId);
        const message = await (0, gemini_1.sendChatWithOptionalKey)(history, `${systemContext}\n${businessContext}\nContext: ${context || 'WhatsApp marketing for Indian businesses'}\n\nAlways return clean WhatsApp-ready text, not JSON unless explicitly asked.\n\n${lastMessage}`, apiKey);
        res.json({ success: true, data: { message: (0, gemini_1.cleanAIText)(message) } });
    }
    catch (error) {
        return sendAIError(res, error, 'AI chat failed');
    }
};
exports.chat = chat;
//# sourceMappingURL=ai.controller.js.map