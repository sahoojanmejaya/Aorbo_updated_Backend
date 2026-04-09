const {
    User,
    Customer,
    Booking,
    Trek,
    PaymentLog,
    BookingParticipant,
    Vendor,
    Batch,
    TrekCaptain,
    Traveler,
    BookingTraveler,
} = require("../../models");
const { Op } = require("sequelize");
const sequelize = require("sequelize");

// Get all customers for a vendor (users who have booked vendor's treks)
exports.getVendorCustomers = async (req, res) => {
    try {
        let vendorId = req.user.id;

        if (!vendorId) {
            // If vendorId is not directly available, get it from the vendor association
            const userWithVendor = await User.findByPk(req.user.id, {
                include: [{ model: Vendor, as: "vendor" }],
            });

            if (!userWithVendor?.vendor) {
                return res.status(403).json({
                    success: false,
                    message: "User is not associated with any vendor",
                });
            }

            vendorId = userWithVendor.vendor.id;
        }

        const { search, status, page = 1, limit = 10 } = req.query;

        // Build where clause for search
        const userWhereClause = {};
        const trimmedSearch = (search || "").trim();
        if (trimmedSearch && trimmedSearch !== "undefined") {
            // If search looks like a TBR ID, filter customers by bookings that match that TBR
            if (trimmedSearch.length >= 6 && trimmedSearch.toUpperCase().startsWith("TBR")) {
                const { Batch } = require("../../models");
                const tbrLike = `%${trimmedSearch}%`;
                // 1) Find Batch IDs that match the TBR pattern (case-insensitive LIKE)
                const batches = await Batch.findAll({
                    where: { tbr_id: { [Op.like]: tbrLike } },
                    attributes: ["id"],
                    raw: true,
                });
                const batchIds = batches.map((b) => b.id);
                // 2) Find Bookings for those batches for this vendor
                let customerIds = [];
                if (batchIds.length > 0) {
                    const tbrBookings = await Booking.findAll({
                        where: { vendor_id: vendorId, batch_id: { [Op.in]: batchIds } },
                        attributes: ["customer_id"],
                        group: ["customer_id"],
                        raw: true,
                    });
                    customerIds = tbrBookings.map((b) => b.customer_id);
                }
                // If nothing found, force empty result by setting impossible id
                userWhereClause.id = customerIds.length
                    ? { [Op.in]: customerIds }
                    : { [Op.eq]: -1 };
            } else {
                userWhereClause[Op.or] = [
                    { name: { [Op.like]: `%${trimmedSearch}%` } },
                    { email: { [Op.like]: `%${trimmedSearch}%` } },
                    { phone: { [Op.like]: `%${trimmedSearch}%` } },
                ];
            }
        }

        // Get customers with their booking statistics
        const customers = await Customer.findAndCountAll({
            where: userWhereClause,
            include: [
                {
                    model: Booking,
                    as: "bookings",
                    where: { vendor_id: vendorId },
                    required: false, // Show all customers, not just those with bookings
                    include: [
                        {
                            model: Trek,
                            as: "trek",
                            attributes: ["id", "title"],
                        },
                        {
                            model: PaymentLog,
                            as: "payments",
                            attributes: ["amount", "status"],
                        },
                    ],
                },
                {
                    model: require("../../models").City,
                    as: "city",
                    attributes: ["id", "cityName"],
                },
                {
                    model: require("../../models").State,
                    as: "state",
                    attributes: ["id", "name"],
                },
            ],
            distinct: true, // Use distinct instead of group
            limit: parseInt(limit),
            offset: (parseInt(page) - 1) * parseInt(limit),
            order: [["createdAt", "DESC"]],
        });

        // Transform data to include booking statistics
        const transformedCustomers = await Promise.all(
            customers.rows.map(async (customer) => {
                const customerBookings = await Booking.findAll({
                    where: {
                        customer_id: customer.id,
                        vendor_id: vendorId,
                    },
                    include: [
                        {
                            model: PaymentLog,
                            as: "payments",
                            attributes: ["amount", "status"],
                        },
                    ],
                    order: [["createdAt", "DESC"]],
                });

                // Calculate statistics
                const totalBookings = customerBookings.length;
                const totalSpent = customerBookings.reduce(
                    (sum, booking) =>
                        sum + parseFloat(booking.final_amount || 0),
                    0
                );
                const lastBooking =
                    customerBookings.length > 0
                        ? customerBookings[0].createdAt
                        : null;

                // Determine status based on recent activity
                const isActive =
                    lastBooking &&
                    new Date(lastBooking) >
                        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // Active if booked in last 90 days

                return {
                    id: customer.id,
                    name: customer.name,
                    email: customer.email,
                    phone: customer.phone,
                    city_id: customer.city_id,
                    state_id: customer.state_id,
                    city: customer.city
                        ? {
                              id: customer.city.id,
                              name: customer.city.cityName,
                          }
                        : null,
                    state: customer.state
                        ? {
                              id: customer.state.id,
                              name: customer.state.name,
                          }
                        : null,
                    location:
                        customer.city && customer.state
                            ? `${customer.city.cityName}, ${customer.state.name}`
                            : customer.city
                            ? customer.city.cityName
                            : customer.state
                            ? customer.state.name
                            : "N/A",
                    tripsBooked: totalBookings,
                    lastBooking: lastBooking
                        ? new Date(lastBooking).toLocaleDateString("en-US")
                        : "N/A",
                    totalSpent:
                        totalBookings > 0
                            ? `₹${totalSpent.toLocaleString()}`
                            : "₹0",
                    status: isActive ? "Active" : "Inactive",
                    joinedDate: customer.createdAt
                        ? new Date(customer.createdAt).toLocaleDateString(
                              "en-US"
                          )
                        : "N/A",
                };
            })
        );

        // Filter by status if specified
        const filteredCustomers =
            status && status !== "all" && status !== "undefined"
                ? transformedCustomers.filter(
                      (customer) =>
                          customer.status.toLowerCase() === status.toLowerCase()
                  )
                : transformedCustomers;

        res.json({
            success: true,
            data: filteredCustomers,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(customers.count / parseInt(limit)),
                totalCount: customers.count,
                itemsPerPage: parseInt(limit),
            },
        });
    } catch (error) {
        console.error("Error fetching vendor customers:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch customers",
        });
    }
};

