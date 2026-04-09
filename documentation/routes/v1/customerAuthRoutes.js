const express = require("express");
const router = express.Router();
const customerAuthController = require("../../controllers/v1/customerAuthController");
const {
    authenticateCustomer,
} = require("../../middleware/customerAuthMiddleware");

// Public routes
router.post("/firebase-verify", customerAuthController.firebaseVerify);

// Protected routes
router.put(
    "/profile",
    authenticateCustomer,
    customerAuthController.updateProfile
);
router.get("/profile", authenticateCustomer, customerAuthController.getProfile);

module.exports = router;
