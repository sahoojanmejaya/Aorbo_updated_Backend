# Controlled Aggregator Backend - Implementation Guide

## Overview
This guide walks through implementing the secure, admin-controlled trek booking platform.

---

## Phase 1: Database Setup

### 1.1 Create New Tables

Run the following migrations to create required tables:

```sql
-- Pending Bookings Table
CREATE TABLE pending_bookings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id VARCHAR(255) NOT NULL UNIQUE,
    customer_id INT NOT NULL,
    batch_id INT NOT NULL,
    trek_id INT NOT NULL,
    vendor_id INT NOT NULL,
    traveler_count INT NOT NULL,
    travelers JSON NOT NULL,
    fare_data JSON NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status ENUM('pending', 'completed', 'expired', 'failed') DEFAULT 'pending',
    booking_id INT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_order_id (order_id),
    INDEX idx_customer_id (customer_id),
    INDEX idx_status (status),
    INDEX idx_expires_at (expires_at),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (batch_id) REFERENCES batches(id),
    FOREIGN KEY (trek_id) REFERENCES treks(id),
    FOREIGN KEY (vendor_id) REFERENCES vendors(id)
);

-- Commission Settings Table
CREATE TABLE commission_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    vendor_id INT NOT NULL,
    commission_type ENUM('percentage', 'fixed') DEFAULT 'percentage',
    commission_value DECIMAL(10,2) NOT NULL,
    effective_from DATETIME NOT NULL,
    effective_until DATETIME NULL,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_by_admin_id INT NOT NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_vendor_id (vendor_id),
    INDEX idx_status (status),
    INDEX idx_effective_from (effective_from),
    FOREIGN KEY (vendor_id) REFERENCES vendors(id),
    FOREIGN KEY (created_by_admin_id) REFERENCES users(id)
);

-- Settlements Table
CREATE TABLE settlements (
    id INT PRIMARY KEY AUTO_INCREMENT,
    vendor_id INT NOT NULL,
    booking_ids JSON NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    commission_amount DECIMAL(10,2) NOT NULL,
    payout_amount DECIMAL(10,2) NOT NULL,
    settlement_date DATE NOT NULL,
    status ENUM('pending', 'processing', 'processed', 'failed') DEFAULT 'pending',
    payout_method VARCHAR(255) NULL,
    payout_reference VARCHAR(255) NULL,
    processed_by INT NULL,
    processed_at DATETIME NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_vendor_id (vendor_id),
    INDEX idx_status (status),
    INDEX idx_settlement_date (settlement_date),
    FOREIGN KEY (vendor_id) REFERENCES vendors(id),
    FOREIGN KEY (processed_by) REFERENCES users(id)
);

-- Tax Settings Table
CREATE TABLE tax_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tax_name VARCHAR(255) NOT NULL,
    tax_type ENUM('percentage', 'fixed') DEFAULT 'percentage',
    tax_value DECIMAL(10,2) NOT NULL,
    vendor_id INT NULL,
    status ENUM('active', 'inactive') DEFAULT 'active',
    effective_from DATETIME NOT NULL,
    effective_until DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_vendor_id (vendor_id),
    INDEX idx_status (status),
    FOREIGN KEY (vendor_id) REFERENCES vendors(id)
);

-- Coupon Usage Table
CREATE TABLE coupon_usages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    coupon_id INT NOT NULL,
    customer_id INT NOT NULL,
    booking_id INT NULL,
    discount_amount DECIMAL(10,2) NOT NULL,
    used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_coupon_id (coupon_id),
    INDEX idx_customer_id (customer_id),
    INDEX idx_booking_id (booking_id),
    INDEX idx_coupon_customer (coupon_id, customer_id),
    FOREIGN KEY (coupon_id) REFERENCES coupons(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (booking_id) REFERENCES bookings(id)
);
```

### 1.2 Update Existing Tables

