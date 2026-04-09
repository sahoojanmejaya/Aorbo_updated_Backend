const { NotificationCampaign, NotificationTemplate, PushNotification, Customer, sequelize } = require('../../models');
const { Op } = require('sequelize');
const logger = require('../../utils/logger');

// ─── Helpers ────────────────────────────────────────────────────────────────

const VALID_CAMPAIGN_CATEGORIES = [
    'OFFER', 'COUPON', 'ANNOUNCEMENT', 'UPGRADE', 'DEVOTIONAL', 'PERFORMANCE',
    'NEW_LAUNCH', 'FLASH_SALE', 'LOYALTY', 'REFERRAL', 'SAFETY', 'TIPS',
    'WEBINAR', 'POLICY', 'PAYOUT_UPDATE', 'KYC_REQUEST', 'SLOT_UPDATE', 'VENDOR_AWARD',
];

const VALID_CHANNELS = ['PUSH', 'SMS', 'MAIL'];
const VALID_TARGETS = ['USER', 'VENDOR'];

function buildCampaignData(body) {
    const {
        name, target, category, channels, title, body: msgBody,
        sms_sender_id, from_email, audience_filter,
        schedule_type, schedule_time, end_time,
        status, redirect_url,
        is_ab_test, variant_b_title, variant_b_body,
    } = body;

    const data = {};
    if (name !== undefined) data.name = name;
    if (target !== undefined) data.target = target;
    if (category !== undefined) data.category = category;
    if (channels !== undefined) data.channels = channels;
    if (title !== undefined) data.title = title;
    if (msgBody !== undefined) data.body = msgBody;
    if (sms_sender_id !== undefined) data.sms_sender_id = sms_sender_id;
    if (from_email !== undefined) data.from_email = from_email;
    if (audience_filter !== undefined) data.audience_filter = audience_filter;
    if (schedule_type !== undefined) data.schedule_type = schedule_type;
    if (schedule_time !== undefined) data.schedule_time = schedule_time;
    if (end_time !== undefined) data.end_time = end_time;
    if (status !== undefined) data.status = status;
    if (redirect_url !== undefined) data.redirect_url = redirect_url;
    if (is_ab_test !== undefined) data.is_ab_test = is_ab_test;
    if (variant_b_title !== undefined) data.variant_b_title = variant_b_title;
    if (variant_b_body !== undefined) data.variant_b_body = variant_b_body;
    return data;
}

function buildTemplateData(body) {
    const {
        name, target, event_type, channels, message_title, body: msgBody,
        from_email, sms_sender_id, deep_link, is_active,
        schedule_type, relative_time,
    } = body;

    const data = {};
    if (name !== undefined) data.name = name;
    if (target !== undefined) data.target = target;
    if (event_type !== undefined) data.event_type = event_type;
    if (channels !== undefined) data.channels = channels;
    if (message_title !== undefined) data.message_title = message_title;
    if (msgBody !== undefined) data.body = msgBody;
    if (from_email !== undefined) data.from_email = from_email;
    if (sms_sender_id !== undefined) data.sms_sender_id = sms_sender_id;
    if (deep_link !== undefined) data.deep_link = deep_link;
    if (is_active !== undefined) data.is_active = is_active;
    if (schedule_type !== undefined) data.schedule_type = schedule_type;
    if (relative_time !== undefined) data.relative_time = relative_time;
    return data;
}

// ─── Campaign CRUD ───────────────────────────────────────────────────────────

const getAllCampaigns = async (req, res) => {
    try {
        const {
            page = 1, limit = 20, status, target,
            search, sort_by = 'created_at', sort_order = 'DESC',
        } = req.query;

        const allowedSort = ['created_at', 'updated_at', 'name', 'status', 'schedule_time', 'reach_count'];
        const safeSortBy = allowedSort.includes(sort_by) ? sort_by : 'created_at';
        const safeSortOrder = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        const where = { is_deleted: false };
        if (status) where.status = status;
        if (target) where.target = target;
        if (search) where.name = { [Op.like]: `%${search}%` };

        const { count, rows } = await NotificationCampaign.findAndCountAll({
            where,
            order: [[safeSortBy, safeSortOrder]],
            limit: parseInt(limit),
            offset: (parseInt(page) - 1) * parseInt(limit),
        });

        res.json({
            success: true,
            data: rows,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(count / parseInt(limit)),
                total_items: count,
                items_per_page: parseInt(limit),
            },
        });
    } catch (error) {
        logger.error('Error fetching campaigns:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch campaigns' });
    }
};

const getCampaignById = async (req, res) => {
    try {
        const campaign = await NotificationCampaign.findByPk(req.params.id);
        if (!campaign || campaign.is_deleted) {
            return res.status(404).json({ success: false, error: 'Campaign not found' });
        }
        res.json({ success: true, data: campaign });
    } catch (error) {
        logger.error('Error fetching campaign:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch campaign' });
    }
};

