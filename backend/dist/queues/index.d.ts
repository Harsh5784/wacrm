import { Queue } from 'bullmq';
import { Server } from 'socket.io';
export declare const campaignQueue: Queue<any, any, string, any, any, string>;
export declare const messageQueue: Queue<any, any, string, any, any, string>;
export declare const scraperQueue: Queue<any, any, string, any, any, string>;
export declare const setupQueues: (io: Server) => Promise<void>;
//# sourceMappingURL=index.d.ts.map