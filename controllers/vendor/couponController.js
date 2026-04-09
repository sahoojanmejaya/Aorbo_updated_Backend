const { Coupon, CouponAssignment, User, Vendor, Trek } = require("../../models");
const { Op } = require("sequelize");
const { validationResult } = require("express-validator");
const CouponAuditService = require("../../services/couponAuditService");

// Get coupons by trek ID
const getCouponsByTrek = async (req, res) => {
    try {
        const trekId = req.params.trekId;

        if (!trekId) {
            return res.status(400).json({
                success: false,
                error: "Trek ID is required",
                message: "Please provide trek ID as URL parameter"
            });
        }

        console.log('Fetching coupons for trek ID:', trekId);

        const coupons = await Coupon.findAll({
            where: {
                [Op.or]: [
                    { assigned_trek_id: trekId },
                    { assigned_trek_id: null }
                ]
            },
            order: [
                ["assigned_trek_id", "ASC"], // Trek-specific coupons first
                ["created_at", "DESC"]
            ],
            include: [
                {
                    model: Vendor,
                    as: "vendor",
                    attributes: ["id", "company_info", "status"],
                    include: [
                        {
                            model: User,
                            as: "user",
                            attributes: ["id", "name", "email", "phone"]
                        }
                    ]
                },
                {
                    model: Trek,
                    as: "assignedTrek",
                    attributes: ["id", "title", "destination_id"],
                    required: false
                }
            ]
        });

        console.log('Found coupons for trek:', coupons.length);

        // Serialize the coupons to ensure dates are properly formatted and include all fields
        const serializedCoupons = coupons.map(coupon => {
            try {
                const couponData = coupon.toJSON();

                return {
                    // Basic coupon information
                    id: couponData.id,
                    title: couponData.title,
                    code: couponData.code,
                    description: couponData.description,
                    color: couponData.color,

                    // Discount details
                    discount_type: couponData.discount_type,
                    discount_value: couponData.discount_value,
                    min_amount: couponData.min_amount,
                    max_discount_amount: couponData.max_discount_amount,

                    // Usage limits
                    max_uses: couponData.max_uses,
                    current_uses: couponData.current_uses,

                    // Validity period
                    valid_from: couponData.valid_from ? couponData.valid_from.toISOString() : null,
                    valid_until: couponData.valid_until ? couponData.valid_until.toISOString() : null,

                    // Status information
                    status: couponData.status,
                    approval_status: couponData.approval_status,
                    admin_notes: couponData.admin_notes,

                    // Terms and conditions (parse JSON if it's a string)
                    terms_and_conditions: (() => {
                        try {
                            if (!couponData.terms_and_conditions) return [];
                            if (typeof couponData.terms_and_conditions === 'string') {
                                return JSON.parse(couponData.terms_and_conditions);
                            }
                            return couponData.terms_and_conditions;
                        } catch (error) {
                            console.error('Error parsing terms_and_conditions JSON:', error);
                            console.error('Invalid JSON data:', couponData.terms_and_conditions);
                            // Return the raw string as a single item array if JSON parsing fails
                            return [couponData.terms_and_conditions];
                        }
                    })(),

                    // Vendor information
                    vendor_id: couponData.vendor_id,
                    vendor: couponData.vendor ? {
                        id: couponData.vendor.id,
                        company_info: couponData.vendor.company_info,
                        status: couponData.vendor.status,
                        user: couponData.vendor.user ? {
                            id: couponData.vendor.user.id,
                            name: couponData.vendor.user.name,
                            email: couponData.vendor.user.email,
                            phone: couponData.vendor.user.phone
                        } : null
                    } : null,

                    // Assigned trek information
                    assigned_trek_id: couponData.assigned_trek_id,
                    assigned_trek_name: couponData.assignedTrek ? couponData.assignedTrek.title : null,
                    assignedTrek: couponData.assignedTrek ? {
                        id: couponData.assignedTrek.id,
                        title: couponData.assignedTrek.title,
                        destination_id: couponData.assignedTrek.destination_id
                    } : null,

                    // Timestamps
                    created_at: couponData.created_at ? couponData.created_at.toISOString() : null,
                    updated_at: couponData.updated_at ? couponData.updated_at.toISOString() : null,

                    // Additional computed fields
                    // Check if expired: valid_until should be valid for the entire day (end of day)
                    is_expired: (() => {
                        if (!couponData.valid_until) return false;
                        const validUntil = new Date(couponData.valid_until);
                        const now = new Date();
                        // Set valid_until to end of day (23:59:59.999) for comparison
                        validUntil.setHours(23, 59, 59, 999);
                        return validUntil < now;
                    })(),
                    is_active: couponData.status === 'active' && couponData.approval_status === 'approved',
                    usage_percentage: couponData.max_uses ? (couponData.current_uses / couponData.max_uses) * 100 : 0,
                    remaining_uses: couponData.max_uses ? couponData.max_uses - couponData.current_uses : null
                };
            } catch (error) {
                console.error('Error serializing coupon:', error);
                console.error('Coupon data:', coupon);
                // Return a basic coupon object with error info
                return {
                    id: coupon.id || 'unknown',
                    title: coupon.title || 'Error loading coupon',
                    code: coupon.code || 'ERROR',
                    description: 'Error loading coupon data',
                    discount_type: 'unknown',
                    discount_value: 0,
                    valid_from: null,
                    valid_until: null,
                    status: 'error',
                    approval_status: 'error',
                    terms_and_conditions: [],
                    error: 'Failed to load coupon data'
                };
            }
        });

        // Separate trek-specific and common coupons for statistics
        const trekSpecificCoupons = serializedCoupons.filter(c => c.assigned_trek_id == trekId);
        const commonCoupons = serializedCoupons.filter(c => c.assigned_trek_id === null);

        res.json({
            success: true,
            data: serializedCoupons,
            count: serializedCoupons.length,
            trek_info: {
                trek_id: trekId,
                total_coupons: serializedCoupons.length,
                trek_specific_coupons: trekSpecificCoupons.length,
                common_coupons: commonCoupons.length,
                active_coupons: serializedCoupons.filter(c => c.status === 'active').length,
                pending_coupons: serializedCoupons.filter(c => c.approval_status === 'pending').length,
                approved_coupons: serializedCoupons.filter(c => c.approval_status === 'approved').length,
                rejected_coupons: serializedCoupons.filter(c => c.approval_status === 'rejected').length,
                expired_coupons: serializedCoupons.filter(c => c.is_expired).length
            }
        });
    } catch (error) {
        console.error("Error fetching coupons by trek:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch coupons",
            message: error.message
        });
    }
};

