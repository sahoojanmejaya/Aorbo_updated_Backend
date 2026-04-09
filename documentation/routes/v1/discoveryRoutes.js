const express = require("express");
const router = express.Router();
const { getDiscovery } = require("../../controllers/v1/discoveryController");

// Public endpoint — no auth required (home feed content, like trek listings)
router.get("/", getDiscovery);

module.exports = router;
