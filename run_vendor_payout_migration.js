const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
    let connection;
    
    try {
        // Create connection
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'aorbo_trekking',
            multipleStatements: true
        });

        console.log('✅ Connected to database');

        // Read migration file
        const migrationPath = path.join(__dirname, 'migrations', '004_vendor_payout_tables.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('📄 Running vendor payout migration...');

        // Execute migration
        await connection.query(sql);

        console.log('✅ Migration completed successfully!');
        console.log('\n📊 Verifying tables...');

        // Verify tables
        const [settlements] = await connection.query("SHOW TABLES LIKE 'settlements'");
        const [withdrawals] = await connection.query("SHOW TABLES LIKE 'withdrawal_requests'");

        if (settlements.length > 0) {
            console.log('  ✓ settlements table created');
        }
        if (withdrawals.length > 0) {
            console.log('  ✓ withdrawal_requests table created');
        }

        // Check vendor columns
        const [vendorColumns] = await connection.query("DESCRIBE vendors");
        const hasBalanceColumns = vendorColumns.some(col => col.Field === 'balance_locked');
        if (hasBalanceColumns) {
            console.log('  ✓ vendor balance columns added');
        }

        // Check batch tbr_id
        const [batchColumns] = await connection.query("DESCRIBE batches");
        const hasTbrId = batchColumns.some(col => col.Field === 'tbr_id');
        if (hasTbrId) {
            console.log('  ✓ batches.tbr_id column added');
        }

        console.log('\n🎉 All vendor payout tables are ready!');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

runMigration();
