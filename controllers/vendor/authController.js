const { Vendor, User } = require("../../models");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const logger = require("../../utils/logger");

const JWT_SECRET = process.env.JWT_SECRET || "vendor_jwt_secret";

// Vendor registration
exports.register = async (req, res) => {
    try {
        const { email, password, name, company_info } = req.body;
        if (!email || !password || !name) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res
                .status(400)
                .json({ message: "Email already registered" });
        }

        // Check if user is already a vendor
        if (existingUser) {
            const existingVendor = await Vendor.findOne({
                where: { user_id: existingUser.id },
            });
            if (existingVendor) {
                return res
                    .status(400)
                    .json({ message: "User is already a vendor" });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user first
        const user = await User.create({
            name,
            email,
            passwordHash: hashedPassword,
            roleId: 2, // Assuming 2 is vendor role
            status: "active",
        });

        // Create vendor record
        const vendor = await Vendor.create({
            user_id: user.id,
            company_info: company_info || {},
            status: "active",
        });

        logger.auth("info", "Vendor registered successfully", {
            vendorId: vendor.id,
            userId: user.id,
            email: user.email,
        });

        return res.status(201).json({
            message: "Vendor registered successfully",
            vendor: {
                id: vendor.id,
                user_id: user.id,
                email: user.email,
                name: user.name,
                company_info: vendor.company_info,
                status: vendor.status,
            },
        });
    } catch (err) {
        logger.auth("error", "Vendor registration failed", {
            error: err.message,
            stack: err.stack,
            email: req.body.email,
        });
        res.status(500).json({ message: "Registration failed" });
    }
};

// Vendor login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res
                .status(400)
                .json({ message: "Email and password required" });
        }

        // Find user by email
        const user = await User.findOne({ where: { email } });
        if (!user) {
            logger.auth("warn", "Login attempt with invalid email", {
                email: email,
                ip: req.ip,
            });
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Check if user is a vendor using raw query to avoid model issues
        const { sequelize } = require("../../models");
        const [vendorResults] = await sequelize.query(
            "SELECT id, user_id, company_info, status FROM vendors WHERE user_id = ?",
            { replacements: [user.id] }
        );

        if (vendorResults.length === 0) {
            logger.auth("warn", "Login attempt by non-vendor user", {
                email: email,
                userId: user.id,
                ip: req.ip,
            });
            return res.status(401).json({ message: "User is not a vendor" });
        }

        const vendor = vendorResults[0];

        // Verify password
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            logger.auth("warn", "Login attempt with invalid password", {
                email: email,
                userId: user.id,
                ip: req.ip,
            });
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Check if vendor is active
        if (vendor.status !== "active") {
            logger.auth("warn", "Login attempt by inactive vendor", {
                email: email,
                vendorId: vendor.id,
                status: vendor.status,
                ip: req.ip,
            });
            return res
                .status(401)
                .json({ message: "Vendor account is not active" });
        }

        const token = jwt.sign(
            {
                id: vendor.id,
                user_id: user.id,
                email: user.email,
                role: "vendor",
            },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        logger.auth("info", "Vendor login successful", {
            vendorId: vendor.id,
            userId: user.id,
            email: user.email,
            ip: req.ip,
        });

        res.json({
            token,
            vendor: {
                id: vendor.id,
                user_id: user.id,
                email: user.email,
                name: user.name,
                company_info: vendor.company_info ? JSON.parse(vendor.company_info) : {},
                status: vendor.status,
            },
        });
    } catch (err) {
        logger.auth("error", "Vendor login failed", {
            error: err.message,
            stack: err.stack,
            email: req.body.email,
            ip: req.ip,
        });
        res.status(500).json({ message: "Login failed" });
    }
};
