/**
 * Audit Logs Table Creation Script
 * 
 * @description Creates the audit_logs table if it doesn't exist
 * @author Kiro AI Assistant
 * @created 2026-03-09 16:04:00 IST
 * @updated 2026-03-09 16:04:00 IST
 * 
 * Usage: node create-audit-logs-table.js
 */

const { sequelize } = require('./models');

async function createAuditLogsTable() {
    try {
        console.log('🚀 Creating audit_logs table...');
        console.log('📅 Timestamp:', new Date().toISOString());
        
        // Test database connection
        await sequelize.authenticate();
        console.log('✅ Database connection established');
        
        // Create audit_logs table
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id VARCHAR(36) PRIMARY KEY,
                timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                performer_id INT NULL,
                performer_name VARCHAR(255) NULL,
                action VARCHAR(255) NOT NULL,
                entity_id VARCHAR(255) NULL,
                entity_name VARCHAR(255) NULL,
                details JSON NULL,
                module VARCHAR(100) NULL,
                ip_address VARCHAR(45) NULL,
                user_agent TEXT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                INDEX idx_audit_timestamp (timestamp),
                INDEX idx_audit_performer (performer_id),
                INDEX idx_audit_module (module),
                INDEX idx_audit_action (action),
                INDEX idx_audit_entity (entity_id),
                INDEX idx_audit_module_action (module, action)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            COMMENT='System audit log for tracking all admin and user actions'
        `);
        
        console.log('✅ audit_logs table created successfully!');
        console.log('📋 Table structure:');
        console.log('   - id: Primary key (UUID)');
        console.log('   - timestamp: When the action occurred');
        console.log('   - performer_id: User who performed the action');
        console.log('   - performer_name: Name of the user');
        console.log('   - action: What action was performed');
        console.log('   - entity_id: ID of the affected entity');
        console.log('   - entity_name: Name/type of the affected entity');
        console.log('   - details: JSON details of the action');
        console.log('   - module: Which module/feature (VENDOR, BATCH, etc.)');
        console.log('   - ip_address: IP address of the performer');
        console.log('   - user_agent: Browser/client information');
        console.log('   - Indexes: Optimized for common queries');
        
        // Insert a sample audit log entry
        await sequelize.query(`
            INSERT INTO audit_logs (
                id, timestamp, performer_name, action, entity_name, 
                details, module, ip_address
            ) VALUES (
                UUID(), NOW(), 'System', 'TABLE_CREATED', 'audit_logs',
                '{"message": "Audit logs table created successfully", "version": "1.0.0"}',
                'SYSTEM', '127.0.0.1'
            )
        `);
        
        console.log('✅ Sample audit log entry created');
        
    } catch (error) {
        console.error('❌ Failed to create audit_logs table:', error.message);
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
createAuditLogsTable();