```sql
-- Add new fields to treks table
ALTER TABLE treks 
ADD COLUMN approval_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
ADD COLUMN admin_notes TEXT NULL,
ADD COLUMN reviewed_by INT NULL,
ADD COLUMN reviewed_at DATETIME NULL,
ADD COLUMN platform_fee_percentage DECIMAL(5,2) DEFAULT 10.00,
ADD COLUMN visibility BOOLEAN DEFAULT FALSE,
ADD COLUMN featured BOOLEAN DEFAULT FALSE,
ADD INDEX idx_approval_status (approval_status),
ADD INDEX idx_visibility (visibility);

-- Add new fields to bookings table
ALTER TABLE bookings
ADD COLUMN settlement_status ENUM('pending', 'settled', 'cancelled') DEFAULT 'pending',
ADD COLUMN settled_at DATETIME NULL,
ADD COLUMN cancellation_id INT NULL,
ADD COLUMN cancelled_at DATETIME NULL,
ADD COLUMN razorpay_order_id VARCHAR(255) NULL,
ADD COLUMN razorpay_payment_id VARCHAR(255) NULL,
ADD COLUMN payment_method VARCHAR(50) NULL,
ADD COLUMN tax_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN tax_breakdown JSON NULL,
ADD INDEX idx_settlement_status (settlement_status),
ADD INDEX idx_razorpay_order_id (razorpay_order_id);

-- Add new fields to commission_logs table
ALTER TABLE commission_logs
ADD COLUMN status ENUM('pending_settlement', 'settled', 'cancelled') DEFAULT 'pending_settlement',
ADD COLUMN settled_at DATETIME NULL,
ADD COLUMN cancellation_adjustment DECIMAL(10,2) DEFAULT 0,
ADD INDEX idx_status (status);

-- Add new fields to customers table
ALTER TABLE customers
ADD COLUMN fcm_token VARCHAR(500) NULL,
ADD INDEX idx_fcm_token (fcm_token);

-- Add new fields to users table
ALTER TABLE users
ADD COLUMN fcm_token VARCHAR(500) NULL,
ADD INDEX idx_fcm_token (fcm_token);
```

---

## Phase 2: Environment Configuration

### 2.1 Update .env File

Add the following environment variables:

```env
# JWT Secrets
JWT_SECRET=your-super-secret-jwt-key-change-this
FARE_TOKEN_SECRET=your-fare-token-secret-change-this

# Razorpay Configuration
RAZORPAY_KEY_ID=rzp_live_your_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret

# Firebase Configuration (for FCM)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Security
BCRYPT_ROUNDS=10
SESSION_SECRET=your-session-secret
```

### 2.2 Install Dependencies

```bash
npm install express-rate-limit express-validator jsonwebtoken crypto
```

---

## Phase 3: Route Integration

### 3.1 Update Main Routes File

Add to `routes/v1/index.js`:

```javascript
const secureBookingRoutes = require("./secureBookingRoutes");

// Replace old booking routes with secure ones
router.use("/bookings", secureBookingRoutes);
```

### 3.2 Update Admin Routes

Add to `routes/admin/index.js`:

```javascript
const trekApprovalRoutes = require("./trekApprovalRoutes");
const settlementRoutes = require("./settlementRoutes");

router.use("/trek-approvals", trekApprovalRoutes);
router.use("/settlements", settlementRoutes);
```

### 3.3 Update Vendor Routes

Add to `routes/vendor/index.js`:

```javascript
const restrictedTrekRoutes = require("./restrictedTrekRoutes");

// Replace old trek routes with restricted ones
router.use("/treks", restrictedTrekRoutes);
```

---

## Phase 4: Security Hardening

### 4.1 Apply Security Middleware

Update `app.js`:

```javascript
const helmet = require("helmet");
const cors = require("cors");
const { rateLimiters } = require("./middleware/securityMiddleware");

// Security headers
app.use(helmet());

// CORS configuration
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000"],
    credentials: true
}));

// Global rate limiting
app.use("/api/", rateLimiters.api);
app.use("/api/v1/auth/", rateLimiters.auth);
app.use("/api/admin/auth/", rateLimiters.auth);
```

### 4.2 Remove Insecure Endpoints

Comment out or remove these endpoints:
- Any endpoint that accepts client-side price calculations
- Direct vendor-customer communication endpoints
- Unprotected admin endpoints

---

## Phase 5: Testing

### 5.1 Test Secure Booking Flow

```bash
# Step 1: Calculate fare
curl -X POST http://localhost:3000/api/v1/bookings/calculate-fare \
  -H "Authorization: Bearer <customer_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": 1,
    "traveler_count": 2,
    "coupon_code": "TREK50"
  }'

# Step 2: Create order
curl -X POST http://localhost:3000/api/v1/bookings/create-order \
  -H "Authorization: Bearer <customer_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "fare_token": "<fare_token_from_step_1>",
    "travelers": [
      {"name": "John Doe", "age": 30, "gender": "Male"},
      {"name": "Jane Doe", "age": 28, "gender": "Female"}
    ]
  }'

# Step 3: Verify payment (after Razorpay payment)
curl -X POST http://localhost:3000/api/v1/bookings/verify-payment \
  -H "Authorization: Bearer <customer_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "<razorpay_order_id>",
    "payment_id": "<razorpay_payment_id>",
    "signature": "<razorpay_signature>"
  }'
```

