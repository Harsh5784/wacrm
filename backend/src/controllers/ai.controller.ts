import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import {
  cleanAIText,
  generateWithOptionalKey,
  geminiModelName,
  getKeyStatus,
  sendChatWithOptionalKey,
} from '../lib/gemini';

const systemContext = `You are an expert WhatsApp marketing assistant for Indian businesses.
You help generate personalized, natural-sounding messages in Hindi and English (Hinglish supported).
Keep messages conversational, brief, and effective. Avoid spammy language.
Format responses as clean JSON when asked for structured data. No markdown code fences.`;

async function getAIProfile(orgId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true, settings: true },
  });
  const settings = (org?.settings as any) || {};
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

async function generateText(prompt: string, orgId: string): Promise<string> {
  const { apiKey, businessContext } = await getAIProfile(orgId);
  return generateWithOptionalKey(`${systemContext}\n\n${businessContext}\n\n${prompt}`, apiKey);
}

function sendAIError(res: Response, error: any, fallback: string) {
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
      message: `Gemini model "${geminiModelName}" is not available for this API key/project. Set GEMINI_MODEL in backend/.env to an available model.`,
    });
  }

  return res.status(500).json({ success: false, message: `${fallback}: ${message}` });
}

export const generateMessage = async (req: AuthRequest, res: Response) => {
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

    const raw = await generateText(prompt, req.user!.orgId);
    let messages: string[] = [];
    try {
      const cleaned = raw.replace(/```json|```/g, '').trim();
      messages = JSON.parse(cleaned).messages || [raw];
    } catch {
      messages = [cleanAIText(raw)];
    }

    res.json({ success: true, data: { messages: messages.map(cleanAIText).filter(Boolean) } });
  } catch (error: any) {
    console.error('generateMessage error:', error.message);
    return sendAIError(res, error, 'AI generation failed');
  }
};

export const getFollowUpSuggestions = async (req: AuthRequest, res: Response) => {
  try {
    const { leadId } = req.params;
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, orgId: req.user!.orgId },
      include: {
        notes: { orderBy: { createdAt: 'desc' }, take: 3 },
        activities: { orderBy: { createdAt: 'desc' }, take: 5 },
        messages: { orderBy: { createdAt: 'desc' }, take: 3 },
      },
    });

    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    const prompt = `Suggest 3 WhatsApp follow-up messages and one recommended next action for this lead.
Lead: ${lead.name}, Stage: ${lead.stage}, Category: ${lead.category || 'Unknown'}, City: ${lead.city || 'Unknown'}
Recent Activity: ${lead.activities[0]?.description || 'None'}
Notes: ${lead.notes.map(n => n.content.substring(0, 80)).join('; ') || 'None'}
Messages: ${lead.messages.map(m => `${m.direction}: ${m.content.substring(0, 120)}`).join('; ') || 'None'}

Return ONLY valid JSON: {"suggestions":[{"message":"...","timing":"...","reason":"..."}]}`;

    const raw = await generateText(prompt, req.user!.orgId);
    let suggestions: any[] = [];
    try {
      const cleaned = raw.replace(/```json|```/g, '').trim();
      suggestions = JSON.parse(cleaned).suggestions || [];
    } catch {
      suggestions = [{ message: cleanAIText(raw), timing: 'Today', reason: 'AI suggestion' }];
    }

    res.json({ success: true, data: { suggestions } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to get suggestions' });
  }
};

export const scoreLead = async (req: AuthRequest, res: Response) => {
  try {
    const { leadId } = req.params;
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, orgId: req.user!.orgId },
      include: {
        activities: { take: 10 },
        messages: { take: 5 },
      },
    });

    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    const prompt = `Score this sales lead from 0-100 based on conversion potential. Detect hot/warm/cold intent and best next action timing.
Lead info: name=${lead.name}, stage=${lead.stage}, source=${lead.source}, category=${lead.category || 'Unknown'},
activities=${lead.activities.length}, messages=${lead.messages.length}, city=${lead.city || 'Unknown'}

Return ONLY valid JSON: {"score":75,"temperature":"hot|warm|cold","reasoning":"short reason","nextAction":"recommended action","bestReplyTiming":"..."}`;

    const raw = await generateText(prompt, req.user!.orgId);
    let scoreData = { score: 50, temperature: 'warm', reasoning: 'Average lead', nextAction: 'Follow up', bestReplyTiming: 'Today' };
    try {
      const cleaned = raw.replace(/```json|```/g, '').trim();
      scoreData = JSON.parse(cleaned);
    } catch {}

    await prisma.lead.update({ where: { id: leadId }, data: { score: scoreData.score } });
    await prisma.activity.create({
      data: { type: 'SCORE_UPDATED', description: `AI score: ${scoreData.score}`, leadId, userId: req.user!.id },
    });

    res.json({ success: true, data: scoreData });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Lead scoring failed' });
  }
};

export const getReplySuggestions = async (req: AuthRequest, res: Response) => {
  try {
    const { incomingMessage, leadName, context } = req.body;

    const prompt = `Suggest 3 WhatsApp reply options for this message.
From: ${leadName || 'Customer'}
Message: "${incomingMessage}"
Context: ${context || 'business inquiry'}

Return ONLY valid JSON: {"replies":[{"text":"...","intent":"close_deal|nurture|info|schedule"}]}`;

    const raw = await generateText(prompt, req.user!.orgId);
    let replies: any[] = [];
    try {
      const cleaned = raw.replace(/```json|```/g, '').trim();
      replies = JSON.parse(cleaned).replies || [];
    } catch {
      replies = [{ text: cleanAIText(raw), intent: 'info' }];
    }

    res.json({ success: true, data: { replies } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to get reply suggestions' });
  }
};

export const generateCampaignDraft = async (req: AuthRequest, res: Response) => {
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

    const raw = await generateText(prompt, req.user!.orgId);
    let draft: any;
    try {
      draft = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch {
      draft = {
        name: goal ? `${goal} Campaign` : 'AI WhatsApp Campaign',
        description: audience || 'AI generated campaign',
        messageTemplate: cleanAIText(raw),
      };
    }

    res.json({ success: true, data: draft });
  } catch (error: any) {
    return sendAIError(res, error, 'AI campaign generation failed');
  }
};

export const getGeminiStatus = async (req: AuthRequest, res: Response) => {
  try {
    const keys = getKeyStatus();
    const hasKey = keys.length > 0;

    res.json({
      success: true,
      data: {
        configured: hasKey,
        model: geminiModelName,
        status: hasKey ? 'ready' : 'missing_api_key',
        keys: keys.map(({ index, active, fails }) => ({ index, active, fails })),
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
export const chat = async (req: AuthRequest, res: Response) => {
  try {
    const { messages, context } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, message: 'Messages are required' });
    }

    const history = messages.slice(0, -1).map((m: any) => ({
      role: (m.role === 'assistant' ? 'model' : 'user') as 'model' | 'user',
      parts: [{ text: String(m.content || '') }],
    }));

    const lastMessage = messages[messages.length - 1]?.content || '';
    const { apiKey, businessContext } = await getAIProfile(req.user!.orgId);
    const message = await sendChatWithOptionalKey(
      history,
      `${systemContext}\n${businessContext}\nContext: ${context || 'WhatsApp marketing for Indian businesses'}\n\nAlways return clean WhatsApp-ready text, not JSON unless explicitly asked.\n\n${lastMessage}`,
      apiKey
    );

    res.json({ success: true, data: { message: cleanAIText(message) } });
  } catch (error: any) {
    return sendAIError(res, error, 'AI chat failed');
  }
};
