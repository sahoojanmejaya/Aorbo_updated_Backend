const {
    CancellationBooking,
    Booking,
    Customer,
    Trek,
    Batch,
    Vendor,
    BatchCancellationRequest,
    sequelize,
} = require("../../models");
const { Op } = require("sequelize");
const { updateBatchSlotsOnCancellation } = require("../../utils/batchSlotManager");

// Get all cancellation bookings for admin overview
// NOTE: Status and reason MUST come from batch_cancellation_requests table
exports.getCancellationBookings = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, search, amount, customerName, trekName, canId } = req.query;
        
        console.log("\n🚀 ========== FETCHING CANCELLATION BOOKINGS ==========");
        console.log("Query params:", { page, limit, status, search, amount, customerName, trekName, canId });
        
        // Calculate pagination
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;

        // CRITICAL: First fetch ALL batch_cancellation_requests to create a map
        console.log("\n🔍 STEP 1: Fetching ALL batch_cancellation_requests from database...");
        const allBatchCancellationRequests = await BatchCancellationRequest.findAll({
            attributes: ['id', 'batch_id', 'status', 'reason', 'vendor_id', 'created_at', 'requested_at'],
            order: [['created_at', 'DESC']],
            raw: false // Keep as Sequelize instances to access toJSON properly
        });
        
        console.log(`📊 Total batch_cancellation_requests found: ${allBatchCancellationRequests.length}`);
        
        // Debug: Log all batch_cancellation_requests to see what we have
        console.log(`\n📋 ALL batch_cancellation_requests in database:`);
        allBatchCancellationRequests.forEach((req, idx) => {
            const reqData = req.toJSON();
            console.log(`  [${idx + 1}] ID: ${reqData.id}, batch_id: ${reqData.batch_id} (type: ${typeof reqData.batch_id}), status: ${reqData.status}, reason: ${reqData.reason?.substring(0, 30)}..., created_at: ${reqData.created_at}`);
        });
        
        // Create a map: batch_id -> batch_cancellation_request (latest one)
        // CRITICAL: Use integer keys to ensure proper matching
        const batchCancellationMap = {};
        allBatchCancellationRequests.forEach(req => {
            const reqData = req.toJSON();
            const batchId = reqData.batch_id;
            
            // Convert to integer for consistent key matching
            if (batchId !== null && batchId !== undefined) {
                const batchIdKey = parseInt(batchId);
                
                if (!isNaN(batchIdKey)) {
                    // Store the latest request for each batch_id
                    const existingDate = batchCancellationMap[batchIdKey]?.created_at || batchCancellationMap[batchIdKey]?.requested_at || 0;
                    const newDate = reqData.created_at || reqData.requested_at || 0;
                    
                    if (!batchCancellationMap[batchIdKey] || new Date(newDate) > new Date(existingDate)) {
                        batchCancellationMap[batchIdKey] = reqData;
                    }
                } else {
                    console.log(`⚠️ Skipping invalid batch_id: ${batchId} (not a number)`);
                }
            }
        });
        
        console.log(`\n📋 Batch Cancellation Map created with ${Object.keys(batchCancellationMap).length} unique batch_ids:`);
        Object.keys(batchCancellationMap).forEach(batchId => {
            const req = batchCancellationMap[batchId];
            console.log(`  batch_id: ${batchId} => status: "${req.status}", reason: "${req.reason?.substring(0, 50)}...", created_at: ${req.created_at}`);
        });

        // Build where clause for cancellation_bookings
        const whereClause = {};
        if (status && status !== "all" && status !== "undefined") {
            // Don't filter by status in cancellation_bookings - we'll filter by batch_cancellation_requests status
        }
        
        // Handle amount filter
        if (amount && amount !== "undefined") {
            const amountNum = parseFloat(amount);
            if (!isNaN(amountNum)) {
                whereClause.total_refundable_amount = amountNum;
            }
        }

        // Build search condition for general search
        const searchConditions = [];
        if (search && search !== "undefined") {
            searchConditions.push(
                { '$booking.customer.name$': { [Op.like]: `%${search}%` } },
                { '$trek.title$': { [Op.like]: `%${search}%` } },
                { '$booking.id$': { [Op.like]: `%${search}%` } }
            );
        }

        // Handle individual field searches - these will be applied to includes
        let customerWhere = {};
        let trekWhere = {};
        let hasCustomerFilter = false;
        let hasTrekFilter = false;
        
        if (customerName && customerName !== "undefined") {
            customerWhere.name = { [Op.like]: `%${customerName}%` };
            hasCustomerFilter = true;
        }
        if (trekName && trekName !== "undefined") {
            trekWhere.title = { [Op.like]: `%${trekName}%` };
            hasTrekFilter = true;
        }
        
        // Handle CAN ID search
        if (canId && canId !== "undefined") {
            const cleanCanId = canId.replace(/^CAN-?/i, '');
            whereClause.id = { [Op.like]: `%${cleanCanId}%` };
        }
        
        // Build include conditions based on filters - include vendor and batch info
        const includeOptions = [
            {
                model: Booking,
                as: "booking",
                include: [
                    {
                        model: Customer,
                        as: "customer",
                        attributes: ["id", "name", "email", "phone"],
                        ...(hasCustomerFilter ? { 
                            where: customerWhere,
                            required: true 
                        } : {})
                    },
                    {
                        model: Batch,
                        as: "batch",
                        attributes: ["id", "tbr_id", "booked_slots", "capacity"],
                        include: [
                            {
                                model: Trek,
                                as: "trek",
                                attributes: ["id", "title", "mtr_id", "vendor_id"],
                                include: [
                                    {
                                        model: Vendor,
                                        as: "vendor",
                                        attributes: ["id", "company_info"]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            },
            {
                model: Trek,
                as: "trek",
                attributes: ["id", "title", "mtr_id", "vendor_id"],
                include: [
                    {
                        model: Vendor,
                        as: "vendor",
                        attributes: ["id", "company_info"]
                    }
                ],
                ...(hasTrekFilter ? { 
                    where: trekWhere,
                    required: true 
                } : {})
            }
        ];

        // Get total count
        const totalCount = await CancellationBooking.count({
            where: {
                ...whereClause,
                ...(searchConditions.length > 0 ? { [Op.or]: searchConditions } : {})
            },
            include: includeOptions
        });

        // Get cancellation bookings with pagination
        console.log("\n🔍 STEP 2: Fetching cancellation_bookings...");
        const cancellationBookings = await CancellationBooking.findAll({
            where: {
                ...whereClause,
                ...(searchConditions.length > 0 ? { [Op.or]: searchConditions } : {})
            },
            include: includeOptions,
            order: [["created_at", "DESC"]],
            limit: limitNum,
            offset: offset
        });
        
        console.log(`📊 Found ${cancellationBookings.length} cancellation_bookings records`);

        // Format the response with custom IDs and batch details
        const formattedData = await Promise.all(cancellationBookings.map(async (cancellation, index) => {
            const data = cancellation.toJSON();
            
            console.log(`\n📋 Processing Record ${index + 1}:`, {
                cancellation_id: data.id,
                batch_id_from_cancellation: data.batch_id,
                batch_id_from_booking: data.booking?.batch?.id,
                batch_id_type: typeof data.batch_id,
                trek_name: data.trek?.title,
                customer_name: data.booking?.customer?.name
            });
            
            // CRITICAL: Get batch_id - try from cancellation_bookings first, then from booking
            let batchId = data.batch_id || data.booking?.batch?.id || null;
            
            let tbrId = 'N/A';
            let bookedSlots = 0;
            let vendorId = null;
            let companyInfo = null;
            let trekDetails = null;
            let bookingsDetails = { totalCount: 0, bookingIds: [] };
            
            // CRITICAL: Create new object with data from batch_cancellation_requests table
            let batchCancellationData = {
                cancellation_date: null,
                status: 'pending',
                reason: 'N/A'
            };

            if (batchId) {
                const batchIdInt = parseInt(batchId);
                
                if (!isNaN(batchIdInt)) {
                    try {
                        // STRICT QUERY - Fetch from batch_cancellation_requests table with proper attributes
                        // Try multiple approaches to ensure we get the data
                        let batchCancellationRequest = await BatchCancellationRequest.findOne({
                            where: { batch_id: batchIdInt },
                            order: [['created_at', 'DESC']],
                            attributes: ['id', 'batch_id', 'status', 'reason', 'created_at', 'requested_at', 'processed_at'],
                            raw: false // Get as Sequelize instance to ensure proper data access
                        });
                        
                        // If not found, try with string batch_id as fallback
                        if (!batchCancellationRequest) {
                            batchCancellationRequest = await BatchCancellationRequest.findOne({
                                where: { batch_id: String(batchIdInt) },
                                order: [['created_at', 'DESC']],
                                attributes: ['id', 'batch_id', 'status', 'reason', 'created_at', 'requested_at', 'processed_at'],
                                raw: false
                            });
                        }
                        
                        if (batchCancellationRequest) {
                            const reqData = batchCancellationRequest.toJSON ? batchCancellationRequest.toJSON() : batchCancellationRequest;
                            
                            console.log(`🔍 [Record ${index + 1}] Found batch_cancellation_request for batch_id ${batchIdInt}:`, {
                                id: reqData.id,
                                batch_id: reqData.batch_id,
                                status: reqData.status,
                                reason: reqData.reason?.substring(0, 50),
                                created_at: reqData.created_at,
                                requested_at: reqData.requested_at,
                                processed_at: reqData.processed_at
                            });
                            
                            // Get cancellation_date - prefer created_at, then requested_at, then processed_at
                            if (reqData.created_at) {
                                batchCancellationData.cancellation_date = new Date(reqData.created_at).toISOString();
                            } else if (reqData.requested_at) {
                                batchCancellationData.cancellation_date = new Date(reqData.requested_at).toISOString();
                            } else if (reqData.processed_at) {
                                batchCancellationData.cancellation_date = new Date(reqData.processed_at).toISOString();
                            }
                            
                            // Get status from batch_cancellation_requests.status - STRICT mapping
                            if (reqData.status && reqData.status !== null && reqData.status !== undefined) {
                                // Map: approved -> confirmed, others stay same
                                if (reqData.status === 'approved') {
                                    batchCancellationData.status = 'confirmed';
                                } else {
                                    batchCancellationData.status = reqData.status;
                                }
                            }
                            
                            // Get reason from batch_cancellation_requests.reason - STRICT
                            if (reqData.reason && reqData.reason !== null && reqData.reason !== undefined) {
                                const trimmedReason = reqData.reason.toString().trim();
                                if (trimmedReason && trimmedReason !== '' && trimmedReason !== 'N/A' && trimmedReason.toLowerCase() !== 'null') {
                                    batchCancellationData.reason = trimmedReason;
                                }
                            }
                            
                            console.log(`✅ [Record ${index + 1}] Mapped data from DB - batch_id: ${batchIdInt}`, {
                                cancellation_date: batchCancellationData.cancellation_date,
                                status: batchCancellationData.status,
                                reason: batchCancellationData.reason?.substring(0, 50)
                            });
                        } else {
                            console.log(`⚠️ [Record ${index + 1}] No record found in DB query for batch_id ${batchIdInt}, trying map...`);
                            
                            // Fallback to map
                            const mapRequest = batchCancellationMap[batchIdInt] || batchCancellationMap[String(batchIdInt)];
                            if (mapRequest) {
                                if (mapRequest.created_at) {
                                    batchCancellationData.cancellation_date = new Date(mapRequest.created_at).toISOString();
                                } else if (mapRequest.requested_at) {
                                    batchCancellationData.cancellation_date = new Date(mapRequest.requested_at).toISOString();
                                }
                                
                                if (mapRequest.status && mapRequest.status !== null && mapRequest.status !== undefined) {
                                    if (mapRequest.status === 'approved') {
                                        batchCancellationData.status = 'confirmed';
                                    } else {
                                        batchCancellationData.status = mapRequest.status;
                                    }
                                }
                                
                                if (mapRequest.reason && mapRequest.reason !== null && mapRequest.reason !== undefined) {
                                    const trimmedReason = mapRequest.reason.toString().trim();
                                    if (trimmedReason && trimmedReason !== '' && trimmedReason !== 'N/A' && trimmedReason.toLowerCase() !== 'null') {
                                        batchCancellationData.reason = trimmedReason;
                                    }
                                }
                                
                                console.log(`✅ [Record ${index + 1}] Fetched from map - batch_id: ${batchIdInt}`, {
                                    cancellation_date: batchCancellationData.cancellation_date,
                                    status: batchCancellationData.status,
                                    reason: batchCancellationData.reason?.substring(0, 50)
                                });
                            } else {
                                console.log(`❌ [Record ${index + 1}] NO record found for batch_id ${batchIdInt} in batch_cancellation_requests table or map`);
                            }
                        }
                    } catch (error) {
                        console.error(`❌ [Record ${index + 1}] Error fetching batch_cancellation_request for batch_id ${batchIdInt}:`, error.message);
                        console.error(error.stack);
                    }
                } else {
                    console.log(`⚠️ [Record ${index + 1}] Invalid batch_id: ${batchId} (not a number)`);
                }
            } else {
                console.log(`⚠️ [Record ${index + 1}] No batch_id found for cancellation ${data.id}`);
            }

            if (batchId) {
                // Get batch with all bookings
                const batch = await Batch.findByPk(batchId, {
                    include: [
                        {
                            model: Trek,
                            as: "trek",
                            attributes: ["id", "title", "mtr_id", "vendor_id"],
                            include: [
                                {
                                    model: Vendor,
                                    as: "vendor",
                                    attributes: ["id", "company_info"]
                                }
                            ]
                        },
                        {
                            model: Booking,
                            as: "bookings",
                            attributes: ["id", "total_travelers"],
                            required: false
                        }
                    ]
                });

                if (batch) {
                    const batchData = batch.toJSON();
                    tbrId = batchData.tbr_id || 'N/A';
                    bookedSlots = batchData.booked_slots || 0;
                    
                    // Get vendor info from batch's trek
                    if (batchData.trek) {
                        vendorId = batchData.trek.vendor_id || null;
                        trekDetails = {
                            trek_id: batchData.trek.id || null,
                            trek_name: batchData.trek.title || 'N/A',
                            mtr_id: batchData.trek.mtr_id || 'N/A'
                        };
                        
                        // Get company info from vendor
                        if (batchData.trek.vendor) {
                            const vendor = batchData.trek.vendor;
                            let companyData = null;
                            if (vendor.company_info) {
                                try {
                                    companyData = typeof vendor.company_info === 'string' 
                                        ? JSON.parse(vendor.company_info) 
                                        : vendor.company_info;
                                } catch (e) {
                                    console.error("Error parsing company_info:", e);
                                }
                            }
                            
                            if (companyData) {
                                companyInfo = {
                                    company_name: companyData.company_name || 'N/A',
                                    contact_person: companyData.contact_person || 'N/A',
                                    phone: companyData.phone || 'N/A',
                                    email: companyData.email || 'N/A'
                                };
                            }
                        }
                    }
                    
                    // Get all bookings for this batch with total_travelers
                    let allBatchBookings;
                    if (batchData.bookings && batchData.bookings.length > 0) {
                        allBatchBookings = batchData.bookings;
                        bookingsDetails.totalCount = batchData.bookings.length;
                        bookingsDetails.bookingIds = batchData.bookings.map(b => `BOOK-${String(b.id).padStart(2, '0')}`);
                    } else {
                        // Fallback: query bookings separately
                        allBatchBookings = await Booking.findAll({
                            where: { batch_id: batchId },
                            attributes: ["id", "total_travelers"]
                        });
                        bookingsDetails.totalCount = allBatchBookings.length;
                        bookingsDetails.bookingIds = allBatchBookings.map(b => `BOOK-${String(b.id).padStart(2, '0')}`);
                    }
                    
                    // Calculate total travelers: sum of total_travelers from all bookings in this batch
                    if (allBatchBookings && allBatchBookings.length > 0) {
                        bookedSlots = allBatchBookings.reduce((sum, booking) => {
                            return sum + (parseInt(booking.total_travelers) || 0);
                        }, 0);
                    }
                }
            }
            
            // Return response with batch_cancellation_data object
            console.log(`\n✅ FINAL VALUES for cancellation ${data.id} (batch ${batchId}):`, {
                batch_id: batchId,
                batch_cancellation_data: batchCancellationData,
                source: 'batch_cancellation_requests table'
            });
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
            
            // RETURN with batch_cancellation_data from batch_cancellation_requests table
            const responseData = {
                id: `CAN-${String(data.id).padStart(2, '0')}`,
                batch_id: batchId || null,
                vendor_id: vendorId,
                company_info: companyInfo || {
                    company_name: 'N/A',
                    contact_person: 'N/A',
                    phone: 'N/A',
                    email: 'N/A'
                },
                tbr_id: tbrId,
                trek_details: trekDetails || {
                    trek_id: data.trek?.id || null,
                    trek_name: data.trek?.title || 'N/A',
                    mtr_id: data.trek?.mtr_id || 'N/A'
                },
                bookings_details: bookingsDetails,
                booked_slots: bookedSlots,
                cancellation_date: batchCancellationData.cancellation_date, // FROM batch_cancellation_requests.created_at
                status: batchCancellationData.status, // FROM batch_cancellation_requests.status
                reason: batchCancellationData.reason // FROM batch_cancellation_requests.reason
            };
            
            console.log(`📤 RETURNING DATA:`, {
                id: responseData.id,
                batch_id: responseData.batch_id,
                cancellation_date: responseData.cancellation_date,
                status: responseData.status,
                reason: responseData.reason
            });
            
            return responseData;
        }));

        // Calculate pagination info
        const totalPages = Math.ceil(totalCount / limitNum);
        const hasNextPage = pageNum < totalPages;
        const hasPrevPage = pageNum > 1;

        res.json({
            success: true,
            data: formattedData,
            pagination: {
                currentPage: pageNum,
                totalPages: totalPages,
                totalCount: totalCount,
                limit: limitNum,
                hasNextPage: hasNextPage,
                hasPrevPage: hasPrevPage,
                nextPage: hasNextPage ? pageNum + 1 : null,
                prevPage: hasPrevPage ? pageNum - 1 : null
            },
            count: formattedData.length,
        });

    } catch (error) {
        console.error("Error fetching cancellation bookings:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch cancellation bookings",
        });
    }
};

// Get cancellation booking details by ID
exports.getCancellationBookingDetails = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Remove CAN- prefix if present
        const cancellationId = id.replace('CAN-', '');
        
        const cancellationBooking = await CancellationBooking.findByPk(cancellationId, {
            include: [
                {
                    model: Booking,
                    as: "booking",
                    include: [
                        {
                            model: Customer,
                            as: "customer",
                            attributes: ["id", "name", "email", "phone"]
                        },
                        {
                            model: Batch,
                            as: "batch",
                            attributes: ["id", "tbr_id", "start_date", "end_date"]
                        }
                    ]
                },
                {
                    model: Trek,
                    as: "trek",
                    attributes: ["id", "title", "mtr_id", "description"]
                }
            ]
        });

        if (!cancellationBooking) {
            return res.status(404).json({
                success: false,
                message: "Cancellation booking not found",
            });
        }

        const data = cancellationBooking.toJSON();
        
        const formattedData = {
            id: `CAN-${String(data.id).padStart(2, '0')}`,
            booking_id: `BOOK-${String(data.booking_id).padStart(2, '0')}`,
            customer: {
                id: data.booking?.customer?.id,
                name: data.booking?.customer?.name,
                email: data.booking?.customer?.email,
                phone: data.booking?.customer?.phone
            },
            trek: {
                id: data.trek?.id,
                title: data.trek?.title,
                mtr_id: data.trek?.mtr_id,
                description: data.trek?.description
            },
            batch: data.booking?.batch ? {
                id: data.booking.batch.id,
                tbr_id: data.booking.batch.tbr_id,
                start_date: data.booking.batch.start_date,
                end_date: data.booking.batch.end_date
            } : null,
            refund_amount: parseFloat(data.total_refundable_amount),
            status: data.status,
            reason: data.reason,
            cancellation_date: data.cancellation_date,
            created_date: data.created_at,
            processed_date: data.processed_date,
            refund_transaction_id: data.refund_transaction_id,
            notes: data.notes
        };

        res.json({
            success: true,
            data: formattedData,
        });

    } catch (error) {
        console.error("Error fetching cancellation booking details:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch cancellation booking details",
        });
    }
};

