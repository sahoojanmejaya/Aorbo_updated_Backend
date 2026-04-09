-- ============================================================================
-- BOOKING PAYMENT SYSTEM - DATABASE MIGRATIONS
-- ============================================================================
-- This file contains all SQL statements to add missing payment, dispute,
-- and audit features to the existing database schema.
-- ============================================================================

-- ============================================================================
-- PHASE 1: ALTER EXISTING TABLES
-- ============================================================================

-- 1.1 ALTER issue_reports (Add Dispute Management Fields)
-- ----------------------------------------------------------------------------
ALTER TABLE issue_reports
ADD COLUMN claimant ENUM('customer', 'vendor', 'admin') DEFAULT 'customer' AFTER customer_id,
ADD COLUMN dispute_type ENUM('balance_issue', 'double_payment', 'vendor_collection', 'refund_dispute', 'payment_mismatch', 'other') AFTER issue_type,
ADD COLUMN evidence_urls JSON COMMENT 'Array of attachment URLs' AFTER description,
ADD COLUMN proof_hash VARCHAR(255) COMMENT 'Hash of evidence for verification' AFTER evidence_urls,
ADD COLUMN locks_refund TINYINT(1) DEFAULT 0 COMMENT 'Blocks automatic refunds when 1' AFTER disputed_amount,
ADD COLUMN vendor_id INT COMMENT 'Vendor involved in dispute' AFTER customer_id,
ADD COLUMN resolved_by INT COMMENT 'Admin who resolved' AFTER assigned_to,
ADD COLUMN idempotency_token VARCHAR(255) UNIQUE COMMENT 'Prevent duplicate disputes' AFTER id,
ADD INDEX idx_dispute_status (status, locks_refund),
ADD INDEX idx_claimant (claimant, created_at);

-- 1.2 ALTER bookings (Add Auto-Close & Audit Fields)
-- ----------------------------------------------------------------------------
ALTER TABLE bookings
ADD COLUMN is_auto_closed TINYINT(1) DEFAULT 0 COMMENT 'Vendor Silent Close flag' AFTER status,
ADD COLUMN auto_close_reason VARCHAR(255) COMMENT 'Why auto-closed' AFTER is_auto_closed,
ADD COLUMN auto_closed_at DATETIME COMMENT 'When auto-closed' AFTER auto_close_reason,
ADD COLUMN has_active_dispute TINYINT(1) DEFAULT 0 COMMENT 'Has open dispute' AFTER auto_closed_at,
ADD COLUMN policy_version VARCHAR(50) COMMENT 'Cancellation policy version' AFTER cancellation_policy_type,
ADD COLUMN settlement_verified_at DATETIME COMMENT 'When payment settlement verified' AFTER payment_status,
ADD COLUMN idempotency_token VARCHAR(255) UNIQUE COMMENT 'Prevent duplicate operations' AFTER id,
ADD INDEX idx_auto_close (is_auto_closed, auto_closed_at),
ADD INDEX idx_dispute (has_active_dispute);

-- ============================================================================
-- PHASE 2: CREATE NEW TABLES
-- ============================================================================

