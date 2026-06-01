import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
export declare const getCampaigns: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getCampaign: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const createCampaign: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const estimateCampaign: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getCampaignAvailableLeads: (req: AuthRequest, res: Response) => Promise<void>;
export declare const updateCampaign: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const deleteCampaign: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const startCampaign: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const pauseCampaign: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const resumeCampaign: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const sendUnsentCampaignLeads: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getCampaignStats: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getCampaignLeads: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const updateCampaignLeadStatus: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=campaign.controller.d.ts.map