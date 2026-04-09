const { body } = require("express-validator");
const { Trek, Vendor, Batch, AuditLog } = require("../../models");
const notificationService = require("../../services/notificationService");
const logger = require("../../utils/logger");
const { Op } = require("sequelize");

/**
 * ADMIN TREK APPROVAL CONTROLLER
 * Central authority for trek lifecycle management
 */

// Validation rules
const reviewTrekValidation = [
    body("action").isIn(["approve", "reject"]).withMessage("Invalid action"),
    body("admin_notes").optional().isString().trim(),
    body("modifications").optional().isObject(),
    body("modifications.platform_fee_percentage").optional().isFloat({ min: 0, max: 100 }),
    body("modifications.visibility").optional().isBoolean(),
    body("modifications.featured").optional().isBoolean()
];

/**
 * Get pending treks for approval
 * GET /admin/treks/pending
 */
const getPendingTreks = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        const { count, rows: treks } = await Trek.findAndCountAll({
            where: {
                approval_status: "pending"
            },
            include: [
                {
                    model: Vendor,
                    as: "vendor",
                    attributes: ["id", "business_name", "specialties"]
                }
            ],
            order: [["created_at", "ASC"]],
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
        logger.error("admin", "Failed to fetch pending treks", {
            error: error.message
        });

        res.status(500).json({
            success: false,
            message: "Failed to fetch pending treks"
        });
    }
};

/**
 * Review trek (approve/reject)
 * POST /admin/treks/:id/review
 */
const reviewTrek = async (req, res) => {
    try {
        const trekId = req.params.id;
        const { action, admin_notes, modifications = {} } = req.body;
        const adminId = req.user.id;

        // Fetch trek
        const trek = await Trek.findByPk(trekId, {
            include: [{ model: Vendor, as: "vendor" }]
        });

        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found"
            });
        }

        if (trek.trek_status !== "pending") {
            return res.status(400).json({
                success: false,
                message: `Trek already ${trek.trek_status}`
            });
        }

        // Store original state for audit
        const originalState = trek.toJSON();

        // Update trek based on action
        const updates = {
            approval_status: action === "approve" ? "approved" : "rejected",
            admin_notes,
            reviewed_by: adminId,
            reviewed_at: new Date()
        };

        if (action === "approve") {
            // Core approval fields — always set on approval
            updates.status = "active";
            updates.trek_status = "approved";
            updates.visibility = true;

            // Apply optional admin overrides
            if (modifications.platform_fee_percentage !== undefined) {
                updates.platform_fee_percentage = modifications.platform_fee_percentage;
            }
            if (modifications.visibility !== undefined) {
                updates.visibility = modifications.visibility;
            }
            if (modifications.featured !== undefined) {
                updates.featured = modifications.featured;
            }
        } else {
            // Rejected treks are not visible
            updates.visibility = false;
            updates.status = "inactive";
        }

        await trek.update(updates);

        // Create audit log
        await AuditLog.create({
            action: `trek_${action}ed`,
            entity_type: "trek",
            entity_id: trekId,
            performed_by_type: "admin",
            performed_by_id: adminId,
            changes: {
                before: originalState,
                after: trek.toJSON()
            },
            metadata: {
                admin_notes,
                modifications
            }
        });

        // Send notification to vendor
        await notificationService.sendTrekApproval(
            trekId,
            action === "approve",
            admin_notes
        );

        logger.info("admin", `Trek ${action}ed`, {
            trekId,
            adminId,
            vendorId: trek.vendor_id
        });

        res.json({
            success: true,
            message: `Trek ${action}ed successfully`,
            data: trek
        });
    } catch (error) {
        logger.error("admin", "Trek review failed", {
            error: error.message,
            trekId: req.params.id,
            adminId: req.user.id
        });

        res.status(500).json({
            success: false,
            message: "Failed to review trek"
        });
    }
};

/**
 * Get all treks with filters
 * GET /admin/treks
 */
