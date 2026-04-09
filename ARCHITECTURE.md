# Controlled Aggregator Backend Architecture

## System Overview
Admin-controlled trek booking platform where all critical operations flow through admin approval and validation.

## Core Principles
1. **Zero Trust Client Data** - Never trust client-provided prices, slots, or calculations
2. **Admin Authority** - All critical operations require admin approval
3. **Server-Side Validation** - All calculations performed server-side
4. **Role-Based Isolation** - Strict data access boundaries between roles
5. **Audit Everything** - Complete audit trail for compliance

---

## 1. AUTHENTICATION & AUTHORIZATION

### Role Hierarchy
```
Admin (Super Authority)
├── Full system access
├── Approve/reject all operations
├── Override any decision
└── Access all data

Agent (Support Staff)
├── Handle customer queries
├── View bookings/treks
├── Cannot modify financial data
└── Cannot approve treks

Vendor (Trek Provider)
├── Create treks (pending_approval)
├── View assigned bookings only
├── Cannot see customer financial data
└── Cannot modify approved treks

Customer (End User)
├── View approved treks only
├── Book via backend APIs
├── Cannot contact vendors directly
└── Cannot see vendor details
```

### Security Measures
- JWT with short expiry (15 min access, 7 day refresh)
- Role-based middleware on every route
- Resource ownership validation
- IP-based rate limiting
- Failed auth attempt tracking

---

## 2. TREK LIFECYCLE (Admin-Controlled)

### Trek States
```
pending_approval → approved → active → completed → archived
                ↓
              rejected
```

### Vendor Trek Creation
```javascript
POST /vendor/treks
Body: {
  name, description, difficulty, duration,
  base_price, // Vendor sets this
  activities, inclusions, exclusions
}
Response: {
  trek_id,
  status: "pending_approval",
  message: "Trek submitted for admin review"
}
```

### Admin Approval Flow
```javascript
POST /admin/treks/:id/review
Body: {
  action: "approve" | "reject",
  admin_notes: "Reason for decision",
  modifications: {
    platform_fee_percentage: 10,
    visibility: true,
    featured: false
  }
}
```

### Critical Field Protection
Vendors CANNOT modify after approval:
- base_price (requires admin re-approval)
- difficulty_level
- max_capacity
- cancellation_policy_id

---

## 3. BOOKING FLOW (Server-Side Validation)

### Step 1: Calculate Fare (Server-Side)
```javascript
POST /v1/bookings/calculate-fare
Headers: { Authorization: "Bearer <customer_token>" }
Body: {
  batch_id: 123,
  traveler_count: 2,
  coupon_code: "TREK50" // Optional
}

Server Logic:
1. Fetch batch from DB (verify active, slots available)
2. Fetch trek base_price from DB
3. Calculate: base_amount = base_price * traveler_count
4. Validate coupon (if provided):
   - Check expiry, usage limits, vendor restrictions
   - Verify customer hasn't exceeded per_user_limit
5. Apply coupon discount
6. Calculate taxes from tax_settings table
7. Calculate platform_fee
8. Generate fare_token (JWT, expires in 5 min)

Response: {
  fare_token: "eyJ...", // Contains encrypted fare details
  breakdown: {
    base_amount: 10000,
    discount: 500,
    taxes: 1170,
    platform_fee: 0, // Hidden from customer
    final_amount: 10670
  },
  expires_at: "2026-03-24T10:35:00Z"
}
```

### Step 2: Create Razorpay Order (Server-Side)
```javascript
POST /v1/bookings/create-order
Headers: { Authorization: "Bearer <customer_token>" }
Body: {
  fare_token: "eyJ...",
  travelers: [
    { name, age, gender, id_proof_type, id_proof_number },
    { name, age, gender, id_proof_type, id_proof_number }
  ]
}

Server Logic:
1. Verify fare_token (check expiry, signature)
2. Decrypt fare details from token
3. Re-validate batch slots (atomic check)
4. Create Razorpay order with amount from token
5. Store pending_booking record with:
   - order_id
   - encrypted fare details
   - traveler data
   - expires_at (15 min)

Response: {
  order_id: "order_xyz",
  amount: 1067000, // Paise
  currency: "INR",
  razorpay_key: "rzp_live_xxx"
}
```

