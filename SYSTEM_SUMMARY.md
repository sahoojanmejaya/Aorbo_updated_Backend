# Controlled Aggregator Backend System - Complete Summary

## 🎯 System Overview

A secure, admin-controlled trek booking platform where the admin acts as the central authority controlling all critical operations including trek approvals, payment flow, customer communication, and vendor payouts.

---

## 🏗️ Architecture Components

### 1. **Security Layer** (`middleware/securityMiddleware.js`)
- **Rate Limiting**: Different limits for auth, payment, booking, and general API
- **Input Validation**: Express-validator integration with error handling
- **Resource Ownership**: Validates users can only access their own data
- **Vendor Isolation**: Ensures vendors see only their data
- **Role-Based Access**: Admin, vendor, customer role enforcement
- **Audit Logging**: Automatic logging of all critical operations
- **Critical Field Protection**: Prevents unauthorized modification of sensitive fields

### 2. **Fare Calculation Service** (`services/fareCalculationService.js`)
**Zero Trust Principle**: Never trust client-provided amounts

**Features**:
- Server-side price calculation from database
- Coupon validation with usage limits
- Tax calculation from settings
- Commission calculation
- Secure fare token generation (JWT, 5-min expiry)
- Fare integrity verification

**Flow**:
```
Client Request → Fetch Batch/Trek from DB → Calculate Base Amount
→ Validate Coupon → Apply Discount → Calculate Taxes
→ Calculate Commission (hidden) → Generate Fare Token → Return to Client
```

### 3. **Payment Service** (`services/paymentService.js`)
**Platform-Controlled Payment Flow**

**Features**:
- Razorpay order creation (server-side only)
- Payment signature verification (CRITICAL)
- Atomic booking creation with slot locking
- Commission calculation and logging
- Vendor wallet management
- Refund processing

**Flow**:
```
Fare Token → Create Razorpay Order → Store Pending Booking
→ Client Pays → Verify Signature → Atomic Transaction:
  - Lock Batch Slots
  - Create Booking
  - Create Travelers
  - Update Slots
  - Log Commission
  - Update Vendor Wallet
→ Send Notifications
```

### 4. **Notification Service** (`services/notificationService.js`)
**Event-Driven Communication**

**Features**:
- FCM push notifications
- Email notifications for critical events
- Database storage for audit
- Multiple recipient support
- Priority-based delivery

**Events**:
- Booking confirmed/cancelled
- Payment received/refunded
- Trek approved/rejected
- Settlement processed
- New messages
- Disputes raised/resolved

### 5. **Cancellation Service** (`services/cancellationService.js`)
**Policy-Driven Refund System**

**Features**:
- Policy-based refund calculation
- Days-before-trek tier matching
- Atomic cancellation with slot release
- Vendor wallet adjustment
- Razorpay refund initiation
- Commission log updates

**Flow**:
```
Cancel Request → Fetch Booking + Policy → Calculate Refund
→ Atomic Transaction:
  - Create Cancellation Record
  - Update Booking Status
  - Release Batch Slots
  - Adjust Vendor Wallet
  - Update Commission Log
→ Initiate Razorpay Refund → Send Notifications
```

---

## 🔐 Security Enforcement

### Authentication & Authorization
```
Customer → JWT Token (type: customer) → Customer-only endpoints
Vendor → JWT Token (type: vendor, role: vendor) → Vendor-restricted endpoints
Admin → JWT Token (role: admin) → Full system access
```

### Data Isolation

**Customers**:
- ✅ View approved treks only
- ✅ Access own bookings
- ❌ Cannot see vendor financial data
- ❌ Cannot contact vendors directly

**Vendors**:
- ✅ Create treks (pending approval)
- ✅ View assigned bookings
- ✅ Update non-critical trek fields
- ❌ Cannot see customer financial data
- ❌ Cannot modify approved trek prices
- ❌ Cannot publish without admin approval

**Admins**:
- ✅ Full system visibility
- ✅ Approve/reject treks
- ✅ Trigger settlements
- ✅ Override any decision
- ✅ Access all data

### Critical Security Measures

1. **Server-Side Calculations**
   - All prices fetched from database
   - Fare calculated server-side
   - Commission computed server-side
   - Refunds calculated by policy

2. **Atomic Operations**
   - Booking creation uses transactions
   - Slot updates with row locking
   - Settlement processing atomic
   - Cancellation with rollback support

3. **Signature Verification**
   - Razorpay signature validation
   - JWT token verification
   - Fare token integrity checks