// Get vendor coupons with all details
const getVendorCoupons = async (req, res) => {
    try {
        // Get vendor ID from URL parameter or from authenticated user
        const vendorId = req.params.vendorId || req.user?.id;

        if (!vendorId) {
            return res.status(400).json({
                success: false,
                error: "Vendor ID is required",
                message: "Please provide vendor ID as URL parameter or ensure user is authenticated"
            });
        }

        console.log('Fetching coupons for vendor ID:', vendorId);

        const coupons = await Coupon.findAll({
            where: { vendor_id: vendorId },
            order: [["created_at", "DESC"]],
            include: [
                {
                    model: Vendor,
                    as: "vendor",
                    attributes: ["id", "company_info", "status"],
                    include: [
                        {
                            model: User,
                            as: "user",
                            attributes: ["id", "name", "email", "phone"]
                        }
                    ]
                },
                {
                    model: Trek,
                    as: "assignedTrek",
                    attributes: ["id", "title", "destination_id"],
                    required: false
                }
            ]
        });

        console.log('Found coupons:', coupons.length);

        // Serialize the coupons to ensure dates are properly formatted and include all fields
        const serializedCoupons = coupons.map(coupon => {
            try {
                const couponData = coupon.toJSON();

                return {
                    // Basic coupon information
                    id: couponData.id,
                    title: couponData.title,
                    code: couponData.code,
                    description: couponData.description,
                    color: couponData.color,

                    // Discount details
                    discount_type: couponData.discount_type,
                    discount_value: couponData.discount_value,
                    min_amount: couponData.min_amount,
                    max_discount_amount: couponData.max_discount_amount,

                    // Usage limits
                    max_uses: couponData.max_uses,
                    current_uses: couponData.current_uses,

                    // Validity period
                    valid_from: couponData.valid_from ? couponData.valid_from.toISOString() : null,
                    valid_until: couponData.valid_until ? couponData.valid_until.toISOString() : null,

                    // Status information
                    status: couponData.status,
                    approval_status: couponData.approval_status,
                    admin_notes: couponData.admin_notes,

                    // Terms and conditions (parse JSON if it's a string)
                    terms_and_conditions: (() => {
                        try {
                            if (!couponData.terms_and_conditions) return [];
                            if (typeof couponData.terms_and_conditions === 'string') {
                                return JSON.parse(couponData.terms_and_conditions);
                            }
                            return couponData.terms_and_conditions;
                        } catch (error) {
                            console.error('Error parsing terms_and_conditions JSON:', error);
                            console.error('Invalid JSON data:', couponData.terms_and_conditions);
                            // Return the raw string as a single item array if JSON parsing fails
                            return [couponData.terms_and_conditions];
                        }
                    })(),

                    // Vendor information
                    vendor_id: couponData.vendor_id,
                    vendor: couponData.vendor ? {
                        id: couponData.vendor.id,
                        company_info: couponData.vendor.company_info,
                        status: couponData.vendor.status,
                        user: couponData.vendor.user ? {
                            id: couponData.vendor.user.id,
                            name: couponData.vendor.user.name,
                            email: couponData.vendor.user.email,
                            phone: couponData.vendor.user.phone
                        } : null
                    } : null,

                    // Assigned trek information
                    assigned_trek_id: couponData.assigned_trek_id,
                    assigned_trek_name: couponData.assignedTrek ? couponData.assignedTrek.title : null,
                    assignedTrek: couponData.assignedTrek ? {
                        id: couponData.assignedTrek.id,
                        title: couponData.assignedTrek.title,
                        destination_id: couponData.assignedTrek.destination_id
                    } : null,

                    // Timestamps
                    created_at: couponData.created_at ? couponData.created_at.toISOString() : null,
                    updated_at: couponData.updated_at ? couponData.updated_at.toISOString() : null,

                    // Additional computed fields
                    // Check if expired: valid_until should be valid for the entire day (end of day)
                    is_expired: (() => {
                        if (!couponData.valid_until) return false;
                        const validUntil = new Date(couponData.valid_until);
                        const now = new Date();
                        // Set valid_until to end of day (23:59:59.999) for comparison
                        validUntil.setHours(23, 59, 59, 999);
                        return validUntil < now;
                    })(),
                    is_active: couponData.status === 'active' && couponData.approval_status === 'approved',
                    usage_percentage: couponData.max_uses ? (couponData.current_uses / couponData.max_uses) * 100 : 0,
                    remaining_uses: couponData.max_uses ? couponData.max_uses - couponData.current_uses : null
                };
            } catch (error) {
                console.error('Error serializing coupon:', error);
                console.error('Coupon data:', coupon);
                // Return a basic coupon object with error info
                return {
                    id: coupon.id || 'unknown',
                    title: coupon.title || 'Error loading coupon',
                    code: coupon.code || 'ERROR',
                    description: 'Error loading coupon data',
                    discount_type: 'unknown',
                    discount_value: 0,
                    valid_from: null,
                    valid_until: null,
                    status: 'error',
                    approval_status: 'error',
                    terms_and_conditions: [],
                    error: 'Failed to load coupon data'
                };
            }
        });

        res.json({
            success: true,
            data: serializedCoupons,
            count: serializedCoupons.length,
            vendor_info: {
                vendor_id: vendorId,
                total_coupons: serializedCoupons.length,
                active_coupons: serializedCoupons.filter(c => c.status === 'active').length,
                pending_coupons: serializedCoupons.filter(c => c.approval_status === 'pending').length,
                approved_coupons: serializedCoupons.filter(c => c.approval_status === 'approved').length,
                rejected_coupons: serializedCoupons.filter(c => c.approval_status === 'rejected').length,
                expired_coupons: serializedCoupons.filter(c => c.is_expired).length
            }
        });
    } catch (error) {
        console.error("Error fetching vendor coupons:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch coupons",
            message: error.message
        });
    }
};

