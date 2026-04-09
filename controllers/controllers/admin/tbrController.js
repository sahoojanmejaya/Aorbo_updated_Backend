/**
 * TBR (Trek Booking Reference) Controller for Admin Panel
 * 
 * @description Handles TBR management operations for administrators
 * @updated 2026-03-11 00:52:00 IST
 * 
 * @routes
 * GET    /api/admin/tbrs              - Get all TBRs with pagination and filters
 * GET    /api/admin/tbrs/statistics   - Get TBR statistics dashboard data
 * GET    /api/admin/tbrs/:id          - Get specific TBR details
 * PUT    /api/admin/tbrs/:id/status   - Update TBR status
 */

const { Batch, Trek, Vendor, Booking, Customer, Destination, TrekImage, CancellationPolicy, Badge, Activity, Inclusion, Exclusion, City, ItineraryItem, Accommodation, TrekStage, BatchCancellationRequest, TrekAuditLog, User } = require('../../models');
const { sequelize } = require('../../models');
const { Op } = require('sequelize');
const logger = require('../../utils/logger');

// All booking columns the frontend needs
const BOOKING_ATTRIBUTES = [
    'id', 'status', 'payment_status', 'booking_date', 'createdAt',
    'total_amount', 'final_amount', 'discount_amount',
    'advance_amount', 'remaining_amount',
    'platform_fees', 'gst_amount', 'insurance_amount', 'free_cancellation_amount',
    'total_travelers', 'cancellation_policy_type',
    'cancelled_by', 'deduction_amount', 'refund_amount', 'cancellation_rule',
    'special_requests'
];

/**
 * Map a raw Sequelize Booking instance to the camelCase shape BookingsPage.tsx expects.
 *
 * @param {Object} b    - Sequelize Booking instance
 * @param {Object} trek - Parent Trek instance (from tbr.trek) — needed for base_price
 *
 * Derivation chain (source of truth = trek.base_price × total_travelers):
 *   finalBaseFare  = effectivePrice × total_travelers   (trek price after discount, all travelers)
 *   gst5           = finalBaseFare × 5%
 *   pf             = finalBaseFare × 2%
 *   totalAmount    = finalBaseFare + gst5 + pf + ti + fc  (expected grand total)
 *   couponDiscount = max(0, totalAmount − b.final_amount) (any extra reduction via coupon)
 *   actualTotal    = b.final_amount                       (what customer actually pays)
 *   comm10         = finalBaseFare × 10%
 *   getComm18      = comm10 × 18%
 *   getPF5         = pf × 5%
 *   vendorBase     = finalBaseFare − comm10 − getComm18 − getPF5
 *   tcs1 / tds1    = vendorBase × 1% each
 *   vendorShare    = vendorBase − tcs1 − tds1
 */
