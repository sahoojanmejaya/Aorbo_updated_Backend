const express = require("express");
const router = express.Router();
const authController = require("../../controllers/vendor/authController");
const authMiddleware = require("../../middleware/authMiddleware");

// Vendor authentication routes
router.post("/login", authController.login);

router.post("/sendOtp", authController.sendOtp);
router.post("/resendotp", authController.resendOtp);
router.post("/verifyOtp", authController.verifyOtp);
router.post("/get-profile", authMiddleware, authController.getProfile);
router.post("/check-email", authController.checkEmailAndProceed);

// BUG #5 FIX: vendor_status_change and update-notes now require authentication — were publicly accessible before
router.post("/update-notes", authMiddleware, authController.updateNote);
router.get("/vendor-activity-log/:vendor_id", authMiddleware, authController.getVendorActivityLogs);

// BUG #5 FIX: vendor_status_change and update-notes now require authentication — were publicly accessible before
router.post("/vendor_status_change", authMiddleware, authController.changeUserStatus);

//router.post("/update-profile", authController.updateProfile);
router.post("/register", authController.register);
router.post(
    "/update-profile",
    authMiddleware,
    authController.uploadDocuments,
    authController.updateProfile
);

module.exports = router;
