const { User, Role } = require("../../models");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// Admin login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required",
            });
        }

        // Find user by email
        const user = await User.findOne({
            where: { email },
            include: [{ model: Role, as: "role" }],
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials",
            });
        }

        // Check if user has admin role
        if (!user.role || user.role.name !== "admin") {
            return res.status(401).json({
                success: false,
                message: "Access denied. Admin privileges required.",
            });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.passwordHash);
        if (!validPassword) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials",
            });
        }

        // Check if user is active
        if (user.status !== "active") {
            return res.status(401).json({
                success: false,
                message: "Account is not active",
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: "admin",
                roleId: user.roleId,
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        // Return user data without sensitive information
        const userData = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: "admin",
            status: user.status,
            createdAt: user.createdAt,
        };

        res.json({
            success: true,
            message: "Admin login successful",
            data: {
                token,
                user: userData,
            },
        });
    } catch (error) {
        console.error("Admin login error:", error);
        res.status(500).json({
            success: false,
            message: "Login failed",
        });
    }
};

// Get admin profile
exports.getProfile = async (req, res) => {
    try {
        const userId = req.user.id;

        const user = await User.findByPk(userId, {
            include: [{ model: Role, as: "role" }],
            attributes: { exclude: ["passwordHash"] },
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        const userData = {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role?.name || "admin",
            status: user.status,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };

        res.json({
            success: true,
            data: userData,
        });
    } catch (error) {
        console.error("Get admin profile error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get profile",
        });
    }
};

// Update admin profile
exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, email, phone } = req.body;

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // Check if email is being changed and if it's already taken
        if (email && email !== user.email) {
            const existingUser = await User.findOne({ where: { email } });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: "Email already exists",
                });
            }
        }

        // Update user data
        await user.update({
            name: name || user.name,
            email: email || user.email,
            phone: phone || user.phone,
        });

        const userData = {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: "admin",
            status: user.status,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };

        res.json({
            success: true,
            message: "Profile updated successfully",
            data: userData,
        });
    } catch (error) {
        console.error("Update admin profile error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update profile",
        });
    }
};

// Admin logout
exports.logout = async (req, res) => {
    try {
        // In a stateless JWT system, logout is handled client-side
        // by removing the token. This endpoint can be used for logging
        // logout events or future token blacklisting if needed.

        res.json({
            success: true,
            message: "Logout successful",
        });
    } catch (error) {
        console.error("Admin logout error:", error);
        res.status(500).json({
            success: false,
            message: "Logout failed",
        });
    }
};
