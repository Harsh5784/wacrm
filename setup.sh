#!/bin/bash
# WACrm Pro — Quick Setup Script
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}"
echo "╔══════════════════════════════════════╗"
echo "║        WACrm Pro Setup Script        ║"
echo "╚══════════════════════════════════════╝"
echo -e "${NC}"

# Check prerequisites
check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    echo -e "${RED}✗ $1 not found. Please install it first.${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ $1 found${NC}"
}

echo "Checking prerequisites..."
check_cmd node
check_cmd npm
check_cmd psql || echo -e "${YELLOW}  PostgreSQL not found locally — use Docker or remote DB${NC}"
check_cmd redis-cli || echo -e "${YELLOW}  Redis not found locally — use Docker or remote Redis${NC}"

# Setup backend
echo ""
echo -e "${YELLOW}Setting up backend...${NC}"
cd backend
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo -e "${GREEN}✓ Created backend/.env — please fill in your values${NC}"
fi
npm install
echo -e "${GREEN}✓ Backend dependencies installed${NC}"

# Setup frontend
echo ""
echo -e "${YELLOW}Setting up frontend...${NC}"
cd ../frontend
if [ ! -f ".env.local" ]; then
  cp .env.example .env.local
  echo -e "${GREEN}✓ Created frontend/.env.local${NC}"
fi
npm install
echo -e "${GREEN}✓ Frontend dependencies installed${NC}"

cd ..

echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Edit ${YELLOW}backend/.env${NC} — add your DATABASE_URL, REDIS_URL, GEMINI_API_KEY"
echo "  2. Run database migrations:"
echo "     ${YELLOW}cd backend && npx prisma migrate dev --name init${NC}"
echo "  3. Seed the database:"
echo "     ${YELLOW}npx tsx src/utils/seed.ts${NC}"
echo "  4. Start backend:"
echo "     ${YELLOW}npm run dev${NC}"
echo "  5. In new terminal, start frontend:"
echo "     ${YELLOW}cd frontend && npm run dev${NC}"
echo ""
echo "  OR use Docker: ${YELLOW}docker-compose up -d${NC}"
echo ""
echo "  Login: admin@wacrm.pro / Admin@123"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
