const express = require("express");
const router = express.Router();
const {
    getAllThemes,
    getThemeById,
    createTheme,
    updateTheme,
    deleteTheme
} = require("../../controllers/admin/homeThemeController");

// GET /api/admin/home-themes - Get all themes
router.get("/", getAllThemes);

// GET /api/admin/home-themes/:id - Get single theme
router.get("/:id", getThemeById);

// POST /api/admin/home-themes - Create new theme
router.post("/", createTheme);

// PUT /api/admin/home-themes/:id - Update theme
router.put("/:id", updateTheme);

// DELETE /api/admin/home-themes/:id - Delete theme
router.delete("/:id", deleteTheme);

module.exports = router;
