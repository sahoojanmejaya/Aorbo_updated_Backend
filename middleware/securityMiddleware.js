const rateLimit = require("express-rate-limit");
const { validationResult } = require("express-validator");
const logger = require("../utils/logger");
const { AuditLog } = require("../models");

// Rate limiting configurations
const createRateLimiter = (windowMs, max, message) => {
    return rateLimit({
        windowMs,
        max,
        message: { success: false, message },
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            logger.warn("security", "Rate limit exceeded", {
                ip: req.ip,
                path: req.path,
                user: req.user?.id || req.customer?.id
            });
            res.status(429).json({
                success: false,
                message: "Too many requests, please try again later"
            });
        }
    });
};

// Different rate limiters for different endpoints
const rateLimiters = {
    // Authentication endpoints - strict
    auth: createRateLimiter(15 * 60 * 1000, 5, "Too many authentication attempts"),
    
    // Payment endpoints - moderate
    payment: createRateLimiter(15 * 60 * 1000, 10, "Too many payment requests"),
    
    // General API - lenient
    api: createRateLimiter(15 * 60 * 1000, 100, "Too many requests"),
    
    // Booking creation - moderate
    booking: createRateLimiter(15 * 60 * 1000, 20, "Too many booking attempts")
};

// Validation error handler
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        logger.warn("validation", "Validation failed", {
            errors: errors.array(),
            path: req.path,
            user: req.user?.id || req.customer?.id
        });
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: errors.array()
        });
    }
    next();
};

// Resource ownership validation
const validateOwnership = (model, idParam = "id", ownerField = "customer_id") => {
    return async (req, res, next) => {
        try {
            const resourceId = req.params[idParam];
            const userId = req.customer?.id || req.user?.id;
            const userType = req.customer ? "customer" : "user";
            
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: "Authentication required"
                });
            }
            
            const resource = await model.findByPk(resourceId);
            
            if (!resource) {
                return res.status(404).json({
                    success: false,
                    message: "Resource not found"
                });
            }
            
            // Check ownership
            if (resource[ownerField] !== userId) {
                logger.warn("security", "Unauthorized resource access attempt", {
                    userId,
                    userType,
                    resourceId,
                    model: model.name,
                    ownerField
                });
                
                return res.status(403).json({
                    success: false,
                    message: "Access denied"
                });
            }
            
            // Attach resource to request for use in controller
            req.resource = resource;
            next();
        } catch (error) {
            logger.error("security", "Ownership validation error", { error: error.message });
            res.status(500).json({
                success: false,
                message: "Internal server error"
            });
        }
    };
};

// Vendor data isolation middleware
const enforceVendorIsolation = async (req, res, next) => {
    try {
        if (req.user?.role !== "vendor") {
            return next(); // Not a vendor, skip
        }
        
        const vendorId = req.user.vendor_id;
        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Vendor profile not found"
            });
        }
        
        // Inject vendor_id filter into query
        req.vendorFilter = { vendor_id: vendorId };
        next();
    } catch (error) {
        logger.error("security", "Vendor isolation error", { error: error.message });
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// Prevent direct vendor-customer communication
const preventDirectContact = (req, res, next) => {
    const senderRole = req.user?.role || req.customer ? "customer" : null;
    const recipientRole = req.body.recipient_role;
    
    if (
        (senderRole === "customer" && recipientRole === "vendor") ||
        (senderRole === "vendor" && recipientRole === "customer")
    ) {
        logger.warn("security", "Direct contact attempt blocked", {
            sender: senderRole,
            recipient: recipientRole
        });
        
        return res.status(403).json({
            success: false,
            message: "Direct communication not allowed. Messages are routed through support."
        });
    }
    
    next();
};

// Audit logger middleware
const auditLogger = (action, entityType) => {
    return async (req, res, next) => {
        // Store original json method
        const originalJson = res.json.bind(res);
        
        // Override json method to capture response
        res.json = function(data) {
            // Only log successful operations
            if (data.success !== false && res.statusCode < 400) {
                // Async log creation (don't block response)
                setImmediate(async () => {
                    try {
                        const userId = req.user?.id || req.customer?.id;
                        const userType = req.customer ? "customer" : req.user?.role || "unknown";
                        
                        if (!AuditLog) return;
                        await AuditLog.create({
                            action,
                            entity_type: entityType,
                            entity_id: data.data?.id || req.params.id || null,
                            performed_by_type: userType,
                            performed_by_id: userId,
                            ip_address: req.ip,
                            user_agent: req.get("user-agent"),
                            changes: {
                                before: req.resource || null,
                                after: data.data || null
                            },
                            metadata: {
                                method: req.method,
                                path: req.path,
                                query: req.query,
                                body: sanitizeBody(req.body)
                            }
                        });
                    } catch (error) {
                        logger.error("audit", "Failed to create audit log", {
                            error: error.message,
                            action,
                            entityType
                        });
                    }
                });
            }
            
            // Call original json method
            return originalJson(data);
        };
        
        next();
    };
};

// Sanitize request body for logging (remove sensitive data)
const sanitizeBody = (body) => {
    const sanitized = { ...body };
    const sensitiveFields = [
        "password", "token", "signature", "razorpay_signature",
        "card_number", "cvv", "otp", "secret"
    ];
    
    sensitiveFields.forEach(field => {
        if (sanitized[field]) {
            sanitized[field] = "[REDACTED]";
        }
    });
    
    return sanitized;
};

// Role-based access control
const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        const userRole = req.user?.role;
        
        if (!userRole) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }
        
        if (!allowedRoles.includes(userRole)) {
            logger.warn("security", "Unauthorized role access attempt", {
                userId: req.user.id,
                userRole,
                allowedRoles,
                path: req.path
            });
            
            return res.status(403).json({
                success: false,
                message: "Insufficient permissions"
            });
        }
        
        next();
    };
};

// Admin-only middleware
const requireAdmin = requireRole("admin", "super_admin");

// Prevent modification of critical fields
const protectCriticalFields = (criticalFields) => {
    return (req, res, next) => {
        const attemptedChanges = Object.keys(req.body);
        const blockedFields = attemptedChanges.filter(field => 
            criticalFields.includes(field)
        );
        
        if (blockedFields.length > 0) {
            logger.warn("security", "Critical field modification attempt", {
                userId: req.user?.id,
                blockedFields,
                path: req.path
            });
            
            return res.status(403).json({
                success: false,
                message: `Cannot modify protected fields: ${blockedFields.join(", ")}`,
                protected_fields: criticalFields
            });
        }
        
        next();
    };
};

module.exports = {
    rateLimiters,
    handleValidationErrors,
    validateOwnership,
    enforceVendorIsolation,
    preventDirectContact,
    auditLogger,
    requireRole,
    requireAdmin,
    protectCriticalFields
};
