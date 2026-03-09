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
//kycController.verifyTempToken
router.post("/personal-business",  kycController.savePersonalBusinessStep);
router.post("/documents",  kycController.uploadDocuments, kycController.saveDocumentsStep);
router.post("/remove-document", kycController.removeDocument);
router.post("/remove-bank-document",  kycController.removeBankDocument);
router.post("/bank-details",  kycController.saveBankDetailsStep);
router.post("/submit", kycController.submitKYC);

// Get KYC status moved to public routes above

module.exports = router;
