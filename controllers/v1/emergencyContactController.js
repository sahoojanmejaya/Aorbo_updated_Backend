const { EmergencyContact, Customer } = require("../../models");

// Get all emergency contacts for a customer
exports.getEmergencyContacts = async (req, res) => {
    try {
        const customerId = req.customer.id;

        const contacts = await EmergencyContact.findAll({
            where: {
                customer_id: customerId,
                is_active: true,
            },
            order: [["priority", "ASC"], ["created_at", "ASC"]],
        });

        res.json({
            success: true,
            data: contacts,
        });
    } catch (error) {
        console.error("Error fetching emergency contacts:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch emergency contacts",
        });
    }
};

// Create a new emergency contact
exports.createEmergencyContact = async (req, res) => {
    try {
        const customerId = req.customer.id;
        const { name, phone, relationship } = req.body;

        // Validate required fields
        if (!name || !phone) {
            return res.status(400).json({
                success: false,
                message: "Name and phone number are required",
            });
        }

        // Check if customer already has 3 emergency contacts
        const existingCount = await EmergencyContact.count({
            where: {
                customer_id: customerId,
                is_active: true,
            },
        });

        if (existingCount >= 3) {
            return res.status(400).json({
                success: false,
                message: "Maximum 3 emergency contacts allowed",
            });
        }

        // Calculate priority (next available)
        const priority = existingCount + 1;

        const contact = await EmergencyContact.create({
            customer_id: customerId,
            name,
            phone,
            relationship: relationship || null,
            priority,
        });

        res.status(201).json({
            success: true,
            message: "Emergency contact added successfully",
            data: contact,
        });
    } catch (error) {
        console.error("Error creating emergency contact:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create emergency contact",
        });
    }
};

// Update an emergency contact
exports.updateEmergencyContact = async (req, res) => {
    try {
        const customerId = req.customer.id;
        const contactId = req.params.id;
        const { name, phone, relationship } = req.body;

        const contact = await EmergencyContact.findOne({
            where: {
                id: contactId,
                customer_id: customerId,
            },
        });

        if (!contact) {
            return res.status(404).json({
                success: false,
                message: "Emergency contact not found",
            });
        }

        // Update fields
        if (name) contact.name = name;
        if (phone) contact.phone = phone;
        if (relationship !== undefined) contact.relationship = relationship;

        await contact.save();

        res.json({
            success: true,
            message: "Emergency contact updated successfully",
            data: contact,
        });
    } catch (error) {
        console.error("Error updating emergency contact:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update emergency contact",
        });
    }
};

// Delete an emergency contact
exports.deleteEmergencyContact = async (req, res) => {
    try {
        const customerId = req.customer.id;
        const contactId = req.params.id;

        const contact = await EmergencyContact.findOne({
            where: {
                id: contactId,
                customer_id: customerId,
            },
        });

        if (!contact) {
            return res.status(404).json({
                success: false,
                message: "Emergency contact not found",
            });
        }

        // Soft delete
        contact.is_active = false;
        await contact.save();

        // Or hard delete if preferred
        // await contact.destroy();

        res.json({
            success: true,
            message: "Emergency contact deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting emergency contact:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete emergency contact",
        });
    }
};
