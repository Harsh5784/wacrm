import { GoogleGenerativeAI } from '@google/generative-ai';
import { loadEnv } from './env';

loadEnv();

// Rotating Gemini key manager - supports up to 3 keys
const keys = Array.from(new Set([
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  // backward compat with single key
  process.env.GEMINI_API_KEY,
].filter(Boolean) as string[]));

let currentKeyIndex = 0;
const keyFailCounts: Record<number, number> = {};
export const geminiModelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

export function getGeminiModel(modelName = geminiModelName) {
  if (keys.length === 0) {
    throw new Error('No Gemini API key configured. Add GEMINI_API_KEY_1 to backend/.env');
  }
  const key = keys[currentKeyIndex];
  const genAI = new GoogleGenerativeAI(key);
  return genAI.getGenerativeModel({ model: modelName });
}

function getModelForKey(apiKey: string, modelName = geminiModelName) {
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: modelName });
}

export function cleanAIText(raw: string): string {
  const text = String(raw || '').replace(/```json|```/g, '').trim();
  if (!text) return '';

  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === 'string') return parsed.trim();
    if (typeof parsed.message === 'string') return parsed.message.trim();
    if (typeof parsed.text === 'string') return parsed.text.trim();
    if (typeof parsed.reply === 'string') return parsed.reply.trim();
    if (Array.isArray(parsed.messages)) return parsed.messages.filter(Boolean).join('\n\n').trim();
    if (Array.isArray(parsed.suggestions)) {
      return parsed.suggestions
        .map((item: any) => item.message || item.text || item.reply)
        .filter(Boolean)
        .join('\n\n')
        .trim();
    }
  } catch {}

  return text
    .replace(/^\{\s*"message"\s*:\s*"/, '')
    .replace(/"\s*\}\s*$/, '')
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .trim();
}

export async function generateWithRotation(prompt: string): Promise<string> {
  if (keys.length === 0) {
    throw new Error('No Gemini API key configured. Add GEMINI_API_KEY_1 to backend/.env');
  }

  let lastError: any;
  // Try each key in rotation
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const idx = (currentKeyIndex + attempt) % keys.length;
    try {
      const genAI = new GoogleGenerativeAI(keys[idx]);
      const model = genAI.getGenerativeModel({ model: geminiModelName });
      const result = await model.generateContent(prompt);
      currentKeyIndex = idx; // stick to working key
      keyFailCounts[idx] = 0;
      return result.response.text().trim();
    } catch (err: any) {
      lastError = err;
      const msg = err?.message || '';
      // Rate limit or quota error → rotate to next key
      if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
        console.warn(`[Gemini] Key ${idx + 1} exhausted, rotating...`);
        keyFailCounts[idx] = (keyFailCounts[idx] || 0) + 1;
        currentKeyIndex = (idx + 1) % keys.length;
        continue;
      }
      throw err; // non-rate-limit error, throw immediately
    }
  }
  throw lastError || new Error('All Gemini keys exhausted');
}

export async function generateWithOptionalKey(prompt: string, apiKey?: string | null): Promise<string> {
  if (apiKey) {
    const model = getModelForKey(apiKey);
    const result = await model.generateContent(prompt);
    return cleanAIText(result.response.text());
  }

  return cleanAIText(await generateWithRotation(prompt));
}

export async function validateGeminiApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey?.trim()) return false;
  const model = getModelForKey(apiKey.trim());
  const result = await model.generateContent('Reply with only: ok');
  return result.response.text().toLowerCase().includes('ok');
}

export async function sendChatWithRotation(
  history: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>,
  message: string
): Promise<string> {
  if (keys.length === 0) {
    throw new Error('No Gemini API key configured. Add GEMINI_API_KEY_1 to backend/.env');
  }

  let lastError: any;
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const idx = (currentKeyIndex + attempt) % keys.length;
    try {
      const genAI = new GoogleGenerativeAI(keys[idx]);
      const model = genAI.getGenerativeModel({ model: geminiModelName });
      const chat = model.startChat({
        history,
        generationConfig: { maxOutputTokens: 1000 },
      });
      const result = await chat.sendMessage(message);
      currentKeyIndex = idx;
      keyFailCounts[idx] = 0;
      return result.response.text().trim();
    } catch (err: any) {
      lastError = err;
      const msg = err?.message || '';
      if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
        console.warn(`[Gemini] Key ${idx + 1} exhausted, rotating...`);
        keyFailCounts[idx] = (keyFailCounts[idx] || 0) + 1;
        currentKeyIndex = (idx + 1) % keys.length;
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('All Gemini keys exhausted');
}

export async function sendChatWithOptionalKey(
  history: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>,
  message: string,
  apiKey?: string | null
): Promise<string> {
  if (apiKey) {
    const model = getModelForKey(apiKey);
    const chat = model.startChat({
      history,
      generationConfig: { maxOutputTokens: 1000 },
    });
    const result = await chat.sendMessage(message);
    return cleanAIText(result.response.text());
  }

  return cleanAIText(await sendChatWithRotation(history, message));
}

export function getKeyStatus() {
  return keys.map((k, i) => ({
    index: i + 1,
    key: k.substring(0, 12) + '...',
    active: i === currentKeyIndex,
    fails: keyFailCounts[i] || 0,
  }));
}
