
const pool = require('../config/db');

exports.getAllTreks = async (req, res) => {
    try {
        const query = `
            SELECT 
                b.tbr_id as id,
                t.id as trek_id,
                t.title as service_name,
                d.name as destination,
                b.start_date as departure,
                b.end_date as arrival,
                t.duration,
                COALESCE(cp.title, 'Standard') as policy,
                -- DYNAMIC SLOT CALCULATION
                (SELECT COALESCE(SUM(b3.total_travelers), 0) 
                 FROM bookings b3 
                 WHERE b3.batch_id = b.id 
                 AND (b.status = 'Cancelled' OR b3.status != 'cancelled')
                ) as slots_booked,
                b.capacity as total_slots,
                (SELECT name FROM badges WHERE id = t.badge_id) as promo_badge,
                b.status,
                t.inclusions,
                t.exclusions,
                v.business_name as vendor_name, 
                JSON_UNQUOTE(JSON_EXTRACT(v.company_info, '$.logo')) as vendor_logo, 
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(v.company_info, '$.premium')), 'None') as vendor_premium, 
                JSON_UNQUOTE(JSON_EXTRACT(v.company_info, '$.credibility')) AS vendor_credibility, 
                u.email AS vendor_email, 
                u.phone AS vendor_contact, 
                v.created_at AS vendor_joined,
                c.name AS captain_name, c.email AS captain_email, c.phone AS captain_contact,
                a.agent_name, a.agent_id, a.time AS approval_time,
                t.base_price AS price_per_slot,
                
                -- DYNAMIC FINANCIALS (Aggregated from Bookings)
                (SELECT COALESCE(SUM(b2.platform_fees), 0) FROM bookings b2 WHERE b2.batch_id = b.id) AS total_platform_fee,
                (SELECT COALESCE(SUM(b2.total_basic_cost * 0.10), 0) FROM bookings b2 WHERE b2.batch_id = b.id AND b2.status != 'cancelled') AS total_commission,
                (SELECT COALESCE(SUM(b2.total_amount), 0) FROM bookings b2 WHERE b2.batch_id = b.id AND b2.status != 'cancelled') AS revenue_bookings,
                (SELECT COALESCE(SUM(b2.deduction_amount), 0) FROM bookings b2 WHERE b2.batch_id = b.id AND b2.status = 'cancelled') AS revenue_cancellations
            FROM batches b
            JOIN treks t ON b.trek_id = t.id
            JOIN destinations d ON t.destination_id = d.id
            JOIN vendors v ON t.vendor_id = v.id
            JOIN users u ON v.user_id = u.id
            LEFT JOIN trek_captains c ON b.captain_id = c.id
            LEFT JOIN approvals a ON t.id = a.trek_id
            LEFT JOIN cancellation_policies cp ON t.cancellation_policy_id = cp.id
            -- Removed static join to financials f
        `;

        const [rows] = await pool.query(query);

        // Fetch source cities efficiently
        const [citiesRows] = await pool.query('SELECT * FROM trek_source_cities');
        const citiesMap = {};
        citiesRows.forEach(row => {
            if (!citiesMap[row.trek_id]) citiesMap[row.trek_id] = [];
            citiesMap[row.trek_id].push(row.city_name);
        });

        const treks = rows.map(row => ({
            id: row.id,
            serviceName: row.service_name,
            destination: row.destination,
            sourceCities: citiesMap[row.trek_id] || [],
            departure: row.departure,
            arrival: row.arrival,
            duration: row.duration,
            policy: row.policy,
            slotsBooked: row.slots_booked,
            totalSlots: row.total_slots,
            promoBadge: row.promo_badge,
            status: row.status,
            inclusions: row.inclusions,
            exclusions: row.exclusions,
            vendor: {
                id: row.vendor_id,
                name: row.vendor_name,
                logo: row.vendor_logo,
                credibilityScore: Number(row.vendor_credibility),
                premium: row.vendor_premium,
                email: row.vendor_email,
                contact: row.vendor_contact,
                joinedDate: row.vendor_joined
            },
            captain: {
                name: row.captain_name,
                email: row.captain_email,
                contact: row.captain_contact
            },
            approval: {
                agentName: row.agent_name,
                agentId: row.agent_id,
                time: row.approval_time
            },
            financials: {
                pricePerSlot: Number(row.price_per_slot || 0),
                totalCommission: Number(row.total_commission),
                totalPlatformFee: Number(row.total_platform_fee),
                totalPlatformShare: Number(row.total_commission) + Number(row.total_platform_fee),
                revenueFromBookings: Number(row.revenue_bookings),
                revenueFromCancellations: Number(row.revenue_cancellations)
            }
        }));

        res.json(treks);
    } catch (err) {
        console.error("DEBUG ERROR in getAllTreks:", err);
        res.status(500).json({
            message: 'Server Error',
            error: err.toString(),
            stack: err.stack
        });
    }
};
