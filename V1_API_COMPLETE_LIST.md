# 📋 COMPLETE V1 API LIST

**Base URL**: `/api/v1`  
**Total APIs**: 47  
**Date**: March 24, 2026

---

## 🔐 AUTHENTICATION

### 1. Customer Authentication (3 APIs)
**Base**: `/api/v1/customer/auth`

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/firebase-verify` | ❌ No | Verify Firebase token & login/register |
| GET | `/profile` | ✅ Yes | Get customer profile |
| PUT | `/profile` | ✅ Yes | Update customer profile |

---

## 🏔️ TREK MANAGEMENT (5 APIs)
**Base**: `/api/v1/treks`

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/` | ❌ No | Get all active treks (admin-approved only) |
| GET | `/:id` | ❌ No | Get trek details by ID (admin-approved only) |
| GET | `/:id/batches` | ❌ No | Get trek batches |
| GET | `/:id/reviews` | ❌ No | Get trek reviews |
| GET | `/:id/ratings` | ❌ No | Get trek ratings |

**Admin Control**: Only shows treks with `approval_status="approved"` and `visibility=true`

---

## 💳 BOOKING MANAGEMENT (5 APIs)
**Base**: `/api/v1/bookings`

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/calculate-fare` | ✅ Yes | Step 1: Calculate fare (server-side) |
| POST | `/create-order` | ✅ Yes | Step 2: Create Razorpay order |
| POST | `/verify-payment` | ✅ Yes | Step 3: Verify payment & create booking |
| GET | `/` | ✅ Yes | Get customer's bookings |
| GET | `/:id` | ✅ Yes | Get booking details by ID |

**Admin Control**: 
- Server-side fare calculation
- Commission tracking
- Secure 3-step flow

---

## 🎟️ COUPON MANAGEMENT (6 APIs)
**Base**: `/api/v1/coupons`

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/available` | ❌ No | Get available coupons (admin-approved only) |
| POST | `/validate` | ✅ Yes | Validate coupon code |
| POST | `/apply` | ✅ Yes | Apply coupon to booking |
| GET | `/customer` | ✅ Yes | Get customer's coupons |
| GET | `/vendor/:vendorId` | ❌ No | Get vendor-specific coupons |
| GET | `/trek/:trekId` | ❌ No | Get trek-specific coupons |

**Admin Control**: Only shows coupons with `approval_status="approved"`

---

## 💬 CHAT/MESSAGING (3 APIs)
**Base**: `/api/v1/customer/chats`

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/` | ✅ Yes | Create or get chat (vendor contact blocked) |
| GET | `/:chatId/messages` | ✅ Yes | Get chat messages |
| PATCH | `/:chatId/read` | ✅ Yes | Mark messages as read |

**Admin Control**: 
- Direct vendor-customer contact BLOCKED
- All messages routed through admin/agent

---

## ⭐ RATING & REVIEW (6 APIs)
**Base**: `/api/v1/ratings`

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/` | ❌ No | Get all ratings (paginated) |
| GET | `/all` | ❌ No | Get all ratings (no pagination) |
| POST | `/` | ✅ Yes | Submit rating and review |
| GET | `/customer/:customer_id` | ✅ Yes | Get customer's ratings |
| PUT | `/:id` | ✅ Yes | Update rating |
| DELETE | `/:id` | ✅ Yes | Delete rating |

---

## 🚨 ISSUE REPORTING (3 APIs)
**Base**: `/api/v1/issues`

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/submit` | ❌ No | Submit issue report |
| GET | `/:id` | ❌ No | Get issue report by ID |
| GET | `/booking/:booking_id` | ❌ No | Get all issues for a booking |

**Issue Types**:
- `accommodation_issue`
- `trek_services_issue`
- `transportation_issue`
- `other`

**Issue Categories**:
- `drunken_driving`
- `rash_unsafe_driving`
- `sexual_harassment`
- `verbal_abuse_assault`
- `others`

---

## ⚖️ DISPUTE MANAGEMENT (2 APIs)
**Base**: `/api/v1/booking-dispute`

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/:bookingId` | ❌ No | Get all disputes for a booking |
| PUT | `/:bookingId/status` | ❌ No | Update dispute status |

**Dispute Statuses**:
- `pending` → `open`
- `open` → `in_progress`
- `in_progress` → `resolved` or `closed`

