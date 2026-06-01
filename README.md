# WACrm Pro — WhatsApp Marketing + CRM Platform

A **production-ready** WhatsApp Marketing, CRM, and Lead Management platform for Indian businesses.

---

## 🚀 Quick Start (5 minutes)

### Option 1: Docker Compose (Recommended)

```bash
# 1. Clone / extract the project
cd wacrm

# 2. Copy env files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# 3. Edit backend/.env — set your GEMINI_API_KEY
#    (FREE key at https://aistudio.google.com/app/apikey)

# 4. Start everything
docker-compose up -d

# 5. Seed the database (first time only)
docker exec wacrm_backend sh -c "cd /app && npx prisma db seed"
```

Open http://localhost:3000 — login with `admin@wacrm.pro` / `Admin@123`

---

### Option 2: Manual Setup

**Prerequisites:** Node.js 18+, PostgreSQL 15+, Redis 7+

```bash
# ── BACKEND ──────────────────────────────
cd backend
npm install
cp .env.example .env
# Edit .env with your DB, Redis, and API keys

npx prisma migrate dev --name init
npx tsx src/utils/seed.ts
npm run dev          # runs on :5000

# ── FRONTEND (new terminal) ──────────────
cd frontend
npm install
cp .env.example .env.local
npm run dev          # runs on :3000
```

---

## 🔑 Default Login

| Field    | Value              |
|----------|--------------------|
| Email    | admin@wacrm.pro    |
| Password | Admin@123          |

---

## 📁 Project Structure

```
wacrm/
├── backend/
│   ├── prisma/schema.prisma        ← Full DB schema
│   └── src/
│       ├── index.ts                ← Express server entry
│       ├── lib/                    ← Prisma + Redis clients
│       ├── middleware/             ← Auth + Validation
│       ├── controllers/            ← Business logic
│       ├── routes/                 ← API endpoints
│       ├── queues/                 ← BullMQ workers
│       ├── services/               ← Socket.io + Cron
│       └── utils/seed.ts           ← Database seeder
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── page.tsx            ← Landing page
│       │   ├── auth/login/         ← Login / Register
│       │   └── dashboard/          ← All dashboard pages
│       ├── components/
│       │   ├── ui/                 ← Button, Card, Modal, etc.
│       │   └── crm/                ← Lead panels & modals
│       ├── store/                  ← Zustand auth store
│       ├── hooks/                  ← useAuth hook
│       └── lib/                    ← API client + utils
├── docker/
│   └── nginx/nginx.conf            ← Nginx reverse proxy
├── docker-compose.yml
└── README.md
```

---

## 🔌 Environment Variables

### `backend/.env`

```env
NODE_ENV=development
PORT=5000

# PostgreSQL
DATABASE_URL=postgresql://wacrm_user:wacrm_pass@localhost:5432/wacrm

# Redis
REDIS_URL=redis://localhost:6379

# JWT (change in production!)
JWT_SECRET=your-super-secret-32-char-minimum-key
JWT_REFRESH_SECRET=another-super-secret-32-char-key

# Google Gemini AI (FREE - https://aistudio.google.com/app/apikey)
GEMINI_API_KEY=AIzaSy...

# Frontend URL for CORS
FRONTEND_URL=http://localhost:3000
```

### `frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
NEXT_PUBLIC_WS_URL=http://localhost:5000
```

---

## 📋 Features

### ✅ CRM & Lead Management
- Add/import/export leads (CSV)
- Lead stages: New → Contacted → Qualified → Proposal → Negotiation → Won/Lost
- Tags, notes, activity timeline
- AI lead scoring (0–100)
- Follow-up reminders
- Team member assignment

### ✅ WhatsApp Campaigns
- Multi-step campaign builder
- Personalized variables: `{{name}}`, `{{city}}`, `{{company}}`
- Smart sending: random delays, typing simulation
- Pause / Resume / Stop campaigns
- Delivery & reply tracking
- Daily send limits

### ✅ Lead Scraper
- Google Maps scraper
- Justdial scraper
- IndiaMART scraper
- One-click import to CRM

### ✅ AI Assistant (Claude API)
- Chat interface (Hindi/English/Hinglish)
- Message generator (3 variations)
- Follow-up suggestions per lead
- AI lead scoring with reasoning
- Reply suggestions for incoming messages

### ✅ Analytics
- Daily message volume charts
- Delivery / reply rate tracking
- Lead acquisition trends
- Campaign performance table
- 7 / 30 / 90 day periods

### ✅ Team Management
- Invite members with role-based access
- Roles: Admin, Manager, Member
- Activate / Deactivate accounts

### ✅ Settings
- Profile management
- Organization settings
- Password change

---

## 🔌 API Reference

Base URL: `http://localhost:5000/api/v1`

