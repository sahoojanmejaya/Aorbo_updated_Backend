const { CancellationPolicy } = require("../../models");
const { Op } = require("sequelize");

// Get all cancellation policies with pagination and filtering
exports.getAllCancellationPolicies = async (req, res) => {
    try {
        const { page = 1, limit = 20, search, is_active } = req.query;
        const offset = (page - 1) * limit;

        // Build where clause
        const whereClause = {};

        if (search) {
            whereClause[Op.or] = [
                { title: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } },
            ];
        }

        if (is_active !== undefined) {
            whereClause.is_active = is_active === "true";
        }

        const { count, rows: policies } =
            await CancellationPolicy.findAndCountAll({
                where: whereClause,
                order: [
                    ["sort_order", "ASC"],
                    ["title", "ASC"],
                ],
                limit: parseInt(limit),
                offset: parseInt(offset),
            });

        res.json({
            success: true,
            data: policies,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(count / limit),
                totalCount: count,
            },
        });
    } catch (error) {
        console.error("Error fetching cancellation policies:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch cancellation policies",
            error: error.message,
        });
    }
};

// Get cancellation policy by ID
exports.getCancellationPolicyById = async (req, res) => {
    try {
        const { id } = req.params;

        const policy = await CancellationPolicy.findByPk(id);

        if (!policy) {
            return res.status(404).json({
                success: false,
                message: "Cancellation policy not found",
            });
        }

        res.json({
            success: true,
            data: policy,
        });
    } catch (error) {
        console.error("Error fetching cancellation policy:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch cancellation policy",
            error: error.message,
        });
    }
};

// Create new cancellation policy
exports.createCancellationPolicy = async (req, res) => {
    try {
        const {
            title,
            description,
            rules,
            descriptionPoints = [],
            is_active = true,
            sort_order = 0,
        } = req.body;

        // Validate required fields
        if (!title) {
            return res.status(400).json({
                success: false,
                message: "Policy title is required",
            });
        }

        if (!rules || !Array.isArray(rules) || rules.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one rule is required",
            });
        }

        // Validate rules structure
        for (const rule of rules) {
            if (!rule.rule || !rule.deduction || !rule.deduction_type) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Each rule must have rule, deduction, and deduction_type",
                });
            }

            if (!["percentage", "fixed"].includes(rule.deduction_type)) {
                return res.status(400).json({
                    success: false,
                    message:
                        "deduction_type must be either 'percentage' or 'fixed'",
                });
            }

            if (
                rule.deduction_type === "percentage" &&
                (rule.deduction < 0 || rule.deduction > 100)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Percentage deduction must be between 0 and 100",
                });
            }

            if (rule.deduction_type === "fixed" && rule.deduction < 0) {
                return res.status(400).json({
                    success: false,
                    message: "Fixed deduction cannot be negative",
                });
            }
        }

        // Check if policy title already exists
        const existingPolicy = await CancellationPolicy.findOne({
            where: { title: title.trim() },
        });

        if (existingPolicy) {
            return res.status(400).json({
                success: false,
                message: "Cancellation policy with this title already exists",
            });
        }

        const policy = await CancellationPolicy.create({
            title: title.trim(),
            description,
            rules,
            descriptionPoints,
            is_active,
            sort_order,
        });

        res.status(201).json({
            success: true,
            message: "Cancellation policy created successfully",
            data: policy,
        });
    } catch (error) {
        console.error("Error creating cancellation policy:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create cancellation policy",
            error: error.message,
        });
    }
};

