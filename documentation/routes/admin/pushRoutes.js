'use strict';

const express = require('express');
const router = express.Router();
const {
    getAllCampaigns, getCampaignById, createCampaign, updateCampaign, deleteCampaign,
    getAllTemplates, getTemplateById, createTemplate, updateTemplate, deleteTemplate,
    getLogs,
    dispatchCampaign,
} = require('../../controllers/admin/pushController');

// ─── Campaign routes ────────────────────────────────────────────────────────
router.get('/campaigns', getAllCampaigns);
router.get('/campaigns/:id', getCampaignById);
router.post('/campaigns', createCampaign);
router.put('/campaigns/:id', updateCampaign);
router.delete('/campaigns/:id', deleteCampaign);
router.post('/campaigns/:id/dispatch', dispatchCampaign);

// ─── Template routes ────────────────────────────────────────────────────────
router.get('/templates', getAllTemplates);
router.get('/templates/:id', getTemplateById);
router.post('/templates', createTemplate);
router.put('/templates/:id', updateTemplate);
router.delete('/templates/:id', deleteTemplate);

// ─── Notification log routes ────────────────────────────────────────────────
router.get('/logs', getLogs);

module.exports = router;