All endpoints (except `/auth/*`) require:
```
Authorization: Bearer <access_token>
```

### Auth
```
POST /auth/register    { name, email, password, orgName }
POST /auth/login       { email, password }
POST /auth/refresh     { refreshToken }
POST /auth/logout      { refreshToken }
GET  /auth/me
```

### Leads
```
GET    /leads                  ?search, stage, page, limit
POST   /leads                  { name, phone, email, ... }
GET    /leads/:id
PUT    /leads/:id
DELETE /leads/:id
GET    /leads/stats
GET    /leads/export           → CSV download
POST   /leads/import           multipart/form-data file=<csv>
POST   /leads/:id/notes        { content }
```

### Campaigns
```
GET    /campaigns
POST   /campaigns              { name, messageTemplate, leadIds, ... }
GET    /campaigns/:id
PUT    /campaigns/:id
DELETE /campaigns/:id
POST   /campaigns/:id/start
POST   /campaigns/:id/pause
POST   /campaigns/:id/resume
GET    /campaigns/:id/stats
```

### AI
```
POST /ai/generate-message      { purpose, business, language, tone }
GET  /ai/follow-up/:leadId
POST /ai/score-lead/:leadId
POST /ai/reply-suggestions     { incomingMessage, leadName }
POST /ai/chat                  { messages: [{role, content}] }
```

### Scraper
```
POST /scraper/google-maps      { query, location, category }
POST /scraper/justdial         { query, location }
POST /scraper/indiamart        { query, location }
GET  /scraper/jobs
GET  /scraper/jobs/:id
POST /scraper/jobs/:id/import
```

### Analytics
```
GET /analytics/dashboard
GET /analytics              ?period=7d|30d|90d
```

---

## 🐳 Production Deployment

```bash
# Build and run production
docker-compose -f docker-compose.yml up --build -d

# View logs
docker-compose logs -f backend

# Run migrations
docker exec wacrm_backend npx prisma migrate deploy

# Seed DB
docker exec wacrm_backend npx tsx src/utils/seed.ts
```

### Deploy to VPS / Cloud

1. Copy project to server
2. Install Docker + Docker Compose
3. Set production env vars (strong JWT secrets!)
4. `docker-compose up -d`
5. Point Nginx/Cloudflare to port 80

### Recommended Cloud Stack
- **Frontend**: Vercel (free tier)
- **Backend**: Railway / Render / DigitalOcean
- **Database**: Supabase / Railway PostgreSQL
- **Redis**: Upstash (free tier)

---

## 🔒 Production Checklist

- [ ] Change `JWT_SECRET` and `JWT_REFRESH_SECRET` (min 32 chars)
- [ ] Set `NODE_ENV=production`
- [ ] Enable HTTPS / SSL
- [ ] Set correct `FRONTEND_URL` for CORS
- [ ] Add GEMINI_API_KEY (free at aistudio.google.com)
- [ ] Set strong database password
- [ ] Configure Redis password
- [ ] Set up daily backups for PostgreSQL

---

## 🛠️ WhatsApp Integration

The platform is built to integrate with:
- **whatsapp-web.js** (unofficial, free)
- **Baileys** (unofficial, Node.js)
- **WhatsApp Business API** (official, paid)

To connect, implement `sendWhatsAppMessage()` in `backend/src/queues/index.ts`.
The function signature is already defined — just replace the simulation with your chosen library.

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 + Tailwind CSS + Framer Motion |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Queue | Redis + BullMQ |
| Auth | JWT + Refresh Tokens |
| Realtime | Socket.io |
| AI | Google Gemini API (Free) |
| Charts | Recharts |
| State | Zustand + React Query |
| Containers | Docker + Nginx |

---

## 🤝 License

MIT — Personal and commercial use allowed.