// Get detailed customer information
exports.getCustomerById = async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = req.user.id;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        const customer = await Customer.findByPk(id, {
            include: [
                {
                    model: Booking,
                    as: "bookings",
                    where: { vendor_id: vendorId },
                    required: false,
                    include: [
                        {
                            model: Trek,
                            as: "trek",
                            attributes: ["id", "title", "base_price"],
                        },
                        {
                            model: PaymentLog,
                            as: "payments",
                            attributes: ["amount", "status", "created_at"],
                        },
                    ],
                    order: [["createdAt", "DESC"]],
                },
                {
                    model: require("../../models").City,
                    as: "city",
                    attributes: ["id", "cityName"],
                },
                {
                    model: require("../../models").State,
                    as: "state",
                    attributes: ["id", "name"],
                },
            ],
        });

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found",
            });
        }

        // Calculate customer statistics
        const totalBookings = customer.bookings?.length || 0;
        const totalSpent =
            customer.bookings?.reduce(
                (sum, booking) => sum + parseFloat(booking.final_amount || 0),
                0
            ) || 0;
        const lastBooking = customer.bookings?.[0]?.createdAt || null;

        const customerData = {
            id: customer.id,
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            city: customer.city,
            state: customer.state,
            location:
                customer.city && customer.state
                    ? `${customer.city.cityName}, ${customer.state.name}`
                    : customer.city
                    ? customer.city.cityName
                    : customer.state
                    ? customer.state.name
                    : "N/A",
            totalBookings,
            totalSpent: `₹${totalSpent.toLocaleString()}`,
            lastBooking: lastBooking
                ? new Date(lastBooking).toLocaleDateString("en-US")
                : "N/A",
            joinedDate: customer.createdAt
                ? new Date(customer.createdAt).toLocaleDateString("en-US")
                : "N/A",
            bookings: customer.bookings || [],
        };

        res.json({
            success: true,
            data: customerData,
        });
    } catch (error) {
        console.error("Error fetching customer details:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch customer details",
        });
    }
};

