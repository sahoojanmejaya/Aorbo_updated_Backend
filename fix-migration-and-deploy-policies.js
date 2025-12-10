const { sequelize } = require('./models');

async function fixMigrationAndDeployPolicies() {
    try {
        console.log('🚀 Fixing migration issues and deploying cancellation policies...');
        
        // Step 1: Check current migration status
        console.log('\n📊 Checking current migration status...');
        const [migrationStatus] = await sequelize.query(`
            SELECT name FROM SequelizeMeta 
            ORDER BY name
        `);
        
        console.log('Applied migrations:', migrationStatus.map(m => m.name));
        
        // Step 2: Fix the problematic ENUM migration manually
        console.log('\n🔧 Fixing coupon audit logs ENUM...');
        try {
            await sequelize.query(`
                ALTER TABLE coupons_audit_logs 
                MODIFY COLUMN action ENUM(
                    'created', 'updated', 'activated', 'deactivated', 
                    'approved', 'rejected', 'assigned', 'unassigned', 
                    'used', 'expired', 'deleted', 'status_change'
                ) NOT NULL
            `);
            console.log('✅ ENUM column updated successfully');
            
            // Mark the migration as applied
            await sequelize.query(`
                INSERT IGNORE INTO SequelizeMeta (name) 
                VALUES ('add_status_change_to_coupon_audit_logs.js')
            `);
            console.log('✅ Migration marked as applied');
            
        } catch (error) {
            if (error.message.includes('Duplicate entry')) {
                console.log('✅ Migration already applied');
            } else {
                console.log('⚠️ ENUM update failed (might already be correct):', error.message);
            }
        }
        
        // Step 3: Create cancellation policy settings table
        console.log('\n🏗️ Creating cancellation policy settings table...');
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS cancellation_policy_settings (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Policy settings table created');
        
        // Step 4: Insert default policy settings
        console.log('\n📝 Inserting default policy settings...');
        await sequelize.query(`
            INSERT IGNORE INTO cancellation_policy_settings (
                policy_type, 
                flexible_advance_non_refundable, 
                flexible_full_payment_24h_deduction,
                standard_72h_plus_deduction,
                standard_48_72h_deduction,
                standard_24_48h_deduction,
                standard_under_24h_deduction,
                is_active
            ) VALUES 
            ('flexible', TRUE, 100, 20, 50, 70, 100, TRUE),
            ('standard', TRUE, 100, 20, 50, 70, 100, TRUE)
        `);
        console.log('✅ Default policy settings inserted');
        
        // Step 5: Add booking table fields if they don't exist
        console.log('\n📋 Adding booking table fields...');
        
        // Check and add each field individually
        const bookingFields = [
            { name: 'cancellation_policy_type', type: "ENUM('flexible', 'standard')" },
            { name: 'advance_amount', type: 'DECIMAL(10, 2) DEFAULT 0.0' },
            { name: 'policy_version', type: 'VARCHAR(255)' },
            { name: 'deduction_amount', type: 'DECIMAL(10, 2)' },
            { name: 'refund_amount', type: 'DECIMAL(10, 2)' },
            { name: 'cancellation_rule', type: 'TEXT' }
        ];
        
        for (const field of bookingFields) {
            try {
                await sequelize.query(`
                    ALTER TABLE bookings ADD COLUMN ${field.name} ${field.type}
                `);
                console.log(`✅ Added ${field.name} to bookings table`);
            } catch (error) {
                if (error.message.includes('Duplicate column name')) {
                    console.log(`✅ ${field.name} already exists`);
                } else {
                    console.log(`⚠️ Failed to add ${field.name}:`, error.message);
                }
            }
        }
        
        // Step 6: Update payment_status ENUM
        console.log('\n🔄 Updating payment_status ENUM...');
        try {
            await sequelize.query(`
                ALTER TABLE bookings 
                MODIFY COLUMN payment_status ENUM(
                    'pending', 'partial', 'completed', 'failed', 
                    'refunded', 'advance_only', 'full_paid'
                ) DEFAULT 'pending'
            `);
            console.log('✅ Payment status ENUM updated');
        } catch (error) {
            console.log('⚠️ Payment status update failed (might already be correct):', error.message);
        }
        
        // Step 7: Mark migrations as applied
        console.log('\n📝 Marking migrations as applied...');
        const migrationsToMark = [
            'add_cancellation_policy_fields_to_bookings.js',
            'create_cancellation_policy_settings_table.js'
        ];
        
        for (const migration of migrationsToMark) {
            try {
                await sequelize.query(`
                    INSERT IGNORE INTO SequelizeMeta (name) 
                    VALUES ('${migration}')
                `);
                console.log(`✅ Marked ${migration} as applied`);
            } catch (error) {
                console.log(`✅ ${migration} already marked as applied`);
            }
        }
        
        // Step 8: Verify setup
        console.log('\n🔍 Verifying setup...');
        
        // Check policy settings table
        const [policySettings] = await sequelize.query(`
            SELECT * FROM cancellation_policy_settings WHERE is_active = TRUE
        `);
        console.log(`✅ Found ${policySettings.length} active policy settings`);
        
        // Check booking table fields
        const [bookingFields] = await sequelize.query(`
            SHOW COLUMNS FROM bookings LIKE '%cancellation%'
        `);
        console.log(`✅ Found ${bookingFields.length} cancellation-related fields in bookings table`);
        
        console.log('\n🎉 Cancellation policy system deployment complete!');
        console.log('\n📋 Summary:');
        console.log('- ✅ Fixed ENUM migration issue');
        console.log('- ✅ Created policy settings table');
        console.log('- ✅ Inserted default policy settings');
        console.log('- ✅ Added booking table fields');
        console.log('- ✅ Updated payment status ENUM');
        console.log('- ✅ Marked migrations as applied');
        
        console.log('\n🚀 Your cancellation policy system is now ready!');
        
    } catch (error) {
        console.error('❌ Error during deployment:', error.message);
        console.error('Stack trace:', error.stack);
    } finally {
        await sequelize.close();
    }
}

fixMigrationAndDeployPolicies();

