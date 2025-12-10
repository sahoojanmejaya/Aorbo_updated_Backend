const express = require("express");
const router = express.Router();
const chatController = require("../../controllers/admin/chatController");
const authMiddleware = require("../../middleware/authMiddleware");

// All routes require authentication
router.use(authMiddleware);

// Admin chat routes
router.get("/", chatController.getAllChats);
router.get("/stats", chatController.getChatStats);
router.get("/:chatId/messages", chatController.getChatMessages);
router.post("/", chatController.createOrGetChat);
router.patch("/:chatId/status", chatController.updateChatStatus);

module.exports = router;
