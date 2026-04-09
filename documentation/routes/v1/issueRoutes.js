const express = require("express");
const router = express.Router();
const issueController = require("../../controllers/v1/issueController");
const { validateIssueReport } = require("../../middleware/validationMiddleware");
const { authenticateCustomer } = require("../../middleware/customerAuthMiddleware");

/**
 * @route   POST /api/v1/issues/submit
 * @desc    Submit an issue report (authenticated customers only; identity from JWT)
 * @access  Authenticated customer
 */
router.post("/submit", authenticateCustomer, validateIssueReport, issueController.submitIssueReport);

/**
 * @route   GET /api/v1/issues/:id
 * @desc    Get issue report by ID (authenticated; ownership enforced in controller)
 * @access  Authenticated customer
 */
router.get("/:id", authenticateCustomer, issueController.getIssueReport);

/**
 * @route   GET /api/v1/issues/booking/:booking_id
 * @desc    Get all issue reports for a booking (authenticated; ownership enforced in controller)
 * @access  Authenticated customer
 */
router.get("/booking/:booking_id", authenticateCustomer, issueController.getIssueReportsByBooking);

module.exports = router;