// Get specific vendor coupon by ID with all details
const getVendorCouponById = async (req, res) => {
    try {
        // Get vendor ID from URL parameter or from authenticated user
        const vendorId = req.params.vendorId || req.user?.id;
        const couponId = req.params.id;

        if (!vendorId) {
            return res.status(400).json({
                success: false,
                error: "Vendor ID is required",
                message: "Please provide vendor ID as URL parameter or ensure user is authenticated"
            });
        }

        console.log(`Fetching coupon ${couponId} for vendor ${vendorId}`);

        const coupon = await Coupon.findOne({
            where: {
                id: couponId,
                vendor_id: vendorId
            },
            include: [
                {
                    model: Vendor,
                    as: "vendor",
                    attributes: ["id", "company_info", "status"],
                    include: [
                        {
                            model: User,
                            as: "user",
                            attributes: ["id", "name", "email", "phone"]
                        }
                    ]
                }
            ]
        });

        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: "Coupon not found or you don't have permission to view it"
            });
        }

        const couponData = coupon.toJSON();

        const detailedCoupon = {
            // Basic coupon information
            id: couponData.id,
            title: couponData.title,
            code: couponData.code,
            description: couponData.description,
            color: couponData.color,

            // Discount details
            discount_type: couponData.discount_type,
            discount_value: couponData.discount_value,
            min_amount: couponData.min_amount,
            max_discount_amount: couponData.max_discount_amount,

            // Usage limits
            max_uses: couponData.max_uses,
            current_uses: couponData.current_uses,

            // Validity period
            valid_from: couponData.valid_from ? couponData.valid_from.toISOString() : null,
            valid_until: couponData.valid_until ? couponData.valid_until.toISOString() : null,

            // Status information
            status: couponData.status,
            approval_status: couponData.approval_status,
            admin_notes: couponData.admin_notes,

            // Terms and conditions (parse JSON if it's a string)
            terms_and_conditions: (() => {
                try {
                    if (!couponData.terms_and_conditions) return [];
                    if (typeof couponData.terms_and_conditions === 'string') {
                        return JSON.parse(couponData.terms_and_conditions);
                    }
                    return couponData.terms_and_conditions;
                } catch (error) {
                    console.error('Error parsing terms_and_conditions JSON:', error);
                    console.error('Invalid JSON data:', couponData.terms_and_conditions);
                    // Return the raw string as a single item array if JSON parsing fails
                    return [couponData.terms_and_conditions];
                }
            })(),

            // Vendor information
            vendor_id: couponData.vendor_id,
            vendor: couponData.vendor ? {
                id: couponData.vendor.id,
                company_info: couponData.vendor.company_info,
                status: couponData.vendor.status,
                user: couponData.vendor.user ? {
                    id: couponData.vendor.user.id,
                    name: couponData.vendor.user.name,
                    email: couponData.vendor.user.email,
                    phone: couponData.vendor.user.phone
                } : null
            } : null,

            // Timestamps
            created_at: couponData.created_at ? couponData.created_at.toISOString() : null,
            updated_at: couponData.updated_at ? couponData.updated_at.toISOString() : null,

            // Additional computed fields
            is_expired: couponData.valid_until ? new Date(couponData.valid_until) < new Date() : false,
            is_active: couponData.status === 'active' && couponData.approval_status === 'approved',
            usage_percentage: couponData.max_uses ? (couponData.current_uses / couponData.max_uses) * 100 : 0,
            remaining_uses: couponData.max_uses ? couponData.max_uses - couponData.current_uses : null,

            // Additional computed fields for detailed view
            days_until_expiry: couponData.valid_until ?
                Math.ceil((new Date(couponData.valid_until) - new Date()) / (1000 * 60 * 60 * 24)) : null,
            is_usable: couponData.status === 'active' &&
                couponData.approval_status === 'approved' &&
                (!couponData.max_uses || couponData.current_uses < couponData.max_uses) &&
                (!couponData.valid_until || new Date(couponData.valid_until) > new Date())
        };

        res.json({
            success: true,
            data: detailedCoupon
        });
    } catch (error) {
        console.error("Error fetching vendor coupon:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch coupon",
            message: error.message
        });
    }
};

