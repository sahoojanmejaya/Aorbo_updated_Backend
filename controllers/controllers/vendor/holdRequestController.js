const { HoldRequest, Trek, Batch, Vendor, User } = require("../../models");
const logger = require("../../utils/logger");

// Get all hold requests for a vendor
exports.getVendorHoldRequests = async (req, res) => {
    try {
        const vendorId = req.user.id;
        
        const holdRequests = await HoldRequest.findAll({
            where: { vendor_id: vendorId },
            order: [["created_at", "DESC"]]
        });

        logger.vendor("info", `Vendor ${vendorId} fetched ${holdRequests.length} hold requests`);
        
        res.json({
            success: true,
            data: holdRequests
        });
    } catch (error) {
        logger.vendor("error", `Error fetching hold requests: ${error.message}`);
        res.status(500).json({
            success: false,
            message: "Failed to fetch hold requests",
            error: error.message
        });
    }
};

// Create a new hold request
exports.createHoldRequest = async (req, res) => {
    try {
        const vendorId = req.user.id;
        const {
            trek_ids,
            batch_ids,
            request_type,
            hold_start_date,
            hold_end_date,
            reason
        } = req.body;

        // Validate required fields
        if (!hold_start_date || !hold_end_date) {
            return res.status(400).json({
                success: false,
                message: "Hold start date and end date are required"
            });
        }

        // Validate date range
        const startDate = new Date(hold_start_date);
        const endDate = new Date(hold_end_date);
        
        if (startDate >= endDate) {
            return res.status(400).json({
                success: false,
                message: "Hold end date must be after start date"
            });
        }

        // For date-based holds, trek_ids can be null (meaning all treks)
        // For specific trek holds, trek_ids must be provided
        if (request_type === "slot_hold" && (!trek_ids || trek_ids.length === 0)) {
            return res.status(400).json({
                success: false,
                message: "Trek IDs are required for slot-based holds"
            });
        }

        // Calculate expiration time (24 hours from now)
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        // Debug logging
        console.log("Creating hold request with data:", {
            vendor_id: vendorId,
            trek_ids,
            batch_ids,
            request_type: request_type || "date_hold",
            hold_start_date,
            hold_end_date,
            reason,
            expires_at: expiresAt,
            status: "pending"
        });

        // Create the hold request
        const holdRequest = await HoldRequest.create({
            vendor_id: vendorId,
            trek_ids,
            batch_ids,
            request_type: request_type || "date_hold",
            hold_start_date,
            hold_end_date,
            reason,
            expires_at: expiresAt,
            status: "pending"
        });

        // Fetch the created request (no associations needed since we store IDs directly)
        const createdRequest = await HoldRequest.findByPk(holdRequest.id);

        logger.vendor("info", `Vendor ${vendorId} created hold request ${holdRequest.id} for ${trek_ids ? trek_ids.length : 0} treks`);
        
        res.status(201).json({
            success: true,
            message: "Hold request created successfully",
            data: createdRequest
        });
    } catch (error) {
        logger.vendor("error", `Error creating hold request: ${error.message}`);
        res.status(500).json({
            success: false,
            message: "Failed to create hold request",
            error: error.message
        });
    }
};

// Get a specific hold request
exports.getHoldRequestById = async (req, res) => {
    try {
        const vendorId = req.user.id;
        const { id } = req.params;

        const holdRequest = await HoldRequest.findOne({
            where: { 
                id,
                vendor_id: vendorId 
            }
        });

        if (!holdRequest) {
            return res.status(404).json({
                success: false,
                message: "Hold request not found"
            });
        }

        res.json({
            success: true,
            data: holdRequest
        });
    } catch (error) {
        logger.vendor("error", `Error fetching hold request: ${error.message}`);
        res.status(500).json({
            success: false,
            message: "Failed to fetch hold request",
            error: error.message
        });
    }
};

// Update a hold request (vendor can only update reason)
exports.updateHoldRequest = async (req, res) => {
    try {
        const vendorId = req.user.id;
        const { id } = req.params;
        const { reason } = req.body;

        const holdRequest = await HoldRequest.findOne({
            where: { 
                id,
                vendor_id: vendorId 
            }
        });

        if (!holdRequest) {
            return res.status(404).json({
                success: false,
                message: "Hold request not found"
            });
        }

        // Only allow updates if status is pending
        if (holdRequest.status !== "pending") {
            return res.status(400).json({
                success: false,
                message: "Cannot update hold request that is not pending"
            });
        }

        // Only allow updating the reason
        await holdRequest.update({ reason });

        logger.vendor("info", `Vendor ${vendorId} updated hold request ${id}`);
        
        res.json({
            success: true,
            message: "Hold request updated successfully",
            data: holdRequest
        });
    } catch (error) {
        logger.vendor("error", `Error updating hold request: ${error.message}`);
        res.status(500).json({
            success: false,
            message: "Failed to update hold request",
            error: error.message
        });
    }
};

// Cancel a hold request
exports.cancelHoldRequest = async (req, res) => {
    try {
        const vendorId = req.user.id;
        const { id } = req.params;

        const holdRequest = await HoldRequest.findOne({
            where: { 
                id,
                vendor_id: vendorId 
            }
        });

        if (!holdRequest) {
            return res.status(404).json({
                success: false,
                message: "Hold request not found"
            });
        }

        // Only allow cancellation if status is pending
        if (holdRequest.status !== "pending") {
            return res.status(400).json({
                success: false,
                message: "Cannot cancel hold request that is not pending"
            });
        }

        await holdRequest.update({ status: "expired" });

        logger.vendor("info", `Vendor ${vendorId} cancelled hold request ${id}`);
        
        res.json({
            success: true,
            message: "Hold request cancelled successfully"
        });
    } catch (error) {
        logger.vendor("error", `Error cancelling hold request: ${error.message}`);
        res.status(500).json({
            success: false,
            message: "Failed to cancel hold request",
            error: error.message
        });
    }
};

// Get hold request statistics for vendor
exports.getHoldRequestStats = async (req, res) => {
    try {
        const vendorId = req.user.id;

        const stats = await HoldRequest.findAll({
            where: { vendor_id: vendorId },
            attributes: [
                'status',
                [HoldRequest.sequelize.fn('COUNT', HoldRequest.sequelize.col('id')), 'count']
            ],
            group: ['status']
        });

        const totalRequests = await HoldRequest.count({
            where: { vendor_id: vendorId }
        });

        const pendingRequests = await HoldRequest.count({
            where: { 
                vendor_id: vendorId,
                status: "pending"
            }
        });

        res.json({
            success: true,
            data: {
                stats,
                total: totalRequests,
                pending: pendingRequests
            }
        });
    } catch (error) {
        logger.vendor("error", `Error fetching hold request stats: ${error.message}`);
        res.status(500).json({
            success: false,
            message: "Failed to fetch hold request statistics",
            error: error.message
        });
    }
}; 