export declare const geminiModelName: string;
export declare function getGeminiModel(modelName?: string): import("@google/generative-ai").GenerativeModel;
export declare function cleanAIText(raw: string): string;
export declare function generateWithRotation(prompt: string): Promise<string>;
export declare function generateWithOptionalKey(prompt: string, apiKey?: string | null): Promise<string>;
export declare function validateGeminiApiKey(apiKey: string): Promise<boolean>;
export declare function sendChatWithRotation(history: Array<{
    role: 'user' | 'model';
    parts: Array<{
        text: string;
    }>;
}>, message: string): Promise<string>;
export declare function sendChatWithOptionalKey(history: Array<{
    role: 'user' | 'model';
    parts: Array<{
        text: string;
    }>;
}>, message: string, apiKey?: string | null): Promise<string>;
export declare function getKeyStatus(): {
    index: number;
    key: string;
    active: boolean;
    fails: number;
}[];
//# sourceMappingURL=gemini.d.ts.map