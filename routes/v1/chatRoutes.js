const express = require("express");
const router = express.Router();
const chatController = require("../../controllers/v1/chatController");
const { authenticateCustomer } = require("../../middleware/customerAuthMiddleware");
const { preventDirectContact } = require("../../middleware/securityMiddleware");

// All routes require customer authentication
router.use(authenticateCustomer);

// ✅ ADMIN CONTROL: Prevent direct vendor-customer communication
// Customer chat routes - all messages routed through admin
router.post("/", preventDirectContact, chatController.createOrGetChat);
router.get("/:chatId/messages", chatController.getChatMessages);
router.patch("/:chatId/read", chatController.markMessagesAsRead);

module.exports = router;