### Step 3: Verify Payment & Confirm Booking
```javascript
POST /v1/bookings/verify-payment
Headers: { Authorization: "Bearer <customer_token>" }
Body: {
  order_id: "order_xyz",
  payment_id: "pay_abc",
  signature: "razorpay_signature"
}

Server Logic:
1. Verify Razorpay signature (CRITICAL)
2. Fetch pending_booking by order_id
3. Verify payment amount matches stored amount
4. Atomic slot reservation:
   BEGIN TRANSACTION
   - Lock batch row (FOR UPDATE)
   - Check available_slots >= traveler_count
   - Decrement available_slots
   - Create booking record
   - Create traveler records
   - Update batch.booked_slots
   COMMIT
5. Calculate commission:
   - vendor_amount = final_amount * (1 - platform_fee_percentage)
   - platform_commission = final_amount * platform_fee_percentage
6. Create commission_log entry
7. Update vendor wallet (pending_settlement)
8. Send notifications (customer, vendor, admin)
9. Create audit_log entry

Response: {
  booking_id: "BK-12345",
  status: "confirmed",
  payment_status: "full_paid",
  trek_date: "2026-04-15"
}
```

---

## 4. PAYMENT SYSTEM (Platform-Controlled)

### Payment Flow
```
Customer Payment → Platform Razorpay Account
                ↓
         Platform holds funds
                ↓
    Trek Completion + D+3 days
                ↓
    Admin triggers settlement
                ↓
    Vendor receives (amount - commission)
```

### Commission Structure
```javascript
// Stored in commission_settings table
{
  vendor_id: 45,
  commission_type: "percentage", // or "fixed"
  commission_value: 10.0, // 10%
  effective_from: "2026-01-01",
  created_by_admin_id: 1
}
```

### Settlement Process
```javascript
POST /admin/settlements/trigger
Body: {
  booking_ids: [123, 124, 125],
  settlement_date: "2026-03-27"
}

Server Logic:
1. Verify all bookings:
   - status = "completed"
   - trek_end_date + 3 days <= today
   - payment_status = "full_paid"
   - settlement_status = "pending"
2. For each booking:
   - Calculate vendor_payout = final_amount - commission - refunds
   - Create settlement_transaction
   - Update vendor wallet balance
   - Update booking.settlement_status = "settled"
   - Create audit_log
3. Trigger payout via Razorpay Payouts API (if integrated)
4. Send settlement notification to vendor

Response: {
  settlements_created: 3,
  total_amount: 85000,
  total_commission: 8500,
  vendor_payouts: 76500
}
```

---

## 5. CANCELLATION & REFUND (Policy-Driven)

### Cancellation Request
```javascript
POST /v1/bookings/:id/cancel
Headers: { Authorization: "Bearer <customer_token>" }
Body: {
  reason: "Personal emergency",
  cancel_all_travelers: true
}

Server Logic:
1. Verify booking ownership (customer_id)
2. Check booking status (must be "confirmed")
3. Fetch cancellation_policy from booking
4. Calculate refund based on policy:
   - Days before trek = trek_start_date - today
   - Find applicable policy tier
   - refund_percentage = policy.refund_percentage
   - refund_amount = final_amount * (refund_percentage / 100)
   - platform_retains = final_amount - refund_amount
5. Create cancellation_booking record
6. Update booking.status = "cancelled"
7. Update batch.available_slots += traveler_count
8. Adjust vendor wallet:
   - Deduct pending_settlement amount
   - Add cancellation_penalty (if applicable)
9. Initiate Razorpay refund (server-side)
10. Create audit_log
11. Send notifications

Response: {
  cancellation_id: "CXL-789",
  refund_amount: 8000,
  refund_status: "processing",
  refund_timeline: "5-7 business days"
}
```

