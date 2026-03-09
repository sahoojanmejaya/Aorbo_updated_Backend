const { RolePermission,Permission,Role,User } = require("../../models");
const { Op } = require("sequelize");


exports.getAllPermission = async (req, res) => {
    try {
        const { page = 1, limit = 20} = req.query;
        const offset = (page - 1) * limit;

   

        const { count, rows: permission } = await Permission.findAndCountAll({
          
           
            order: [
                ["createdAt", "DESC"],
               
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
        });

    const formattedPermission = permission.map(permission => ({
  ...permission.toJSON(),
  description: typeof permission.description === "string" ? JSON.parse(permission.description) : permission.description,

  
}));

        res.json({
            message: "Permission fetched successfully",
            success: true,
            data: formattedPermission,
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

// Get permission by ID
exports.getPermissionById = async (req, res) => {
    try {
        const { id } = req.params;

        const permission = await Permission.findByPk(id, {
          
        });

        if (!permission) {
            return res.status(404).json({
                success: false,
                message: "Permission not found",
            });
        }
 const formattedPermission = {
      ...permission.toJSON(),
      description: typeof permission.description === "string" ? JSON.parse(permission.description) : permission.description,
    };
        res.json({
            success: true,
            data: formattedPermission,
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


exports.createPermission = async (req, res) => {
    try {
        const {
            name,
            description,
    } = req.body;

        if (!name ||!description) {
            return res.status(400).json({
                success: false,
                message: "name and description are required",
            });
        }

        const existingPermission = await Permission.findOne({
            where: { name: name.trim() },
        });

        if (existingPermission) {
            return res.status(400).json({
                success: false,
                message: "permission already exists",
            });
        }

        const permission = await Permission.create({
            name: name.trim(),
            description,
         
            
        });

        res.status(201).json({
            success: true,
            message: "Permission created successfully",
            data: permission,
        });
    } catch (error) {
        console.error("Error creating permission:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create role",
            error: error.message,
        });
    }
};

// Update Permission
exports.updatePermission = async (req, res) => {
    try {
        const { id } = req.params;
        const {
           name,
            description,
            
        } = req.body;

        const permission = await Permission.findByPk(id);

        if (!permission) {
            return res.status(404).json({
                success: false,
                message: "Permission not found",
            });
        }

     
        if (name && name.trim() !== permission.name) {
            const existingPermission = await Permission.findOne({
                where: {
                    name: name.trim(),
                    id: { [Op.ne]: id },
                },
            });

            if (existingPermission) {
                return res.status(400).json({
                    success: false,
                    message: "Permission with this name already exists",
                });
            }
        }

        // Update permission
     await Permission.update(
    {
        name: name ? name.trim() : permission.name,
        description: description !== undefined ? description : permission.description,
    },
    {
        where: { id },
    }
);


        res.json({
            success: true,
            message: "Permission updated successfully",
            data: permission,
        });
    } catch (error) {
        console.error("Error updating permission:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update permission",
            error: error.message,
        });
    }
};

// Delete role
exports.deletePermission = async (req, res) => {
    try {
        const { id } = req.params;

        const permission = await Permission.findByPk(id, {
            include: [
                {
                    model: User,
                    as: "users",
                },
            ],
        });

        if (!permission) {
            return res.status(404).json({
                success: false,
                message: "Permission not found",
            });
        }

        // Check if permission is associated with any users
        if (permission.users && permission.users.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete permission that is associated with users",
                data: {
                    associated_users: permission.users.map((user) => ({
                        id: user.id,
                        username: user.username,
                    })),
                },
            });
        }

        await Role.destroy();

        res.json({
            success: true,
            message: "permission deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting permission:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete permission",
            error: error.message,
        });
    }
};





/*
==================================================
ASSIGN PERMISSIONS TO USER (BULK CREATE)
==================================================
body:
{
  user_id: 1,
  role_id: 2,
  permission_ids: [1,2,3,4]
}
*/
exports.assignPermissions = async (req, res) => {
  try {
    const {  role_id, permission_id,pre_fix, } = req.body;

    if (!role_id || permission_id === undefined) {
      return res.status(400).json({
        success: false,
        message: "role_id and permission_id are required",
      });
    }

    const existing = await RolePermission.findOne({
      where: {  role_id,pre_fix }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Permissions already assigned. Use update API."
      });
    }

    let permissions = req.body.permission_id;




console.log("FINAL VALUE:", permissions);

await RolePermission.create({
  role_id: req.body.role_id,
  pre_fix:pre_fix,
 // user_id: req.body.user_id,
  permission_id: permissions
});

    return res.status(201).json({
      success: true,
      message: "Permissions assigned successfully",
      
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: err.message
    });
  }
};







/*
==================================================
VIEW PERMISSIONS OF USER
==================================================
params: user_id
*/
exports.getUserPermissions = async (req, res) => {
  try {
    const { user_id } = req.params;

    const data = await RolePermission.findAll({
      where: { user_id },
      include: [
        { model: Permission, attributes: ["id", "name"] },
        { model: Role, attributes: ["id", "name"] }
      ]
    });

    res.json({
      success: true,
      data
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};


exports.getAllUserPermissions = async (req, res) => {
  try {
    const records = await RolePermission.findAll();

    const result = [];

    for (const row of records) {

      let permissionIds = row.permission_id;

      if (typeof permissionIds === "string") {
        permissionIds = JSON.parse(permissionIds);
      }

      const permissions = await Permission.findAll({
        where: { id: permissionIds },
        attributes: ["id", "name"]
      });

      const role = await Role.findByPk(row.role_id, {
        attributes: ["id", "name"]
      });

      result.push({
        user_id: row.user_id,
        role,
        pre_fix:row.pre_fix,
        permissions
      });
    }

    res.json({
      success: true,
      data: result
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

/*
==================================================
UPDATE USER PERMISSIONS (REPLACE ALL)
==================================================
body:
{
  user_id: 1,
  role_id: 2,
  permission_ids: [1,5,7]
}
*/
exports.updateUserPermissions = async (req, res) => {
  try {
    let { role_id, permission_id } = req.body;

    // force array
    if (!Array.isArray(permission_id)) {
      permission_id = [permission_id];
    }

    // delete old
    await RolePermission.destroy({
      where: { role_id }
    });

    // insert new
    const rows = permission_id.map(pid => ({
      role_id,
      permission_id: pid
    }));

    await RolePermission.bulkCreate(rows);

    res.json({
      success: true,
      message: "Permissions replaced successfully"
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};



exports.getAllRolePermissions = async (req, res) => {
  try {

    const data = await RolePermission.findAll({
      include: [
        {
          model: User,
          attributes: ["id", "name", "email"]
        },
        {
          model: Role,
          attributes: ["id", "name"]
        },
        {
          model: Permission,
          attributes: ["id", "name", "description"]
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    res.json({
      success: true,
      message: "All role permissions fetched",
      data
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch",
      error: err.message
    });
  }
};



/*
==================================================
DELETE SINGLE PERMISSION FROM USER
==================================================
params: user_id, permission_id
*/
exports.deleteSinglePermission = async (req, res) => {
  try {
    const {  role_id,permission_id } = req.params;

    const record = await RolePermission.findOne({
      where: { role_id }
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Record not found"
      });
    }

    let permissions = record.permission_id;

    // ensure array
    if (typeof permissions === "string") {
      permissions = JSON.parse(permissions);
    }

    if (!Array.isArray(permissions)) {
      permissions = [];
    }

    const removeId = String(permission_id); // compare as string

    const updatedPermissions = permissions.filter(
      id => String(id) !== removeId
    );

    // 🔥 IMPORTANT — only update if something changed
    if (updatedPermissions.length === permissions.length) {
      return res.json({
        success: false,
        message: "Permission not found in array",
        data: permissions
      });
    }

    await record.update({
      permission_id: JSON.stringify(updatedPermissions)
    });

    return res.json({
      success: true,
      message: "Permission removed successfully",
      old: permissions,
      new: updatedPermissions
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};





/*
==================================================
DELETE ALL PERMISSIONS OF USER
==================================================
params: user_id
*/
exports.deleteAllPermissions = async (req, res) => {
  try {
    const { role_id } = req.params;

    await RolePermission.destroy({
      where: { role_id }
    });

    res.json({
      success: true,
      message: "All permissions removed"
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