// Admin: Force cancel a booking (including ongoing/completed treks)
exports.adminForceCancelBooking = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { booking_id } = req.params;
        const { reason, refund_amount = 0 } = req.body;

        if (!reason) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: "Reason is required for force cancellation" });
        }

        const booking = await Booking.findByPk(booking_id, {
            include: [{ model: Batch, as: "batch" }],
            transaction
        });

        if (!booking) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: "Booking not found" });
        }

        if (booking.status === "cancelled") {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: "Booking is already cancelled" });
        }

        // Check if cancellation record already exists
        const existingCancellation = await CancellationBooking.findOne({
            where: { booking_id: booking_id },
            transaction
        });

        if (existingCancellation) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: "Cancellation record already exists for this booking" });
        }

        // Admin override: force cancel regardless of trek status
        await booking.update({ status: "cancelled" }, { transaction });

        // Update batch slots
        if (booking.batch) {
            await updateBatchSlotsOnCancellation(booking.batch.id, booking.total_travelers, transaction);
        }

        // Create cancellation record
        console.log("Creating cancellation record with:", {
            booking_id: booking_id,
            customer_id: booking.customer_id,
            batch_id: booking.batch_id,
            trek_id: booking.trek_id
        });

        const cancellationRecord = await CancellationBooking.create({
            booking_id: booking_id,
            customer_id: booking.customer_id,
            batch_id: booking.batch_id,
            trek_id: booking.trek_id,
            total_refundable_amount: parseFloat(refund_amount),
            reason: reason,
            status: "pending",
            cancellation_date: new Date(),
            notes: `Force cancelled by admin. Original status: ${booking.status}`
        }, { transaction });

        await transaction.commit();

        return res.json({
            success: true,
            message: "Booking force cancelled successfully by admin",
            data: {
                booking_id: booking_id,
                cancellation_id: `CAN-${String(cancellationRecord.id).padStart(2, '0')}`,
                refund_amount: parseFloat(refund_amount),
                reason: reason
            }
        });
    } catch (error) {
        await transaction.rollback();
        console.error("Error in admin force cancel:", error);
        return res.status(500).json({ success: false, message: "Failed to force cancel booking" });
    }
};

// Update cancellation booking status
exports.updateCancellationStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes, refund_transaction_id } = req.body;
        
        // Remove CAN- prefix if present
        const cancellationId = id.replace('CAN-', '');
        
        const cancellationBooking = await CancellationBooking.findByPk(cancellationId);
        
        if (!cancellationBooking) {
            return res.status(404).json({
                success: false,
                message: "Cancellation booking not found",
            });
        }

        // Update the cancellation booking
        const updateData = { status };
        if (notes !== undefined) updateData.notes = notes;
        if (refund_transaction_id !== undefined) updateData.refund_transaction_id = refund_transaction_id;
        if (status === 'processed' || status === 'completed') {
            updateData.processed_date = new Date();
        }

        await cancellationBooking.update(updateData);

        res.json({
            success: true,
            message: "Cancellation status updated successfully",
            data: {
                id: `CAN-${String(cancellationBooking.id).padStart(2, '0')}`,
                status: cancellationBooking.status,
                processed_date: cancellationBooking.processed_date
            }
        });

    } catch (error) {
        console.error("Error updating cancellation status:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update cancellation status",
        });
    }
};