### Refund Processing (Automated)
```javascript
// Triggered by cancellation
async function processRefund(cancellationId) {
  const cancellation = await CancellationBooking.findByPk(cancellationId);
  const booking = await Booking.findByPk(cancellation.booking_id);
  
  // Initiate Razorpay refund
  const refund = await razorpay.payments.refund(booking.payment_id, {
    amount: Math.round(cancellation.refund_amount * 100), // Paise
    notes: {
      cancellation_id: cancellationId,
      booking_id: booking.id
    }
  });
  
  // Update records
  await cancellation.update({
    refund_id: refund.id,
    refund_status: "processed",
    refund_processed_at: new Date()
  });
  
  // Audit log
  await AuditLog.create({
    action: "refund_processed",
    entity_type: "cancellation",
    entity_id: cancellationId,
    performed_by: "system",
    details: { refund_id: refund.id, amount: cancellation.refund_amount }
  });
}
```

---

## 6. COMMUNICATION (Admin-Routed)

### Chat Architecture
```
Customer ←→ Admin/Agent ←→ Vendor
         (All messages routed through platform)
```

### Message Flow
```javascript
POST /v1/chats/send
Headers: { Authorization: "Bearer <token>" }
Body: {
  booking_id: 123,
  message: "What time is pickup?",
  attachments: [] // Optional
}

Server Logic:
1. Verify sender has access to booking
2. Determine recipient:
   - If sender = customer → route to admin/agent
   - If sender = vendor → route to admin/agent
   - If sender = admin/agent → route to intended recipient
3. Create chat_message record
4. Send FCM notification to recipient
5. Store notification in notifications table

Response: {
  message_id: 456,
  sent_at: "2026-03-24T10:30:00Z",
  status: "delivered"
}
```

### Direct Vendor-Customer Block
```javascript
// Middleware to prevent direct communication
function preventDirectContact(req, res, next) {
  const { sender_role, recipient_role } = req.body;
  
  if (
    (sender_role === "customer" && recipient_role === "vendor") ||
    (sender_role === "vendor" && recipient_role === "customer")
  ) {
    return res.status(403).json({
      success: false,
      message: "Direct communication not allowed. Messages are routed through support."
    });
  }
  
  next();
}
```

---

## 7. NOTIFICATIONS (Event-Driven)

### Notification Events
```javascript
const NOTIFICATION_EVENTS = {
  // Booking Events
  BOOKING_CONFIRMED: "booking_confirmed",
  BOOKING_CANCELLED: "booking_cancelled",
  PAYMENT_RECEIVED: "payment_received",
  REFUND_PROCESSED: "refund_processed",
  
  // Trek Events
  TREK_APPROVED: "trek_approved",
  TREK_REJECTED: "trek_rejected",
  BATCH_FULL: "batch_full",
  
  // Settlement Events
  SETTLEMENT_PROCESSED: "settlement_processed",
  COMMISSION_DEDUCTED: "commission_deducted",
  
  // Communication Events
  NEW_MESSAGE: "new_message",
  DISPUTE_RAISED: "dispute_raised"
};
```

### Notification Service
```javascript
// services/notificationService.js
class NotificationService {
  async send(event, recipients, data) {
    // 1. Store in database
    const notification = await Notification.create({
      event_type: event,
      recipient_ids: recipients,
      data: data,
      status: "pending"
    });
    
    // 2. Send FCM push notification
    for (const recipientId of recipients) {
      const user = await this.getUser(recipientId);
      if (user.fcm_token) {
        await this.sendFCM(user.fcm_token, {
          title: this.getTitle(event),
          body: this.getBody(event, data),
          data: { notification_id: notification.id, ...data }
        });
      }
    }
    
    // 3. Send email (for critical events)
    if (this.isCriticalEvent(event)) {
      await this.sendEmail(recipients, event, data);
    }
    
    // 4. Update notification status
    await notification.update({ status: "sent", sent_at: new Date() });
    
    return notification;
  }
}
```

---

## 8. SECURITY ENFORCEMENT

### Middleware Stack
```javascript
// Every protected route uses this stack
app.use("/v1/*", [
  rateLimiter,           // Rate limiting
  authenticateToken,     // JWT verification
  validateRole,          // Role-based access
  validateOwnership,     // Resource ownership
  auditLogger           // Audit trail
]);
```

