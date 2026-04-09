# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Aorbo Trekking — a multi-tenant SaaS backend for trekking/adventure travel bookings. Three user roles: **Admin**, **Vendor**, and **Customer** (mobile app users). Built with Express.js + Sequelize ORM + MySQL.

## Common Commands

```bash
# Start development server (with auto-reload)
npm start

# Database migrations
npm run migrate              # Run pending migrations
npm run migrate:undo         # Undo last migration
npm run migrate:status       # Check migration status

# Seed database (run in order or all at once)
npm run seed:all

# Individual seeders (must be run after migrate)
npm run seed:admin
npm run seed:vendors
npm run seed:demoTrek
npm run seed:bookings

# Fix data integrity issues
npm run fix:orphaned-booking-travelers
npm run fix:all-orphaned-records
```

No test runner is configured (`npm test` does nothing).

## Architecture

### API Structure — Three Route Hierarchies

| Prefix | File | Audience |
|--------|------|----------|
| `/api/admin` | `routes/admin/index.js` | Internal admin panel   
| `/api/v1` | `routes/v1/index.js` | Customer mobile app |

Each hierarchy has its own auth middleware:
- Admin/Vendor: JWT (`middleware/authMiddleware.js`) — `Authorization: Bearer <token>`
- Customer: Firebase ID token (`middleware/customerAuthMiddleware.js`) — phone OTP via Firebase

### Request Lifecycle

`server.js` → `app.js` (CORS, timeout, body parsing, static files, routes, error handling) → route file → controller → Sequelize model → MySQL

### Authentication Flow

- **Admin/Vendor**: Login returns JWT; subsequent requests send `Authorization: Bearer <jwt>`
- **Customer**: Firebase phone OTP → Firebase ID token → backend verifies via Firebase Admin SDK → issues session

### Database

- **ORM**: Sequelize 6.x, MySQL dialect
- **Config**: `config/config.js` reads `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` from env
- **Models**: All 80+ models in `models/` auto-loaded by `models/index.js`; associations set up via `associate()` on each model
- **Migrations**: JS-format Sequelize migrations in `migrations/`; also some raw `.sql` files for reference only

### Key Services & Integrations

- **Payments**: Razorpay (`config/razorpay.js`) — booking payments and refunds
- **Firebase**: Admin SDK (`config/firebase.js`) — customer phone authentication
- **Real-time**: Socket.IO on the same HTTP server — admin/vendor/customer chat
- **Cron Jobs**: `cron/settlementCron.js` (daily midnight IST), `cron/auto-close-bookings.js`
- **File Uploads**: Multer — trek images, KYC documents, stored under `storage/`
- **Logging**: Winston with daily rotation (`logs/` directory)

### Controller Patterns

Controllers are large (some 40–75KB) and handle business logic directly — no separate service layer for most features. Use Sequelize transactions (`sequelize.transaction()`) for multi-step operations. Validate input with `express-validator`.

Response format:
```js
res.status(200).json({ success: true, data: ... })
res.status(400).json({ success: false, message: '...' })
```

### Coupon System

Coupons have an audit trail: every create/update/apply/revoke is recorded in `CouponAuditLog`. Coupons can be assigned to specific treks (`CouponAssignment`) or vendors. See `controllers/admin/couponController.js` for the full workflow.

### Booking Lifecycle

`newBookingController.js` (v1) handles the multi-step booking flow: slot hold → payment → confirmation. `bookingController.js` handles post-booking operations (cancellation, traveler updates). Cancellation policies are stored per-batch in `CancellationPolicy` and applied via `CancellationPolicySettings`.

## Environment Setup

Copy `.env.example` and fill in values:

```
PORT=5000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=<password>
DB_NAME=aorbo_trekking
```

Additional env vars needed (not in .env.example): `JWT_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, Firebase service account credentials.

## Production Deployment

Uses PM2 — see `ecosystem.config.js`. Run migrations before deploying: `npm run deploy:migrate`.
