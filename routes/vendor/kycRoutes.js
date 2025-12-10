const express = require("express");
const router = express.Router();
const kycController = require("../../controllers/vendor/kycController");
const authMiddleware = require("../../middleware/authMiddleware");

// Public routes (no authentication required)
router.get("/test-db", kycController.testDatabase);
router.post("/test-file-upload", kycController.uploadDocuments, kycController.testFileUpload);
router.post("/test-documents", kycController.uploadDocuments, kycController.saveDocumentsStep);
router.post("/send-otp", kycController.sendOTP);
router.post("/verify-otp", kycController.verifyOTP);
router.post("/create-account", kycController.createVendorAccount);
router.get("/status", kycController.getKYCStatus);

// KYC step routes (use temp token authentication)
router.post("/personal-business", kycController.verifyTempToken, kycController.savePersonalBusinessStep);
router.post("/documents", kycController.verifyTempToken, kycController.uploadDocuments, kycController.saveDocumentsStep);
router.post("/remove-document", kycController.verifyTempToken, kycController.removeDocument);
router.post("/remove-bank-document", kycController.verifyTempToken, kycController.removeBankDocument);
router.post("/bank-details", kycController.verifyTempToken, kycController.saveBankDetailsStep);
router.post("/submit", kycController.verifyTempToken, kycController.submitKYC);

// Get KYC status moved to public routes above

module.exports = router;
