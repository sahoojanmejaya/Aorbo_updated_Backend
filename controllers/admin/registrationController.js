const { Vendor, User,Role,RolePermission,Permission } = require("../../models");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const logger = require("../../utils/logger");
const { Op } = require("sequelize");

const JWT_SECRET = process.env.JWT_SECRET || "vendor_jwt_secret";


exports.register = async (req, res) => {
  try {
    let { email, password, name, phone, prefix, role_id } = req.body;

    role_id = Number(role_id); // ✅ ensure number

    if (!email || !password || !name) {
      return res.status(400).json({ message: "All fields are required" });
    }

 
    const existingUser = await User.findOne({ where: {
    [Op.or]: [
      { email: email },
      { phone: phone }
    ]
  } });
   if (existingUser) {
  return res.status(400).json({
    message: "Email or phone number already registered",
  });
}



    if (prefix === "team head" && [4, 5].includes(role_id)) {
      const teamHeadExists = await User.findOne({
        where: {
          prefix: "team head",
          roleId: role_id,
        },
      });

      if (teamHeadExists) {
        return res.status(400).json({
          message: "Team head already exists for this role",
        });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      phone,
      passwordHash: hashedPassword,
      roleId: role_id,
      prefix,
      status: "active",
    });

    logger.auth("info", "user registered successfully", {
      userId: user.id,
    });

    return res.status(201).json({
      message: "user registered successfully",
      user_details: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role_id: user.roleId,
        prefix: user.prefix,
      },
    });

  } catch (err) {
    console.error("REGISTER ERROR 👉", err);
    logger.auth("error", "Vendor registration failed", {
      error: err.message,
      stack: err.stack,
      email: req.body.email,
    });

    res.status(500).json({ message: "Registration failed" });
  }
};

exports.getUsersByRoleIds = async (req, res) => {
  try {
    // hardcoded or from query ?role_ids=4,5
    const roleIds = [4, 5];

    const users = await User.findAll({
      where: {
        role_id: {
          [Op.in]: roleIds,
        },
      },
     
      include: [
        {
          model: Role,
          attributes: ["id", "name"],
       as: "role", 
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const formattedUsers = users.map(user => ({
      ...user.toJSON(),
    
    }));

    return res.status(200).json({
    
      success: true,
      msg:"user data fetched successfully",
      count: formattedUsers.length,
      data: formattedUsers,
    });

  } catch (error) {
    console.error("Error fetching users by roles:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message,
    });
  }
};

function safeJsonParse(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

exports.updateProfile = async (req, res) => {
  try {
    const { id } = req.params; 
    const { name, prefix, role_id, status } = req.body;

    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Optional: check role exists
    if (role_id) {
      const roleExists = await Role.findByPk(role_id);
      if (!roleExists) {
        return res.status(400).json({
          success: false,
          message: "Invalid role_id",
        });
      }
    }

    // Update fields only if provided
    if (name !== undefined) user.name = name.trim();
    if (prefix !== undefined) user.prefix = prefix;
    if (role_id !== undefined) user.role_id = role_id;
    if (status !== undefined) user.status = status;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        id: user.id,
        name: user.name,
        prefix: safeJsonParse(user.prefix),
        role_id: user.role_id,
        status: user.status,
      },
    });

  } catch (error) {
    console.error("Error updating profile:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: error.message,
    });
  }
};
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    await user.destroy();

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });

  } catch (error) {
    console.error("Error deleting user:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete user",
      error: error.message,
    });
  }
};
exports.login_all = async (req, res) => {
    try {
        const { email, password, role_id } = req.body; 

        if (!email || !password || !role_id) {
            return res.status(400).json({
                message: "Email, password and role_id are required"
            });
        }

        // map role_id to Sequelize column roleId
        const user = await User.findOne({
            where: { email, roleId: role_id },
            include: [{ model: Role, attributes: ["id", "name"], as: "role", required: false }]
        });

        if (!user) {
            return res.status(401).json({
                message: "Invalid credentials or role mismatch"
            });
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
const rolePermission = await RolePermission.findOne({
    where: { role_id: user.roleId }
});

let permissions = [];

if (rolePermission && rolePermission.permission_id) {

    let permissionIds = rolePermission.permission_id;

    // 🔥 convert string to array
    if (typeof permissionIds === "string") {
        permissionIds = JSON.parse(permissionIds);
    }

    const { Op } = require("sequelize");

    permissions = await Permission.findAll({
        where: {
            id: { [Op.in]: permissionIds }
        },
        attributes: ["id", "name", "description"]
    });
}

        // Role info
        const roleInfo = user.role ? { id: user.role.id, name: user.role.name } : null;

        const token = jwt.sign(
            {
                id: user.id,
                roleId: user.roleId,
                role: roleInfo ? roleInfo.name : null,
                email: user.email
            },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        return res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role_id: user.roleId, 
                permissions: permissions ,// can keep role_id key in response
                role: roleInfo,
                ...user.toJSON() // all other user details
            }
        });

    } catch (err) {
        console.error("Login error:", err);
        return res.status(500).json({ message: "Login failed" });
    }
};

