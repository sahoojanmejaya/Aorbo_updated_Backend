const express = require("express");
const router = express.Router();
const kycController = require("../../controllers/vendor/kycController");

// Public routes (no authentication required)
// BUG #12 FIX: Deleted 3 unauthenticated test endpoints — test-db, test-file-upload, test-documents were live in production with no auth
router.post("/send-otp", kycController.sendOTP);
router.post("/verify-otp", kycController.verifyOTP);
router.post("/create-account", kycController.createVendorAccount);
router.get("/status", kycController.getKYCStatus);

// KYC step routes (use temp token authentication)
// KYC step routes (no longer using temp token as per teammate's version)
router.post("/personal-business",  kycController.savePersonalBusinessStep);
router.post("/documents",  kycController.uploadDocuments, kycController.saveDocumentsStep);
router.post("/remove-document", kycController.removeDocument);
router.post("/remove-bank-document",  kycController.removeBankDocument);
router.post("/bank-details",  kycController.saveBankDetailsStep);
router.post("/submit", kycController.submitKYC);

// Get KYC status moved to public routes above
module.exports = router;
