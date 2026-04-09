const express = require("express");
const router = express.Router();
const {
    getAllContent,
    getContentById,
    createContent,
    updateContent,
    deleteContent
} = require("../../controllers/admin/discoveryContentController");

// GET /api/admin/discovery-content - Get all discovery content
router.get("/", getAllContent);

// GET /api/admin/discovery-content/:id - Get single content
router.get("/:id", getContentById);

// POST /api/admin/discovery-content - Create new content
router.post("/", createContent);

// PUT /api/admin/discovery-content/:id - Update content
router.put("/:id", updateContent);

// DELETE /api/admin/discovery-content/:id - Delete content
router.delete("/:id", deleteContent);

module.exports = router;
