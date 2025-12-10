const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixDuplicateTreks() {
    let connection;
    
    try {
        // Create database connection
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'aorbo_trekking'
        });

        console.log('Connected to database successfully');

        // Find all duplicate vendor-destination-active combinations
        const [duplicates] = await connection.execute(`
            SELECT vendor_id, destination_id, status, COUNT(*) as count
            FROM treks 
            WHERE status = 'active'
            GROUP BY vendor_id, destination_id, status 
            HAVING COUNT(*) > 1
        `);

        console.log(`Found ${duplicates.length} duplicate combinations:`);
        duplicates.forEach(dup => {
            console.log(`Vendor ${dup.vendor_id}, Destination ${dup.destination_id}: ${dup.count} active treks`);
        });

        // Process each duplicate combination
        for (const dup of duplicates) {
            console.log(`\nProcessing vendor ${dup.vendor_id}, destination ${dup.destination_id}...`);
            
            // Get all treks for this combination
            const [treks] = await connection.execute(`
                SELECT id, title, created_at, updated_at, status
                FROM treks 
                WHERE vendor_id = ? AND destination_id = ? AND status = ?
                ORDER BY created_at
            `, [dup.vendor_id, dup.destination_id, dup.status]);

            console.log(`Found ${treks.length} treks for this combination`);

            // Keep the first (oldest) trek as active, mark others as inactive
            if (treks.length > 1) {
                const keepActive = treks[0]; // First trek (oldest)
                const markInactive = treks.slice(1); // All other treks

                console.log(`Keeping trek ${keepActive.id} (${keepActive.title}) as active`);
                console.log(`Marking ${markInactive.length} treks as inactive`);

                // Update other treks to inactive status
                for (const trek of markInactive) {
                    await connection.execute(`
                        UPDATE treks 
                        SET status = 'deactive', updated_at = NOW()
                        WHERE id = ?
                    `, [trek.id]);
                    
                    console.log(`Updated trek ${trek.id} (${trek.title}) to deactive`);
                }
            }
        }

        // Verify the fix
        console.log('\nVerifying fix...');
        const [verification] = await connection.execute(`
            SELECT vendor_id, destination_id, status, COUNT(*) as count
            FROM treks 
            WHERE status = 'active'
            GROUP BY vendor_id, destination_id, status 
            HAVING COUNT(*) > 1
        `);

        if (verification.length === 0) {
            console.log('✅ All duplicate active treks have been resolved!');
            console.log('You can now run the database sync without issues.');
        } else {
            console.log('❌ Some duplicates still exist:');
            verification.forEach(dup => {
                console.log(`Vendor ${dup.vendor_id}, Destination ${dup.destination_id}: ${dup.count} active treks`);
            });
        }

    } catch (error) {
        console.error('Error fixing duplicate treks:', error);
    } finally {
        if (connection) {
            await connection.end();
            console.log('Database connection closed');
        }
    }
}

// Run the fix
fixDuplicateTreks().catch(console.error);