// Update customer information
exports.updateCustomer = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone } = req.body; // Only allow updating name and phone
        const vendorId = req.user.id;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        const customer = await Customer.findByPk(id);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found",
            });
        }

        // Verify customer has bookings with this vendor
        const hasBookings = await Booking.findOne({
            where: { customer_id: id, vendor_id: vendorId },
        });

        if (!hasBookings) {
            return res.status(403).json({
                success: false,
                message:
                    "Access denied. Customer not associated with this vendor.",
            });
        }

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (phone !== undefined) updateData.phone = phone;

        await customer.update(updateData);

        res.json({
            success: true,
            message: "Customer updated successfully",
            data: {
                id: customer.id,
                name: customer.name,
                email: customer.email,
                phone: customer.phone,
            },
        });
    } catch (error) {
        console.error("Error updating customer:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update customer",
        });
    }
};

// Create a new customer
exports.createCustomer = async (req, res) => {
    try {
        const { name, email, phone } = req.body;
        const vendorId = req.user.id;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Validation
        if (!name || !email || !phone) {
            return res.status(400).json({
                success: false,
                message: "Name, email, and phone are required",
            });
        }

        // Check if user already exists by email or phone
        const existing = await Customer.findOne({
            where: { [Op.or]: [{ email }, { phone }] },
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: "A customer with this email or phone already exists",
                existingCustomer: {
                    id: existing.id,
                    name: existing.name,
                    email: existing.email,
                    phone: existing.phone,
                },
            });
        }

        // Create new customer
        const customer = await Customer.create({
            name,
            email,
            phone,
        });

        res.status(201).json({
            success: true,
            message: "Customer created successfully",
            data: {
                id: customer.id,
                name: customer.name,
                email: customer.email,
                phone: customer.phone,
            },
        });
    } catch (error) {
        console.error("Error creating customer:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create customer",
        });
    }
};

// Get traveler details for a specific booking
exports.getBookingTravelers = async (req, res) => {
    try {
        const vendorId = req.user.id;
        const { bookingId } = req.params;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Get booking with travelers
        const booking = await Booking.findOne({
            where: {
                id: bookingId,
                vendor_id: vendorId,
            },
            include: [
                {
                    model: BookingTraveler,
                    as: "travelers",
                    include: [
                        {
                            model: Traveler,
                            as: "traveler",
                            attributes: ["id", "name", "age", "gender"],
                        },
                    ],
                },
            ],
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found or access denied.",
            });
        }

        // Format traveler data
        const travelers = booking.travelers.map(bt => ({
            id: bt.traveler.id,
            name: bt.traveler.name,
            age: bt.traveler.age,
            gender: bt.traveler.gender,
        }));

        res.json({
            success: true,
            data: {
                bookingId: booking.id,
                travelers: travelers,
            },
        });
    } catch (error) {
        console.error("Error fetching booking travelers:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch traveler details",
        });
    }
};

// Get customer analytics
exports.getCustomerAnalytics = async (req, res) => {
    try {
        const vendorId = req.user.id;
        const { startDate, endDate } = req.query;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        const whereClause = { vendor_id: vendorId };
        if (startDate && endDate) {
            whereClause.created_at = {
                [Op.between]: [new Date(startDate), new Date(endDate)],
            };
        }

        // Get customer statistics
        const totalCustomers = await Customer.count({
            include: [
                {
                    model: Booking,
                    as: "bookings",
                    where: whereClause,
                    required: true,
                },
            ],
        });

        const newCustomers = await Customer.count({
            include: [
                {
                    model: Booking,
                    as: "bookings",
                    where: whereClause,
                    required: true,
                },
            ],
            where: {
                createdAt: {
                    [Op.between]: [
                        startDate
                            ? new Date(startDate)
                            : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                        endDate ? new Date(endDate) : new Date(),
                    ],
                },
            },
        });

        const activeCustomers = await Customer.count({
            include: [
                {
                    model: Booking,
                    as: "bookings",
                    where: {
                        ...whereClause,
                        createdAt: {
                            [Op.gte]: new Date(
                                Date.now() - 90 * 24 * 60 * 60 * 1000
                            ),
                        },
                    },
                    required: true,
                },
            ],
        });

        res.json({
            success: true,
            data: {
                totalCustomers,
                newCustomers,
                activeCustomers,
                inactiveCustomers: totalCustomers - activeCustomers,
            },
        });
    } catch (error) {
        console.error("Error fetching customer analytics:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch customer analytics",
        });
    }
};