// Validate coupon
const validateCoupon = async (req, res) => {
    try {
        const { code } = req.body;
        const vendorId = req.user.id;

        if (!code) {
            return res.status(400).json({ error: "Coupon code is required" });
        }

        const coupon = await Coupon.findOne({
            where: {
                code: code.toUpperCase(),
                vendorId,
                isActive: true,
            },
        });

        if (!coupon) {
            return res.status(404).json({ error: "Invalid coupon code" });
        }

        // Check if coupon is expired
        if (coupon.expiryDate && new Date() > new Date(coupon.expiryDate)) {
            return res.status(400).json({ error: "Coupon has expired" });
        }

        // Check usage limits
        if (coupon.maxUsage && coupon.usageCount >= coupon.maxUsage) {
            return res
                .status(400)
                .json({ error: "Coupon usage limit reached" });
        }

        res.json({
            valid: true,
            coupon: {
                id: coupon.id,
                code: coupon.code,
                discountType: coupon.discountType,
                discountValue: coupon.discountValue,
                minAmount: coupon.minAmount,
                maxDiscount: coupon.maxDiscount,
                description: coupon.description,
            },
        });
    } catch (error) {
        console.error("Error validating coupon:", error);
        res.status(500).json({ error: "Failed to validate coupon" });
    }
};