---

## 👥 TRAVELER MANAGEMENT (6 APIs)
**Base**: `/api/v1/customer/travelers`

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/` | ✅ Yes | Get all travelers |
| POST | `/` | ✅ Yes | Create new traveler |
| GET | `/:id` | ✅ Yes | Get traveler details |
| PUT | `/:id` | ✅ Yes | Update traveler |
| DELETE | `/:id` | ✅ Yes | Delete traveler (soft delete) |
| GET | `/:id/bookings` | ✅ Yes | Get traveler's booking history |

---

## 🆘 EMERGENCY CONTACTS (4 APIs)
**Base**: `/api/v1/customer/emergency-contacts`

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/` | ✅ Yes | Get all emergency contacts |
| POST | `/` | ✅ Yes | Create emergency contact (max 3) |
| PUT | `/:id` | ✅ Yes | Update emergency contact |
| DELETE | `/:id` | ✅ Yes | Delete emergency contact |

---

## 🌍 LOCATION MANAGEMENT (13 APIs)

### States (5 APIs)
**Base**: `/api/v1/states`

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/` | ❌ No | Get all states |
| GET | `/search` | ❌ No | Search states (autocomplete) |
| GET | `/popular` | ❌ No | Get popular states |
| GET | `/region/:region` | ❌ No | Get states by region |
| GET | `/:id` | ❌ No | Get state by ID |

---

### Cities (4 APIs)
**Base**: `/api/v1/cities`

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/` | ❌ No | Get all cities |
| GET | `/popular` | ❌ No | Get popular cities |
| GET | `/state/:stateId` | ❌ No | Get cities by state |
| GET | `/:id` | ❌ No | Get city by ID |

---

### Destinations (4 APIs)
**Base**: `/api/v1/destinations`

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/` | ❌ No | Get all destinations |
| GET | `/popular` | ❌ No | Get popular destinations |
| GET | `/state/:state` | ❌ No | Get destinations by state |
| GET | `/:id` | ❌ No | Get destination by ID |

---

## 📊 API SUMMARY BY CATEGORY

| Category | Total APIs | Auth Required | Public |
|----------|-----------|---------------|--------|
| Authentication | 3 | 2 | 1 |
| Trek Management | 5 | 0 | 5 |
| Booking Management | 5 | 5 | 0 |
| Coupon Management | 6 | 3 | 3 |
| Chat/Messaging | 3 | 3 | 0 |
| Rating & Review | 6 | 4 | 2 |
| Issue Reporting | 3 | 0 | 3 |
| Dispute Management | 2 | 0 | 2 |
| Traveler Management | 6 | 6 | 0 |
| Emergency Contacts | 4 | 4 | 0 |
| Location (States) | 5 | 0 | 5 |
| Location (Cities) | 4 | 0 | 4 |
| Location (Destinations) | 4 | 0 | 4 |
| **TOTAL** | **47** | **27** | **20** |

---

## 🔒 AUTHENTICATION BREAKDOWN

### Public APIs (20)
No authentication required:
- Trek listing and details
- Coupon availability
- Location data (states, cities, destinations)
- Issue reporting
- Dispute status
- Ratings (read-only)

### Protected APIs (27)
Require customer authentication:
- Profile management
- Booking operations
- Coupon validation/application
- Chat/messaging
- Rating submission
- Traveler management
- Emergency contacts

---

## 🎯 ADMIN-CONTROLLED APIs

### Direct Admin Control (12 APIs)
Admin approval required before customers can access:

1. `GET /treks` - Only approved treks
2. `GET /treks/:id` - Only approved treks
3. `GET /treks/:id/batches` - Only approved trek batches
4. `GET /treks/:id/reviews` - Only approved trek reviews
5. `GET /treks/:id/ratings` - Only approved trek ratings
6. `GET /coupons/available` - Only approved coupons
7. `POST /coupons/validate` - Only approved coupons
8. `POST /coupons/apply` - Only approved coupons
9. `GET /coupons/customer` - Only approved coupons
10. `GET /coupons/vendor/:vendorId` - Only approved coupons
11. `GET /coupons/trek/:trekId` - Only approved coupons
12. `POST /customer/chats` - Vendor contact blocked

### Indirect Admin Control (5 APIs)
Admin controls through backend logic:

13. `POST /bookings/calculate-fare` - Server-side calculation
14. `POST /bookings/create-order` - Amount validation
15. `POST /bookings/verify-payment` - Commission logging
16. `GET /bookings` - Admin visibility
17. `GET /bookings/:id` - Financial tracking

---

## 📱 MOBILE APP INTEGRATION

### Required Headers
```javascript
// For public APIs
headers: {
    'Content-Type': 'application/json'
}