// Get vendor customer overview statistics
exports.getVendorCustomerOverview = async (req, res) => {
    try {
        const vendorId = req.user.id;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Get unique customers who have bookings and all bookings separately
        const customersWithBookings = await Customer.findAll({
            include: [
                {
                    model: Booking,
                    as: "bookings",
                    include: [
                        {
                            model: Trek,
                            as: "trek",
                            where: { vendor_id: vendorId },
                            required: true,
                        },
                    ],
                    required: true, // Only show customers who have bookings
                },
            ],
            distinct: true, // Ensure each customer appears only once
        });

        // Get all bookings separately for statistics (ONLY for this vendor)
        const allBookings = await Booking.findAll({
            include: [
                {
                    model: Trek,
                    as: "trek",
                    where: { vendor_id: vendorId },
                    required: true,
                },
                {
                    model: Customer,
                    as: "customer",
                    required: true,
                },
            ],
        });

        // Count unique customers who have bookings using customer_id calculation
        const uniqueCustomerIds = new Set();
        allBookings.forEach(booking => {
            if (booking.customer && booking.customer.id) {
                uniqueCustomerIds.add(booking.customer.id);
            }
        });
        const totalCustomers = uniqueCustomerIds.size; // Unique customer count
        
        // Count bookings by payment status
        const fullPaidCount = allBookings.filter(booking => 
            booking.payment_status === "completed" || booking.payment_status === "full_paid"
        ).length;
        
        const partialPaidCount = allBookings.filter(booking => 
            booking.payment_status === "partial"
        ).length;
        
        const cancelledCount = allBookings.filter(booking => 
            booking.status === "cancelled"
        ).length;

        // Calculate total revenue using same method as Bookings Overview API
        const totalRevenue = (await Booking.sum("final_amount", {
            include: [
                {
                    model: Trek,
                    as: "trek",
                    where: { vendor_id: vendorId },
                    required: true,
                },
            ],
            where: {
                payment_status: { [Op.in]: ["completed", "partial"] },
            },
        })) || 0;
        
        console.log("Debug Overview Stats:");
        console.log("Unique customer IDs:", Array.from(uniqueCustomerIds));
        console.log("Total unique customers with bookings:", totalCustomers);
        console.log("Total bookings:", allBookings.length);
        console.log("fullPaidCount:", fullPaidCount);
        console.log("partialPaidCount:", partialPaidCount);
        console.log("cancelledCount:", cancelledCount);
        console.log("totalRevenue:", totalRevenue);

        const overview = {
            totalCustomers,
            fullPaidCount,
            partialPaidCount,
            cancelledCount,
            totalRevenue, // Now using same Booking.sum() method as Bookings Overview
            uniqueCustomers: totalCustomers, // Force unique customer count
        };

        res.json({
            success: true,
            data: overview,
        });
    } catch (error) {
        console.error("Error fetching customer overview:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch customer overview",
        });
    }
};