### Rate Limiting
```javascript
const rateLimit = require("express-rate-limit");

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests, please try again later"
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 login attempts per 15 minutes
  skipSuccessfulRequests: true
});
```

### Input Validation
```javascript
const { body, param, validationResult } = require("express-validator");

const validateBookingCreation = [
  body("batch_id").isInt().withMessage("Invalid batch ID"),
  body("traveler_count").isInt({ min: 1, max: 20 }),
  body("travelers").isArray({ min: 1 }),
  body("travelers.*.name").trim().notEmpty(),
  body("travelers.*.age").isInt({ min: 1, max: 120 }),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];
```

### Resource Ownership Validation
```javascript
async function validateBookingOwnership(req, res, next) {
  const bookingId = req.params.id;
  const customerId = req.customer.id;
  
  const booking = await Booking.findOne({
    where: { id: bookingId, customer_id: customerId }
  });
  
  if (!booking) {
    return res.status(404).json({
      success: false,
      message: "Booking not found or access denied"
    });
  }
  
  req.booking = booking;
  next();
}
```

---

## 9. DATA ISOLATION

### Vendor Data Access
```javascript
// Vendors can ONLY see their own data
async function getVendorBookings(req, res) {
  const vendorId = req.user.vendor_id; // From JWT
  
  const bookings = await Booking.findAll({
    where: { vendor_id: vendorId },
    attributes: [
      "id", "booking_date", "status", "total_travelers",
      // EXCLUDE: final_amount, discount_amount, payment details
    ],
    include: [
      {
        model: Trek,
        attributes: ["name", "difficulty"]
      },
      {
        model: Customer,
        attributes: ["name", "phone"] // Only contact info
        // EXCLUDE: email, dob, emergency_contact
      }
    ]
  });
  
  res.json({ success: true, data: bookings });
}
```

### Customer Data Access
```javascript
// Customers can ONLY see approved treks
async function getAvailableTreks(req, res) {
  const treks = await Trek.findAll({
    where: {
      status: "active",
      approval_status: "approved",
      visibility: true
    },
    attributes: [
      "id", "name", "description", "difficulty", "duration",
      "base_price", "images"
      // EXCLUDE: vendor_id, commission_percentage, cost_breakdown
    ],
    include: [
      {
        model: Batch,
        where: {
          start_date: { [Op.gte]: new Date() },
          available_slots: { [Op.gt]: 0 }
        },
        attributes: ["id", "start_date", "end_date", "available_slots"]
      }
    ]
  });
  
  res.json({ success: true, data: treks });
}
```

---

## 10. AUDIT LOGGING

### Audit Log Structure
```javascript
{
  id: 1234,
  action: "booking_created",
  entity_type: "booking",
  entity_id: 567,
  performed_by_type: "customer",
  performed_by_id: 89,
  ip_address: "192.168.1.1",
  user_agent: "Mozilla/5.0...",
  changes: {
    before: null,
    after: { status: "confirmed", amount: 10670 }
  },
  metadata: {
    trek_id: 45,
    vendor_id: 12,
    payment_id: "pay_abc"
  },
  created_at: "2026-03-24T10:30:00Z"
}
```

### Critical Actions to Audit
- All authentication attempts (success/failure)
- Trek approval/rejection
- Booking creation/cancellation
- Payment verification
- Refund processing
- Settlement triggers
- Admin overrides
- Data access (especially financial data)
- Configuration changes

---

## Implementation Priority

### Phase 1: Security Hardening (Week 1)
1. Implement server-side fare calculation
2. Add resource ownership validation
3. Implement rate limiting
4. Add input validation middleware
5. Fix JWT secret handling

### Phase 2: Admin Controls (Week 2)
1. Trek approval workflow
2. Settlement system
3. Commission calculation
4. Admin override capabilities

### Phase 3: Communication (Week 3)
1. Routed chat system
2. FCM notification service
3. Email notifications
4. Dispute management

### Phase 4: Audit & Compliance (Week 4)
1. Comprehensive audit logging
2. Data isolation enforcement
3. Security testing
4. Documentation
