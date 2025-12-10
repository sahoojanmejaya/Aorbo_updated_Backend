const express = require("express");
const router = express.Router();
const { CancellationPolicy } = require("../../models");

// Get active cancellation policies for vendor use
router.get("/", async (req, res) => {
    try {
        const policies = await CancellationPolicy.findAll({
            where: { is_active: true },
            attributes: ["id", "title", "description"],
            order: [
                ["sort_order", "ASC"],
                ["title", "ASC"],
            ],
        });

        res.json({
            success: true,
            data: policies,
        });
    } catch (error) {
        console.error("Error fetching cancellation policies:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch cancellation policies",
        });
    }
});

module.exports = router;
