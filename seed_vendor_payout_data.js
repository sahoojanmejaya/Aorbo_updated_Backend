const mysql = require('mysql2/promise');
require('dotenv').config();

async function seedVendorPayoutData() {
    let connection;
    
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'aorbo_trekking'
        });

        console.log('✅ Connected to database');
        console.log('\n📊 Seeding vendor payout data...\n');

        // 1. Update vendor balances
        console.log('1️⃣  Setting vendor balances...');
        await connection.query(`
            UPDATE vendors 
            SET 
                balance_locked = FLOOR(RAND() * 50000) + 10000,
                balance_available = FLOOR(RAND() * 30000) + 5000,
                balance_pending_refund = FLOOR(RAND() * 5000)
            WHERE id IN (SELECT DISTINCT vendor_id FROM treks LIMIT 5)
        `);
        console.log('   ✓ Vendor balances updated');

        // 2. Insert sample settlements
        console.log('\n2️⃣  Creating settlement records...');
        
        const [vendors] = await connection.query('SELECT id FROM vendors LIMIT 3');
        
        for (const vendor of vendors) {
            // Create 2-3 settlements per vendor
            const numSettlements = Math.floor(Math.random() * 2) + 2;
            
            for (let i = 0; i < numSettlements; i++) {
                const daysAgo = (i + 1) * 7; // Weekly settlements
                const periodStart = new Date();
                periodStart.setDate(periodStart.getDate() - daysAgo - 7);
                
                const periodEnd = new Date();
                periodEnd.setDate(periodEnd.getDate() - daysAgo);
                
                const amount = (Math.floor(Math.random() * 50000) + 10000).toFixed(2);
                const status = i === 0 ? 'pending' : (Math.random() > 0.3 ? 'completed' : 'processing');
                
                const paymentDate = status === 'completed' ? periodEnd : null;
                const paymentRef = status === 'completed' ? `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}` : null;
                
                await connection.query(`
                    INSERT INTO settlements 
                    (vendor_id, period_start, period_end, total_amount, status, payment_reference, payment_date)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [
                    vendor.id,
                    periodStart.toISOString().split('T')[0],
                    periodEnd.toISOString().split('T')[0],
                    amount,
                    status,
                    paymentRef,
                    paymentDate
                ]);
            }
        }
        console.log(`   ✓ Created settlements for ${vendors.length} vendors`);

        // 3. Insert sample withdrawal requests
        console.log('\n3️⃣  Creating withdrawal requests...');
        
        const [users] = await connection.query(`
            SELECT u.id 
            FROM users u 
            JOIN vendors v ON v.user_id = u.id 
            LIMIT 3
        `);
        
        for (const user of users) {
            const numRequests = Math.floor(Math.random() * 2) + 1;
            
            for (let i = 0; i < numRequests; i++) {
                const daysAgo = (i + 1) * 3;
                const requestedAt = new Date();
                requestedAt.setDate(requestedAt.getDate() - daysAgo);
                
                const amount = (Math.floor(Math.random() * 20000) + 5000).toFixed(2);
                const statuses = ['pending', 'approved', 'completed', 'rejected'];
                const status = statuses[Math.floor(Math.random() * statuses.length)];
                
                const processedAt = status !== 'pending' ? requestedAt : null;
                const paymentRef = status === 'completed' ? `WD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}` : null;
                const rejectionReason = status === 'rejected' ? 'Insufficient balance' : null;
                
                await connection.query(`
                    INSERT INTO withdrawal_requests 
                    (user_id, amount, status, requested_at, processed_at, payment_reference, rejection_reason)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [
                    user.id,
                    amount,
                    status,
                    requestedAt,
                    processedAt,
                    paymentRef,
                    rejectionReason
                ]);
            }
        }
        console.log(`   ✓ Created withdrawal requests for ${users.length} users`);

        // 4. Verify data
        console.log('\n📊 Verification:');
        
        const [[{ settlementCount }]] = await connection.query('SELECT COUNT(*) as settlementCount FROM settlements');
        const [[{ requestCount }]] = await connection.query('SELECT COUNT(*) as requestCount FROM withdrawal_requests');
        const [[{ vendorCount }]] = await connection.query('SELECT COUNT(*) as vendorCount FROM vendors WHERE balance_available > 0');
        
        console.log(`   • Settlements: ${settlementCount}`);
        console.log(`   • Withdrawal Requests: ${requestCount}`);
        console.log(`   • Vendors with balances: ${vendorCount}`);

        console.log('\n✅ Vendor payout seed data created successfully!');
        console.log('\n🚀 You can now start the vendor-payout frontend and see data.');

    } catch (error) {
        console.error('❌ Seeding failed:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

seedVendorPayoutData();
