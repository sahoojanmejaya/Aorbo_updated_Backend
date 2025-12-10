const { Chat, Message, Customer, User } = require("../../models");
const logger = require("../../utils/logger");
const { Op } = require("sequelize");

const chatController = {
    // Get all chats for admin panel
    getAllChats: async (req, res) => {
        try {
            const { status, search, page = 1, limit = 20 } = req.query;
            const offset = (page - 1) * limit;

            const whereClause = {};
            if (status) {
                whereClause.status = status;
            }

            // Search filter for customer name or phone
            const customerWhere = {};
            if (search) {
                customerWhere[Op.or] = [
                    { name: { [Op.like]: `%${search}%` } },
                    { phone: { [Op.like]: `%${search}%` } },
                    { email: { [Op.like]: `%${search}%` } },
                ];
            }

            const { count, rows: chats } = await Chat.findAndCountAll({
                where: whereClause,
                include: [
                    {
                        model: Customer,
                        as: "customer",
                        attributes: ["id", "name", "phone", "email"],
                        where: Object.keys(customerWhere).length > 0 ? customerWhere : undefined,
                    },
                    {
                        model: User,
                        as: "admin",
                        attributes: ["id", "name", "email"],
                        required: false,
                    },
                ],
                order: [["last_message_at", "DESC"]],
                limit: parseInt(limit),
                offset: parseInt(offset),
            });

            // Get last message for each chat
            const chatsWithLastMessage = await Promise.all(
                chats.map(async (chat) => {
                    const lastMessage = await Message.findOne({
                        where: { chat_id: chat.id },
                        order: [["created_at", "DESC"]],
                        limit: 1,
                    });

                    return {
                        id: chat.id,
                        customer: chat.customer,
                        admin: chat.admin,
                        status: chat.status,
                        lastMessageAt: chat.last_message_at,
                        unreadAdminCount: chat.unread_admin_count,
                        unreadCustomerCount: chat.unread_customer_count,
                        lastMessage: lastMessage
                            ? {
                                  id: lastMessage.id,
                                  message: lastMessage.message,
                                  senderType: lastMessage.sender_type,
                                  createdAt: lastMessage.created_at,
                              }
                            : null,
                    };
                })
            );

            logger.app("info", "Admin fetched chats", {
                adminId: req.user.id,
                count: chats.length,
            });

            res.json({
                success: true,
                data: {
                    chats: chatsWithLastMessage,
                    pagination: {
                        total: count,
                        page: parseInt(page),
                        limit: parseInt(limit),
                        totalPages: Math.ceil(count / limit),
                    },
                },
            });
        } catch (error) {
            logger.error("error", "Error fetching chats", {
                error: error.message,
                stack: error.stack,
            });

            res.status(500).json({
                success: false,
                message: "Failed to fetch chats",
                error: error.message,
            });
        }
    },

    // Get messages for a specific chat
    getChatMessages: async (req, res) => {
        try {
            const { chatId } = req.params;
            const { page = 1, limit = 50 } = req.query;
            const offset = (page - 1) * limit;

            const chat = await Chat.findByPk(chatId, {
                include: [
                    {
                        model: Customer,
                        as: "customer",
                        attributes: ["id", "name", "phone", "email"],
                    },
                ],
            });

            if (!chat) {
                return res.status(404).json({
                    success: false,
                    message: "Chat not found",
                });
            }

            const { count, rows: messages } = await Message.findAndCountAll({
                where: { chat_id: chatId },
                order: [["created_at", "ASC"]],
                limit: parseInt(limit),
                offset: parseInt(offset),
            });

            logger.app("info", "Admin fetched chat messages", {
                adminId: req.user.id,
                chatId,
                messageCount: messages.length,
            });

            res.json({
                success: true,
                data: {
                    chat: {
                        id: chat.id,
                        customer: chat.customer,
                        status: chat.status,
                        unreadAdminCount: chat.unread_admin_count,
                    },
                    messages: messages.map((msg) => ({
                        id: msg.id,
                        chatId: msg.chat_id,
                        message: msg.message,
                        senderType: msg.sender_type,
                        senderId: msg.sender_id,
                        messageType: msg.message_type,
                        attachmentUrl: msg.attachment_url,
                        isRead: msg.is_read,
                        readAt: msg.read_at,
                        createdAt: msg.created_at,
                    })),
                    pagination: {
                        total: count,
                        page: parseInt(page),
                        limit: parseInt(limit),
                        totalPages: Math.ceil(count / limit),
                    },
                },
            });
        } catch (error) {
            logger.error("error", "Error fetching chat messages", {
                error: error.message,
                stack: error.stack,
            });

            res.status(500).json({
                success: false,
                message: "Failed to fetch messages",
                error: error.message,
            });
        }
    },

    // Create or get existing chat with a customer
    createOrGetChat: async (req, res) => {
        try {
            const { customerId } = req.body;

            if (!customerId) {
                return res.status(400).json({
                    success: false,
                    message: "Customer ID is required",
                });
            }

            // Check if customer exists
            const customer = await Customer.findByPk(customerId);
            if (!customer) {
                return res.status(404).json({
                    success: false,
                    message: "Customer not found",
                });
            }

            // Check if chat already exists
            let chat = await Chat.findOne({
                where: { customer_id: customerId },
                include: [
                    {
                        model: Customer,
                        as: "customer",
                        attributes: ["id", "name", "phone", "email"],
                    },
                ],
            });

            if (!chat) {
                // Create new chat
                chat = await Chat.create({
                    customer_id: customerId,
                    admin_id: req.user.id,
                    status: "active",
                });

                chat = await Chat.findByPk(chat.id, {
                    include: [
                        {
                            model: Customer,
                            as: "customer",
                            attributes: ["id", "name", "phone", "email"],
                        },
                    ],
                });

                logger.app("info", "Admin created new chat", {
                    adminId: req.user.id,
                    customerId,
                    chatId: chat.id,
                });
            }

            res.json({
                success: true,
                data: {
                    chat: {
                        id: chat.id,
                        customer: chat.customer,
                        status: chat.status,
                        unreadAdminCount: chat.unread_admin_count,
                        lastMessageAt: chat.last_message_at,
                    },
                },
            });
        } catch (error) {
            logger.error("error", "Error creating/getting chat", {
                error: error.message,
                stack: error.stack,
            });

            res.status(500).json({
                success: false,
                message: "Failed to create/get chat",
                error: error.message,
            });
        }
    },

    // Update chat status
    updateChatStatus: async (req, res) => {
        try {
            const { chatId } = req.params;
            const { status } = req.body;

            if (!["active", "closed", "archived"].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid status",
                });
            }

            const chat = await Chat.findByPk(chatId);
            if (!chat) {
                return res.status(404).json({
                    success: false,
                    message: "Chat not found",
                });
            }

            await chat.update({ status });

            logger.app("info", "Admin updated chat status", {
                adminId: req.user.id,
                chatId,
                status,
            });

            res.json({
                success: true,
                message: "Chat status updated successfully",
                data: {
                    chat: {
                        id: chat.id,
                        status: chat.status,
                    },
                },
            });
        } catch (error) {
            logger.error("error", "Error updating chat status", {
                error: error.message,
                stack: error.stack,
            });

            res.status(500).json({
                success: false,
                message: "Failed to update chat status",
                error: error.message,
            });
        }
    },

    // Get chat statistics
    getChatStats: async (req, res) => {
        try {
            const totalChats = await Chat.count();
            const activeChats = await Chat.count({ where: { status: "active" } });
            const closedChats = await Chat.count({ where: { status: "closed" } });
            const totalUnreadMessages = await Chat.sum("unread_admin_count");

            logger.app("info", "Admin fetched chat statistics", {
                adminId: req.user.id,
            });

            res.json({
                success: true,
                data: {
                    totalChats,
                    activeChats,
                    closedChats,
                    totalUnreadMessages: totalUnreadMessages || 0,
                },
            });
        } catch (error) {
            logger.error("error", "Error fetching chat statistics", {
                error: error.message,
                stack: error.stack,
            });

            res.status(500).json({
                success: false,
                message: "Failed to fetch chat statistics",
                error: error.message,
            });
        }
    },
};

module.exports = chatController;
