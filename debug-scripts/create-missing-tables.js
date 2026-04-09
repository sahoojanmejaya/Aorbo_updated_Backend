/**
 * Missing Tables Creation Script
 * 
 * @description Creates missing database tables for new models
 * @author Kiro AI Assistant
 * @created 2026-03-09 16:28:00 IST
 * @updated 2026-03-09 16:28:00 IST
 * 
 * Usage: node create-missing-tables.js
 */

const { sequelize } = require('./models');

async function createMissingTables() {
    try {
        console.log('🚀 Creating missing database tables...');
        console.log('📅 Timestamp:', new Date().toISOString());
        
        // Test database connection
        await sequelize.authenticate();
        console.log('✅ Database connection established');
        
        // Create coupon_redemptions table
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS coupon_redemptions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                coupon_id INT NOT NULL,
                customer_id INT NOT NULL,
                booking_id INT NULL,
                discount_amount DECIMAL(10,2) NOT NULL,
                original_amount DECIMAL(10,2) NOT NULL,
                final_amount DECIMAL(10,2) NOT NULL,
                status ENUM('pending', 'used', 'expired', 'cancelled') NOT NULL DEFAULT 'pending',
                redeemed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                used_at DATETIME NULL,
                notes TEXT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                INDEX idx_coupon_redemptions_coupon_id (coupon_id),
                INDEX idx_coupon_redemptions_customer_id (customer_id),
                INDEX idx_coupon_redemptions_booking_id (booking_id),
                INDEX idx_coupon_redemptions_status (status),
                INDEX idx_coupon_redemptions_redeemed_at (redeemed_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            COMMENT='Tracks coupon redemptions by customers'
        `);
        console.log('✅ coupon_redemptions table created');
        
        // Create commission_logs table
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS commission_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                vendor_id INT NOT NULL,
                booking_id INT NOT NULL,
                trek_id INT NOT NULL,
                booking_amount DECIMAL(10,2) NOT NULL,
                commission_rate DECIMAL(5,2) NOT NULL,
                commission_amount DECIMAL(10,2) NOT NULL,
                status ENUM('pending', 'paid', 'cancelled', 'disputed') NOT NULL DEFAULT 'pending',
                payment_reference VARCHAR(100) NULL,
                paid_at DATETIME NULL,
                notes TEXT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                INDEX idx_commission_logs_vendor_id (vendor_id),
                INDEX idx_commission_logs_booking_id (booking_id),
                INDEX idx_commission_logs_trek_id (trek_id),
                INDEX idx_commission_logs_status (status),
                INDEX idx_commission_logs_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            COMMENT='Tracks commission calculations and payments'
        `);
        console.log('✅ commission_logs table created');
        
        // Ensure withdrawals table exists with correct structure
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS withdrawals (
                id INT AUTO_INCREMENT PRIMARY KEY,
                withdrawal_id VARCHAR(50) NOT NULL UNIQUE,
                vendor_id INT NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                tbrs_count INT NOT NULL DEFAULT 0,
                status ENUM('pending', 'approved', 'rejected', 'processing', 'completed') NOT NULL DEFAULT 'pending',
                notes TEXT NULL,
                rejection_reason TEXT NULL,
                withdrawal_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                status_change_date DATETIME NULL,
                approved_at DATETIME NULL,
                approved_by INT NULL,
                rejected_at DATETIME NULL,
                rejected_by INT NULL,
                approval_notes TEXT NULL,
                transaction_id VARCHAR(100) NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                INDEX idx_withdrawals_vendor_id (vendor_id),
                INDEX idx_withdrawals_status (status),
                INDEX idx_withdrawals_withdrawal_date (withdrawal_date),
                INDEX idx_withdrawals_approved_by (approved_by),
                INDEX idx_withdrawals_rejected_by (rejected_by)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            COMMENT='Vendor withdrawal requests and processing'
        `);
        console.log('✅ withdrawals table created/updated');
        
        console.log('🎉 All missing tables created successfully!');
        console.log('📋 Summary:');
        console.log('   - coupon_redemptions: Tracks coupon usage');
        console.log('   - commission_logs: Tracks vendor commissions');
        console.log('   - withdrawals: Vendor withdrawal requests');
        console.log('   - All tables have proper indexes for performance');
        
    } catch (error) {
        console.error('❌ Failed to create missing tables:', error.message);
        console.error('📋 Error details:', error);
        process.exit(1);
    } finally {
        await sequelize.close();
        console.log('🔌 Database connection closed');
        process.exit(0);
    }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Run the table creation
createMissingTables();