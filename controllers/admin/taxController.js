'use strict';

/**
 * Tax Controller — Admin Panel
 *
 * Aggregates GST and platform-fee collections from the Booking table.
 *
 * @routes
 *   GET /api/admin/taxes/summary   — monthly tax summary
 *   GET /api/admin/taxes/records   — paginated individual tax records
 */

const { Booking, Trek, Batch, Customer, User } = require('../../models');
const { sequelize }                             = require('../../models');
const { Op, fn, col, literal }                  = require('sequelize');
const logger                                    = require('../../utils/logger');

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/taxes/summary
// Returns month-by-month breakdown of GST and platform fees collected.
// ─────────────────────────────────────────────────────────────────────────────
exports.getTaxSummary = async (req, res) => {
    try {
        const { year = new Date().getFullYear() } = req.query;

        const rows = await Booking.findAll({
            attributes: [
                [fn('MONTH', col('booking_date')), 'month'],
                [fn('SUM', col('gst_amount')),     'total_gst'],
                [fn('SUM', col('platform_fees')),  'total_platform_fees'],
                [fn('SUM', col('final_amount')),   'total_revenue'],
                [fn('COUNT', col('id')),            'booking_count'],
            ],
            where: {
                status:      { [Op.notIn]: ['cancelled'] },
                booking_date: {
                    [Op.gte]: new Date(`${year}-01-01`),
                    [Op.lte]: new Date(`${year}-12-31`),
                },
            },
            group: [fn('MONTH', col('booking_date'))],
            order: [[fn('MONTH', col('booking_date')), 'ASC']],
            raw: true,
        });

        const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                             'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // Fill all 12 months (zeros for months with no bookings)
        const summary = MONTH_NAMES.map((name, i) => {
            const row = rows.find(r => parseInt(r.month) === i + 1);
            return {
                month:               name,
                month_num:           i + 1,
                total_gst:           parseFloat(row?.total_gst          ?? 0),
                total_platform_fees: parseFloat(row?.total_platform_fees ?? 0),
                total_revenue:       parseFloat(row?.total_revenue       ?? 0),
                booking_count:       parseInt(row?.booking_count         ?? 0),
                gst_rate:            5, // 5% GST rate
            };
        });

        const totals = {
            total_gst:           summary.reduce((s, r) => s + r.total_gst,           0),
            total_platform_fees: summary.reduce((s, r) => s + r.total_platform_fees, 0),
            total_revenue:       summary.reduce((s, r) => s + r.total_revenue,       0),
            booking_count:       summary.reduce((s, r) => s + r.booking_count,       0),
        };

        return res.json({ success: true, data: { year: parseInt(year), summary, totals } });

    } catch (error) {
        logger.error('getTaxSummary error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch tax summary', error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/taxes/records
// Paginated list of individual bookings with their GST breakdown.
// Query params: page, limit, date_from, date_to, search (booking id or customer name)
// ─────────────────────────────────────────────────────────────────────────────
exports.getTaxRecords = async (req, res) => {
    try {
        const {
            page       = 1,
            limit      = 20,
            date_from  = '',
            date_to    = '',
            search     = '',
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const where  = { status: { [Op.notIn]: ['cancelled'] } };

        if (date_from || date_to) {
            where.booking_date = {};
            if (date_from) where.booking_date[Op.gte] = new Date(date_from);
            if (date_to)   where.booking_date[Op.lte] = new Date(date_to);
        }

        const { count, rows } = await Booking.findAndCountAll({
            where,
            attributes: [
                'id', 'booking_date', 'status', 'payment_status',
                'final_amount', 'gst_amount', 'platform_fees',
                'total_travelers', 'total_amount',
            ],
            include: [
                {
                    model:      Customer,
                    as:         'customer',
                    attributes: ['id'],
                    include: [{
                        model:      User,
                        as:         'user',
                        attributes: ['name', 'email'],
                        ...(search ? { where: { name: { [Op.like]: `%${search}%` } } } : {}),
                        required: !!search,
                    }],
                    required: !!search,
                },
                {
                    model:      Batch,
                    as:         'batch',
                    attributes: ['id', 'start_date'],
                    include: [{
                        model:      Trek,
                        as:         'trek',
                        attributes: ['id', 'title'],
                    }],
                    required: false,
                },
            ],
            order:  [['booking_date', 'DESC']],
            limit:  parseInt(limit),
            offset,
        });

        const records = rows.map(b => ({
            booking_id:      b.id,
            booking_date:    b.booking_date,
            status:          b.status,
            payment_status:  b.payment_status,
            customer_name:   b.customer?.user?.name  ?? '—',
            customer_email:  b.customer?.user?.email ?? '—',
            trek_name:       b.batch?.trek?.title    ?? '—',
            trek_date:       b.batch?.start_date     ?? null,
            total_travelers: b.total_travelers,
            base_amount:     parseFloat(b.total_amount  ?? 0),
            gst_amount:      parseFloat(b.gst_amount    ?? 0),
            platform_fees:   parseFloat(b.platform_fees ?? 0),
            final_amount:    parseFloat(b.final_amount  ?? 0),
            gst_rate:        5,
        }));

        return res.json({
            success: true,
            data: {
                records,
                pagination: {
                    current_page:  parseInt(page),
                    total_pages:   Math.ceil(count / parseInt(limit)),
                    total_items:   count,
                    items_per_page: parseInt(limit),
                },
            },
        });

    } catch (error) {
        logger.error('getTaxRecords error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch tax records', error: error.message });
    }
};
