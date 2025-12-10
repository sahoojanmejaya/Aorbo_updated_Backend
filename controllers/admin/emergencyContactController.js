const { EmergencyContact, Customer, City, State } = require("../../models");
const { Op } = require("sequelize");

// Get all emergency contacts with customer information
const getAllEmergencyContacts = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            customer_id,
            search,
            sort_by = "created_at",
            sort_order = "DESC",
        } = req.query;

        const offset = (page - 1) * limit;
        const whereClause = { is_active: true };

        // Filter by customer
        if (customer_id) {
            whereClause.customer_id = customer_id;
        }

        // Search functionality
        if (search) {
            whereClause[Op.or] = [
                { name: { [Op.like]: `%${search}%` } },
                { phone: { [Op.like]: `%${search}%` } },
                { relationship: { [Op.like]: `%${search}%` } },
            ];
        }

        const { count, rows: contacts } = await EmergencyContact.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: Customer,
                    as: "customer",
                    attributes: ["id", "name", "email", "phone", "city_id", "state_id"],
                    required: false,
                },
            ],
            order: [[sort_by, sort_order.toUpperCase()]],
            limit: parseInt(limit),
            offset: parseInt(offset),
        });

        res.json({
            success: true,
            data: {
                contacts,
                pagination: {
                    current_page: parseInt(page),
                    total_pages: Math.ceil(count / limit),
                    total_items: count,
                    items_per_page: parseInt(limit),
                },
            },
        });
    } catch (error) {
        console.error("Error fetching emergency contacts:", error);
        console.error("Error details:", error.message);
        console.error("Error stack:", error.stack);
        res.status(500).json({
            success: false,
            message: "Failed to fetch emergency contacts",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
};

// Get emergency contact by ID
const getEmergencyContactById = async (req, res) => {
    try {
        const { id } = req.params;

        const contact = await EmergencyContact.findByPk(id, {
            include: [
                {
                    model: Customer,
                    as: "customer",
                    attributes: ["id", "name", "email", "phone", "city_id", "state_id"],
                    required: false,
                },
            ],
        });

        if (!contact) {
            return res.status(404).json({
                success: false,
                message: "Emergency contact not found",
            });
        }

        res.json({
            success: true,
            data: contact,
        });
    } catch (error) {
        console.error("Error fetching emergency contact:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch emergency contact",
        });
    }
};

// Get emergency contacts statistics
const getEmergencyContactStats = async (req, res) => {
    try {
        const totalContacts = await EmergencyContact.count({
            where: { is_active: true },
        });

        const customersWithContacts = await EmergencyContact.count({
            distinct: true,
            col: "customer_id",
            where: { is_active: true },
        });

        const totalCustomers = await Customer.count({
            where: { is_active: true },
        });

        const contactsByPriority = await EmergencyContact.findAll({
            attributes: [
                "priority",
                [
                    EmergencyContact.sequelize.fn("COUNT", EmergencyContact.sequelize.col("id")),
                    "count",
                ],
            ],
            where: { is_active: true },
            group: ["priority"],
            order: [["priority", "ASC"]],
        });

        res.json({
            success: true,
            data: {
                total_contacts: totalContacts,
                customers_with_contacts: customersWithContacts,
                total_customers: totalCustomers,
                customers_without_contacts: totalCustomers - customersWithContacts,
                contacts_by_priority: contactsByPriority,
            },
        });
    } catch (error) {
        console.error("Error fetching emergency contact stats:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch statistics",
        });
    }
};

// Update emergency contact (admin can edit)
const updateEmergencyContact = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone, relationship, priority, is_active } = req.body;

        const contact = await EmergencyContact.findByPk(id);

        if (!contact) {
            return res.status(404).json({
                success: false,
                message: "Emergency contact not found",
            });
        }

        // Update fields
        if (name !== undefined) contact.name = name;
        if (phone !== undefined) contact.phone = phone;
        if (relationship !== undefined) contact.relationship = relationship;
        if (priority !== undefined) contact.priority = priority;
        if (is_active !== undefined) contact.is_active = is_active;

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

// Delete emergency contact (admin)
const deleteEmergencyContact = async (req, res) => {
    try {
        const { id } = req.params;

        const contact = await EmergencyContact.findByPk(id);

        if (!contact) {
            return res.status(404).json({
                success: false,
                message: "Emergency contact not found",
            });
        }

        // Soft delete
        contact.is_active = false;
        await contact.save();

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

// Get emergency contacts for a specific customer
const getCustomerEmergencyContacts = async (req, res) => {
    try {
        const { customerId } = req.params;

        const customer = await Customer.findByPk(customerId);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found",
            });
        }

        const contacts = await EmergencyContact.findAll({
            where: {
                customer_id: customerId,
                is_active: true,
            },
            order: [
                ["priority", "ASC"],
                ["created_at", "ASC"],
            ],
        });

        res.json({
            success: true,
            data: {
                customer: {
                    id: customer.id,
                    name: customer.name,
                    email: customer.email,
                    phone: customer.phone,
                },
                contacts,
            },
        });
    } catch (error) {
        console.error("Error fetching customer emergency contacts:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch customer emergency contacts",
        });
    }
};

module.exports = {
    getAllEmergencyContacts,
    getEmergencyContactById,
    getEmergencyContactStats,
    updateEmergencyContact,
    deleteEmergencyContact,
    getCustomerEmergencyContacts,
};
