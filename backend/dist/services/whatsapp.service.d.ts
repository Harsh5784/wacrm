import { Server } from 'socket.io';
type SendResult = {
    success: boolean;
    messageId?: string;
    error?: string;
};
export declare function initializeWhatsAppService(io: Server): Promise<void>;
export declare function initializeWhatsAppSession(sessionId: string, orgId: string): Promise<void>;
export declare function destroyWhatsAppSession(sessionId: string): Promise<void>;
export declare function sendWhatsAppMessage(sessionId: string | null | undefined, phone: string, message: string): Promise<SendResult>;
export declare function sendWhatsAppMediaMessage(sessionId: string | null | undefined, phone: string, mediaUrl: string, caption?: string): Promise<SendResult>;
export {};
//# sourceMappingURL=whatsapp.service.d.ts.map