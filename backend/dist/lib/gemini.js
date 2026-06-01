"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.geminiModelName = void 0;
exports.getGeminiModel = getGeminiModel;
exports.cleanAIText = cleanAIText;
exports.generateWithRotation = generateWithRotation;
exports.generateWithOptionalKey = generateWithOptionalKey;
exports.validateGeminiApiKey = validateGeminiApiKey;
exports.sendChatWithRotation = sendChatWithRotation;
exports.sendChatWithOptionalKey = sendChatWithOptionalKey;
exports.getKeyStatus = getKeyStatus;
const generative_ai_1 = require("@google/generative-ai");
const env_1 = require("./env");
(0, env_1.loadEnv)();
// Rotating Gemini key manager - supports up to 3 keys
const keys = Array.from(new Set([
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    // backward compat with single key
    process.env.GEMINI_API_KEY,
].filter(Boolean)));
let currentKeyIndex = 0;
const keyFailCounts = {};
exports.geminiModelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
function getGeminiModel(modelName = exports.geminiModelName) {
    if (keys.length === 0) {
        throw new Error('No Gemini API key configured. Add GEMINI_API_KEY_1 to backend/.env');
    }
    const key = keys[currentKeyIndex];
    const genAI = new generative_ai_1.GoogleGenerativeAI(key);
    return genAI.getGenerativeModel({ model: modelName });
}
function getModelForKey(apiKey, modelName = exports.geminiModelName) {
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ model: modelName });
}
function cleanAIText(raw) {
    const text = String(raw || '').replace(/```json|```/g, '').trim();
    if (!text)
        return '';
    try {
        const parsed = JSON.parse(text);
        if (typeof parsed === 'string')
            return parsed.trim();
        if (typeof parsed.message === 'string')
            return parsed.message.trim();
        if (typeof parsed.text === 'string')
            return parsed.text.trim();
        if (typeof parsed.reply === 'string')
            return parsed.reply.trim();
        if (Array.isArray(parsed.messages))
            return parsed.messages.filter(Boolean).join('\n\n').trim();
        if (Array.isArray(parsed.suggestions)) {
            return parsed.suggestions
                .map((item) => item.message || item.text || item.reply)
                .filter(Boolean)
                .join('\n\n')
                .trim();
        }
    }
    catch { }
    return text
        .replace(/^\{\s*"message"\s*:\s*"/, '')
        .replace(/"\s*\}\s*$/, '')
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .trim();
}
async function generateWithRotation(prompt) {
    if (keys.length === 0) {
        throw new Error('No Gemini API key configured. Add GEMINI_API_KEY_1 to backend/.env');
    }
    let lastError;
    // Try each key in rotation
    for (let attempt = 0; attempt < keys.length; attempt++) {
        const idx = (currentKeyIndex + attempt) % keys.length;
        try {
            const genAI = new generative_ai_1.GoogleGenerativeAI(keys[idx]);
            const model = genAI.getGenerativeModel({ model: exports.geminiModelName });
            const result = await model.generateContent(prompt);
            currentKeyIndex = idx; // stick to working key
            keyFailCounts[idx] = 0;
            return result.response.text().trim();
        }
        catch (err) {
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
async function generateWithOptionalKey(prompt, apiKey) {
    if (apiKey) {
        const model = getModelForKey(apiKey);
        const result = await model.generateContent(prompt);
        return cleanAIText(result.response.text());
    }
    return cleanAIText(await generateWithRotation(prompt));
}
async function validateGeminiApiKey(apiKey) {
    if (!apiKey?.trim())
        return false;
    const model = getModelForKey(apiKey.trim());
    const result = await model.generateContent('Reply with only: ok');
    return result.response.text().toLowerCase().includes('ok');
}
async function sendChatWithRotation(history, message) {
    if (keys.length === 0) {
        throw new Error('No Gemini API key configured. Add GEMINI_API_KEY_1 to backend/.env');
    }
    let lastError;
    for (let attempt = 0; attempt < keys.length; attempt++) {
        const idx = (currentKeyIndex + attempt) % keys.length;
        try {
            const genAI = new generative_ai_1.GoogleGenerativeAI(keys[idx]);
            const model = genAI.getGenerativeModel({ model: exports.geminiModelName });
            const chat = model.startChat({
                history,
                generationConfig: { maxOutputTokens: 1000 },
            });
            const result = await chat.sendMessage(message);
            currentKeyIndex = idx;
            keyFailCounts[idx] = 0;
            return result.response.text().trim();
        }
        catch (err) {
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
async function sendChatWithOptionalKey(history, message, apiKey) {
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
function getKeyStatus() {
    return keys.map((k, i) => ({
        index: i + 1,
        key: k.substring(0, 12) + '...',
        active: i === currentKeyIndex,
        fails: keyFailCounts[i] || 0,
    }));
}
//# sourceMappingURL=gemini.js.map