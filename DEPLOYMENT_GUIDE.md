# Deployment Guide - Cancellation Policy Updates

## Overview
This guide covers the deployment of the new cancellation policy system with flexible and standard refund calculations.

## Database Changes
The following migrations have been added:
- `add_cancellation_policy_fields_to_bookings.js` - Adds cancellation policy fields to bookings table
- `create_cancellation_policy_settings_table.js` - Creates configurable cancellation policy settings table

### **Available Migration Scripts:**
```bash
# Individual migrations
npm run migrate:cancellation-policy     # Booking fields only
npm run migrate:policy-settings         # Policy settings table only

# Combined migration
npm run migrate:cancellation-system     # Both migrations together

# Complete setup with default data
npm run setup:cancellation-policies     # Table + default settings

# General deployment
npm run deploy:migrate                  # All pending migrations
npm run deploy:check-migrations         # Check migration status
```

## New Fields Added to `bookings` Table:
- `cancellation_policy_type` (ENUM: 'flexible', 'standard')
- `advance_amount` (DECIMAL)
- `policy_version` (STRING)
- `deduction_amount` (DECIMAL)
- `refund_amount` (DECIMAL)
- `cancellation_rule` (TEXT)
- Updated `payment_status` ENUM to include 'advance_only' and 'full_paid'

## Deployment Steps

### 1. Check Migration Status (Optional)
```bash
npm run deploy:check-migrations
```

### 2. Run Migrations in Production
```bash
npm run deploy:migrate
```

### 3. Alternative: Run Specific Migration
```bash
npm run migrate:cancellation-policy
```

## New API Endpoints

### Customer APIs
### GET /api/v1/customer/bookings/cancellation-refund/:booking_id
- **Updated**: Now calculates refund based on selected policy (flexible/standard)
- **Returns**: Policy-driven refund calculations with configurable settings

### POST /api/v1/customer/bookings/confirm-cancellation
- **Needs Update**: Should calculate refund server-side instead of accepting client amount
- **Status**: Pending implementation

### Admin APIs
### GET /api/admin/cancellation-policy-settings
- **New**: Get all cancellation policy settings
- **Returns**: List of all policy configurations

### GET /api/admin/cancellation-policy-settings/:policyType
- **New**: Get settings for specific policy type (flexible/standard)
- **Returns**: Active settings for the specified policy type

### PUT /api/admin/cancellation-policy-settings/:policyType
- **New**: Update settings for specific policy type
- **Body**: Policy-specific settings (flexible or standard parameters)

### GET /api/admin/cancellation-policy-settings/history/records
- **New**: Get policy settings change history
- **Query**: Optional `policyType` parameter to filter by policy type

## New Utility Files
- `utils/refundCalculator.js` - Contains flexible and standard policy logic with configurable settings
- `models/CancellationPolicySettings.js` - Model for configurable policy settings
- `controllers/admin/cancellationPolicySettingsController.js` - Admin controller for policy settings
- `routes/admin/cancellationPolicySettingsRoutes.js` - Admin routes for policy settings

## New Database Tables
### `cancellation_policy_settings`
- Stores configurable settings for both flexible and standard policies
- Fields include deduction percentages and refund rules
- Supports policy versioning and history tracking

## Testing Checklist
- [ ] Test flexible policy with advance-only payment
- [ ] Test flexible policy with full payment >24h
- [ ] Test flexible policy with full payment <24h
- [ ] Test standard policy with different time slabs (72h+, 48-72h, 24-48h, <24h)
- [ ] Test boundary cases (exactly 72h, 48h, 24h)
- [ ] Test already cancelled bookings (should return 409)
- [ ] Test bookings after trek start

## Rollback (If Needed)
```bash
npm run migrate:undo:live
```

## Environment Variables Required
Ensure these are set in production:
- `NODE_ENV=production`
- Database connection variables
- Any other existing environment variables

## Notes
- The migration is backward compatible
- Existing bookings will default to 'standard' policy
- New bookings should specify policy type during creation
- All calculations use precise rounding (round_half_up)
