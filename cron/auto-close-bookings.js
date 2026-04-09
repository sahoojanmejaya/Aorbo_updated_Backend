require('dotenv').config();
const db = require('../src/config/db');

async function autoCloseBookings() {
    console.log('🤖 STARTING AUTO-CLOSE CRON JOB');
    console.log('='.repeat(50));

    const conn = await db.getConnection();

    try {
        await conn.beginTransaction();

        // 1. Find arrival-completed batches
        // We assume 30 minutes buffer after end_date to be safe
        const [batches] = await conn.query(`
      SELECT id, tbr_id, end_date 
      FROM batches 
      WHERE end_date < DATE_SUB(NOW(), INTERVAL 30 MINUTE)
    `);

        if (batches.length === 0) {
            console.log('✅ No completed batches found needing processing.');
            await conn.commit();
            process.exit(0);
        }

        const batchIds = batches.map(b => b.id);
        console.log(`Found ${batches.length} completed batches. Checking bookings...`);

        // 2. Find unpaid bookings in these batches that are NOT auto-closed
        // Using a tolerance check for balance
        const [bookings] = await conn.query(`
      SELECT b.id, b.total_amount, b.paidAmount, b.customer_id, b.batch_id
      FROM bookings b
      WHERE b.batch_id IN (?)
        AND (b.total_amount - b.paidAmount) > 1  -- Balance > 1 Rupee
        AND b.is_auto_closed = 0
        AND b.status = 'confirmed'
    `, [batchIds]);

        console.log(`Found ${bookings.length} overdue bookings to auto-close.`);

        if (bookings.length === 0) {
            console.log('✅ All bookings in completed batches are paid or already closed.');
            await conn.commit();
            process.exit(0);
        }

        // 3. Process each booking
        const results = [];
        for (const booking of bookings) {
            console.log(`Processing Booking #${booking.id} (Balance: ${booking.total_amount - booking.paidAmount})`);

            // 3.1 Mark as Auto-Paid (Vendor Silent Close)
            // We set payment_status to 'auto_paid' or keep 'pending' but mark is_auto_closed
            // Requirement: "set status=paid_auto and create auto_close audit record"
            // Note: 'paid_auto' might not be in enum, using 'completed' with flag

            const balance = booking.total_amount - booking.paidAmount;

            await conn.query(`
        UPDATE bookings 
        SET 
          is_auto_closed = 1, 
          auto_close_reason = 'arrival_complete_no_vendor_mark',
          auto_closed_at = NOW(),
          payment_status = 'completed', 
          paidAmount = total_amount  -- Mark as fully paid
        WHERE id = ?
      `, [booking.id]);

            // 3.2 Audit Log
            await conn.query(`
        INSERT INTO booking_audit_log (
          booking_id, action_type, actor_type, actor_id, metadata, created_at
        ) VALUES (?, 'auto_close', 'system', NULL, ?, NOW())
      `, [
                booking.id,
                JSON.stringify({
                    reason: 'arrival_complete_no_vendor_mark',
                    balance_cleared: balance
                })
            ]);

            // 3.3 Auto Close Record
            await conn.query(`
        INSERT INTO auto_close_records (
          booking_id, reason, balance_amount, trek_arrival_time, can_dispute_until, created_at
        ) VALUES (?, 'arrival_complete_no_vendor_mark', ?, 
          (SELECT end_date FROM batches WHERE id = ?),
          DATE_ADD(NOW(), INTERVAL 48 HOUR), -- 48h Dispute TTL
          NOW()
        )
      `, [
                booking.id, balance, booking.batch_id
            ]);

            results.push(booking.id);
        }

        await conn.commit();
        console.log(`\n✨ Successfully auto-closed ${results.length} bookings:`, results);

    } catch (e) {
        await conn.rollback();
        console.error('❌ CRITICAL ERROR:', e);
        process.exit(1);
    } finally {
        conn.release();
        process.exit(0);
    }
}

autoCloseBookings();
