import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
export declare const generateMessage: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getFollowUpSuggestions: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const scoreLead: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getReplySuggestions: (req: AuthRequest, res: Response) => Promise<void>;
export declare const generateCampaignDraft: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getGeminiStatus: (req: AuthRequest, res: Response) => Promise<void>;
export declare const chat: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=ai.controller.d.ts.map