// Update cancellation policy
exports.updateCancellationPolicy = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title,
            description,
            rules,
            descriptionPoints,
            is_active,
            sort_order,
        } = req.body;

        const policy = await CancellationPolicy.findByPk(id);

        if (!policy) {
            return res.status(404).json({
                success: false,
                message: "Cancellation policy not found",
            });
        }

        // Validate rules if provided
        if (rules) {
            if (!Array.isArray(rules) || rules.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "At least one rule is required",
                });
            }

            for (const rule of rules) {
                if (!rule.rule || !rule.deduction || !rule.deduction_type) {
                    return res.status(400).json({
                        success: false,
                        message:
                            "Each rule must have rule, deduction, and deduction_type",
                    });
                }

                if (!["percentage", "fixed"].includes(rule.deduction_type)) {
                    return res.status(400).json({
                        success: false,
                        message:
                            "deduction_type must be either 'percentage' or 'fixed'",
                    });
                }

                if (
                    rule.deduction_type === "percentage" &&
                    (rule.deduction < 0 || rule.deduction > 100)
                ) {
                    return res.status(400).json({
                        success: false,
                        message:
                            "Percentage deduction must be between 0 and 100",
                    });
                }

                if (rule.deduction_type === "fixed" && rule.deduction < 0) {
                    return res.status(400).json({
                        success: false,
                        message: "Fixed deduction cannot be negative",
                    });
                }
            }
        }

        // Check if title is being changed and if it already exists
        if (title && title.trim() !== policy.title) {
            const existingPolicy = await CancellationPolicy.findOne({
                where: {
                    title: title.trim(),
                    id: { [Op.ne]: id },
                },
            });

            if (existingPolicy) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Cancellation policy with this title already exists",
                });
            }
        }

        // Update policy
        await policy.update({
            title: title ? title.trim() : policy.title,
            description:
                description !== undefined ? description : policy.description,
            rules: rules || policy.rules,
            descriptionPoints:
                descriptionPoints !== undefined
                    ? descriptionPoints
                    : policy.descriptionPoints,
            is_active: is_active !== undefined ? is_active : policy.is_active,
            sort_order:
                sort_order !== undefined ? sort_order : policy.sort_order,
        });

        res.json({
            success: true,
            message: "Cancellation policy updated successfully",
            data: policy,
        });
    } catch (error) {
        console.error("Error updating cancellation policy:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update cancellation policy",
            error: error.message,
        });
    }
};

// Delete cancellation policy
exports.deleteCancellationPolicy = async (req, res) => {
    try {
        const { id } = req.params;

        const policy = await CancellationPolicy.findByPk(id);

        if (!policy) {
            return res.status(404).json({
                success: false,
                message: "Cancellation policy not found",
            });
        }

        await policy.destroy();

        res.json({
            success: true,
            message: "Cancellation policy deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting cancellation policy:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete cancellation policy",
            error: error.message,
        });
    }
};

// Toggle cancellation policy status
exports.toggleCancellationPolicyStatus = async (req, res) => {
    try {
        const { id } = req.params;

        const policy = await CancellationPolicy.findByPk(id);
        if (!policy) {
            return res.status(404).json({
                success: false,
                message: "Cancellation policy not found",
            });
        }

        policy.is_active = !policy.is_active;
        await policy.save();

        res.json({
            success: true,
            message: `Cancellation policy ${
                policy.is_active ? "activated" : "deactivated"
            } successfully`,
            data: policy,
        });
    } catch (error) {
        console.error("Error toggling cancellation policy status:", error);
        res.status(500).json({
            success: false,
            message: "Failed to toggle cancellation policy status",
            error: error.message,
        });
    }
};

// Bulk update cancellation policy sort order
exports.updateCancellationPolicySortOrder = async (req, res) => {
    try {
        const { policies } = req.body;

        if (!Array.isArray(policies)) {
            return res.status(400).json({
                success: false,
                message: "Policies array is required",
            });
        }

        // Update sort order for each policy
        const updatePromises = policies.map(({ id, sort_order }) => {
            return CancellationPolicy.update({ sort_order }, { where: { id } });
        });

        await Promise.all(updatePromises);

        res.json({
            success: true,
            message: "Cancellation policy sort order updated successfully",
        });
    } catch (error) {
        console.error("Error updating cancellation policy sort order:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update cancellation policy sort order",
            error: error.message,
        });
    }
};

// Get active cancellation policies (for dropdowns)
exports.getActiveCancellationPolicies = async (req, res) => {
    try {
        const policies = await CancellationPolicy.findAll({
            where: { is_active: true },
            attributes: ["id", "title", "description"],
            order: [
                ["sort_order", "ASC"],
                ["title", "ASC"],
            ],
        });

        res.json({
            success: true,
            data: policies,
        });
    } catch (error) {
        console.error("Error fetching active cancellation policies:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch active cancellation policies",
            error: error.message,
        });
    }
};
