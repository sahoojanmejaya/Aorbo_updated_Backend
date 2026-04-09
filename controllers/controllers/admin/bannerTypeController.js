const db = require("../../models");
const { BannerType } = db;
const { Op } = require("sequelize");

// Get all banner types with pagination and filtering
const getAllBannerTypes = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 50,
            search = "",
            status = "",
            sortBy = "created_at",
            sortOrder = "DESC"
        } = req.query;

        const offset = (page - 1) * limit;
        const whereClause = {};

        // Add search filter
        if (search) {
            whereClause[Op.or] = [
                { name: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } }
            ];
        }

        // Add status filter
        if (status) {
            whereClause.status = status;
        }

        const { count, rows: bannerTypes } = await BannerType.findAndCountAll({
            where: {
                ...whereClause,
                deleted_at: null // Explicitly exclude soft-deleted records
            },
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [[sortBy, sortOrder.toUpperCase()], ['id', 'ASC']],
            attributes: [
                'id', 'name', 'description', 'card_width', 'card_height', 
                'order', 'status', 'start_date', 'end_date', 'created_at', 'updated_at'
            ]
        });

        res.json({
            success: true,
            data: {
                bannerTypes,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(count / limit),
                    totalItems: count,
                    itemsPerPage: parseInt(limit)
                }
            }
        });
    } catch (error) {
        console.error("Error fetching banner types:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch banner types",
            error: error.message
        });
    }
};

// Get single banner type by ID
const getBannerTypeById = async (req, res) => {
    try {
        const { id } = req.params;

        const bannerType = await BannerType.findByPk(id, {
            attributes: [
                'id', 'name', 'description', 'card_width', 'card_height', 
                'order', 'status', 'start_date', 'end_date', 'created_at', 'updated_at'
            ]
        });

        if (!bannerType) {
            return res.status(404).json({
                success: false,
                message: "Banner type not found"
            });
        }

        res.json({
            success: true,
            data: bannerType
        });
    } catch (error) {
        console.error("Error fetching banner type:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch banner type",
            error: error.message
        });
    }
};

// Create new banner type
const createBannerType = async (req, res) => {
    try {
        const {
            name,
            description,
            card_width,
            card_height,
            order,
            status,
            start_date,
            end_date
        } = req.body;

        console.log("Creating banner type with data:", { name, description, order, status });

        // Validate required fields
        if (!name || !description) {
            return res.status(400).json({
                success: false,
                message: "Name and description are required"
            });
        }

        // Auto-assign the next available order number
        let nextOrder = 1;
        if (order !== undefined && order !== null && order !== "") {
            // Check if the requested order is available
            const existingOrder = await BannerType.findOne({
                where: { order: parseInt(order) }
            });
            if (existingOrder) {
                return res.status(400).json({
                    success: false,
                    message: `Display order ${order} is already taken. Please choose another order.`
                });
            }
            nextOrder = parseInt(order);
        } else {
            // Find the highest order number and add 1
            const maxOrder = await BannerType.max('order');
            nextOrder = maxOrder ? maxOrder + 1 : 1;
        }

        const bannerType = await BannerType.create({
            name,
            description,
            card_width: card_width || "fixed",
            card_height: card_height || "fixed",
            order: nextOrder,
            status: status || "inactive",
            start_date: start_date || null,
            end_date: end_date || null
        });

        res.status(201).json({
            success: true,
            message: "Banner type created successfully",
            data: bannerType
        });
    } catch (error) {
        console.error("Error creating banner type:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create banner type",
            error: error.message
        });
    }
};

// Update banner type
const updateBannerType = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const bannerType = await BannerType.findByPk(id);

        if (!bannerType) {
            return res.status(404).json({
                success: false,
                message: "Banner type not found"
            });
        }

        // Check if name is being updated and if it already exists
        if (updateData.name && updateData.name !== bannerType.name) {
            const existingBannerType = await BannerType.findOne({
                where: { 
                    name: updateData.name,
                    id: { [Op.ne]: id }
                }
            });

            if (existingBannerType) {
                return res.status(400).json({
                    success: false,
                    message: "Banner type with this name already exists"
                });
            }
        }

        // Enforce unique display order on update
        if (
            Object.prototype.hasOwnProperty.call(updateData, 'order') &&
            updateData.order !== bannerType.order
        ) {
            const existingOrder = await BannerType.findOne({
                where: { 
                    order: updateData.order,
                    id: { [Op.ne]: id }
                }
            });
            if (existingOrder) {
                return res.status(400).json({
                    success: false,
                    message: `Display order ${updateData.order} is already taken. Please choose another order.`
                });
            }
        }

        await bannerType.update(updateData);

        res.json({
            success: true,
            message: "Banner type updated successfully",
            data: bannerType
        });
    } catch (error) {
        console.error("Error updating banner type:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update banner type",
            error: error.message
        });
    }
};

// Delete banner type (soft delete) with order renumbering
const deleteBannerType = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    
    try {
        const { id } = req.params;

        const bannerType = await BannerType.findByPk(id, { transaction });

        if (!bannerType) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: "Banner type not found"
            });
        }

        const deletedOrder = bannerType.order;

        // Soft delete the banner type using destroy() method
        await bannerType.destroy({ transaction });

        // Renumber all banner types with order greater than the deleted one
        await BannerType.update(
            { order: db.sequelize.literal('`order` - 1') },
            { 
                where: { 
                    order: { [Op.gt]: deletedOrder },
                    deleted_at: null
                },
                transaction 
            }
        );

        await transaction.commit();

        res.json({
            success: true,
            message: "Banner type deleted successfully and orders renumbered"
        });
    } catch (error) {
        await transaction.rollback();
        console.error("Error deleting banner type:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete banner type",
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get active banner types (for dropdowns)
const getActiveBannerTypes = async (req, res) => {
    try {
        const bannerTypes = await BannerType.findAll({
            where: { 
                status: 'active',
                deleted_at: null
            },
            attributes: ['id', 'name', 'description', 'order'],
            order: [['order', 'ASC'], ['id', 'ASC']]
        });

        res.json({
            success: true,
            data: bannerTypes
        });
    } catch (error) {
        console.error("Error fetching active banner types:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch active banner types",
            error: error.message
        });
    }
};

// Reorder banner types
const reorderBannerTypes = async (req, res) => {
    try {
        const { reorderedItems } = req.body;

        if (!Array.isArray(reorderedItems)) {
            return res.status(400).json({
                success: false,
                message: "Invalid reordered items format"
            });
        }

        console.log("Received reorder request:", reorderedItems);

        // Use transaction to ensure all updates happen atomically
        const transaction = await db.sequelize.transaction();

        try {
            // Update the order for each banner type sequentially
            for (const item of reorderedItems) {
                await BannerType.update(
                    { order: item.order },
                    { 
                        where: { id: item.id },
                        transaction: transaction
                    }
                );
                console.log(`Updated BannerType ${item.id} to order ${item.order}`);
            }

            await transaction.commit();

            res.json({
                success: true,
                message: "Banner types reordered successfully"
            });
        } catch (updateError) {
            await transaction.rollback();
            throw updateError;
        }
    } catch (error) {
        console.error("Error reordering banner types:", error);
        res.status(500).json({
            success: false,
            message: "Failed to reorder banner types",
            error: error.message
        });
    }
};

module.exports = {
    getAllBannerTypes,
    getBannerTypeById,
    createBannerType,
    updateBannerType,
    deleteBannerType,
    getActiveBannerTypes,
    reorderBannerTypes
};