### 5.2 Test Admin Trek Approval

```bash
# Get pending treks
curl -X GET http://localhost:3000/api/admin/trek-approvals/pending \
  -H "Authorization: Bearer <admin_token>"

# Approve trek
curl -X POST http://localhost:3000/api/admin/trek-approvals/1/review \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "approve",
    "admin_notes": "Trek looks good",
    "modifications": {
      "platform_fee_percentage": 10,
      "visibility": true,
      "featured": false
    }
  }'
```

### 5.3 Test Settlement Flow

```bash
# Get eligible bookings
curl -X GET http://localhost:3000/api/admin/settlements/eligible \
  -H "Authorization: Bearer <admin_token>"

# Trigger settlement
curl -X POST http://localhost:3000/api/admin/settlements/trigger \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "booking_ids": [1, 2, 3],
    "settlement_date": "2026-03-27"
  }'
```

---

## Phase 6: Monitoring & Maintenance

### 6.1 Setup Audit Log Monitoring

Create a cron job to monitor critical actions:

```javascript
// cron/audit-monitor.js
const { AuditLog } = require("../models");
const { Op } = require("sequelize");

async function monitorCriticalActions() {
    const criticalActions = [
        "trek_approved",
        "trek_rejected",
        "settlement_triggered",
        "booking_cancelled",
        "payment_verified"
    ];
    
    const recentLogs = await AuditLog.findAll({
        where: {
            action: { [Op.in]: criticalActions },
            created_at: {
                [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
        }
    });
    
    // Send daily summary to admin
    console.log(`Critical actions in last 24h: ${recentLogs.length}`);
}

module.exports = monitorCriticalActions;
```

### 6.2 Cleanup Expired Pending Bookings

```javascript
// cron/cleanup-pending-bookings.js
const { PendingBooking } = require("../models");
const { Op } = require("sequelize");

async function cleanupExpiredBookings() {
    const result = await PendingBooking.update(
        { status: "expired" },
        {
            where: {
                status: "pending",
                expires_at: { [Op.lt]: new Date() }
            }
        }
    );
    
    console.log(`Expired ${result[0]} pending bookings`);
}

module.exports = cleanupExpiredBookings;
```

---

## Phase 7: Deployment Checklist

### Pre-Deployment
- [ ] All environment variables set in production
- [ ] Database migrations applied
- [ ] JWT secrets changed from defaults
- [ ] Razorpay live keys configured
- [ ] Firebase FCM configured
- [ ] Rate limiting tested
- [ ] CORS origins configured
- [ ] SSL/TLS certificates installed

### Post-Deployment
- [ ] Test complete booking flow
- [ ] Test admin approval workflow
- [ ] Test settlement process
- [ ] Monitor error logs for 24 hours
- [ ] Verify audit logs are being created
- [ ] Test notification delivery
- [ ] Verify vendor data isolation
- [ ] Test cancellation and refund flow

---

## Security Best Practices

1. **Never Trust Client Data**
   - Always recalculate prices server-side
   - Validate all inputs
   - Use prepared statements for SQL

2. **Rate Limiting**
   - Different limits for different endpoints
   - Track failed auth attempts
   - Block suspicious IPs

3. **Audit Everything**
   - Log all critical operations
   - Store before/after states
   - Monitor audit logs daily

4. **Data Isolation**
   - Vendors see only their data
   - Customers see only approved treks
   - Admin has full visibility

5. **Payment Security**
   - Verify Razorpay signatures
   - Use atomic transactions
   - Handle race conditions

---

## Troubleshooting

### Issue: Fare token expired
**Solution**: Tokens expire in 5 minutes. Recalculate fare before creating order.

### Issue: Slot race condition
**Solution**: Use database row locking (FOR UPDATE) during booking creation.

### Issue: Commission not calculated
**Solution**: Ensure commission_settings exist for vendor with active status.

### Issue: Notifications not sent
**Solution**: Verify Firebase FCM configuration and customer/user fcm_token.

### Issue: Settlement fails
**Solution**: Check booking status, payment_status, and trek completion date + 3 days.

---

## Support

For issues or questions:
1. Check audit logs for error details
2. Review application logs
3. Verify database constraints
4. Test with Postman/curl
5. Check Razorpay dashboard for payment issues

