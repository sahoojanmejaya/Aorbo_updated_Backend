const db = require('../config/db');

exports.getTBRs = async (req, res) => {
    try {
        console.log("Fetching TBRs...");
        // Fetch batches (TBRs) and join with treks and vendors
        const [batches] = await db.query(`
            SELECT 
                b.id,
                b.tbr_id,
                b.trek_id,
                t.vendor_id,
                b.start_date as departure_datetime,
                b.end_date as arrival_datetime,
                b.capacity as slots,
                t.title as trek_name,
                v.business_name as vendor_name,
                'FINANCIALLY_LOCKED' as booking_status -- Default status
            FROM batches b
            JOIN treks t ON b.trek_id = t.id
            JOIN vendors v ON t.vendor_id = v.id
        `);

        console.log(`Found ${batches.length} batches`);

        // For each batch, calculate financials from bookings
        // This is N+1 but efficient enough for low volume. Better to use GROUP BY in future.
        const tbrs = await Promise.all(batches.map(async (batch) => {
            const [bookingStats] = await db.query(`
                SELECT 
                    COUNT(*) as total_bookings,
                    SUM(final_amount) as total_revenue,
                    SUM(gst_amount) as total_gst,
                    SUM(platform_fees) as total_platform_fee
                FROM bookings 
                WHERE batch_id = ? AND status = 'confirmed'
            `, [batch.id]);

            const stats = bookingStats[0];
            const gross = parseFloat(stats.total_revenue || 0);
            const gst = parseFloat(stats.total_gst || 0);
            const platform = parseFloat(stats.total_platform_fee || 0);

            // Standard commission logic (mock example: 10% of gross if not stored)
            const commission = gross * 0.10;
            const vendorShare = gross - commission - platform - gst;

            return {
                id: batch.tbr_id || `TBR-${batch.id}`,
                trek_id: batch.trek_id ? batch.trek_id.toString() : '',
                vendor_id: batch.vendor_id ? batch.vendor_id.toString() : '',
                user_id: 'SYSTEM', // Placeholder
                trek_name: batch.trek_name,
                vendor_name: batch.vendor_name,
                booking_status: batch.booking_status,
                booking_time: batch.departure_datetime, // Using departure as proxy if booking time unavailable
                departure_datetime: batch.departure_datetime,
                arrival_datetime: batch.arrival_datetime,
                settlement_ready_date: batch.end_date, // Assuming ready after end date
                slots: batch.slots,
                // Financials
                base_fare_final: gross,
                gst_final: gst,
                commission_final: commission,
                commission_gst_final: commission * 0.18, // 18% GST on commission
                platform_fee_final: platform,
                tds_final: vendorShare * 0.01, // 1% TDS
                tcs_final: vendorShare * 0.01, // 1% TCS
                cancellation_deduction_final: 0,
                vendor_share_final: vendorShare,
                platform_share_final: commission + platform
            };
        }));

        res.json(tbrs);
    } catch (err) {
        console.error("Error fetching TBRs:", err);
        res.status(500).json({ error: 'Server Error' });
    }
};
