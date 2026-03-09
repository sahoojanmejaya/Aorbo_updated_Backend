const express = require("express");
const router = express.Router();
const authController = require("../../controllers/vendor/authController");

// Vendor authentication routes
router.post("/login", authController.login);

router.post("/sendOtp", authController.sendOtp);
router.post("/resendotp", authController.resendOtp);
router.post("/verifyOtp", authController.verifyOtp);
router.post("/get-profile", authController.getProfile);
router.post("/check-email", authController.checkEmailAndProceed);
router.post("/update-notes", authController.updateNote);
router.get("/vendor-activity-log/:vendor_id", authController.getVendorActivityLogs);

router.post("/vendor_status_change", authController.changeUserStatus);
//router.post("/update-profile", authController.updateProfile);
router.post("/register", authController.register);
router.post(
    "/update-profile",
   authController.uploadDocuments,
authController.updateProfile
);
module.exports = router;