// Get all vendor customers with detailed information
exports.getAllVendorCustomers = async (req, res) => {
    try {
        console.log("getAllVendorCustomers called with req.user:", req.user);
        const vendorId = req.user.vendorId || req.user.id;
        const {
            search = "",
            trekFilter = "all",
            paymentFilter = "all",
            dateFilter = "all",
            customFromDate,
            customToDate,
            page = 1,
            limit = 20,
            viewMode = "list",
        } = req.query;

        console.log("Vendor ID from req.user:", { vendorId, userId: req.user.id, userVendorId: req.user.vendorId });

        if (!vendorId) {
            console.log("No vendor ID found in request");
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        const offset = (page - 1) * limit;

        // Build search conditions
        const searchConditions = {};
        let isTbrSearch = false;
        let batchSearchCondition = null;
        
        if (search && search.trim() !== "") {
            const trimmedSearch = search.trim().toUpperCase();
            // Check if search is a TBR ID
            if (trimmedSearch.startsWith("TBR")) {
                isTbrSearch = true;
                batchSearchCondition = {
                    tbr_id: { [Op.like]: `%${trimmedSearch}%` }
                };
            } else {
                // Regular customer field search
                searchConditions[Op.or] = [
                    { name: { [Op.like]: `%${search}%` } },
                    { email: { [Op.like]: `%${search}%` } },
                    { phone: { [Op.like]: `%${search}%` } },
                ];
            }
        }
        
        // Build booking filters
        const bookingFilters = {};
        
        // Trek filter
        if (trekFilter !== "all") {
            bookingFilters.trek_id = trekFilter;
        }
        
        // Payment status filter
        if (paymentFilter !== "all") {
            if (paymentFilter === "cancelled") {
                // Cancelled bookings have status = 'cancelled', not payment_status
                bookingFilters.status = "cancelled";
            } else {
                // Map frontend values to backend payment_status values
                const paymentStatusMap = {
                    "full": "full_paid",
                    "partial": "partial"
                };
                bookingFilters.payment_status = paymentStatusMap[paymentFilter] || paymentFilter;
            }
        }
        
        // Date filters
        if (dateFilter !== "all") {
            const now = new Date();
            switch (dateFilter) {
                case "day":
                    const todayStart = new Date();
                    todayStart.setHours(0, 0, 0, 0);
                    const todayEnd = new Date();
                    todayEnd.setHours(23, 59, 59, 999);
                    bookingFilters.created_at = {
                        [Op.between]: [todayStart, todayEnd]
                    };
                    break;
                case "this-week":
                    const weekStart = new Date();
                    weekStart.setDate(weekStart.getDate() - 7);
                    bookingFilters.created_at = {
                        [Op.gte]: weekStart
                    };
                    break;
                case "this-month":
                    const monthStart = new Date();
                    monthStart.setMonth(monthStart.getMonth() - 1);
                    bookingFilters.created_at = {
                        [Op.gte]: monthStart
                    };
                    break;
            }
        }
        
        // Custom date range filter
        if (customFromDate && customToDate) {
            bookingFilters.created_at = {
                [Op.between]: [new Date(customFromDate), new Date(customToDate)]
            };
        }

        console.log("About to execute query with vendorId:", vendorId);
        console.log("Search conditions:", searchConditions);
        console.log("Booking filters:", bookingFilters);
        console.log("Is TBR search:", isTbrSearch);
        console.log("Batch search condition:", batchSearchCondition);
        console.log("Frontend filter values:", { trekFilter, paymentFilter, dateFilter, customFromDate, customToDate });

        // Prepare Batch include with TBR search condition if applicable
        const batchInclude = {
            model: require("../../models").Batch,
            as: "batch",
            attributes: ["id", "tbr_id", "start_date", "end_date"],
            required: isTbrSearch ? true : false, // Required if searching by TBR
        };
        
        // Only add where clause if batchSearchCondition exists
        if (batchSearchCondition) {
            batchInclude.where = batchSearchCondition;
        }

        // Get bookings with customer data to show separate entry for each booking
        const bookingsResult = await Booking.findAndCountAll({
            where: {
                ...bookingFilters,
                vendor_id: vendorId, // ✅ Add vendor filter to ensure only this vendor's bookings
            },
            attributes: [
                "id",
                "customer_id",
                "trek_id",
                "vendor_id",
                "batch_id",
                "total_travelers",
                "vendor_discount",
                "coupon_discount",
                "total_amount",
                "final_amount",
                "advance_amount",
                "payment_status",
                "status",
                "booking_date",
                "created_at",
                "createdAt",
                "updatedAt",
            ],
            include: [
                {
                    model: Customer,
                    as: "customer",
                    where: Object.keys(searchConditions).length > 0 ? searchConditions : undefined,
                    required: isTbrSearch ? false : true, // Not required if searching by TBR, required otherwise
                    include: [
                        {
                            model: require("../../models").City,
                            as: "city",
                            attributes: ["id", "cityName"],
                        },
                        {
                            model: require("../../models").State,
                            as: "state",
                            attributes: ["id", "name"],
                        },
                    ],
                },
                {
                    model: Trek,
                    as: "trek",
                    attributes: ["id", "title", "base_price"],
                    include: [
                        {
                            model: require("../../models").TrekCaptain,
                            as: "captain",
                            attributes: ["id", "name", "phone"],
                            required: false,
                        },
                    ],
                },
                batchInclude,
                {
                    model: require("../../models").CancellationBooking,
                    as: "cancellationBooking",
                    attributes: ["id", "reason", "cancellation_date", "total_refundable_amount", "status"],
                    required: false,
                },
            ],
            limit: parseInt(limit),
            offset: offset,
            order: [["createdAt", "DESC"]],
            distinct: true,
            col: "id",
        });
        const bookings = bookingsResult.rows;
        const count = bookingsResult.count;

        console.log("Query executed successfully. Found bookings:", bookings.length, "Total count:", count);

        // Transform bookings data to match frontend expectations (each booking = one customer entry)
        const customerData = bookings.map((booking) => {
            const customer = booking.customer;
            const captain = booking.trek?.captain || null;
            const batch = booking.batch || null;
            const cancellationBooking = booking.cancellationBooking || null;

            // Get values from booking and trek
            const basePrice = parseFloat(booking.trek?.base_price || 0);
            const vendorDiscount = parseFloat(booking.vendor_discount || 0);
            const couponDiscount = parseFloat(booking.coupon_discount || 0);
            const totalTravelers = parseInt(booking.total_travelers || 1);

            // Calculate final amount: (base_price - vendor_discount - coupon_discount) * total_travelers
            const calculatedAmount = (basePrice - vendorDiscount - couponDiscount) * totalTravelers;

            return {
                id: `CUST${customer.id}`,
                bookingId: `${booking.id}`, // Add booking ID
                tbrId: batch?.tbr_id || `TBR${booking.id}`, // Use batch TBR ID or fallback to booking ID
                name: customer.name,
                phone: customer.phone,
                email: customer.email,
                trekId: booking.trek_id,
                trekName: booking.trek ? booking.trek.title : "N/A",
                trekDate: batch?.start_date || null,
                bookingTime: booking.booking_date || booking.created_at || booking.createdAt, // Use booking_date first, then fallback to timestamps
                bookingId: booking.id, // Add booking ID
                totalTravelers: totalTravelers, // Total travelers count
                paymentStatus: booking.payment_status,
                // Return calculated amount as the main amount
                amount: calculatedAmount,
                // Keep original amounts for reference if needed
                originalFinalAmount: parseFloat(booking.final_amount || 0),
                originalPaidAmount: parseFloat(booking.final_amount || 0),
                advanceAmount: parseFloat(booking.advance_amount || 0),
                // Include discount details for reference
                basePrice: basePrice,
                vendorDiscount: vendorDiscount,
                couponDiscount: couponDiscount,
                captain: captain?.name || "Not Available",
                captainPhone: captain?.phone || null,
                status: customer.status || "active",
                // Cancellation data - use CancellationBooking table for cancelled bookings
                cancellationDate: cancellationBooking?.cancellation_date || (booking.status === 'cancelled' ? booking.updatedAt : null),
                cancellationReason: cancellationBooking?.reason || (booking.status === 'cancelled' ? 'No reason' : null),
                refundAmount: cancellationBooking?.total_refundable_amount || (booking.status === 'cancelled' ? booking.refund_amount : null),
            };
        });

        // Filters already applied at SQL level, no need for additional filtering
        // Apply view mode grouping if needed  
        let responseData = customerData;
        if (viewMode === "grouped") {
            // Group customers by trek
            const groupedByTrek = customerData.reduce((acc, customer) => {
                if (!acc[customer.trekId]) {
                    acc[customer.trekId] = {
                        trekId: customer.trekId,
                        trekName: customer.trekName,
                        customers: []
                    };
                }
                acc[customer.trekId].customers.push(customer);
                return acc;
            }, {});
            
            responseData = Object.values(groupedByTrek);
        }
        let filteredCustomers = responseData;

        // Trek filter - already applied at SQL level

        // Payment filter - already applied at SQL level

        // Date filter - already applied at SQL level

        res.json({
            success: true,
            data: filteredCustomers,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(count / limit),
                totalCount: count,
                limit: parseInt(limit),
            },
        });
    } catch (error) {
        console.error("Error fetching all vendor customers:", error);
        console.error("Error stack:", error.stack);
        console.error("Error details:", {
            name: error.name,
            message: error.message,
            sql: error.sql,
            original: error.original
        });
        res.status(500).json({
            success: false,
            message: "Failed to fetch customers",
            error: error.message
        });
    }
};
