const jwt = require("jsonwebtoken");
const { Customer } = require("../models");
const logger = require("../utils/logger");

const authenticateCustomer = async (req, res, next) => {
    let authHeader;
    try {
        // Get token from header
        authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "No token provided",
            });
        }

        const token = authHeader.split(" ")[1];

        // Verify token
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            logger.error("auth", "JWT_SECRET not configured");
            return res.status(500).json({ success: false, message: "Server configuration error" });
        }
        const decoded = jwt.verify(token, jwtSecret);

        if (decoded.type !== "customer") {
            return res.status(403).json({
                success: false,
                message: "Invalid token type",
            });
        }

        // Get customer from database
        const customer = await Customer.findByPk(decoded.id);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found",
            });
        }

        if (customer.status !== "active") {
            return res.status(403).json({
                success: false,
                message: "Account is inactive",
            });
        }

        // Add customer to request object
        req.customer = customer;
        next();
    } catch (error) {
        if (error.name === "JsonWebTokenError") {
            // Log JWT validation errors with email notification
            logger.logAuthError(error, {
                category: 'jwt_validation',
                middleware: 'customerAuthMiddleware',
                errorType: 'invalid_token',
                tokenProvided: !!authHeader,
                endpoint: req.originalUrl,
                method: req.method
            });

            return res.status(401).json({
                success: false,
                message: "Invalid token",
            });
        }

        if (error.name === "TokenExpiredError") {
            // Log token expiration without email notification (normal client behavior)
            logger.warn("auth", "Customer JWT token expired:", {
                error: error.message,
                name: error.name,
                middleware: 'customerAuthMiddleware',
                tokenProvided: !!authHeader,
                endpoint: req.originalUrl,
                method: req.method,
                expiredAt: error.expiredAt
            });

            return res.status(401).json({
                success: false,
                message: "Token expired",
                code: "TOKEN_EXPIRED"
            });
        }

        // Log other authentication errors
        logger.logAuthError(error, {
            category: 'customer_auth_middleware',
            middleware: 'customerAuthMiddleware',
            errorType: 'general_auth_error',
            tokenProvided: !!authHeader,
            endpoint: req.originalUrl,
            method: req.method,
            statusCode: 500
        });

        console.error("Auth middleware error:", error);
        res.status(500).json({
            success: false,
            message: "Authentication failed",
        });
    }
};

module.exports = {
    authenticateCustomer,
}; 