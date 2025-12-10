const { validationResult } = require("express-validator");
const logger = require("../utils/logger");

// Enhanced validation middleware with better error formatting
const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // Format validation errors to match frontend expectations
        const formattedErrors = errors.array().reduce((acc, error) => {
            const field = error.path || error.param;
            if (!acc[field]) {
                acc[field] = [];
            }
            acc[field].push(error.msg);
            return acc;
        }, {});

        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: formattedErrors,
            validationErrors: errors.array(),
        });
    }
    next();
};

// Middleware to handle Sequelize validation errors
const handleSequelizeErrors = (error, req, res, next) => {
    if (error.name === "SequelizeValidationError") {
        const validationErrors = {};
        error.errors.forEach((err) => {
            if (!validationErrors[err.path]) {
                validationErrors[err.path] = [];
            }
            validationErrors[err.path].push(err.message);
        });

        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: validationErrors,
        });
    }

    if (error.name === "SequelizeForeignKeyConstraintError") {
        return res.status(400).json({
            success: false,
            message: "Invalid reference data provided",
            errors: {
                [error.fields[0]]: ["Referenced data does not exist"],
            },
        });
    }

    if (error.name === "SequelizeUniqueConstraintError") {
        const field = error.fields[0];
        return res.status(400).json({
            success: false,
            message: "Duplicate entry",
            errors: {
                [field]: [`${field} already exists`],
            },
        });
    }

    // Handle database errors (including column errors) with email notifications
    if (error.name === "SequelizeDatabaseError" || error.name?.includes("Sequelize")) {
        // Log database error with email notification
        logger.logDatabaseError(error, {
            sql: error.sql,
            parameters: error.parameters,
            errorType: error.name,
            endpoint: req.originalUrl,
            method: req.method,
            statusCode: 500,
            sqlMessage: error.original?.sqlMessage || error.message,
            errno: error.original?.errno,
            sqlState: error.original?.sqlState
        });

        // Return user-friendly error response
        return res.status(500).json({
            success: false,
            message: "Database operation failed",
            error: process.env.NODE_ENV === 'development' ? error.message : "Internal server error"
        });
    }

    // Pass other errors to the default error handler
    next(error);
};

// Middleware to validate required fields
const validateRequiredFields = (requiredFields) => {
    return (req, res, next) => {
        const missingFields = [];

        requiredFields.forEach((field) => {
            if (
                !req.body[field] ||
                (typeof req.body[field] === "string" && !req.body[field].trim())
            ) {
                missingFields.push(field);
            }
        });

        if (missingFields.length > 0) {
            const errors = {};
            missingFields.forEach((field) => {
                errors[field] = [`${field} is required`];
            });

            return res.status(400).json({
                success: false,
                message: "Required fields missing",
                errors: errors,
            });
        }

        next();
    };
};

// Middleware to validate array fields
const validateArrayFields = (arrayFields) => {
    return (req, res, next) => {
        const errors = {};

        arrayFields.forEach((field) => {
            const value = req.body[field];
            if (value && !Array.isArray(value)) {
                errors[field] = [`${field} must be an array`];
            }
        });

        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid array fields",
                errors: errors,
            });
        }

        next();
    };
};

// Middleware to sanitize input data
const sanitizeInput = (req, res, next) => {
    // Trim string fields
    Object.keys(req.body).forEach((key) => {
        if (typeof req.body[key] === "string") {
            req.body[key] = req.body[key].trim();
        }
    });

    next();
};

// Badge validation middleware
const validateBadge = (req, res, next) => {
    const errors = {};

    // Validate name
    if (!req.body.name || !req.body.name.trim()) {
        errors.name = ["Badge name is required"];
    } else if (req.body.name.length > 100) {
        errors.name = ["Badge name must be less than 100 characters"];
    }

    // Validate description
    if (req.body.description && req.body.description.length > 500) {
        errors.description = ["Description must be less than 500 characters"];
    }

    // Validate color (hex color format)
    if (req.body.color && !/^#[0-9A-F]{6}$/i.test(req.body.color)) {
        errors.color = ["Color must be a valid hex color (e.g., #3B82F6)"];
    }

    // Validate category
    const validCategories = [
        "achievement",
        "difficulty",
        "special",
        "seasonal",
        "certification",
    ];
    if (req.body.category && !validCategories.includes(req.body.category)) {
        errors.category = ["Invalid category selected"];
    }

    // Validate sort_order
    if (req.body.sort_order !== undefined) {
        const sortOrder = parseInt(req.body.sort_order);
        if (isNaN(sortOrder) || sortOrder < 0) {
            errors.sort_order = ["Sort order must be a positive number"];
        }
    }

    if (Object.keys(errors).length > 0) {
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: errors,
        });
    }

    next();
};

// Issue report validation middleware
const validateIssueReport = (req, res, next) => {
    const errors = {};

    // Validate name
    if (!req.body.name || !req.body.name.trim()) {
        errors.name = ["Name is required"];
    } else if (req.body.name.length > 255) {
        errors.name = ["Name must be less than 255 characters"];
    }

    // Validate phone number
    if (!req.body.phone_number || !req.body.phone_number.trim()) {
        errors.phone_number = ["Phone number is required"];
    } else if (!/^[0-9+\-\s()]{10,20}$/.test(req.body.phone_number.trim())) {
        errors.phone_number = ["Please enter a valid phone number"];
    }

    // Validate email
    if (!req.body.email || !req.body.email.trim()) {
        errors.email = ["Email is required"];
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email.trim())) {
        errors.email = ["Please enter a valid email address"];
    } else if (req.body.email.length > 255) {
        errors.email = ["Email must be less than 255 characters"];
    }

    // Validate booking_id (TIN/Trip ID)
    if (!req.body.booking_id) {
        errors.booking_id = ["TIN/Trip ID is required"];
    } else if (!Number.isInteger(Number(req.body.booking_id)) || Number(req.body.booking_id) <= 0) {
        errors.booking_id = ["TIN/Trip ID must be a valid positive integer"];
    }

    // Validate issue_type
    const validIssueTypes = ["accommodation_issue", "trek_services_issue", "transportation_issue", "other"];
    if (!req.body.issue_type) {
        errors.issue_type = ["Issue type is required"];
    } else if (!validIssueTypes.includes(req.body.issue_type)) {
        errors.issue_type = [`Issue type must be one of: ${validIssueTypes.join(", ")}`];
    }

    // Validate issue_category (optional)
    if (req.body.issue_category) {
        const validCategories = ["drunken_driving", "rash_unsafe_driving", "sexual_harassment", "verbal_abuse_assault", "others"];
        if (!validCategories.includes(req.body.issue_category)) {
            errors.issue_category = [`Issue category must be one of: ${validCategories.join(", ")}`];
        }
    }

    // Validate description (optional)
    if (req.body.description && req.body.description.length > 2000) {
        errors.description = ["Description must be less than 2000 characters"];
    }

    if (Object.keys(errors).length > 0) {
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: errors,
        });
    }

    next();
};

module.exports = {
    validateRequest,
    handleSequelizeErrors,
    validateRequiredFields,
    validateArrayFields,
    sanitizeInput,
    validateBadge,
    validateIssueReport,
};
