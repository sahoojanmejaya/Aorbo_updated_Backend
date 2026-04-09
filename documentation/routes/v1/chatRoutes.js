const express = require("express");
const router = express.Router();
const chatController = require("../../controllers/v1/chatController");
const { authenticateCustomer } = require("../../middleware/customerAuthMiddleware");

// All routes require customer authentication
router.use(authenticateCustomer);

// Customer chat routes
router.post("/", chatController.createOrGetChat);
router.get("/:chatId/messages", chatController.getChatMessages);
router.patch("/:chatId/read", chatController.markMessagesAsRead);

module.exports = router;