// For protected APIs
headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <jwt_token>'
}
```

### Authentication Flow
```javascript
// 1. Login with Firebase
POST /api/v1/customer/auth/firebase-verify
Body: { firebaseIdToken: "..." }
Response: { token: "jwt_token", customer: {...} }

// 2. Use token for protected APIs
GET /api/v1/bookings
Headers: { Authorization: "Bearer jwt_token" }
```

### Booking Flow (3-Step)
```javascript
// Step 1: Calculate fare
POST /api/v1/bookings/calculate-fare
Body: { batch_id, traveler_count, coupon_code }
Response: { fare_token, breakdown, expires_at }

// Step 2: Create order
POST /api/v1/bookings/create-order
Body: { fare_token, travelers: [...] }
Response: { order_id, amount, razorpay_key }

// Step 3: Verify payment (after Razorpay payment)
POST /api/v1/bookings/verify-payment
Body: { order_id, payment_id, signature }
Response: { booking_id, status: "confirmed" }
```

---

## 🚀 RATE LIMITS

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Authentication | 5 requests | 15 minutes |
| Payment | 10 requests | 15 minutes |
| Booking | 20 requests | 15 minutes |
| General API | 100 requests | 15 minutes |

---

## 📝 RESPONSE FORMAT

### Success Response
```json
{
    "success": true,
    "data": { ... },
    "message": "Operation successful"
}
```

### Error Response
```json
{
    "success": false,
    "message": "Error description",
    "errors": [ ... ]  // Optional validation errors
}
```

### Paginated Response
```json
{
    "success": true,
    "data": [ ... ],
    "pagination": {
        "currentPage": 1,
        "totalPages": 10,
        "totalCount": 100,
        "hasNext": true,
        "hasPrev": false
    }
}
```

---

## 🔍 QUERY PARAMETERS

### Common Query Parameters

#### Pagination
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)

#### Filtering
- `status` - Filter by status
- `trek_id` - Filter by trek
- `vendor_id` - Filter by vendor
- `customer_id` - Filter by customer

#### Trek Listing
- `destination_id` - Filter by destination
- `city_id` - Filter by city
- `min_price` - Minimum price
- `max_price` - Maximum price
- `duration_days` - Filter by duration
- `start_date` - Filter by start date

#### Search
- `q` - Search query
- `search` - Search term

---

## 📊 API USAGE STATISTICS

### Most Used APIs (Expected)
1. `GET /treks` - Trek listing
2. `GET /treks/:id` - Trek details
3. `POST /bookings/calculate-fare` - Fare calculation
4. `POST /bookings/verify-payment` - Payment verification
5. `GET /bookings` - Booking history

### Critical APIs (High Priority)
1. `POST /bookings/verify-payment` - Payment processing
2. `POST /bookings/create-order` - Order creation
3. `POST /customer/auth/firebase-verify` - Authentication
4. `POST /coupons/validate` - Coupon validation
5. `POST /issues/submit` - Issue reporting

---

## ✅ API CHECKLIST FOR MOBILE APP

### Must Implement
- [x] Authentication (Firebase verify)
- [x] Trek listing and details
- [x] 3-step booking flow
- [x] Booking history
- [x] Traveler management
- [x] Emergency contacts
- [x] Rating submission
- [x] Issue reporting

### Optional
- [ ] Chat/messaging
- [ ] Dispute management
- [ ] Coupon browsing
- [ ] Location search

---

## 🎯 ADMIN CONTROL SUMMARY

**Total V1 APIs**: 47  
**Admin-Controlled**: 17 (36%)  
**Public**: 20 (43%)  
**Customer-Only**: 27 (57%)

**Admin Control Types**:
- ✅ Approval filters (12 APIs)
- ✅ Server-side calculation (3 APIs)
- ✅ Communication routing (1 API)
- ✅ Financial tracking (1 API)

---

**Document Version**: 1.0  
**Last Updated**: March 24, 2026  
**Status**: ✅ COMPLETE