// Add new coupon
const addCoupon = async (req, res) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: "Validation failed",
                details: errors.array()
            });
        }

        const {
            title,
            code,
            description,
            discount_type,
            discount_value,
            valid_from,
            valid_until,
            terms_and_conditions,
            assigned_trek_id
        } = req.body;

        const vendorId = req.user.id;

        // Debug logging
        console.log('Creating coupon with data:', {
            title,
            code,
            description,
            discount_type,
            discount_value,
            valid_from,
            valid_until,
            terms_and_conditions,
            assigned_trek_id,
            vendorId
        });

        // Check if vendor exists
        const vendor = await Vendor.findByPk(vendorId);
        if (!vendor) {
            return res.status(404).json({ error: "Vendor not found" });
        }

        // Check if coupon code already exists for this vendor
        const existingCoupon = await Coupon.findOne({
            where: {
                code: code.toUpperCase(),
                vendor_id: vendorId
            }
        });

        if (existingCoupon) {
            return res.status(400).json({
                error: "Coupon code already exists for this vendor"
            });
        }

        // Validate dates
        const validFromDate = new Date(valid_from);
        const validUntilDate = new Date(valid_until);
        const currentDate = new Date();

        if (validFromDate < currentDate) {
            return res.status(400).json({
                error: "Valid from date cannot be in the past"
            });
        }

        if (validUntilDate <= validFromDate) {
            return res.status(400).json({
                error: "Valid until date must be after valid from date"
            });
        }

        // Validate discount_type
        if (!discount_type || !['fixed', 'percentage'].includes(discount_type)) {
            return res.status(400).json({
                error: "Invalid discount type. Must be 'fixed' or 'percentage'"
            });
        }

        // Validate discount value based on type
        if (discount_type === "percentage" && (discount_value < 0 || discount_value > 100)) {
            return res.status(400).json({
                error: "Percentage discount must be between 0 and 100"
            });
        }

        if (discount_type === "fixed" && discount_value <= 0) {
            return res.status(400).json({
                error: "Fixed discount must be greater than 0"
            });
        }

        // Create coupon
        const coupon = await Coupon.create({
            title: title,
            vendor_id: vendorId,
            code: code.toUpperCase(),
            description: description || null,
            discount_type,
            discount_value: parseFloat(discount_value),
            min_amount: null,
            max_discount_amount: null,
            max_uses: null,
            current_uses: 0,
            valid_from: validFromDate,
            valid_until: validUntilDate,
            color: "#3B82F6",
            status: "inactive", // Set to inactive until approved
            approval_status: "pending", // Require admin approval
            terms_and_conditions: terms_and_conditions || null,
            assigned_trek_id: assigned_trek_id || null
        });

        // Fetch the created coupon with vendor details
        const createdCoupon = await Coupon.findByPk(coupon.id, {
            include: [{
                model: Vendor,
                as: 'vendor',
                attributes: ['id', 'company_info']
            }]
        });

        // Log the coupon creation
        await CouponAuditService.logCouponCreation(createdCoupon, vendorId, req);

        // If coupon is assigned to a trek, log the assignment
        if (assigned_trek_id) {
            await CouponAuditService.logCouponAssignment(createdCoupon, { id: assigned_trek_id }, vendorId, req);
        }

        res.status(201).json({
            message: "Coupon created successfully and is pending admin approval",
            coupon: createdCoupon
        });

    } catch (error) {
        console.error("Error creating coupon:", error);
        res.status(500).json({
            error: "Failed to create coupon",
            details: error.message
        });
    }
};

