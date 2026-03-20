# Business on WhatsApp 🤖

An AI-powered WhatsApp commerce platform. Businesses manage their catalog, FAQs, and orders via an admin panel. Customers interact through WhatsApp — the AI handles everything conversationally, and payment is handled via a Razorpay link.

## Architecture

```
business_on_whatsapp/
├── admin-panel/        # React + Vite frontend (business dashboard)
├── backend/            # Node.js + Express API server
└── shared/             # Shared TypeScript types
```

## How it works

1. Business signs up → adds products, FAQs, links their WhatsApp number
2. Customer sends "Hi" to the WhatsApp number
3. AI responds, shows menu, filters by request ("rice-based", "white coloured", etc.)
4. Customer places order via chat → backend generates Razorpay payment link
5. Customer pays on Razorpay hosted page → webhook confirms → AI sends receipt

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Meta WhatsApp Business API access
- Razorpay account
- Anthropic API key (Claude) or OpenAI API key

### Setup

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/business_on_whatsapp.git
cd business_on_whatsapp

# Install all dependencies
npm run install:all

# Setup environment variables
cp backend/.env.example backend/.env
cp admin-panel/.env.example admin-panel/.env

# Run database migrations
cd backend && npm run migrate

# Start development servers
npm run dev
```

### Environment Variables

See `backend/.env.example` and `admin-panel/.env.example` for all required variables.

## Tech Stack

| Layer | Tech |
|-------|------|
| Admin Panel | React 18, Vite, TailwindCSS, React Query |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL + Prisma ORM |
| AI | Anthropic Claude (claude-sonnet-4-20250514) |
| WhatsApp | Meta Cloud API |
| Payments | Razorpay |
| Auth | JWT + bcrypt |

## Project Phases

- [x] Phase 1 — Admin Panel (products, FAQs, settings, order management)
- [ ] Phase 2 — Backend + AI engine
- [ ] Phase 3 — WhatsApp webhook handler
- [ ] Phase 4 — Payment flow (Razorpay)
- [ ] Phase 5 — Multi-tenant production hardening

## License

MIT