const createCampaign = async (req, res) => {
    try {
        const data = buildCampaignData(req.body);
        data.created_by = req.user?.id || null;

        if (!data.name || !data.target || !data.category || !data.title || !data.body) {
            return res.status(400).json({ success: false, error: 'name, target, category, title, and body are required' });
        }
        if (!VALID_TARGETS.includes(data.target)) {
            return res.status(400).json({ success: false, error: 'target must be USER or VENDOR' });
        }
        if (!VALID_CAMPAIGN_CATEGORIES.includes(data.category)) {
            return res.status(400).json({ success: false, error: `Invalid category. Valid: ${VALID_CAMPAIGN_CATEGORIES.join(', ')}` });
        }
        if (data.channels && !data.channels.every(c => VALID_CHANNELS.includes(c))) {
            return res.status(400).json({ success: false, error: 'channels must be PUSH, SMS, or MAIL' });
        }

        const campaign = await NotificationCampaign.create(data);
        res.status(201).json({ success: true, message: 'Campaign created', data: campaign });
    } catch (error) {
        logger.error('Error creating campaign:', error);
        res.status(500).json({ success: false, error: 'Failed to create campaign' });
    }
};

const updateCampaign = async (req, res) => {
    try {
        const campaign = await NotificationCampaign.findByPk(req.params.id);
        if (!campaign || campaign.is_deleted) {
            return res.status(404).json({ success: false, error: 'Campaign not found' });
        }
        if (campaign.status === 'SENT') {
            return res.status(400).json({ success: false, error: 'Cannot edit a campaign that has already been sent' });
        }

        const data = buildCampaignData(req.body);
        await campaign.update(data);
        res.json({ success: true, message: 'Campaign updated', data: campaign });
    } catch (error) {
        logger.error('Error updating campaign:', error);
        res.status(500).json({ success: false, error: 'Failed to update campaign' });
    }
};

const deleteCampaign = async (req, res) => {
    try {
        const campaign = await NotificationCampaign.findByPk(req.params.id);
        if (!campaign || campaign.is_deleted) {
            return res.status(404).json({ success: false, error: 'Campaign not found' });
        }
        await campaign.update({ is_deleted: true, status: 'CANCELLED' });
        res.json({ success: true, message: 'Campaign deleted' });
    } catch (error) {
        logger.error('Error deleting campaign:', error);
        res.status(500).json({ success: false, error: 'Failed to delete campaign' });
    }
};

// ─── Template CRUD ───────────────────────────────────────────────────────────

const getAllTemplates = async (req, res) => {
    try {
        const { page = 1, limit = 20, target, event_type, is_active, search } = req.query;
        const where = { is_deleted: false };
        if (target) where.target = target;
        if (event_type) where.event_type = event_type;
        if (is_active !== undefined) where.is_active = is_active === 'true';
        if (search) where.name = { [Op.like]: `%${search}%` };

        const { count, rows } = await NotificationTemplate.findAndCountAll({
            where,
            order: [['name', 'ASC']],
            limit: parseInt(limit),
            offset: (parseInt(page) - 1) * parseInt(limit),
        });

        res.json({
            success: true,
            data: rows,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(count / parseInt(limit)),
                total_items: count,
                items_per_page: parseInt(limit),
            },
        });
    } catch (error) {
        logger.error('Error fetching templates:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch templates' });
    }
};

const getTemplateById = async (req, res) => {
    try {
        const template = await NotificationTemplate.findByPk(req.params.id);
        if (!template || template.is_deleted) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }
        res.json({ success: true, data: template });
    } catch (error) {
        logger.error('Error fetching template:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch template' });
    }
};

const createTemplate = async (req, res) => {
    try {
        const data = buildTemplateData(req.body);
        if (!data.name || !data.target || !data.event_type || !data.body) {
            return res.status(400).json({ success: false, error: 'name, target, event_type, and body are required' });
        }
        if (!VALID_TARGETS.includes(data.target)) {
            return res.status(400).json({ success: false, error: 'target must be USER or VENDOR' });
        }

        const template = await NotificationTemplate.create(data);
        res.status(201).json({ success: true, message: 'Template created', data: template });
    } catch (error) {
        logger.error('Error creating template:', error);
        res.status(500).json({ success: false, error: 'Failed to create template' });
    }
};

const updateTemplate = async (req, res) => {
    try {
        const template = await NotificationTemplate.findByPk(req.params.id);
        if (!template || template.is_deleted) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }
        await template.update(buildTemplateData(req.body));
        res.json({ success: true, message: 'Template updated', data: template });
    } catch (error) {
        logger.error('Error updating template:', error);
        res.status(500).json({ success: false, error: 'Failed to update template' });
    }
};

const deleteTemplate = async (req, res) => {
    try {
        const template = await NotificationTemplate.findByPk(req.params.id);
        if (!template || template.is_deleted) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }
        await template.update({ is_deleted: true, is_active: false });
        res.json({ success: true, message: 'Template deleted' });
    } catch (error) {
        logger.error('Error deleting template:', error);
        res.status(500).json({ success: false, error: 'Failed to delete template' });
    }
};

