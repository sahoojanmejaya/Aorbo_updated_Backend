const { TrekCaptain, Vendor } = require('../../models');
const logger = require('../../utils/logger');

// Get all trek captains for a vendor
const getTrekCaptains = async (req, res) => {
    try {
        const vendorId = req.user?.id;
        
        const captains = await TrekCaptain.findAll({
            where: { 
                vendor_id: vendorId,
                status: 'active'
            },
            order: [['created_at', 'DESC']]
        });

        logger.vendor('info', 'Trek captains retrieved successfully', {
            vendor_id: vendorId,
            count: captains.length
        });

        res.json({
            success: true,
            data: captains
        });
    } catch (error) {
        logger.vendor('error', 'Error retrieving trek captains', {
            error: error.message,
            vendor_id: req.user?.id
        });
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve trek captains',
            error: error.message
        });
    }
};

// Get a single trek captain
const getTrekCaptain = async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = req.user?.id;

        const captain = await TrekCaptain.findOne({
            where: { 
                id: id,
                vendor_id: vendorId
            }
        });

        if (!captain) {
            return res.status(404).json({
                success: false,
                message: 'Trek captain not found'
            });
        }

        logger.vendor('info', 'Trek captain retrieved successfully', {
            captain_id: id,
            vendor_id: vendorId
        });

        res.json({
            success: true,
            data: captain
        });
    } catch (error) {
        logger.vendor('error', 'Error retrieving trek captain', {
            error: error.message,
            captain_id: req.params.id,
            vendor_id: req.user?.id
        });
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve trek captain',
            error: error.message
        });
    }
};

// Create a new trek captain
const createTrekCaptain = async (req, res) => {
    try {
        const vendorId = req.user?.id;
        const { name, email, phone } = req.body;

        // Validate required fields
        if (!name || !email || !phone) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, and phone are required'
            });
        }

        // Check if email already exists for this vendor
        const existingCaptain = await TrekCaptain.findOne({
            where: { 
                email: email,
                vendor_id: vendorId
            }
        });

        if (existingCaptain) {
            return res.status(400).json({
                success: false,
                message: 'A captain with this email already exists'
            });
        }

        const captain = await TrekCaptain.create({
            name,
            email,
            phone,
            vendor_id: vendorId,
            status: 'active'
        });

        logger.vendor('info', 'Trek captain created successfully', {
            captain_id: captain.id,
            vendor_id: vendorId,
            name: captain.name
        });

        res.status(201).json({
            success: true,
            message: 'Trek captain created successfully',
            data: captain
        });
    } catch (error) {
        logger.vendor('error', 'Error creating trek captain', {
            error: error.message,
            vendor_id: req.user?.id,
            body: req.body
        });
        res.status(500).json({
            success: false,
            message: 'Failed to create trek captain',
            error: error.message
        });
    }
};

// Update a trek captain
const updateTrekCaptain = async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = req.user?.id;
        const { name, email, phone, status } = req.body;

        const captain = await TrekCaptain.findOne({
            where: { 
                id: id,
                vendor_id: vendorId
            }
        });

        if (!captain) {
            return res.status(404).json({
                success: false,
                message: 'Trek captain not found'
            });
        }

        // Check if email already exists for another captain of this vendor
        if (email && email !== captain.email) {
            const existingCaptain = await TrekCaptain.findOne({
                where: { 
                    email: email,
                    vendor_id: vendorId,
                    id: { [require('sequelize').Op.ne]: id }
                }
            });

            if (existingCaptain) {
                return res.status(400).json({
                    success: false,
                    message: 'A captain with this email already exists'
                });
            }
        }

        // Update fields
        const updateData = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (phone) updateData.phone = phone;
        if (status) updateData.status = status;

        await captain.update(updateData);

        logger.vendor('info', 'Trek captain updated successfully', {
            captain_id: id,
            vendor_id: vendorId,
            updated_fields: Object.keys(updateData)
        });

        res.json({
            success: true,
            message: 'Trek captain updated successfully',
            data: captain
        });
    } catch (error) {
        logger.vendor('error', 'Error updating trek captain', {
            error: error.message,
            captain_id: req.params.id,
            vendor_id: req.user?.id
        });
        res.status(500).json({
            success: false,
            message: 'Failed to update trek captain',
            error: error.message
        });
    }
};

// Delete a trek captain
const deleteTrekCaptain = async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = req.user?.id;

        const captain = await TrekCaptain.findOne({
            where: { 
                id: id,
                vendor_id: vendorId
            }
        });

        if (!captain) {
            return res.status(404).json({
                success: false,
                message: 'Trek captain not found'
            });
        }

        // Check if captain is assigned to any active treks
        const assignedTreks = await captain.getTreks({
            where: { status: 'active' }
        });

        if (assignedTreks.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete captain who is assigned to active treks'
            });
        }

        await captain.destroy();

        logger.vendor('info', 'Trek captain deleted successfully', {
            captain_id: id,
            vendor_id: vendorId
        });

        res.json({
            success: true,
            message: 'Trek captain deleted successfully'
        });
    } catch (error) {
        logger.vendor('error', 'Error deleting trek captain', {
            error: error.message,
            captain_id: req.params.id,
            vendor_id: req.user?.id
        });
        res.status(500).json({
            success: false,
            message: 'Failed to delete trek captain',
            error: error.message
        });
    }
};

// Toggle captain status
const toggleCaptainStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = req.user?.id;

        const captain = await TrekCaptain.findOne({
            where: { 
                id: id,
                vendor_id: vendorId
            }
        });

        if (!captain) {
            return res.status(404).json({
                success: false,
                message: 'Trek captain not found'
            });
        }

        const newStatus = captain.status === 'active' ? 'inactive' : 'active';
        await captain.update({ status: newStatus });

        logger.vendor('info', 'Trek captain status toggled', {
            captain_id: id,
            vendor_id: vendorId,
            new_status: newStatus
        });

        res.json({
            success: true,
            message: `Captain ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`,
            data: captain
        });
    } catch (error) {
        logger.vendor('error', 'Error toggling trek captain status', {
            error: error.message,
            captain_id: req.params.id,
            vendor_id: req.user?.id
        });
        res.status(500).json({
            success: false,
            message: 'Failed to toggle captain status',
            error: error.message
        });
    }
};

module.exports = {
    getTrekCaptains,
    getTrekCaptain,
    createTrekCaptain,
    updateTrekCaptain,
    deleteTrekCaptain,
    toggleCaptainStatus
}; 