4. **Rate Limiting**
   - Auth: 5 requests / 15 min
   - Payment: 10 requests / 15 min
   - Booking: 20 requests / 15 min
   - API: 100 requests / 15 min

---

## 📊 Database Schema

### New Tables

1. **pending_bookings**: Temporary booking storage (15-min expiry)
2. **commission_settings**: Vendor-specific commission rates
3. **settlements**: Settlement transaction records
4. **tax_settings**: Platform/vendor tax configurations
5. **coupon_usages**: Coupon usage tracking per customer

### Updated Tables

**treks**:
- `approval_status`: pending/approved/rejected
- `admin_notes`: Admin review notes
- `reviewed_by`, `reviewed_at`: Approval tracking
- `platform_fee_percentage`: Commission rate
- `visibility`, `featured`: Display control

**bookings**:
- `settlement_status`: pending/settled/cancelled
- `settled_at`: Settlement timestamp
- `razorpay_order_id`, `razorpay_payment_id`: Payment tracking
- `tax_amount`, `tax_breakdown`: Tax details

**customers**, **users**:
- `fcm_token`: Firebase Cloud Messaging token

---

## 🔄 Key Workflows

### 1. Trek Creation & Approval

```
Vendor Creates Trek (status: inactive, approval: pending)
    ↓
Admin Reviews Trek
    ↓
    ├─→ Approve: status → active, visibility → true
    └─→ Reject: status → inactive, visibility → false
    ↓
Notification Sent to Vendor
```

### 2. Secure Booking Flow

```
Step 1: Calculate Fare (Server-Side)
  POST /v1/bookings/calculate-fare
  → Returns: fare_token (5-min expiry)

Step 2: Create Order (Server-Side)
  POST /v1/bookings/create-order
  → Validates fare_token
  → Creates Razorpay order
  → Stores pending_booking (15-min expiry)
  → Returns: order_id, amount, razorpay_key

Step 3: Client Pays via Razorpay
  (Client-side Razorpay integration)

Step 4: Verify Payment (Server-Side)
  POST /v1/bookings/verify-payment
  → Verifies Razorpay signature
  → Atomic booking creation
  → Slot reservation
  → Commission logging
  → Wallet update
  → Notifications sent
```

### 3. Settlement Process

```
Trek Completion + D+3 Days
    ↓
Admin Views Eligible Bookings
  GET /admin/settlements/eligible
    ↓
Admin Triggers Settlement
  POST /admin/settlements/trigger
    ↓
For Each Vendor:
  - Calculate total payout
  - Deduct commission
  - Update vendor wallet
  - Create settlement record
  - Update booking status
  - Send notification
```

### 4. Cancellation & Refund

```
Customer Requests Cancellation
    ↓
Calculate Refund (Policy-Based)
  - Days before trek
  - Find applicable tier
  - Calculate refund percentage
    ↓
Atomic Transaction:
  - Create cancellation record
  - Update booking status
  - Release batch slots
  - Adjust vendor wallet
  - Update commission log
    ↓
Initiate Razorpay Refund
    ↓
Send Notifications
```

---

## 📁 File Structure

```
├── middleware/
│   └── securityMiddleware.js          # Security enforcement
├── services/
│   ├── fareCalculationService.js      # Server-side fare calculation
│   ├── paymentService.js              # Payment processing
│   ├── notificationService.js         # FCM & email notifications
│   └── cancellationService.js         # Cancellation & refunds
├── controllers/
│   ├── v1/
│   │   └── secureBookingController.js # Customer booking APIs
│   ├── admin/
│   │   ├── trekApprovalController.js  # Trek approval workflow
│   │   └── settlementController.js    # Settlement management
│   └── vendor/
│       └── restrictedTrekController.js # Vendor trek management
├── routes/
│   ├── v1/
│   │   └── secureBookingRoutes.js     # Customer routes
│   ├── admin/
│   │   ├── trekApprovalRoutes.js      # Admin trek routes
│   │   └── settlementRoutes.js        # Admin settlement routes
│   └── vendor/
│       └── restrictedTrekRoutes.js    # Vendor routes
├── models/
│   ├── PendingBooking.js              # Temporary bookings
│   ├── CommissionSetting.js           # Commission config
│   ├── Settlement.js                  # Settlement records
│   ├── TaxSetting.js                  # Tax configuration
│   └── CouponUsage.js                 # Coupon tracking
├── migrations/
│   └── create-controlled-aggregator-tables.js
├── ARCHITECTURE.md                     # Detailed architecture
├── IMPLEMENTATION_GUIDE.md             # Step-by-step guide
└── SYSTEM_SUMMARY.md                   # This file
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install express-rate-limit express-validator jsonwebtoken
```