const getAllTreks = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            status,
            approval_status,
            trek_status,
            vendor_id,
            search
        } = req.query;

        const offset = (page - 1) * limit;
        const where = {};

        if (status) where.status = status;
        if (approval_status) where.approval_status = approval_status;
        if (trek_status) where.trek_status = trek_status;
        if (vendor_id) where.vendor_id = vendor_id;
        if (search) {
            where[Op.or] = [
                { name: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } }
            ];
        }

        const { count, rows: treks } = await Trek.findAndCountAll({
            where,
            include: [
                {
                    model: Vendor,
                    as: "vendor",
                    attributes: ["id", "business_name"]
                },
                {
                    model: Batch,
                    as: "batches",
                    attributes: ["id", "start_date", "end_date", "available_slots"]
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
        logger.error("admin", "Failed to fetch treks", {
            error: error.message
        });

        res.status(500).json({
            success: false,
            message: "Failed to fetch treks"
        });
    }
};

/**
 * Update trek critical fields (admin only)
 * PUT /admin/treks/:id/critical-fields
 */
const updateCriticalFields = async (req, res) => {
    try {
        const trekId = req.params.id;
        const { base_price, difficulty, max_capacity, cancellation_policy_id } = req.body;
        const adminId = req.user.id;

        const trek = await Trek.findByPk(trekId);
        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found"
            });
        }

        const originalState = trek.toJSON();
        const updates = {};

        if (base_price !== undefined) updates.base_price = base_price;
        if (difficulty !== undefined) updates.difficulty = difficulty;
        if (max_capacity !== undefined) updates.max_capacity = max_capacity;
        if (cancellation_policy_id !== undefined) {
            updates.cancellation_policy_id = cancellation_policy_id;
        }

        // If trek was approved, require re-approval for critical changes
        if (trek.approval_status === "approved" && Object.keys(updates).length > 0) {
            updates.approval_status = "pending";
            updates.admin_notes = "Critical fields modified by admin - requires re-approval";
        }

        await trek.update(updates);

        // Audit log
        await AuditLog.create({
            action: "trek_critical_fields_updated",
            entity_type: "trek",
            entity_id: trekId,
            performed_by_type: "admin",
            performed_by_id: adminId,
            changes: {
                before: originalState,
                after: trek.toJSON()
            }
        });

        logger.info("admin", "Trek critical fields updated", {
            trekId,
            adminId,
            updates
        });

        res.json({
            success: true,
            message: "Critical fields updated successfully",
            data: trek
        });
    } catch (error) {
        logger.error("admin", "Failed to update critical fields", {
            error: error.message,
            trekId: req.params.id
        });

        res.status(500).json({
            success: false,
            message: "Failed to update critical fields"
        });
    }
};

/**
 * Toggle trek visibility
 * PATCH /admin/treks/:id/visibility
 */
const toggleVisibility = async (req, res) => {
    try {
        const trekId = req.params.id;
        const { visibility } = req.body;
        const adminId = req.user.id;

        const trek = await Trek.findByPk(trekId);
        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found"
            });
        }

        await trek.update({ visibility });

        // Audit log
        await AuditLog.create({
            action: "trek_visibility_changed",
            entity_type: "trek",
            entity_id: trekId,
            performed_by_type: "admin",
            performed_by_id: adminId,
            changes: {
                before: { visibility: trek.visibility },
                after: { visibility }
            }
        });

        logger.info("admin", "Trek visibility changed", {
            trekId,
            adminId,
            visibility
        });

        res.json({
            success: true,
            message: "Visibility updated successfully",
            data: { visibility }
        });
    } catch (error) {
        logger.error("admin", "Failed to toggle visibility", {
            error: error.message,
            trekId: req.params.id
        });

        res.status(500).json({
            success: false,
            message: "Failed to toggle visibility"
        });
    }
};

module.exports = {
    getPendingTreks,
    reviewTrek,
    reviewTrekValidation,
    getAllTreks,
    updateCriticalFields,
    toggleVisibility
};
