const express = require("express");
const router = express.Router();
const chatController = require("../../controllers/admin/chatController");
const authMiddleware = require("../../middleware/authMiddleware");
const {createMulterConfig} = require("../../utils/file_upload");
const upload = createMulterConfig({
     allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp', '.svg',

  // Documents
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.rtf', '.odt',

  // Audio (ALL major formats)
  '.mp3', '.wav', '.aac', '.m4a', '.flac', '.alac',
  '.ogg', '.oga', '.opus', '.wma', '.aiff', '.amr',

  // Video (ALL major formats)
  '.mp4', '.mov', '.avi', '.mkv', '.flv', '.wmv',
  '.webm', '.mpeg', '.mpg', '.3gp', '.m4v', '.ts',

  // Screen recordings / raw recordings
  '.rec', '.m3u8', '.mts', '.rm', '.rmvb',

  // Map / GIS files
  '.kml', '.kmz', '.gpx', '.geojson','.json',

  // Compressed uploads (optional but common)
  '.zip', '.rar', '.7z', '.tar', '.gz'], 
    maxFileSize: 10 * 1024 * 1024, // 10 MB
    maxFileCount: 1,
    uploadPath: '/upload_document'
});
// All routes require authentication
//router.use(authMiddleware);

// Admin chat routes
//router.get("/", chatController.getAllChats);
//router.get("/stats", chatController.getChatStats);
//router.get("/:chatId/messages", chatController.getChatMessages);
//router.post("/", chatController.createOrGetChat);
//router.patch("/:chatId/status", chatController.updateChatStatus);
router.get("/:userId", chatController.getChatByUserId);
router.get("/get_messages/:userId1/:userId2", chatController.get_messages);
router.delete("/delete_chat_user", chatController.deleteChatBetweenUsers);
router.delete("/delete_chat_byId/:id", chatController.deleteChatById);
router.get("get_messages_byId/:id", chatController.getChatById);
router.post("/upload_attachment", upload.single('upload_file'),chatController.uploadAttachment);
module.exports = router;
