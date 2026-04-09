-- ============================================================================
-- VENDOR PAYOUT SYSTEM TABLES
-- ============================================================================
-- This migration adds tables needed for the vendor payout management system
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. settlements - Tracks vendor payout settlements
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settlements (
    id INT PRIMARY KEY AUTO_INCREMENT,
    vendor_id INT NOT NULL COMMENT 'FK to vendors',
    period_start DATE NOT NULL COMMENT 'Settlement period start date',
    period_end DATE NOT NULL COMMENT 'Settlement period end date',
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Total settlement amount',
    status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    payment_reference VARCHAR(100) COMMENT 'Payment gateway reference',
    payment_date DATETIME COMMENT 'Date when payment was made',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_vendor_id (vendor_id),
    INDEX idx_status (status),
    INDEX idx_period (period_start, period_end),
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Vendor payout settlements tracking';

-- ----------------------------------------------------------------------------
-- 2. withdrawal_requests - Manual withdrawal requests from vendors
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL COMMENT 'FK to users (vendor user)',
    amount DECIMAL(10,2) NOT NULL COMMENT 'Requested withdrawal amount',
    status ENUM('pending', 'approved', 'rejected', 'completed') DEFAULT 'pending',
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME COMMENT 'Date when request was processed',
    processed_by INT COMMENT 'Admin user who processed the request',
    rejection_reason TEXT COMMENT 'Reason for rejection if applicable',
    payment_reference VARCHAR(100) COMMENT 'Payment reference after completion',
    notes TEXT COMMENT 'Additional notes',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_requested_at (requested_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Manual withdrawal requests from vendors';

-- ----------------------------------------------------------------------------
-- 3. Add vendor balance tracking columns to vendors table (if not exists)
-- ----------------------------------------------------------------------------
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS balance_locked DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Locked balance (pending settlements)',
ADD COLUMN IF NOT EXISTS balance_available DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Available balance for withdrawal',
ADD COLUMN IF NOT EXISTS balance_pending_refund DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Balance pending refund processing';

-- ----------------------------------------------------------------------------
-- 4. Add TBR ID to batches table (if not exists)
-- ----------------------------------------------------------------------------
ALTER TABLE batches 
ADD COLUMN IF NOT EXISTS tbr_id VARCHAR(50) COMMENT 'Trek Batch Record ID';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify the tables were created successfully:
-- 
-- SHOW TABLES LIKE 'settlements';
-- SHOW TABLES LIKE 'withdrawal_requests';
-- DESCRIBE settlements;
-- DESCRIBE withdrawal_requests;
-- DESCRIBE vendors;
-- DESCRIBE batches;
-- ============================================================================
