# Database Scripts - Cancellation Policy System

## Overview
This document lists all the database-related scripts available in `package.json` for managing the cancellation policy system. These scripts ensure proper database setup and migration for the new configurable cancellation policies.

## Available Scripts

### **1. Individual Migration Scripts**

#### **Booking Fields Migration**
```bash
npm run migrate:cancellation-policy
```
- **Purpose**: Adds cancellation policy fields to the `bookings` table
- **Migration File**: `add_cancellation_policy_fields_to_bookings.js`
- **Fields Added**:
  - `cancellation_policy_type` (ENUM: 'flexible', 'standard')
  - `advance_amount` (DECIMAL)
  - `policy_version` (STRING)
  - `deduction_amount` (DECIMAL)
  - `refund_amount` (DECIMAL)
  - `cancellation_rule` (TEXT)
  - Updates `payment_status` ENUM to include 'advance_only' and 'full_paid'

#### **Policy Settings Table Migration**
```bash
npm run migrate:policy-settings
```
- **Purpose**: Creates the `cancellation_policy_settings` table
- **Migration File**: `create_cancellation_policy_settings_table.js`
- **Table Structure**:
  - Stores configurable settings for both flexible and standard policies
  - Includes all deduction percentages and refund rules
  - Supports policy versioning and history tracking

### **2. Combined Migration Script**

#### **Complete Cancellation System Migration**
```bash
npm run migrate:cancellation-system
```
- **Purpose**: Runs both booking fields and policy settings migrations
- **Execution Order**:
  1. First: `migrate:cancellation-policy` (booking fields)
  2. Second: `migrate:policy-settings` (policy settings table)
- **Use Case**: One-command setup for the entire cancellation policy system

### **3. Setup Script with Default Data**

#### **Complete System Setup**
```bash
npm run setup:cancellation-policies
```
- **Purpose**: Creates policy settings table and inserts default values
- **What it does**:
  - Creates `cancellation_policy_settings` table with proper indexes
  - Inserts default settings for both flexible and standard policies
  - Sets up proper database structure for the policy system
- **Default Settings**:
  - **Flexible Policy**: Advance non-refundable (TRUE), 24h deduction (100%)
  - **Standard Policy**: 72h+ (20%), 48-72h (50%), 24-48h (70%), <24h (100%)

### **4. General Migration Scripts**

#### **Full Migration (All Pending)**
```bash
npm run migrate:live
```
- **Purpose**: Runs all pending migrations in production
- **Use Case**: Deploy all database changes including cancellation policies

#### **Migration Status Check**
```bash
npm run deploy:check-migrations
```
- **Purpose**: Shows status of all migrations
- **Use Case**: Verify which migrations have been applied

## Database Schema Changes

### **New Table: `cancellation_policy_settings`**
```sql
CREATE TABLE cancellation_policy_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    policy_type ENUM('flexible', 'standard') NOT NULL,
    flexible_advance_non_refundable BOOLEAN NOT NULL DEFAULT TRUE,
    flexible_full_payment_24h_deduction INT NOT NULL DEFAULT 100,
    standard_72h_plus_deduction INT NOT NULL DEFAULT 20,
    standard_48_72h_deduction INT NOT NULL DEFAULT 50,
    standard_24_48h_deduction INT NOT NULL DEFAULT 70,
    standard_under_24h_deduction INT NOT NULL DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_policy_type (policy_type),
    INDEX idx_is_active (is_active)
);
```

### **Updated Table: `bookings`**
```sql
-- New columns added:
ALTER TABLE bookings ADD COLUMN cancellation_policy_type ENUM('flexible', 'standard');
ALTER TABLE bookings ADD COLUMN advance_amount DECIMAL(10, 2) DEFAULT 0.0;
ALTER TABLE bookings ADD COLUMN policy_version VARCHAR(255);
ALTER TABLE bookings ADD COLUMN deduction_amount DECIMAL(10, 2);
ALTER TABLE bookings ADD COLUMN refund_amount DECIMAL(10, 2);
ALTER TABLE bookings ADD COLUMN cancellation_rule TEXT;

-- Updated payment_status enum:
ALTER TABLE bookings MODIFY COLUMN payment_status ENUM(
    'pending', 'partial', 'completed', 'failed', 'refunded', 
    'advance_only', 'full_paid'
) DEFAULT 'pending';
```

## Deployment Instructions

### **For New Deployments:**
```bash
# Run all migrations
npm run deploy:migrate

# Or run cancellation system specifically
npm run migrate:cancellation-system
```

### **For Existing Systems:**
```bash
# Check current migration status
npm run deploy:check-migrations

# Run cancellation system migrations
npm run migrate:cancellation-system

# Or use the setup script for complete setup
npm run setup:cancellation-policies
```

### **For Development:**
```bash
# Run individual migrations
npm run migrate:cancellation-policy
npm run migrate:policy-settings

# Or run all pending migrations
npm run migrate:live
```

## Default Policy Settings

After running the setup script, the following default settings are available:

### **Flexible Policy Defaults:**
- Advance Non-Refundable: `true`
- 24h Deduction: `100%`

### **Standard Policy Defaults:**
- 72h+ Deduction: `20%`
- 48-72h Deduction: `50%`
- 24-48h Deduction: `70%`
- Under 24h Deduction: `100%`

## Verification Commands

### **Check Table Creation:**
```sql
SHOW TABLES LIKE '%cancellation%';
DESCRIBE cancellation_policy_settings;
DESCRIBE bookings;
```

### **Check Default Data:**
```sql
SELECT * FROM cancellation_policy_settings WHERE is_active = TRUE;
```

### **Check Booking Fields:**
```sql
SHOW COLUMNS FROM bookings LIKE '%cancellation%';
SHOW COLUMNS FROM bookings LIKE '%advance%';
SHOW COLUMNS FROM bookings LIKE '%payment_status%';
```

## Troubleshooting

### **If Migrations Fail:**
1. Check migration status: `npm run deploy:check-migrations`
2. Run individual migrations: `npm run migrate:cancellation-policy`
3. Use setup script as fallback: `npm run setup:cancellation-policies`

### **If Table Already Exists:**
The setup script uses `CREATE TABLE IF NOT EXISTS` and `INSERT IGNORE`, so it's safe to run multiple times.

### **If Data is Missing:**
Run the setup script to ensure default policy settings are inserted: `npm run setup:cancellation-policies`

## Production Deployment Checklist

- [ ] Run `npm run deploy:check-migrations` to check current status
- [ ] Run `npm run migrate:cancellation-system` to apply changes
- [ ] Verify tables exist: `SHOW TABLES LIKE '%cancellation%'`
- [ ] Verify default settings: `SELECT * FROM cancellation_policy_settings`
- [ ] Test admin interface policy configuration
- [ ] Test customer cancellation API with new policies

All database changes for the cancellation policy system are now properly documented and scripted in the package.json file!
