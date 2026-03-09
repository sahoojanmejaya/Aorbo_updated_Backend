const { Role } = require("../../models");
const { Op } = require("sequelize");

// Get all roles with pagination and filtering
exports.getAllRoles = async (req, res) => {
    try {
        const { page = 1, limit = 20} = req.query;
        const offset = (page - 1) * limit;

   

        const { count, rows: roles } = await Role.findAndCountAll({
          
           
            order: [
                ["createdAt", "DESC"],
               
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
        });

    const formattedRoles = roles.map(role => ({
  ...role.toJSON(),
 prefix: typeof role.prefix === "string" ? JSON.parse(role.prefix) : role.prefix,

}));

        res.json({
            message: "Role fetched successfully",
            success: true,
            data: formattedRoles,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(count / limit),
                totalCount: count,
            },
        });
    } catch (error) {
        console.error("Error fetching roles:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch roles",
            error: error.message,
        });
    }
};

// Get role by ID
exports.getRoleById = async (req, res) => {
    try {
        const { id } = req.params;

        const role = await Role.findByPk(id, {
          
        });

        if (!role) {
            return res.status(404).json({
                success: false,
                message: "Role not found",
            });
        }
 const formattedRole = {
      ...role.toJSON(),
     prefix: typeof role.prefix === "string" ? JSON.parse(role.prefix) : role.prefix,
    };
        res.json({
            success: true,
            data: formattedRole,
        });
    } catch (error) {
        console.error("Error fetching badge:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch badge",
            error: error.message,
        });
    }
};

// Create new role
exports.createRole = async (req, res) => {
    try {
        const {
            name,
            description,
            prefix,
            
        } = req.body;

        // Validate required fields
        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Badge name is required",
            });
        }

        const existingRole = await Role.findOne({
            where: { name: name.trim() },
        });

        if (existingRole) {
            return res.status(400).json({
                success: false,
                message: "Role with this name already exists",
            });
        }

        const role = await Role.create({
            name: name.trim(),
            description,
            prefix
            
        });

        res.status(201).json({
            success: true,
            message: "Role created successfully",
            data: role,
        });
    } catch (error) {
        console.error("Error creating role:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create role",
            error: error.message,
        });
    }
};

// Update Role
exports.updateRole = async (req, res) => {
    try {
        const { id } = req.params;
        const {
           name,
            description,
            prefix,
        } = req.body;

        const role = await Role.findByPk(id);

        if (!role) {
            return res.status(404).json({
                success: false,
                message: "Role not found",
            });
        }

     
        if (name && name.trim() !== role.name) {
            const existingRole = await Role.findOne({
                where: {
                    name: name.trim(),
                    id: { [Op.ne]: id },
                },
            });

            if (existingRole) {
                return res.status(400).json({
                    success: false,
                    message: "Role with this name already exists",
                });
            }
        }

        // Update role
        await role.update({
            name: name ? name.trim() : role.name,
            description:
                description !== undefined ? description : role.description,
            prefix: prefix !== undefined ? prefix : role.prefix,
           
        });

        res.json({
            success: true,
            message: "Role updated successfully",
            data: role,
        });
    } catch (error) {
        console.error("Error updating role:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update role",
            error: error.message,
        });
    }
};

// Delete role
exports.deleteRole = async (req, res) => {
    try {
        const { id } = req.params;

        const role = await Role.findByPk(id, {
           
        });

        if (!role) {
            return res.status(404).json({
                success: false,
                message: "Role not found",
            });
        }

        // Check if role is associated with any users
        if (role.users && role.users.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete role that is associated with users",
                data: {
                    associated_users: role.users.map((user) => ({
                        id: user.id,
                        username: user.username,
                    })),
                },
            });
        }

        await Role.destroy();

        res.json({
            success: true,
            message: "Role deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting role:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete role",
            error: error.message,
        });
    }
};