function mapBooking(b, trek) {
    const r2 = (n) => Math.round(parseFloat(n || 0) * 100) / 100;

    // ── True base fare: trek base_price (after trek-level discount) × travelers ──
    let pricePerPerson = parseFloat(trek?.base_price || 0);
    const hasDiscount  = Boolean(trek?.has_discount) && parseFloat(trek?.discount_value || 0) > 0;
    if (hasDiscount) {
        const dv = parseFloat(trek.discount_value);
        if (trek.discount_type === 'percentage') {
            pricePerPerson = pricePerPerson * (1 - dv / 100);
        } else {
            pricePerPerson = pricePerPerson - dv;
        }
    }
    // Fallback to stored total_amount if trek price is unavailable (shouldn't happen in normal flow)
    const travelers     = b.total_travelers || 1;
    const finalBaseFare = pricePerPerson > 0
        ? r2(pricePerPerson * travelers)
        : r2(b.total_amount);      // fallback

    // ── Variable add-ons from DB (set per booking, can't be re-derived) ────────
    const insuranceAmt  = r2(b.insurance_amount);
    const freeCancelAmt = r2(b.free_cancellation_amount);
    const advanceAmt    = r2(b.advance_amount);

    // ── Recalculate all percentage-based fees from finalBaseFare ────────────────
    const gst5 = r2(finalBaseFare * 0.05);   // 5% GST on base fare
    const pf   = r2(finalBaseFare * 0.02);   // 2% platform fee

    // Expected grand total from first principles
    const expectedGrandTotal = r2(finalBaseFare + gst5 + pf + insuranceAmt + freeCancelAmt);

    // Actual amount stored in DB (b.final_amount) is authoritative for what customer pays
    const storedGrandTotal = r2(b.final_amount);

    // Coupon or promotional discount = difference between expected and actual (if any)
    const couponDiscount = storedGrandTotal > 0
        ? Math.max(0, r2(expectedGrandTotal - storedGrandTotal))
        : 0;

    // The actual grand total the customer pays (may be less due to coupon)
    const totalAmount = storedGrandTotal > 0 ? storedGrandTotal : expectedGrandTotal;

    // ── Commission / vendor derivation chain (always on finalBaseFare) ──────────
    const comm10    = r2(finalBaseFare * 0.10);  // 10% commission on base fare
    const getComm18 = r2(comm10 * 0.18);         // 18% GST on commission
    const getPF5    = r2(pf * 0.05);             // 5% GST on platform fee

    const vendorBase  = r2(finalBaseFare - comm10 - getComm18 - getPF5);
    const tcs1        = r2(vendorBase * 0.01);
    const tds1        = r2(vendorBase * 0.01);
    const vendorShare = r2(vendorBase - tcs1 - tds1);

    // taxes = all GST components + withholding taxes (what KPI "Tax & Compliances" sums)
    const taxes               = r2(gst5 + getComm18 + getPF5 + tcs1 + tds1);
    const platformFixedCharges = r2(comm10 + pf + getComm18 + getPF5 + tcs1 + tds1);

    // ── Realized payment amounts ──────────────────────────────────────────────
    const ps = b.payment_status;
    let realizedTotalPaid;
    if (ps === 'full_paid' || ps === 'completed') {
        realizedTotalPaid = totalAmount;
    } else if (ps === 'advance_only' || ps === 'partial') {
        realizedTotalPaid = advanceAmt;
    } else {
        realizedTotalPaid = 0;
    }

    const pendingAmount   = Math.max(0, r2(totalAmount - realizedTotalPaid));
    const availableAmount = Math.max(0, r2(realizedTotalPaid - platformFixedCharges));

    const customer   = b.customer;
    const emailPhone = customer
        ? [customer.email, customer.phone].filter(Boolean).join(' | ')
        : null;

    return {
        // Identity
        id:     b.id,
        status: b.status,
        date:   b.createdAt || b.booking_date,

        // Traveller
        transactionIds:      null,
        travellerName:       customer?.name || 'N/A',
        travellerId:         customer?.id   || null,
        travellerDetails:    emailPhone,
        subTravellerDetails: null,
        slots:               travelers,
        couponDetails:       couponDiscount > 0 ? `Discount: ₹${couponDiscount}` : null,

        // Fare breakdown (matches table columns 1-to-1)
        finalBaseFare,
        gst5,
        pf,
        ti: insuranceAmt,   tiPolicyId: null,
        fc: freeCancelAmt,  fcPolicyId: null,
        totalAmount,        // actual grand total customer pays (after any coupon)
        couponDiscount,     // any extra promotional reduction applied at checkout

        // Payment state
        totalPaid:         advanceAmt,
        realizedTotalPaid,
        appPaidTotal:      realizedTotalPaid,
        pendingAmount,

        // Derived platform / tax columns
        comm10, getComm18, getPF5,
        tcs1, tds1, taxes,
        vendorShare,
        platformFixedCharges,
        availableAmount,

        // Cancellation fields
        refundAmount:    r2(b.refund_amount),
        deductionAmount: r2(b.deduction_amount),
        cxlReason:       b.cancellation_rule || null,
        reason:          b.cancelled_by ? `Cancelled by ${b.cancelled_by}` : null,
        remarks:         b.special_requests || null,
    };
}

/**
 * Get all TBRs with pagination, filtering, and search
 * Maps backend fields to frontend-expected field names
 * @route GET /api/admin/tbrs
 */
