# Admin Interface Updates - Configurable Cancellation Policies

## Overview
The admin interface now supports configurable cancellation policy settings, allowing administrators to customize refund calculations for both flexible and standard policies.

## New Admin Features

### 1. Cancellation Policy Settings Management

#### **Flexible Policy Configuration**
- **Advance Non-Refundable**: Toggle whether advance payments are non-refundable
- **24h Deduction Percentage**: Configure deduction percentage for full payment cancellations within 24h

#### **Standard Policy Configuration**
- **72h+ Deduction**: Configure deduction percentage for cancellations 72+ hours before trek
- **48-72h Deduction**: Configure deduction percentage for cancellations 48-72 hours before trek
- **24-48h Deduction**: Configure deduction percentage for cancellations 24-48 hours before trek
- **Under 24h Deduction**: Configure deduction percentage for cancellations under 24 hours before trek

### 2. API Endpoints for Admin Interface

#### **Get All Policy Settings**
```
GET /api/admin/cancellation-policy-settings
```
Returns all policy settings for both flexible and standard policies.

#### **Get Policy Settings by Type**
```
GET /api/admin/cancellation-policy-settings/flexible
GET /api/admin/cancellation-policy-settings/standard
```
Returns active settings for the specified policy type.

#### **Update Policy Settings**
```
PUT /api/admin/cancellation-policy-settings/flexible
PUT /api/admin/cancellation-policy-settings/standard
```

**Flexible Policy Request Body:**
```json
{
  "flexible_advance_non_refundable": true,
  "flexible_full_payment_24h_deduction": 100
}
```

**Standard Policy Request Body:**
```json
{
  "standard_72h_plus_deduction": 20,
  "standard_48_72h_deduction": 50,
  "standard_24_48h_deduction": 70,
  "standard_under_24h_deduction": 100
}
```

#### **Get Policy Settings History**
```
GET /api/admin/cancellation-policy-settings/history/records?policyType=flexible
```
Returns change history for policy settings (optional filter by policy type).

### 3. Frontend Interface Requirements

#### **Flexible Policy Settings Panel**
- Toggle switch for "Advance Non-Refundable"
- Input field for "24h Deduction Percentage" (0-100%)
- Save button to update settings

#### **Standard Policy Settings Panel**
- Input field for "72h+ Deduction" (0-100%)
- Input field for "48-72h Deduction" (0-100%)
- Input field for "24-48h Deduction" (0-100%)
- Input field for "Under 24h Deduction" (0-100%)
- Save button to update settings

#### **Policy History Panel**
- Table showing previous settings changes
- Columns: Date, Policy Type, Changed By, Settings
- Optional filter by policy type

### 4. Default Settings

#### **Flexible Policy Defaults**
- Advance Non-Refundable: `true`
- 24h Deduction: `100%`

#### **Standard Policy Defaults**
- 72h+ Deduction: `20%`
- 48-72h Deduction: `50%`
- 24-48h Deduction: `70%`
- Under 24h Deduction: `100%`

### 5. Validation Rules

- All percentage values must be between 0 and 100
- Policy type must be either 'flexible' or 'standard'
- Required fields must be provided for each policy type
- Changes are logged with timestamp and admin user info

### 6. Integration with Existing Refund System

The configurable settings automatically integrate with:
- Customer cancellation refund API (`/api/v1/customer/bookings/cancellation-refund/:booking_id`)
- Refund calculation logic in `utils/refundCalculator.js`
- Booking cancellation confirmation process

### 7. Testing

Use the provided test script:
```bash
npm run test:cancellation-policy
```

This will test all the new admin API endpoints with sample data.

### 8. Deployment Notes

1. Run the migration to create the policy settings table
2. Default settings will be automatically created
3. Existing bookings will continue to work with default settings
4. New bookings will use the current active settings

### 9. Security Considerations

- All admin endpoints require authentication
- Policy changes are logged for audit purposes
- Input validation prevents invalid settings
- Only one active setting per policy type is allowed

## Example Admin Interface Flow

1. **Admin logs in** to the admin panel
2. **Navigates to** "Booking Management" > "Cancellation Policies"
3. **Selects policy type** (Flexible or Standard)
4. **Updates settings** using the form interface
5. **Saves changes** which immediately affect new bookings
6. **Views history** of previous changes if needed

The system automatically applies the new settings to all future cancellation calculations while maintaining backward compatibility with existing bookings.