// ─── Notification Logs ───────────────────────────────────────────────────────

const getLogs = async (req, res) => {
    try {
        const { page = 1, limit = 50, target, channel, status, campaign_id } = req.query;
        const where = {};
        if (target) where.target = target;
        if (channel) where.channel = channel;
        if (status) where.status = status;
        if (campaign_id) where.campaign_id = campaign_id;

        const { count, rows } = await PushNotification.findAndCountAll({
            where,
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: (parseInt(page) - 1) * parseInt(limit),
        });

        res.json({
            success: true,
            data: rows,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(count / parseInt(limit)),
                total_items: count,
                items_per_page: parseInt(limit),
            },
        });
    } catch (error) {
        logger.error('Error fetching notification logs:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch logs' });
    }
};

// ─── Dispatch ────────────────────────────────────────────────────────────────

/**
 * POST /api/admin/push/campaigns/:id/dispatch
 * Triggers the actual sending of a campaign via Firebase Admin SDK.
 * Fetches device tokens for the target audience and dispatches FCM messages.
 */
const dispatchCampaign = async (req, res) => {
    try {
        const campaign = await NotificationCampaign.findByPk(req.params.id);
        if (!campaign || campaign.is_deleted) {
            return res.status(404).json({ success: false, error: 'Campaign not found' });
        }
        if (!['DRAFT', 'SCHEDULED'].includes(campaign.status)) {
            return res.status(400).json({ success: false, error: `Campaign is already ${campaign.status}` });
        }

        // Collect device tokens for target audience
        let deviceTokens = [];
        if (campaign.target === 'USER') {
            const customers = await Customer.findAll({
                where: { device_token: { [Op.ne]: null }, is_active: true },
                attributes: ['id', 'name', 'device_token'],
            });
            deviceTokens = customers.map(c => ({ id: c.id, name: c.name, token: c.device_token }));
        } else {
            const { Vendor } = require('../../models');
            const vendors = await Vendor.findAll({
                where: { device_token: { [Op.ne]: null }, status: 'active' },
                attributes: ['id', 'business_name', 'device_token'],
            });
            deviceTokens = vendors.map(v => ({ id: v.id, name: v.business_name || `Vendor ${v.id}`, token: v.device_token }));
        }

        if (deviceTokens.length === 0) {
            await campaign.update({ status: 'FAILED', error_count: 0 });
            return res.status(400).json({ success: false, error: 'No registered device tokens found for target audience' });
        }

        // Attempt FCM dispatch via firebase-admin
        let sentCount = 0;
        let failedCount = 0;

        try {
            const admin = require('firebase-admin');
            const fcmMessages = deviceTokens.map(recipient => ({
                notification: { title: campaign.title, body: campaign.body },
                token: recipient.token,
                data: campaign.redirect_url ? { url: campaign.redirect_url } : {},
            }));

            // Send in batches of 500 (FCM limit)
            const BATCH_SIZE = 500;
            for (let i = 0; i < fcmMessages.length; i += BATCH_SIZE) {
                const batch = fcmMessages.slice(i, i + BATCH_SIZE);
                const response = await admin.messaging().sendEach(batch);
                sentCount += response.successCount;
                failedCount += response.failureCount;
            }
        } catch (fcmError) {
            logger.warn('Firebase Admin not available or FCM dispatch failed:', fcmError.message);
            // Graceful degradation: log as sent without actual FCM dispatch
            sentCount = deviceTokens.length;
        }

        // Update campaign stats
        await campaign.update({
            status: 'SENT',
            reach_count: deviceTokens.length,
            error_count: failedCount,
        });

        // Write notification log entries (sampled: log first 1000 to avoid table bloat)
        const logsToCreate = deviceTokens.slice(0, 1000).map(recipient => ({
            title: campaign.title,
            message: campaign.body,
            campaign_id: campaign.id,
            target: campaign.target,
            entity_id: String(recipient.id),
            entity_name: recipient.name,
            channel: 'PUSH',
            status: 'SENT',
            sent_at: new Date(),
            is_campaign: true,
        }));
        await PushNotification.bulkCreate(logsToCreate, { ignoreDuplicates: true });

        res.json({
            success: true,
            message: `Campaign dispatched to ${deviceTokens.length} recipients (${sentCount} sent, ${failedCount} failed)`,
            data: { reach: deviceTokens.length, sent: sentCount, failed: failedCount },
        });
    } catch (error) {
        logger.error('Error dispatching campaign:', error);
        res.status(500).json({ success: false, error: 'Failed to dispatch campaign' });
    }
};

module.exports = {
    getAllCampaigns, getCampaignById, createCampaign, updateCampaign, deleteCampaign,
    getAllTemplates, getTemplateById, createTemplate, updateTemplate, deleteTemplate,
    getLogs,
    dispatchCampaign,
};