-- 2.1 CREATE booking_payments (Multiple Payment Records)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  booking_id INT NOT NULL COMMENT 'FK to bookings',
  payment_type ENUM('advance', 'balance_online', 'balance_offline') NOT NULL,
  amount DECIMAL(10,2) NOT NULL COMMENT 'Actual amount',
  claimed_amount DECIMAL(10,2) NULL COMMENT 'Amount vendor claims collected',
  accepted_amount DECIMAL(10,2) NULL COMMENT 'Amount system accepts (capped to balance)',
  method ENUM('cash', 'UPI', 'card', 'netbanking', 'wallet', 'other') NOT NULL,
  txn_id VARCHAR(255) NULL COMMENT 'Gateway transaction ID or UPI ref',
  ref_no VARCHAR(255) NULL COMMENT 'Vendor reference number',
  attachment_url VARCHAR(500) NULL COMMENT 'Photo/receipt URL',
  proof_hash VARCHAR(255) NULL COMMENT 'SHA256 hash of proof',
  settlement_status ENUM('pending', 'settled', 'failed', 'refunded') DEFAULT 'pending',
  vendor_user_id INT NULL COMMENT 'Vendor who marked collection',
  marked_at DATETIME NULL COMMENT 'When vendor marked collected',
  evidence_status ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
  notes TEXT NULL COMMENT 'Additional notes',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  INDEX idx_booking_payment (booking_id, payment_type),
  INDEX idx_settlement (settlement_status),
  INDEX idx_vendor_marked (vendor_user_id, marked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Multiple payment records per booking';

-- 2.2 CREATE booking_audit_log (Immutable Audit Trail)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_audit_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  booking_id INT NOT NULL COMMENT 'FK to bookings',
  action_type ENUM(
    'payment_received', 
    'payment_marked', 
    'auto_close', 
    'refund_issued', 
    'dispute_opened', 
    'dispute_resolved', 
    'status_change',
    'vendor_claim_approved',
    'vendor_claim_rejected',
    'settlement_verified'
  ) NOT NULL,
  actor_id INT NULL COMMENT 'User/vendor/admin who performed action',
  actor_type ENUM('customer', 'vendor', 'admin', 'system') NOT NULL,
  before_state JSON NULL COMMENT 'State before action',
  after_state JSON NULL COMMENT 'State after action',
  idempotency_token VARCHAR(255) NULL COMMENT 'Prevent duplicate operations',
  metadata JSON NULL COMMENT 'Additional context (amounts, reasons, etc)',
  ip_address VARCHAR(45) NULL COMMENT 'IP address of actor',
  user_agent VARCHAR(500) NULL COMMENT 'User agent string',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  INDEX idx_booking_audit (booking_id, created_at DESC),
  INDEX idx_action_type (action_type, created_at DESC),
  INDEX idx_actor (actor_type, actor_id),
  INDEX idx_idempotency (idempotency_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Immutable audit trail for all booking operations';

-- 2.3 CREATE auto_close_records (Track Auto-Closed Bookings)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auto_close_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  booking_id INT NOT NULL UNIQUE COMMENT 'FK to bookings',
  reason ENUM(
    'arrival_complete_no_vendor_mark',
    'vendor_silent_close',
    'timeout_no_payment'
  ) NOT NULL,
  balance_amount DECIMAL(10,2) NOT NULL COMMENT 'Amount auto-marked as paid',
  trek_arrival_time DATETIME NOT NULL COMMENT 'When trek arrived',
  auto_closed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  can_dispute_until DATETIME NOT NULL COMMENT 'Dispute TTL',
  is_disputed TINYINT(1) DEFAULT 0,
  dispute_id INT NULL COMMENT 'FK to issue_reports if disputed',
  reversal_status ENUM('active', 'reversed', 'confirmed') DEFAULT 'active',
  reversed_at DATETIME NULL,
  reversed_by INT NULL COMMENT 'Admin who reversed',
  reversal_reason TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (dispute_id) REFERENCES issue_reports(id) ON DELETE SET NULL,
  INDEX idx_dispute_ttl (can_dispute_until),
  INDEX idx_reversal (reversal_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Track vendor silent close cases';

-- 2.4 CREATE overpayment_records (Track Overpayments)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS overpayment_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  booking_id INT NOT NULL COMMENT 'FK to bookings',
  expected_amount DECIMAL(10,2) NOT NULL,
  received_amount DECIMAL(10,2) NOT NULL,
  overpay_amount DECIMAL(10,2) NOT NULL COMMENT 'received - expected',
  payment_id INT NULL COMMENT 'FK to booking_payments',
  refund_status ENUM('pending', 'processed', 'wallet_credit', 'cancelled') DEFAULT 'pending',
  refund_method ENUM('original_source', 'wallet', 'manual') NULL,
  refund_txn_id VARCHAR(255) NULL,
  refunded_at DATETIME NULL,
  notes TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (payment_id) REFERENCES booking_payments(id) ON DELETE SET NULL,
  INDEX idx_refund_status (refund_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Track and manage overpayments';

-- ============================================================================
-- PHASE 3: CREATE CONFIGURATION TABLE
-- ============================================================================

-- 3.1 CREATE system_config (Feature Flags & Settings)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  config_key VARCHAR(100) UNIQUE NOT NULL,
  config_value TEXT NOT NULL,
  data_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
  description TEXT NULL,
  updated_by INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='System configuration and feature flags';

-- Insert default configurations
INSERT INTO system_config (config_key, config_value, data_type, description) VALUES
('auto_refund_overpay', 'true', 'boolean', 'Automatically refund overpayments'),
('dispute_ttl_hours', '48', 'number', 'Hours after arrival to allow disputes'),
('auto_close_enabled', 'true', 'boolean', 'Enable auto-close at arrival complete'),
('vendor_mark_after_start', 'true', 'boolean', 'Allow vendor to mark collected after trek start'),
('settlement_verification_required', 'true', 'boolean', 'Verify settlement before refunds')
ON DUPLICATE KEY UPDATE config_value=VALUES(config_value);

-- ============================================================================
-- PHASE 4: DATA MIGRATION (Optional - Update Existing Records)
-- ============================================================================

-- 4.1 Set default policy_version for existing bookings
-- ----------------------------------------------------------------------------
UPDATE bookings 
SET policy_version = 'v1.0' 
WHERE policy_version IS NULL;

-- 4.2 Create audit records for existing bookings (optional)
-- ----------------------------------------------------------------------------
-- INSERT INTO booking_audit_log (booking_id, action_type, actor_type, metadata)
-- SELECT id, 'status_change', 'system', JSON_OBJECT('status', status, 'note', 'Migrated from legacy')
-- FROM bookings
-- WHERE created_at < '2026-01-22';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check new columns in issue_reports
SELECT COLUMN_NAME, COLUMN_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'aorbo_trekking' 
  AND TABLE_NAME = 'issue_reports'
  AND COLUMN_NAME IN ('claimant', 'dispute_type', 'evidence_urls', 'locks_refund');

-- Check new columns in bookings
SELECT COLUMN_NAME, COLUMN_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'aorbo_trekking' 
  AND TABLE_NAME = 'bookings'
  AND COLUMN_NAME IN ('is_auto_closed', 'has_active_dispute', 'policy_version');

-- Check new tables
SELECT TABLE_NAME 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = 'aorbo_trekking' 
  AND TABLE_NAME IN ('booking_payments', 'booking_audit_log', 'auto_close_records', 'overpayment_records');

-- ============================================================================
-- END OF MIGRATIONS
-- ============================================================================
