const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const trekController = require("../../controllers/vendor/trekController");
const trekControllerUnified = require("../../controllers/vendor/trekControllerUnified");
const {
    validateRequest,
    sanitizeInput,
    handleSequelizeErrors,
} = require("../../middleware/validationMiddleware");
const logger = require("../../utils/logger");

// Debug middleware for trek routes
const debugTrekRequest = (req, res, next) => {
    logger.trek("info", "Trek route accessed", {
        method: req.method,
        url: req.url,
        path: req.path,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        userId: req.user?.id,
        headers: {
            authorization: req.get("Authorization")
                ? "Bearer [PRESENT]"
                : "NOT PRESENT",
            contentType: req.get("Content-Type"),
        },
    });
    next();
};

// Apply debug middleware to all trek routes
router.use(debugTrekRequest);

// Error handling middleware for trek routes
const handleTrekError = (err, req, res, next) => {
    logger.trek("error", "Trek route error", {
        method: req.method,
        url: req.url,
        error: err.message,
        stack: err.stack,
        userId: req.user?.id,
    });

    res.status(500).json({
        success: false,
        message: "Internal server error in trek route",
        error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
};

// Apply error handling to all trek routes
router.use(handleTrekError);

// Enhanced validation middleware for trek creation/update
const validateTrek = [
    sanitizeInput,
    // Basic Info - Required fields
    body("title")
        .trim()
        .notEmpty()
        .withMessage("Trek title is required")
        .isLength({ min: 1, max: 200 })
        .withMessage("Trek title must be between 1 and 200 characters"),

    body("description")
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage("Description must be less than 2000 characters"),

    body("destination_id")
        .notEmpty()
        .withMessage("Destination is required")
        .isInt({ min: 1 })
        .withMessage("Destination ID must be a positive integer"),

    // State ID removed as per requirements

    body("city_ids")
        .optional()
        .isArray()
        .withMessage("City IDs must be an array")
        .custom((value) => {
            if (!Array.isArray(value)) return true;
            return value.every((id) => Number.isInteger(id) && id > 0);
        })
        .withMessage("All city IDs must be positive integers"),

    // Duration and Pricing
    body("duration")
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage("Duration must be less than 100 characters"),

    body("duration_days")
        .notEmpty()
        .withMessage("Duration days is required")
        .isInt({ min: 1 })
        .withMessage("Duration days must be a positive integer"),

    body("duration_nights")
        .notEmpty()
        .withMessage("Duration nights is required")
        .isInt({ min: 0 })
        .withMessage("Duration nights must be a non-negative integer"),

    body("base_price")
        .notEmpty()
        .withMessage("Base price is required")
        .isFloat({ min: 0 })
        .withMessage("Base price must be a positive number"),

    body("max_participants")
        .notEmpty()
        .withMessage("Maximum participants is required")
        .isInt({ min: 1 })
        .withMessage("Maximum participants must be a positive integer"),

    // Trek Details - Removed difficulty and trek_type as per requirements

    // Category removed as per requirements

    // Meeting Information
    // body("meeting_point")
    //     .notEmpty()
    //     .withMessage("Meeting point is required")
    //     .trim()
    //     .isLength({ max: 200 })
    //     .withMessage("Meeting point must be less than 200 characters"),

    // New text fields - short_description removed as we're using description

    body("trekking_rules")
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage("Trekking rules must be less than 2000 characters"),

    body("emergency_protocols")
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage("Emergency protocols must be less than 2000 characters"),

    body("organizer_notes")
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage("Organizer notes must be less than 2000 characters"),

    // Arrays and JSON fields
    body("inclusions")
        .notEmpty()
        .withMessage("Inclusions are required")
        .isArray({ min: 1 })
        .withMessage("At least one inclusion is required"),

    body("inclusions.*")
        .trim()
        .notEmpty()
        .withMessage("Inclusion items cannot be empty")
        .isLength({ max: 200 })
        .withMessage("Inclusion items must be less than 200 characters"),

    body("exclusions")
        .optional()
        .isArray()
        .withMessage("Exclusions must be an array"),

    body("exclusions.*")
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage("Exclusion items must be less than 200 characters"),

    // Cancellation Policy - Required
    body("cancellation_policy_id")
        .notEmpty()
        .withMessage("Cancellation policy is required")
        .isInt({ min: 1 })
        .withMessage("Cancellation policy ID must be a positive integer"),

    // Other Policies removed as per requirements

    // Activities - Optional
    body("activities")
        .optional()
        .isArray()
        .withMessage("Activities must be an array"),

    body("activities.*")
        .optional()
        .isInt({ min: 1 })
        .withMessage(
            "Each activity must be a valid activity ID (positive integer)"
        ),

    // Status and Discount
    body("status")
        .optional()
        .isIn(["active", "deactive"])
        .withMessage("Status must be active or deactive"),

    body("has_discount")
        .optional()
        .isBoolean()
        .withMessage("Has discount must be a boolean value"),

    body("discount_value")
        .optional()
        .custom((value, { req }) => {
            // Only validate if has_discount is true
            if (req.body.has_discount === true) {
                if (value === null || value === undefined || value === "") {
                    throw new Error(
                        "Discount value is required when has_discount is true"
                    );
                }
                if (isNaN(value) || parseFloat(value) < 0) {
                    throw new Error("Discount value must be a positive number");
                }
            }
            return true;
        }),

    body("discount_type")
        .optional()
        .custom((value, { req }) => {
            // Only validate if has_discount is true
            if (req.body.has_discount === true) {
                if (value === null || value === undefined || value === "") {
                    throw new Error(
                        "Discount type is required when has_discount is true"
                    );
                }
                if (!["percentage", "fixed"].includes(value)) {
                    throw new Error(
                        "Discount type must be percentage or fixed"
                    );
                }
            }
            return true;
        }),

    validateRequest,
];

// Limited validation middleware for trek updates (only captain_id)
const validateLimitedTrekUpdate = [
    sanitizeInput,
    body("captain_id")
        .optional()
        .custom((value) => {
            if (value === null || value === undefined) return true;
            if (value === "none") return true;
            return Number.isInteger(parseInt(value)) && parseInt(value) > 0;
        })
        .withMessage("Captain ID must be a positive integer, 'none', or null"),
    body("accommodations")
        .optional()
        .isArray()
        .withMessage("Accommodations must be an array"),
    body("accommodations.*.night")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Accommodation night must be a positive integer"),
    body("accommodations.*.location")
        .optional()
        .isString()
        .withMessage("Accommodation location must be a string"),
    body("accommodations.*.type")
        .optional()
        .isString()
        .withMessage("Accommodation type must be a string"),
    validateRequest,
];

// Vendor trek routes
router.get("/", trekController.getVendorTreks);
router.get("/tbr-statistics", trekController.getTbrStatistics);
router.get("/pending-balance", trekController.getPendingBalanceCollection);
router.get("/:id", trekController.getTrekById);
router.post("/", validateTrek, trekController.createTrek);

// New unified trek creation endpoint (transactional)
// Note: This route is COMPLETELY handled in app.js with multer middleware
// router.post("/create-complete", trekControllerUnified.createCompleteTrek); // DISABLED - handled in app.js
router.put("/update-complete/:id", validateLimitedTrekUpdate, trekControllerUnified.updateCompleteTrek);

router.put("/:id", validateLimitedTrekUpdate, trekController.updateTrek);
router.delete("/:id", trekController.deleteTrek);
router.patch("/:id/status", trekController.toggleTrekStatus);
router.get("/:id/batches", trekController.getBatches);
router.post(
    "/:id/batches",
    [
        body("batches")
            .isArray({ min: 1 })
            .withMessage("Batches must be a non-empty array"),
        body("batches.*.start_date")
            .isISO8601()
            .withMessage("Each start date must be a valid date"),
        body("batches.*.end_date")
            .isISO8601()
            .withMessage("Each end date must be a valid date"),
        body("batches.*.capacity")
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage(
                "Capacity must be a positive integer between 1 and 100"
            ),
        body("batches.*.is_boarding_point")
            .optional()
            .isBoolean()
            .withMessage("is_boarding_point must be a boolean value"),
        body("batches.*.city_id")
            .optional()
            .isInt({ min: 1 })
            .withMessage("city_id must be a positive integer"),
        validateRequest,
    ],
    trekController.createBatches
);
router.put(
    "/:id/batches",
    [
        body("batches")
            .isArray({ min: 1 })
            .withMessage("Batches must be a non-empty array"),
        body("batches.*.start_date")
            .isISO8601()
            .withMessage("Each start date must be a valid date"),
        body("batches.*.end_date")
            .isISO8601()
            .withMessage("Each end date must be a valid date"),
        body("batches.*.capacity")
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage(
                "Capacity must be a positive integer between 1 and 100"
            ),
        body("batches.*.is_boarding_point")
            .optional()
            .isBoolean()
            .withMessage("is_boarding_point must be a boolean value"),
        body("batches.*.city_id")
            .optional()
            .isInt({ min: 1 })
            .withMessage("city_id must be a positive integer"),
        validateRequest,
    ],
    trekController.updateBatches
);

// Batch update route for captain and accommodations
router.put(
    "/batches/:batchId",
    [
        body("captain_id")
            .optional()
            .custom((value) => {
                if (value === null || value === undefined) return true;
                if (value === "none") return true;
                return Number.isInteger(parseInt(value)) && parseInt(value) > 0;
            })
            .withMessage("Captain ID must be a positive integer, 'none', or null"),
        body("accommodations")
            .optional()
            .isArray()
            .withMessage("Accommodations must be an array"),
        body("accommodations.*.night")
            .optional()
            .isInt({ min: 1 })
            .withMessage("Accommodation night must be a positive integer"),
        body("accommodations.*.location")
            .optional()
            .isString()
            .withMessage("Accommodation location must be a string"),
        body("accommodations.*.type")
            .optional()
            .isString()
            .withMessage("Accommodation type must be a string"),
        validateRequest,
    ],
    trekController.updateBatch
);

// TBR booking details route
router.get("/tbr/:tbrId/bookings", trekController.getBookingDetailsByTBR);

// Pending balance collection routes
router.patch("/bookings/:bookingId/mark-completed", trekController.markPaymentCompleted);
router.post(
    "/bookings/:bookingId/remark",
    [
        body("remark")
            .notEmpty()
            .withMessage("Remark is required")
            .isLength({ min: 1, max: 1000 })
            .withMessage("Remark must be between 1 and 1000 characters"),
        validateRequest,
    ],
    trekController.addCustomerRemark
);

// Itinerary items routes
router.post("/:id/itinerary-items", trekController.createItineraryItems);
router.put("/:id/itinerary-items", trekController.updateItineraryItems);

// Trek stages routes
router.post(
    "/:id/stages",
    [
        body("trekStages")
            .isArray({ min: 1 })
            .withMessage("Trek stages must be a non-empty array"),
        body("trekStages.*.stage_name")
            .isIn(["boarding", "meeting", "return"])
            .withMessage("Stage type must be boarding, meeting, or return"),
        body("trekStages.*.destination")
            .optional()
            .isString()
            .withMessage("Destination must be a string"),
        body("trekStages.*.means_of_transport")
            .optional()
            .isString()
            .withMessage("Transport must be a string"),
        body("trekStages.*.date_time")
            .optional()
            .isString()
            .withMessage("Date time must be a string"),
        body("trekStages.*.is_boarding_point")
            .optional()
            .isBoolean()
            .withMessage("is_boarding_point must be a boolean value"),
        body("trekStages.*.city_id")
            .optional()
            .custom((value) => {
                if (value === null || value === undefined) return true;
                return Number.isInteger(value) && value > 0;
            })
            .withMessage("city_id must be null or a positive integer"),
        validateRequest,
    ],
    trekController.createTrekStages
);
router.put(
    "/:id/stages",
    [
        body("trekStages")
            .isArray({ min: 1 })
            .withMessage("Trek stages must be a non-empty array"),
        body("trekStages.*.stage_name")
            .isIn(["boarding", "meeting", "return"])
            .withMessage("Stage type must be boarding, meeting, or return"),
        body("trekStages.*.destination")
            .optional()
            .isString()
            .withMessage("Destination must be a string"),
        body("trekStages.*.means_of_transport")
            .optional()
            .isString()
            .withMessage("Transport must be a string"),
        body("trekStages.*.date_time")
            .optional()
            .isString()
            .withMessage("Date time must be a string"),
        body("trekStages.*.is_boarding_point")
            .optional()
            .isBoolean()
            .withMessage("is_boarding_point must be a boolean value"),
        body("trekStages.*.city_id")
            .optional()
            .custom((value) => {
                if (value === null || value === undefined) return true;
                return Number.isInteger(value) && value > 0;
            })
            .withMessage("city_id must be null or a positive integer"),
        validateRequest,
    ],
    trekController.updateTrekStages
);

// Accommodations routes
router.post("/:id/accommodations", trekController.createAccommodations);
router.put("/:id/accommodations", trekController.updateAccommodations);

// Image upload route
router.post("/:id/images", trekController.uploadTrekImages);

// Duplicate trek check route
router.post(
    "/check-duplicate",
    [
        body("destination_id")
            .notEmpty()
            .withMessage("Destination ID is required")
            .isInt({ min: 1 })
            .withMessage("Destination ID must be a positive integer"),
        body("batches")
            .isArray({ min: 1 })
            .withMessage("Batches must be a non-empty array"),
        body("batches.*.start_date")
            .notEmpty()
            .withMessage("Start date is required")
            .isISO8601()
            .withMessage("Start date must be a valid ISO date"),
        body("batches.*.end_date")
            .notEmpty()
            .withMessage("End date is required")
            .isISO8601()
            .withMessage("End date must be a valid ISO date"),
        validateRequest,
    ],
    trekController.checkDuplicateTrek
);

// Batch cancellation request route
router.post(
    "/batch/:batchId/request-cancellation",
    [
        body("reason")
            .notEmpty()
            .withMessage("Reason is required")
            .isLength({ min: 10, max: 2000 })
            .withMessage("Reason must be between 10 and 2000 characters"),
        body("recordDetails")
            .optional()
            .isObject()
            .withMessage("Record details must be an object"),
        validateRequest,
    ],
    trekController.requestBatchCancellation
);

// Placeholder routes for future implementation
router.get("/:id/bookings", (req, res) => {
    res.json({ message: "Get trek bookings endpoint - to be implemented" });
});

router.get("/:id/analytics", (req, res) => {
    res.json({ message: "Get trek analytics endpoint - to be implemented" });
});

module.exports = router;
