import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
export declare const getLeads: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getLead: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const createLead: (req: AuthRequest, res: Response) => Promise<void>;
export declare const updateLead: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const deleteLead: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const bulkDeleteLeads: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const importLeads: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const exportLeads: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const addNote: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getLeadStats: (req: AuthRequest, res: Response) => Promise<void>;
//# sourceMappingURL=lead.controller.d.ts.map