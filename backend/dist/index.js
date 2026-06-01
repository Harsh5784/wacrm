"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("./lib/env");
(0, env_1.loadEnv)();
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = require("express-rate-limit");
const path_1 = __importDefault(require("path"));
const prisma_1 = require("./lib/prisma");
const redis_1 = require("./lib/redis");
const queues_1 = require("./queues");
const socket_service_1 = require("./services/socket.service");
const cron_service_1 = require("./services/cron.service");
const whatsapp_service_1 = require("./services/whatsapp.service");
// Routes
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const lead_routes_1 = __importDefault(require("./routes/lead.routes"));
const campaign_routes_1 = __importDefault(require("./routes/campaign.routes"));
const analytics_routes_1 = __importDefault(require("./routes/analytics.routes"));
const scraper_routes_1 = __importDefault(require("./routes/scraper.routes"));
const ai_routes_1 = __importDefault(require("./routes/ai.routes"));
const team_routes_1 = __importDefault(require("./routes/team.routes"));
const settings_routes_1 = __importDefault(require("./routes/settings.routes"));
const whatsapp_routes_1 = __importDefault(require("./routes/whatsapp.routes"));
const tag_routes_1 = __importDefault(require("./routes/tag.routes"));
const billing_routes_1 = __importDefault(require("./routes/billing.routes"));
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
// Socket.io
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
    },
});
// Make io accessible globally
app.set('io', io);
// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use((0, helmet_1.default)({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use((0, compression_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
}));
app.use((0, morgan_1.default)(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Static files
app.use('/uploads', express_1.default.static(path_1.default.join(process.cwd(), 'uploads')));
// Rate limiting
const limiter = (0, express_rate_limit_1.rateLimit)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api', limiter);
// Strict rate limit for auth
const authLimiter = (0, express_rate_limit_1.rateLimit)({
    windowMs: 15 * 60 * 1000,
    max: 20,
    skipSuccessfulRequests: true,
});
// ─── ROUTES ──────────────────────────────────────────────────────────────────
const API_BASE = '/api/v1';
app.use(`${API_BASE}/auth`, authLimiter, auth_routes_1.default);
app.use(`${API_BASE}/leads`, lead_routes_1.default);
app.use(`${API_BASE}/campaigns`, campaign_routes_1.default);
app.use(`${API_BASE}/analytics`, analytics_routes_1.default);
app.use(`${API_BASE}/scraper`, scraper_routes_1.default);
app.use(`${API_BASE}/ai`, ai_routes_1.default);
app.use(`${API_BASE}/team`, team_routes_1.default);
app.use(`${API_BASE}/settings`, settings_routes_1.default);
app.use(`${API_BASE}/whatsapp`, whatsapp_routes_1.default);
app.use(`${API_BASE}/tags`, tag_routes_1.default);
app.use(`${API_BASE}/billing`, billing_routes_1.default);
// Health check
app.get('/health', async (req, res) => {
    try {
        await prisma_1.prisma.$queryRaw `SELECT 1`;
        await redis_1.redis.ping();
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            services: {
                database: 'connected',
                redis: 'connected',
            },
        });
    }
    catch (error) {
        res.status(503).json({ status: 'unhealthy', error: String(error) });
    }
});
// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});
// Global error handler
app.use((err, req, res, next) => {
    console.error('Global Error:', err);
    const status = err.status || err.statusCode || 500;
    const message = process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message || 'Internal server error';
    res.status(status).json({ success: false, message, ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }) });
});
// ─── STARTUP ──────────────────────────────────────────────────────────────────
async function bootstrap() {
    try {
        // Connect to DB
        await prisma_1.prisma.$connect();
        console.log('✅ PostgreSQL connected');
        // Test Redis
        await redis_1.redis.ping();
        console.log('✅ Redis connected');
        // Setup queues
        await (0, queues_1.setupQueues)(io);
        console.log('✅ BullMQ queues initialized');
        // Restore WhatsApp Web sessions
        await (0, whatsapp_service_1.initializeWhatsAppService)(io);
        console.log('✅ WhatsApp Web service ready');
        // Setup socket handlers
        (0, socket_service_1.setupSocketHandlers)(io);
        console.log('✅ Socket.io handlers ready');
        // Setup cron jobs
        (0, cron_service_1.setupCronJobs)();
        console.log('✅ Cron jobs scheduled');
        const PORT = process.env.PORT || 5000;
        httpServer.listen(PORT, () => {
            console.log(`\n🚀 WACrm Backend running on port ${PORT}`);
            console.log(`📊 API: http://localhost:${PORT}/api/v1`);
            console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
            console.log(`❤️  Health: http://localhost:${PORT}/health\n`);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}
// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down...');
    await prisma_1.prisma.$disconnect();
    redis_1.redis.disconnect();
    process.exit(0);
});
bootstrap();
//# sourceMappingURL=index.js.map