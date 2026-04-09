const { body } = require("express-validator");
const { Trek, Batch, Vendor, AuditLog } = require("../../models");
const logger = require("../../utils/logger");

/**
 * VENDOR TREK CONTROLLER (RESTRICTED)
 * Vendors can create but not publish without admin approval
 */

// Validation rules
const createTrekValidation = [
    body("name").trim().notEmpty().withMessage("Trek name required"),
    body("description").trim().notEmpty().withMessage("Description required"),
    body("difficulty").isIn(["easy", "moderate", "difficult", "extreme"]),
    body("duration").isInt({ min: 1 }).withMessage("Invalid duration"),
    body("base_price").isFloat({ min: 0 }).withMessage("Invalid price"),
    body("max_capacity").isInt({ min: 1 }).withMessage("Invalid capacity")
];

/**
 * Create trek (pending approval)
 * POST /vendor/treks
 */
const createTrek = async (req, res) => {
    try {
        const vendorId = req.user.vendor_id;
        const {
            name, description, difficulty, duration, base_price,
            max_capacity, activities, inclusions, exclusions,
            images, location_id, cancellation_policy_id
        } = req.body;

        // Verify vendor exists and is active
        const vendor = await Vendor.findByPk(vendorId);
        if (!vendor || vendor.status !== "active") {
            return res.status(403).json({
                success: false,
                message: "Vendor account not active"
            });
        }

        // Create trek with pending approval status
        const trek = await Trek.create({
            vendor_id: vendorId,
            name,
            description,
            difficulty,
            duration,
            base_price,
            max_capacity,
            activities: JSON.stringify(activities || []),
            inclusions: JSON.stringify(inclusions || []),
            exclusions: JSON.stringify(exclusions || []),
            images: JSON.stringify(images || []),
            location_id,
            cancellation_policy_id,
            status: "inactive", // Inactive until approved
            approval_status: "pending", // Requires admin approval
            visibility: false, // Not visible to customers
            created_by: req.user.id
        });

        // Audit log
        await AuditLog.create({
            action: "trek_created",
            entity_type: "trek",
            entity_id: trek.id,
            performed_by_type: "vendor",
            performed_by_id: req.user.id,
            changes: {
                before: null,
                after: trek.toJSON()
            }
        });

        logger.info("vendor", "Trek created (pending approval)", {
            trekId: trek.id,
            vendorId,
            userId: req.user.id
        });

        res.status(201).json({
            success: true,
            message: "Trek submitted for admin review",
            data: trek
        });
    } catch (error) {
        logger.error("vendor", "Trek creation failed", {
            error: error.message,
            vendorId: req.user.vendor_id
        });

        res.status(500).json({
            success: false,
            message: "Failed to create trek"
        });
    }
};

/**
 * Get vendor's treks
 * GET /vendor/treks
 */