// Update coupon
const updateCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = req.user.id;

        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: "Validation failed",
                details: errors.array()
            });
        }

        const {
            title,
            code,
            description,
            discount_type,
            discount_value,
            valid_from,
            valid_until,
            terms_and_conditions,
            assigned_trek_id
        } = req.body;

        // Find the coupon and verify ownership
        const coupon = await Coupon.findOne({
            where: {
                id: id,
                vendor_id: vendorId
            }
        });

        if (!coupon) {
            return res.status(404).json({
                success: false,
                error: "Coupon not found or you don't have permission to edit it"
            });
        }

        // Check if coupon can be edited (only pending or approved coupons can be edited)
        if (coupon.approval_status === 'rejected') {
            return res.status(400).json({
                success: false,
                error: "Cannot edit rejected coupons"
            });
        }

        // Capture previous values for audit log
        const previousValues = {
            title: coupon.title,
            code: coupon.code,
            description: coupon.description,
            discount_type: coupon.discount_type,
            discount_value: coupon.discount_value,
            valid_from: coupon.valid_from,
            valid_until: coupon.valid_until,
            terms_and_conditions: coupon.terms_and_conditions,
            assigned_trek_id: coupon.assigned_trek_id
        };

        // Update the coupon
        await coupon.update({
            title,
            code: code.toUpperCase(),
            description,
            discount_type,
            discount_value: parseFloat(discount_value),
            valid_from: new Date(valid_from),
            valid_until: new Date(valid_until),
            terms_and_conditions: terms_and_conditions,
            assigned_trek_id: assigned_trek_id || null,
            // Reset approval status to pending and status to inactive when edited
            approval_status: 'pending',
            status: 'inactive',
            admin_notes: null
        });

        // Check if trek assignment changed and log accordingly
        const previousTrekId = previousValues.assigned_trek_id;
        const newTrekId = assigned_trek_id;

        if (previousTrekId !== newTrekId) {
            // Trek assignment changed
            if (previousTrekId && newTrekId) {
                // Reassignment: from one trek to another
                await CouponAuditService.logCouponReassignment(coupon, { id: previousTrekId }, { id: newTrekId }, vendorId, req);
            } else if (!previousTrekId && newTrekId) {
                // Assignment: from no trek to a trek
                await CouponAuditService.logCouponAssignment(coupon, { id: newTrekId }, vendorId, req);
            } else if (previousTrekId && !newTrekId) {
                // Unassignment: from a trek to no trek
                await CouponAuditService.logCouponUnassignment(coupon, { id: previousTrekId }, vendorId, req);
            }
        } else {
            // No trek assignment change, log regular update
            await CouponAuditService.logCouponUpdate(coupon, previousValues, vendorId, req);
        }

        res.json({
            success: true,
            message: "Coupon updated successfully and sent for review",
            data: coupon
        });

    } catch (error) {
        console.error("Error updating coupon:", error);
        res.status(500).json({
            success: false,
            error: "Failed to update coupon",
            details: error.message
        });
    }
};

