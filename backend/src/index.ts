import { loadEnv } from './lib/env';

loadEnv();

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { rateLimit } from 'express-rate-limit';
import path from 'path';

import { prisma } from './lib/prisma';
import { redis } from './lib/redis';
import { setupQueues } from './queues';
import { setupSocketHandlers } from './services/socket.service';
import { setupCronJobs } from './services/cron.service';
import { initializeWhatsAppService } from './services/whatsapp.service';

// Routes
import authRoutes from './routes/auth.routes';
import leadRoutes from './routes/lead.routes';
import campaignRoutes from './routes/campaign.routes';
import analyticsRoutes from './routes/analytics.routes';
import scraperRoutes from './routes/scraper.routes';
import aiRoutes from './routes/ai.routes';
import teamRoutes from './routes/team.routes';
import settingsRoutes from './routes/settings.routes';
import whatsappRoutes from './routes/whatsapp.routes';
import tagRoutes from './routes/tag.routes';
import billingRoutes from './routes/billing.routes';

const app = express();
const httpServer = createServer(app);
app.set('trust proxy', 1);

// Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Make io accessible globally
app.set('io', io);

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With'],
  exposedHeaders: ['Authorization'],
}));
app.use(morgan(':method :url :status :response-time ms', {
  skip: (req,res) => res.statusCode === 304
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use((req,res,next)=>{
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma','no-cache');
  res.setHeader('Expires','0');
  next();
});

// Static files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Strict rate limit for auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
});

// ─── ROUTES ──────────────────────────────────────────────────────────────────

const API_BASE = '/api/v1';

app.use(`${API_BASE}/auth`, authLimiter, authRoutes);
app.use(`${API_BASE}/leads`, leadRoutes);
app.use(`${API_BASE}/campaigns`, campaignRoutes);
app.use(`${API_BASE}/analytics`, analyticsRoutes);
app.use(`${API_BASE}/scraper`, scraperRoutes);
app.use(`${API_BASE}/ai`, aiRoutes);
app.use(`${API_BASE}/team`, teamRoutes);
app.use(`${API_BASE}/settings`, settingsRoutes);
app.use(`${API_BASE}/whatsapp`, whatsappRoutes);
app.use(`${API_BASE}/tags`, tagRoutes);
app.use(`${API_BASE}/billing`, billingRoutes);

// Health check
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        database: 'connected',
        redis: 'connected',
      },
    });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: String(error) });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
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
    await prisma.$connect();
    console.log('✅ PostgreSQL connected');

    // Test Redis
    await redis.ping();
    console.log('✅ Redis connected');

    // Setup queues
    await setupQueues(io);
    console.log('✅ BullMQ queues initialized');

    // Restore WhatsApp Web sessions
    await initializeWhatsAppService(io);
    console.log('✅ WhatsApp Web service ready');

    // Setup socket handlers
    setupSocketHandlers(io);
    console.log('✅ Socket.io handlers ready');

    // Setup cron jobs
    setupCronJobs();
    console.log('✅ Cron jobs scheduled');

    const PORT = process.env.PORT || 5000;
    httpServer.listen(PORT, () => {
      console.log(`\n🚀 WACrm Backend running on port ${PORT}`);
      console.log(`📊 API: http://localhost:${PORT}/api/v1`);
      console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
      console.log(`❤️  Health: http://localhost:${PORT}/health\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
});

bootstrap();