const getMyTreks = async (req, res) => {
    try {
        const vendorId = req.user.vendor_id;
        const { status, approval_status, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        const where = { vendor_id: vendorId };
        if (status) where.status = status;
        if (approval_status) where.approval_status = approval_status;

        const { count, rows: treks } = await Trek.findAndCountAll({
            where,
            include: [
                {
                    model: Batch,
                    as: "batches",
                    attributes: ["id", "start_date", "end_date", "available_slots", "booked_slots"]
                }
            ],
            order: [["created_at", "DESC"]],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            data: treks,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        logger.error("vendor", "Failed to fetch treks", {
            error: error.message,
            vendorId: req.user.vendor_id
        });

        res.status(500).json({
            success: false,
            message: "Failed to fetch treks"
        });
    }
};

/**
 * Update trek (non-critical fields only)
 * PUT /vendor/treks/:id
 */
const updateTrek = async (req, res) => {
    try {
        const trekId = req.params.id;
        const vendorId = req.user.vendor_id;
        const {
            description, images, inclusions, exclusions,
            activities, location_id
        } = req.body;

        // Fetch trek and verify ownership
        const trek = await Trek.findOne({
            where: { id: trekId, vendor_id: vendorId }
        });

        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found"
            });
        }

        // Check if trek is approved - critical fields cannot be changed
        if (trek.approval_status === "approved") {
            // Only allow non-critical field updates
            const allowedUpdates = {
                description,
                images: images ? JSON.stringify(images) : trek.images,
                inclusions: inclusions ? JSON.stringify(inclusions) : trek.inclusions,
                exclusions: exclusions ? JSON.stringify(exclusions) : trek.exclusions,
                activities: activities ? JSON.stringify(activities) : trek.activities,
                location_id: location_id || trek.location_id
            };

            const originalState = trek.toJSON();
            await trek.update(allowedUpdates);

            // Audit log
            await AuditLog.create({
                action: "trek_updated",
                entity_type: "trek",
                entity_id: trekId,
                performed_by_type: "vendor",
                performed_by_id: req.user.id,
                changes: {
                    before: originalState,
                    after: trek.toJSON()
                }
            });

            logger.info("vendor", "Trek updated (non-critical fields)", {
                trekId,
                vendorId
            });

            return res.json({
                success: true,
                message: "Trek updated successfully",
                data: trek
            });
        }

        // If pending/rejected, allow all updates except critical pricing
        const updates = {
            description,
            images: images ? JSON.stringify(images) : trek.images,
            inclusions: inclusions ? JSON.stringify(inclusions) : trek.inclusions,
            exclusions: exclusions ? JSON.stringify(exclusions) : trek.exclusions,
            activities: activities ? JSON.stringify(activities) : trek.activities,
            location_id: location_id || trek.location_id
        };

        const originalState = trek.toJSON();
        await trek.update(updates);

        // Audit log
        await AuditLog.create({
            action: "trek_updated",
            entity_type: "trek",
            entity_id: trekId,
            performed_by_type: "vendor",
            performed_by_id: req.user.id,
            changes: {
                before: originalState,
                after: trek.toJSON()
            }
        });

        logger.info("vendor", "Trek updated", {
            trekId,
            vendorId
        });

        res.json({
            success: true,
            message: "Trek updated successfully",
            data: trek
        });
    } catch (error) {
        logger.error("vendor", "Trek update failed", {
            error: error.message,
            trekId: req.params.id,
            vendorId: req.user.vendor_id
        });

        res.status(500).json({
            success: false,
            message: "Failed to update trek"
        });
    }
};

/**
 * Request critical field modification
 * POST /vendor/treks/:id/request-modification
 */
const requestModification = async (req, res) => {
    try {
        const trekId = req.params.id;
        const vendorId = req.user.vendor_id;
        const { field, new_value, reason } = req.body;

        const trek = await Trek.findOne({
            where: { id: trekId, vendor_id: vendorId }
        });

        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found"
            });
        }

        // Create modification request (stored in admin_notes)
        const modificationRequest = {
            field,
            current_value: trek[field],
            requested_value: new_value,
            reason,
            requested_at: new Date(),
            requested_by: req.user.id
        };

        await trek.update({
            admin_notes: JSON.stringify(modificationRequest),
            approval_status: "pending" // Requires re-approval
        });

        logger.info("vendor", "Modification request created", {
            trekId,
            vendorId,
            field
        });

        res.json({
            success: true,
            message: "Modification request submitted for admin review",
            data: modificationRequest
        });
    } catch (error) {
        logger.error("vendor", "Modification request failed", {
            error: error.message,
            trekId: req.params.id
        });

        res.status(500).json({
            success: false,
            message: "Failed to submit modification request"
        });
    }
};

/**
 * Get vendor bookings (limited data)
 * GET /vendor/bookings
 */
const getMyBookings = async (req, res) => {
    try {
        const vendorId = req.user.vendor_id;
        const { status, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        const { Booking, Trek, Customer, Batch } = require("../../models");

        const where = { vendor_id: vendorId };
        if (status) where.status = status;

        const { count, rows: bookings } = await Booking.findAll({
            where,
            attributes: [
                "id", "booking_date", "status", "total_travelers",
                "trek_id", "batch_id", "customer_id",
                // EXCLUDE: final_amount, discount_amount, payment details
            ],
            include: [
                {
                    model: Trek,
                    as: "trek",
                    attributes: ["id", "name", "difficulty"]
                },
                {
                    model: Batch,
                    as: "batch",
                    attributes: ["id", "start_date", "end_date"]
                },
                {
                    model: Customer,
                    as: "customer",
                    attributes: ["id", "name", "phone"] // Only contact info
                    // EXCLUDE: email, dob, emergency_contact, financial data
                }
            ],
            order: [["created_at", "DESC"]],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            data: bookings,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        logger.error("vendor", "Failed to fetch bookings", {
            error: error.message,
            vendorId: req.user.vendor_id
        });

        res.status(500).json({
            success: false,
            message: "Failed to fetch bookings"
        });
    }
};

module.exports = {
    createTrek,
    createTrekValidation,
    getMyTreks,
    updateTrek,
    requestModification,
    getMyBookings
};
