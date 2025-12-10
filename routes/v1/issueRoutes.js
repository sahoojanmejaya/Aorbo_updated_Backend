const express = require("express");
const router = express.Router();
const issueController = require("../../controllers/v1/issueController");
const { validateIssueReport } = require("../../middleware/validationMiddleware");

/**
 * @route   POST /api/v1/issues/submit
 * @desc    Submit an issue report from mobile app
 * @access  Public (mobile app users)
 * @body    {
 *   "name": "string",
 *   "phone_number": "string", 
 *   "email": "string",
 *   "booking_id": "integer",
 *   "issue_type": "accommodation_issue|trek_services_issue|transportation_issue|other",
 *   "issue_category": "drunken_driving|rash_unsafe_driving|sexual_harassment|verbal_abuse_assault|others",
 *   "description": "string",
 *   "priority": "low|medium|high|urgent" (optional)
 * }
 */
router.post("/submit", validateIssueReport, issueController.submitIssueReport);

/**
 * @route   GET /api/v1/issues/:id
 * @desc    Get issue report by ID
 * @access  Public (for checking status)
 * @params  id - Issue report ID
 */
router.get("/:id", issueController.getIssueReport);

/**
 * @route   GET /api/v1/issues/booking/:booking_id
 * @desc    Get all issue reports for a specific booking
 * @access  Public (for checking booking-related issues)
 * @params  booking_id - Booking/TIN ID
 */
router.get("/booking/:booking_id", issueController.getIssueReportsByBooking);

module.exports = router;