exports.getTbrs = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 50,
            search = '',
            vendor_id = '',
            trek_id = '',
            // Accept both date_from/date_to and legacy startDate/endDate
            date_from: _date_from = '',
            date_to: _date_to = '',
            startDate = '',
            endDate = ''
        } = req.query;

        // Prefer date_from/date_to; fall back to startDate/endDate aliases
        const date_from = _date_from || startDate;
        const date_to   = _date_to   || endDate;

        // Build search conditions
        const whereConditions = {};

        if (search) {
            whereConditions.tbr_id = { [Op.like]: `%${search}%` };
        }

        if (trek_id) {
            whereConditions.trek_id = trek_id;
        }

        // Date range filter
        if (date_from || date_to) {
            whereConditions.start_date = {};
            if (date_from) whereConditions.start_date[Op.gte] = date_from;
            if (date_to) whereConditions.start_date[Op.lte] = date_to;
        }

        // Trek-level vendor filter
        const trekWhereConditions = {};
        if (vendor_id && vendor_id !== 'all') {
            trekWhereConditions.vendor_id = vendor_id;
        }

        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Fetch TBRs with all related data the frontend needs
        const { count, rows: tbrs } = await Batch.findAndCountAll({
            where: whereConditions,
            include: [
                {
                    model: Trek,
                    as: 'trek',
                    where: Object.keys(trekWhereConditions).length > 0 ? trekWhereConditions : undefined,
                    attributes: [
                        'id', 'title', 'vendor_id', 'trek_status', 'status',
                        'base_price', 'discount_value', 'discount_type', 'has_discount',
                        'duration', 'duration_days', 'duration_nights',
                        'max_participants', 'destination_id',
                        'approved_by', 'approved_at'
                    ],
                    required: Object.keys(trekWhereConditions).length > 0,
                    include: [
                        {
                            model: Vendor,
                            as: 'vendor',
                            attributes: ['id', 'business_name', 'business_logo', 'status'],
                            required: false
                        },
                        {
                            model: Destination,
                            as: 'destinationData',
                            attributes: ['id', 'name'],
                            required: false
                        },
                        {
                            model: TrekImage,
                            as: 'images',
                            attributes: ['id', 'url', 'is_cover'],
                            required: false
                        },
                        {
                            model: CancellationPolicy,
                            as: 'cancellation_policy',
                            attributes: ['id', 'title'],
                            required: false
                        },
                        {
                            model: Badge,
                            as: 'badge',
                            attributes: ['id', 'name', 'color'],
                            required: false
                        }
                    ]
                },
                {
                    model: Booking,
                    as: 'bookings',
                    attributes: BOOKING_ATTRIBUTES,
                    required: false,
                    include: [
                        {
                            model: Customer,
                            as: 'customer',
                            attributes: ['id', 'name', 'email', 'phone'],
                            required: false
                        }
                    ]
                },
                {
                    model: BatchCancellationRequest,
                    as: 'cancellation_requests',
                    attributes: ['id', 'status', 'reason', 'created_at'],
                    required: false
                }
            ],
            limit: parseInt(limit),
            offset: offset,
            order: [['start_date', 'DESC']],
            distinct: true
        });

        // Map to frontend-expected field names
        const tbrData = tbrs.map(tbr => {
            const trek = tbr.trek;
            const vendor = trek?.vendor;
            const destination = trek?.destinationData;
            const totalBookings = tbr.bookings ? tbr.bookings.length : 0;
            const confirmedBookings = tbr.bookings ? tbr.bookings.filter(b => b.status === 'confirmed').length : 0;
            const totalRevenue = tbr.bookings ? tbr.bookings.reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0) : 0;

            const basePrice = parseFloat(trek?.base_price || 0);
            const discountValue = parseFloat(trek?.discount_value || 0);
            const discountType = trek?.discount_type || 'percentage';
            const hasDiscount = Boolean(trek?.has_discount) && discountValue > 0;

            let discountedPrice = basePrice;
            if (hasDiscount) {
                if (discountType === 'percentage') {
                    discountedPrice = basePrice - (basePrice * discountValue / 100);
                } else {
                    discountedPrice = basePrice - discountValue;
                }
            }

            // Build badges array from trek badge
            const badges = [];
            if (trek?.badge) {
                badges.push({
                    name: trek.badge.name,
                    color: trek.badge.color || '#3B82F6'
                });
            }

            // Get primary image
            const primaryImage = trek?.images?.find(img => img.is_cover) || trek?.images?.[0];

            // Check if batch is cancelled
            const isCancelled = tbr.cancellation_requests && tbr.cancellation_requests.length > 0 &&
                tbr.cancellation_requests.some(req => req.status === 'approved');
            const cancellationRequestStatus = tbr.cancellation_requests?.length > 0 ? tbr.cancellation_requests[0].status : 'NONE';

            return {
                // === Fields expected by TBRCard.tsx and Inventory.tsx ===
                id: tbr.id,
                tbrId: tbr.tbr_id,
                trekName: trek?.title || 'Untitled Trek',
                departureTime: tbr.start_date ? new Date(tbr.start_date).toISOString() : null,
                arrivalTime: tbr.end_date ? new Date(tbr.end_date).toISOString() : null,
                totalSlots: tbr.capacity,
                bookedSlots: tbr.booked_slots,
                availableSlots: tbr.available_slots,

                // Pricing
                originalPrice: basePrice,
                discountedPrice: discountedPrice,
                discountType: discountType,
                discountValue: discountValue,
                hasDiscount: hasDiscount,

                // Location
                destination: destination?.name || 'N/A',
                sourceLocation: null,

                // Trek details
                trekStatus: trek?.trek_status || 'pending',
                duration: trek?.duration,
                durationDays: trek?.duration_days,
                durationNights: trek?.duration_nights,

                // Operator (vendor)
                operator: vendor ? {
                    id: vendor.id,
                    name: vendor.business_name || 'Unknown Vendor',
                    logo: vendor.business_logo || null
                } : { id: null, name: 'Unknown Vendor', logo: null },

                // Image
                image: primaryImage?.url || null,

                // Policy
                cancellationPolicy: trek?.cancellation_policy?.title || 'STANDARD',

                // Badges
                badges: badges,

                // Approval info
                approvedBy: trek?.approved_by ? { id: trek.approved_by, name: 'Admin' } : null,

                // Stats
                currentBookings: totalBookings,
                confirmedBookings: confirmedBookings,
                totalRevenue: totalRevenue,

                // Cancellation state (defaults)
                isCancelled: isCancelled,
                cancellationRequestStatus: cancellationRequestStatus,
                vendorRequestBadge: null,

                // Timestamps
                createdAt: tbr.createdAt,
                updatedAt: tbr.updatedAt,

                // Bookings mapped to the camelCase shape BookingsPage.tsx expects
                bookings: (tbr.bookings || []).map(b => mapBooking(b, trek))
            };
        });

        logger.api('info', 'Admin TBRs fetched successfully', {
            admin_id: req.user?.id,
            total_count: count,
            page: parseInt(page),
            limit: parseInt(limit)
        });

        res.json({
            success: true,
            message: 'TBRs fetched successfully',
            data: {
                tbrs: tbrData,
                pagination: {
                    current_page: parseInt(page),
                    total_pages: Math.ceil(count / parseInt(limit)),
                    total_count: count,
                    per_page: parseInt(limit),
                    has_next: parseInt(page) < Math.ceil(count / parseInt(limit)),
                    has_prev: parseInt(page) > 1
                }
            }
        });

    } catch (error) {
        logger.error('error', 'Error fetching admin TBRs', {
            error: error.message,
            stack: error.stack,
            admin_id: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to fetch TBRs',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Get TBR statistics for admin dashboard
 * @route GET /api/admin/tbrs/statistics
 */
exports.getTbrStatistics = async (req, res) => {
    try {
        const totalTbrs = await Batch.count();

        const totalBookings = await Booking.count();
        const confirmedBookings = await Booking.count({ where: { status: 'confirmed' } });

        const totalRevenue = await Booking.sum('total_amount', {
            where: { payment_status: { [Op.in]: ['full_paid', 'completed'] } }
        }) || 0;

        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const monthlyTrend = await Batch.findAll({
            attributes: [
                [require('sequelize').fn('DATE_FORMAT', require('sequelize').col('created_at'), '%Y-%m'), 'month'],
                [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
            ],
            where: { createdAt: { [Op.gte]: sixMonthsAgo } },
            group: [require('sequelize').fn('DATE_FORMAT', require('sequelize').col('created_at'), '%Y-%m')],
            order: [[require('sequelize').fn('DATE_FORMAT', require('sequelize').col('created_at'), '%Y-%m'), 'ASC']],
            raw: true
        });

        res.json({
            success: true,
            message: 'TBR statistics fetched successfully',
            data: {
                overview: {
                    total_tbrs: totalTbrs,
                    active_tbrs: 0,
                    completed_tbrs: 0,
                    cancelled_tbrs: 0,
                    total_bookings: totalBookings,
                    confirmed_bookings: confirmedBookings,
                    total_revenue: parseFloat(totalRevenue).toFixed(2)
                },
                monthly_trend: monthlyTrend,
                last_updated: new Date().toISOString()
            }
        });

    } catch (error) {
        logger.error('error', 'Error fetching TBR statistics', {
            error: error.message, stack: error.stack, admin_id: req.user?.id
        });
        res.status(500).json({
            success: false,
            message: 'Failed to fetch TBR statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Get specific TBR details
 * @route GET /api/admin/tbrs/:id
 */
exports.getTbrById = async (req, res) => {
    try {
        const { id } = req.params;

        const tbr = await Batch.findOne({
            where: { tbr_id: id },
            include: [
                {
                    model: Trek,
                    as: 'trek',
                    required: false,
                    include: [
                        {
                            model: Vendor,
                            as: 'vendor',
                            attributes: ['id', 'business_name', 'business_logo', 'status', 'company_info'],
                            required: false,
                            include: [
                                {
                                    model: User,
                                    as: 'user',
                                    attributes: ['id', 'name', 'email', 'phone'],
                                    required: false
                                }
                            ]
                        },
                        {
                            model: Destination,
                            as: 'destinationData',
                            attributes: ['id', 'name'],
                            required: false
                        },
                        {
                            model: TrekImage,
                            as: 'images',
                            attributes: ['id', 'url', 'is_cover'],
                            required: false
                        },
                        {
                            model: CancellationPolicy,
                            as: 'cancellation_policy',
                            attributes: ['id', 'title'],
                            required: false
                        },
                        {
                            model: Badge,
                            as: 'badge',
                            attributes: ['id', 'name', 'color'],
                            required: false
                        }
                    ],
                    attributes: [
                        'id', 'title', 'vendor_id', 'trek_status', 'status', 'inclusions', 'exclusions', 'activities',
                        'base_price', 'discount_value', 'discount_type', 'has_discount',
                        'duration', 'duration_days', 'duration_nights',
                        'max_participants', 'destination_id', 'city_ids',
                        'approved_by', 'approved_at', 'trekking_rules', 'emergency_protocols', 'organizer_notes'
                    ]
                },
                {
                    model: Booking,
                    as: 'bookings',
                    attributes: BOOKING_ATTRIBUTES,
                    required: false,
                    include: [
                        {
                            model: Customer,
                            as: 'customer',
                            attributes: ['id', 'name', 'email', 'phone'],
                            required: false
                        }
                    ]
                },
                {
                    model: BatchCancellationRequest,
                    as: 'cancellation_requests',
                    attributes: ['id', 'status', 'reason', 'created_at'],
                    required: false
                }
            ]
        });

        if (!tbr) {
            return res.status(404).json({ success: false, message: 'TBR not found' });
        }

        // Fetch missing relationships that are expected by the Admin Inventory Panel (TrekDetailsPage.tsx)
        let inclusions_data = [];
        let exclusions_data = [];
        let activities_data = [];
        let itinerary_items = [];
        let accommodations = [];
        let trek_stages = [];
        let sourceCities = [];

        if (tbr.trek) {
            const trekData = tbr.trek.toJSON();
            const parseArray = (val) => {
                if (!val) return [];
                if (Array.isArray(val)) return val;
                try { return JSON.parse(val); } catch { return []; }
            };
            const inclusionIds = parseArray(trekData.inclusions);
            const exclusionIds = parseArray(trekData.exclusions);
            const activityIds = parseArray(trekData.activities);
            const cityIds = parseArray(trekData.city_ids);

            // Determine if stored values are numeric IDs or already string names
            const inclAreIds = inclusionIds.length > 0 && typeof inclusionIds[0] === 'number';
            const exclAreIds = exclusionIds.length > 0 && typeof exclusionIds[0] === 'number';

            const [act, itin, acc, stg, incl, excl, srcCities] = await Promise.all([
                activityIds.length > 0 ? Activity.findAll({ where: { id: { [Op.in]: activityIds } }, attributes: ["id", "name", "category_name"] }) : [],
                ItineraryItem.findAll({ where: { trek_id: tbr.trek.id }, attributes: ["id", "trek_id", "activities", "createdAt", "updatedAt"], order: [["createdAt", "ASC"]] }),
                // BUG FIX: Filter by batch_id to avoid data leakage from other batches
                Accommodation.findAll({ where: { batch_id: tbr.id } }),
                // BUG FIX: Filter by batch_id to fix "route map repeating" issue
                TrekStage.findAll({ where: { batch_id: tbr.id }, include: [{ model: City, as: "city", attributes: ["id", "cityName"] }], order: [["date_time", "ASC"]] }),
                (inclAreIds && inclusionIds.length > 0) ? Inclusion.findAll({ where: { id: { [Op.in]: inclusionIds } }, attributes: ["name"] }) : [],
                (exclAreIds && exclusionIds.length > 0) ? Exclusion.findAll({ where: { id: { [Op.in]: exclusionIds } }, attributes: ["name"] }) : [],
                cityIds.length > 0 ? City.findAll({ where: { id: { [Op.in]: cityIds } }, attributes: ["cityName"] }) : []
            ]);
            activities_data = act;
            itinerary_items = itin;
            accommodations = acc;
            trek_stages = stg;
            // If values were IDs, use DB-resolved names; if already strings, use directly
            inclusions_data = inclAreIds ? incl.map(i => i.name) : inclusionIds;
            exclusions_data = exclAreIds ? excl.map(e => e.name) : exclusionIds;
            sourceCities = srcCities.map(c => c.cityName);
        }

        // Map to the same frontend-expected field names as getTbrs
        const trek = tbr.trek;
        const vendor = trek?.vendor;
        const destination = trek?.destinationData;
        const totalBookings = tbr.bookings ? tbr.bookings.length : 0;
        const confirmedBookings = tbr.bookings ? tbr.bookings.filter(b => b.status === 'confirmed').length : 0;
        const totalRevenue = tbr.bookings ? tbr.bookings.reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0) : 0;

        const basePrice = parseFloat(trek?.base_price || 0);
        const discountValue = parseFloat(trek?.discount_value || 0);
        const discountType = trek?.discount_type || 'percentage';
        const hasDiscount = Boolean(trek?.has_discount) && discountValue > 0;

        let discountedPrice = basePrice;
        if (hasDiscount) {
            if (discountType === 'percentage') {
                discountedPrice = basePrice - (basePrice * discountValue / 100);
            } else {
                discountedPrice = basePrice - discountValue;
            }
        }

        const badges = [];
        if (trek?.badge) {
            badges.push({
                name: trek.badge.name,
                color: trek.badge.color || '#3B82F6'
            });
        }

        const primaryImage = trek?.images?.find(img => img.is_cover) || trek?.images?.[0];

        // Check if batch is cancelled
        const isCancelled = tbr.cancellation_requests && tbr.cancellation_requests.length > 0 &&
            tbr.cancellation_requests.some(req => req.status === 'approved');
        const cancellationRequestStatus = tbr.cancellation_requests?.length > 0 ? tbr.cancellation_requests[0].status : 'NONE';

        const tbrData = {
            id: tbr.id,
            tbrId: tbr.tbr_id,
            trekName: trek?.title || 'Untitled Trek',
            departureTime: tbr.start_date ? new Date(tbr.start_date).toISOString() : null,
            arrivalTime: tbr.end_date ? new Date(tbr.end_date).toISOString() : null,
            totalSlots: tbr.capacity,
            bookedSlots: tbr.booked_slots,
            availableSlots: tbr.available_slots,

            originalPrice: basePrice,
            discountedPrice: discountedPrice,
            discountType: discountType,
            discountValue: discountValue,
            hasDiscount: hasDiscount,

            destination: destination?.name || 'N/A',
            sourceLocation: sourceCities.join(', ') || null,
            sourceCities: sourceCities,

            trekStatus: trek?.trek_status || 'pending',
            duration: trek?.duration,
            durationDays: trek?.duration_days,
            durationNights: trek?.duration_nights,

            operator: vendor ? {
                id: vendor.id,
                name: vendor.business_name || 'Unknown Vendor',
                businessName: vendor.business_name,
                logo: vendor.business_logo || null,
                email: vendor.company_info?.company_email || vendor.user?.email || 'N/A',
                phone: vendor.company_info?.company_phone || vendor.user?.phone || 'N/A',
                captainName: vendor.user?.name || vendor.business_name + ' Team',
                captainPhone: vendor.company_info?.company_phone || vendor.user?.phone || 'N/A',
                credibilityScore: 5
            } : { id: null, name: 'Unknown Vendor', logo: null },

            image: primaryImage?.url || null,
            images: trek?.images || [],

            cancellationPolicy: trek?.cancellation_policy?.title || 'STANDARD',

            badges: badges,

            approvedBy: trek?.approved_by ? { id: trek.approved_by, name: 'Admin' } : null,

            currentBookings: totalBookings,
            confirmedBookings: confirmedBookings,
            totalRevenue: totalRevenue,

            isCancelled: isCancelled,
            cancellationRequestStatus: cancellationRequestStatus,
            vendorRequestBadge: null,

            createdAt: tbr.createdAt,
            updatedAt: tbr.updatedAt,

            // Bookings mapped to the camelCase shape BookingsPage.tsx expects
            bookings: (tbr.bookings || []).map(b => mapBooking(b, trek)),

            // Fix for Missing Data in TrekDetailsPage.tsx, with deduplications
            inclusions: inclusions_data,
            exclusions: exclusions_data,
            accommodations: Array.from(new Set(accommodations.map(a => a.type + (a.details?.location ? ' at ' + a.details.location : '')))),
            otherPolicies: [
                trek?.trekking_rules || null,
                trek?.emergency_protocols || 'Follow standard emergency procedures.',
                trek?.organizer_notes || null
            ].filter(Boolean),
            activities: activities_data.reduce((acc, cur) => {
                const cat = cur.category_name || 'Others';
                if (!acc[cat]) acc[cat] = [];
                if (!acc[cat].includes(cur.name)) acc[cat].push(cur.name);
                return acc;
            }, {}),
            itinerary: itinerary_items.map((item, idx) => ({
                day: idx + 1,
                dayLabel: `Day ${idx + 1}`,
                title: `Day ${idx + 1}`,
                activities: item.activities
            })),
            trekStages: (() => {
                // Deduplicate stages by stageName+destination to avoid duplicate boarding points
                const seen = new Set();
                return trek_stages
                    .map((stage) => ({
                        id: stage.id,
                        stageName: stage.stage_name,
                        destination: stage.destination,
                        cityName: stage.city?.cityName,
                        dateTime: stage.date_time,
                        isBoardingPoint: stage.stage_name === 'boarding',
                        transport: stage.means_of_transport
                    }))
                    .filter(s => {
                        const key = `${s.stageName}_${s.destination}_${s.dateTime}`;
                        if (seen.has(key)) return false;
                        seen.add(key);
                        return true;
                    });
            })()
        };

        res.json({
            success: true,
            message: 'TBR details fetched successfully',
            data: tbrData
        });

    } catch (error) {
        logger.error('error', 'Error fetching TBR details', {
            error: error.message, stack: error.stack, admin_id: req.user?.id
        });
        res.status(500).json({
            success: false,
            message: 'Failed to fetch TBR details',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Update TBR
 * @route PUT /api/admin/tbrs/:id/status
 */
exports.updateTbrStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { capacity, start_date, end_date, reason } = req.body;

        const tbr = await Batch.findByPk(id);
        if (!tbr) {
            return res.status(404).json({ success: false, message: 'TBR not found' });
        }

        const updateData = {};
        if (capacity !== undefined) updateData.capacity = capacity;
        if (start_date) updateData.start_date = start_date;
        if (end_date) updateData.end_date = end_date;

        await tbr.update(updateData);

        res.json({
            success: true,
            message: 'TBR updated successfully',
            data: {
                tbr_id: tbr.tbr_id,
                updated_fields: Object.keys(updateData),
                updated_at: new Date().toISOString()
            }
        });

    } catch (error) {
        logger.error('error', 'Error updating TBR', {
            error: error.message, stack: error.stack, admin_id: req.user?.id
        });
        res.status(500).json({
            success: false,
            message: 'Failed to update TBR',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Cancel an entire batch
 * @route POST /api/admin/tbrs/:id/cancel
 */
exports.cancelBatch = async (req, res) => {
    try {
        const { id: tbrId } = req.params;
        const { reason } = req.body;
        
        console.log('🔍 TBR Controller - Cancelling batch:', tbrId, 'with reason:', reason);

        // Find the batch by TBR ID
        const batch = await Batch.findOne({
            where: { tbr_id: tbrId },
            include: [
                {
                    model: Trek,
                    as: "trek",
                    attributes: ["id", "title", "vendor_id"],
                    include: [
                        {
                            model: Vendor,
                            as: "vendor",
                            attributes: ["id"]
                        }
                    ]
                }
            ]
        });

        if (!batch) {
            console.log('❌ TBR not found:', tbrId);
            return res.status(404).json({
                success: false,
                message: "TBR not found"
            });
        }

        // Check if batch is already cancelled
        const existingCancellation = await BatchCancellationRequest.findOne({
            where: { 
                batch_id: batch.id,
                status: 'approved'
            }
        });

        if (existingCancellation) {
            return res.status(400).json({
                success: false,
                message: "Batch is already cancelled"
            });
        }

        // Create cancellation request
        const cancellationRequest = await BatchCancellationRequest.create({
            batch_id: batch.id,
            vendor_id: batch.trek.vendor_id || batch.trek.vendor?.id, // Get vendor_id from trek
            reason: reason || 'Admin cancellation',
            status: 'approved', // Auto-approve admin cancellations
            requested_by: 'admin', // You might want to get this from auth context
            created_at: new Date(),
            updated_at: new Date()
        });

        console.log('✅ Batch cancellation created:', cancellationRequest.id);

        // Create audit log entry for the cancellation using TrekAuditLog
        try {
            await TrekAuditLog.create({
                vendor_id: batch.trek.vendor_id,
                trek_id: batch.trek.id,
                current_status: 'BATCH_CANCELLED',
                target_entity: 'BATCH',
                details: JSON.stringify({
                    action: 'BATCH_CANCELLED',
                    batchId: batch.id,
                    tbrId: batch.tbr_id,
                    reason: cancellationRequest.reason,
                    cancelledBy: 'admin',
                    cancelledAt: cancellationRequest.created_at,
                    trekTitle: batch.trek.title
                })
            });
            console.log('✅ Trek audit log created for batch cancellation');
        } catch (auditError) {
            console.error('❌ Failed to create trek audit log:', auditError.message);
            // Don't fail the main operation if audit logging fails
        }

        // Fetch all non-cancelled bookings for this batch
        const bookings = await Booking.findAll({
            where: {
                batch_id: batch.id,
                status: { [Op.ne]: 'cancelled' }
            }
        });

        // Cancel all active bookings
        if (bookings && bookings.length > 0) {
            const bookingIds = bookings.map(b => b.id);
            await Booking.update(
                {
                    status: 'cancelled',
                    cancellation_reason: reason || 'Batch cancelled by Admin'
                },
                { where: { id: { [Op.in]: bookingIds } } }
            );
        }

        res.json({
            success: true,
            message: "Batch cancelled successfully",
            data: {
                cancellationId: cancellationRequest.id,
                batchId: batch.id,
                tbrId: batch.tbr_id,
                reason: cancellationRequest.reason,
                status: cancellationRequest.status,
                cancelledAt: cancellationRequest.created_at
            }
        });

    } catch (error) {
        console.error('❌ TBR Controller Error (cancelBatch):', error.message);
        console.error('❌ Stack trace:', error.stack);
        logger.error("error", "Failed to cancel batch", {
            tbrId: req.params.id,
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({
            success: false,
            message: "Failed to cancel batch",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

/**
 * Get logs for a TBR
 * @route GET /api/admin/tbrs/:tbrId/logs
 */
exports.getTbrLogs = async (req, res) => {
    try {
        const { id: tbrId } = req.params;
        const { limit = 50, offset = 0 } = req.query;
        
        console.log('🔍 TBR Controller - Getting logs for TBR:', tbrId);

        // First, find the batch and trek to get trek_id
        const batch = await Batch.findOne({
            where: { tbr_id: tbrId },
            include: [
                {
                    model: Trek,
                    as: "trek",
                    attributes: ["id", "title"]
                }
            ]
        });

        if (!batch) {
            return res.status(404).json({
                success: false,
                message: "TBR not found"
            });
        }

        // Get trek audit logs for this trek
        const trekAuditLogs = await TrekAuditLog.findAll({
            where: { trek_id: batch.trek.id },
            include: [
                {
                    model: User,
                    as: "vendor",
                    attributes: ["id", "name", "email"],
                    required: false
                },
                {
                    model: Trek,
                    as: "trek",
                    attributes: ["id", "title"]
                }
            ],
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        // Get batch cancellation requests for this TBR using manual query
        const [cancellationLogs] = await sequelize.query(`
            SELECT 
                bcr.id,
                bcr.reason,
                bcr.status,
                bcr.requested_at,
                bcr.created_at,
                bcr.processed_by,
                bcr.processed_at,
                b.tbr_id,
                t.title as trek_title
            FROM batch_cancellation_requests bcr
            JOIN batches b ON bcr.batch_id = b.id
            JOIN treks t ON b.trek_id = t.id
            WHERE b.tbr_id = ?
            ORDER BY bcr.created_at DESC
        `, {
            replacements: [tbrId]
        });

        // Format and combine logs
        const combinedLogs = [
            ...trekAuditLogs.map(log => ({
                id: log.id,
                timestamp: log.createdAt || log.created_at || new Date(),
                type: 'trek_audit',
                action: log.current_status,
                target_entity: log.target_entity,
                performer: log.vendor?.name || `Vendor ${log.vendor_id}`,
                details: log.details ? (() => {
                    try {
                        return JSON.parse(log.details);
                    } catch (e) {
                        // If it's not valid JSON, return as plain text
                        return { message: log.details };
                    }
                })() : null,
                description: `${log.current_status} - ${log.target_entity}`,
                trekTitle: log.trek?.title
            })),
            ...cancellationLogs.map(log => ({
                id: `cancel_${log.id}`,
                timestamp: log.created_at || new Date(),
                type: 'batch_cancellation',
                action: 'BATCH_CANCELLATION_REQUEST',
                target_entity: 'BATCH',
                performer: log.processed_by ? `Admin ${log.processed_by}` : 'System',
                details: {
                    reason: log.reason,
                    status: log.status,
                    tbrId: log.tbr_id,
                    trekTitle: log.trek_title,
                    requestedAt: log.requested_at,
                    processedAt: log.processed_at
                },
                description: `Batch cancellation ${log.status} - ${log.reason}`,
                trekTitle: log.trek_title
            }))
        ];

        // Sort by timestamp descending
        combinedLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        console.log('✅ Found', combinedLogs.length, 'log entries for TBR:', tbrId);

        res.json({
            success: true,
            data: {
                logs: combinedLogs,
                total: combinedLogs.length,
                tbrId: tbrId,
                trekId: batch.trek.id,
                trekTitle: batch.trek.title
            }
        });

    } catch (error) {
        console.error('❌ TBR Controller Error (getTbrLogs):', error.message);
        console.error('❌ Stack trace:', error.stack);
        logger.error("error", "Failed to fetch TBR logs", {
            tbrId: req.params.id,
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({
            success: false,
            message: "Failed to fetch TBR logs",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};