// Delete coupon
const deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = req.user.id;

        // Find the coupon and verify ownership
        const coupon = await Coupon.findOne({
            where: {
                id: id,
                vendor_id: vendorId
            }
        });

        if (!coupon) {
            return res.status(404).json({
                success: false,
                error: "Coupon not found or you don't have permission to delete it"
            });
        }

        // Check if coupon can be deleted (only pending coupons can be deleted)
        if (coupon.approval_status === 'approved') {
            return res.status(400).json({
                success: false,
                error: "Cannot delete approved coupons. Please contact admin."
            });
        }

        // Log the coupon deletion before deleting
        await CouponAuditService.logCouponDeletion(coupon, vendorId, req);

        // Delete the coupon
        await coupon.destroy();

        res.json({
            success: true,
            message: "Coupon deleted successfully"
        });

    } catch (error) {
        console.error("Error deleting coupon:", error);
        res.status(500).json({
            success: false,
            error: "Failed to delete coupon",
            details: error.message
        });
    }
};

// Assign coupon to a trek
const assignCouponToTrek = async (req, res) => {
    try {
        const { id } = req.params;
        const { trek_id } = req.body;
        const vendorId = req.user.id;

        // Find the coupon and verify ownership and check if eligible
        const coupon = await Coupon.findOne({
            where: {
                id: id,
                vendor_id: vendorId
            }
        });

        if (!coupon) {
            return res.status(404).json({
                success: false,
                error: "Coupon not found or you don't have permission"
            });
        }

        if (coupon.approval_status !== 'approved' || coupon.status !== 'active') {
            return res.status(400).json({
                success: false,
                error: "Only approved and active coupons can be assigned to treks"
            });
        }

        if (!trek_id) {
            return res.status(400).json({
                success: false,
                error: "Trek ID is required"
            });
        }

        const previousTrekId = coupon.assigned_trek_id;

        // Update the coupon
        await coupon.update({
            assigned_trek_id: trek_id
        });

        // Log assignment
        if (previousTrekId) {
            await CouponAuditService.logCouponReassignment(coupon, { id: previousTrekId }, { id: trek_id }, vendorId, req);
        } else {
            await CouponAuditService.logCouponAssignment(coupon, { id: trek_id }, vendorId, req);
        }

        res.json({
            success: true,
            message: "Coupon assigned successfully",
            data: coupon
        });
    } catch (error) {
        console.error("Error assigning coupon:", error);
        res.status(500).json({
            success: false,
            error: "Failed to assign coupon",
            details: error.message
        });
    }
};

// Unassign coupon from a trek
const unassignCouponFromTrek = async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = req.user.id;

        // Find the coupon and verify ownership
        const coupon = await Coupon.findOne({
            where: {
                id: id,
                vendor_id: vendorId
            }
        });

        if (!coupon) {
            return res.status(404).json({
                success: false,
                error: "Coupon not found or you don't have permission"
            });
        }

        const previousTrekId = coupon.assigned_trek_id;

        if (!previousTrekId) {
            return res.status(400).json({
                success: false,
                error: "Coupon is not assigned to any trek"
            });
        }

        // Update the coupon
        await coupon.update({
            assigned_trek_id: null
        });

        // Log unassignment
        await CouponAuditService.logCouponUnassignment(coupon, { id: previousTrekId }, vendorId, req);

        res.json({
            success: true,
            message: "Coupon unassigned successfully",
            data: coupon
        });
    } catch (error) {
        console.error("Error unassigning coupon:", error);
        res.status(500).json({
            success: false,
            error: "Failed to unassign coupon",
            details: error.message
        });
    }
};

module.exports = {
    getCouponsByTrek,
    getVendorCoupons,
    getVendorCouponById,
    validateCoupon,
    addCoupon,
    updateCoupon,
    deleteCoupon,
    assignCouponToTrek,
    unassignCouponFromTrek
};