### 2. Run Migration
```bash
node migrations/create-controlled-aggregator-tables.js
```

### 3. Configure Environment
```env
JWT_SECRET=your-secret-key
FARE_TOKEN_SECRET=your-fare-secret
RAZORPAY_KEY_ID=rzp_live_xxx
RAZORPAY_KEY_SECRET=xxx
```

### 4. Update Routes
```javascript
// routes/v1/index.js
const secureBookingRoutes = require("./secureBookingRoutes");
router.use("/bookings", secureBookingRoutes);

// routes/admin/index.js
const trekApprovalRoutes = require("./trekApprovalRoutes");
const settlementRoutes = require("./settlementRoutes");
router.use("/trek-approvals", trekApprovalRoutes);
router.use("/settlements", settlementRoutes);

// routes/vendor/index.js
const restrictedTrekRoutes = require("./restrictedTrekRoutes");
router.use("/treks", restrictedTrekRoutes);
```

### 5. Test Booking Flow
```bash
# Calculate fare
curl -X POST /api/v1/bookings/calculate-fare \
  -H "Authorization: Bearer <token>" \
  -d '{"batch_id":1,"traveler_count":2}'

# Create order
curl -X POST /api/v1/bookings/create-order \
  -H "Authorization: Bearer <token>" \
  -d '{"fare_token":"xxx","travelers":[...]}'

# Verify payment
curl -X POST /api/v1/bookings/verify-payment \
  -H "Authorization: Bearer <token>" \
  -d '{"order_id":"xxx","payment_id":"xxx","signature":"xxx"}'
```

---

## 🎯 Key Features Implemented

### ✅ Admin Control
- Trek approval/rejection workflow
- Settlement trigger system
- Critical field modification
- Visibility control
- Commission management

### ✅ Security
- Server-side fare calculation
- Payment signature verification
- Atomic transactions
- Rate limiting
- Audit logging
- Data isolation

### ✅ Payment System
- Platform-controlled flow
- Commission deduction
- D+3 settlement
- Refund processing
- Wallet management

### ✅ Communication
- Admin-routed messaging
- FCM notifications
- Email for critical events
- No direct vendor-customer contact

### ✅ Cancellation
- Policy-based refunds
- Automatic calculation
- Razorpay refund integration
- Vendor wallet adjustment

---

## 📈 Monitoring & Maintenance

### Daily Tasks
- Monitor audit logs for critical actions
- Check failed payment attempts
- Review pending trek approvals
- Verify settlement processing

### Weekly Tasks
- Cleanup expired pending bookings
- Review commission calculations
- Check notification delivery rates
- Analyze booking patterns

### Monthly Tasks
- Audit vendor payouts
- Review security logs
- Update commission rates
- Optimize database indexes

---

## 🔧 Troubleshooting

### Common Issues

**Fare Token Expired**
- Tokens expire in 5 minutes
- Solution: Recalculate fare before order creation

**Slot Race Condition**
- Multiple concurrent bookings
- Solution: Database row locking (FOR UPDATE)

**Commission Not Calculated**
- Missing commission_settings
- Solution: Create active commission setting for vendor

**Notifications Not Sent**
- Missing FCM token
- Solution: Verify Firebase configuration and user tokens

**Settlement Fails**
- Booking not eligible
- Solution: Check status, payment_status, and D+3 rule

---

## 📞 Support

For implementation assistance:
1. Review ARCHITECTURE.md for design details
2. Follow IMPLEMENTATION_GUIDE.md step-by-step
3. Check audit logs for error details
4. Test with provided curl examples
5. Verify database migrations applied

---

## 🎉 Success Criteria

System is successfully implemented when:
- ✅ Customers can only book approved treks
- ✅ All prices calculated server-side
- ✅ Vendors cannot publish without approval
- ✅ Payments verified with Razorpay signatures
- ✅ Settlements processed D+3 after trek completion
- ✅ Refunds calculated by cancellation policy
- ✅ All critical actions logged in audit_logs
- ✅ Notifications delivered via FCM
- ✅ No direct vendor-customer communication
- ✅ Rate limiting prevents abuse

---

**System Status**: Ready for Implementation
**Security Level**: High
**Admin Control**: Complete
**Data Isolation**: Enforced
**Audit Trail**: Comprehensive

