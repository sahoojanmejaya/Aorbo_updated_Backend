const { Chat, Message, Customer, User } = require("../../models");
const logger = require("../../utils/logger");

const chatController = {
    // Create or get existing chat for customer
    createOrGetChat: async (req, res) => {
        try {
            const customerId = req.customer.id; // From Firebase auth middleware

            // Check if chat already exists for this customer
            let chat = await Chat.findOne({
                where: { customer_id: customerId },
            });

            if (!chat) {
                // Create new chat
                chat = await Chat.create({
                    customer_id: customerId,
                    status: "active",
                });

                logger.app("info", "Customer created new chat", {
                    customerId,
                    chatId: chat.id,
                });
            }

            res.json({
                success: true,
                data: {
                    chat: {
                        id: chat.id,
                        customerId: chat.customer_id,
                        adminId: chat.admin_id,
                        status: chat.status,
                        unreadCustomerCount: chat.unread_customer_count,
                        lastMessageAt: chat.last_message_at,
                    },
                },
            });
        } catch (error) {
            logger.error("error", "Error creating/getting customer chat", {
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

    // Get messages for customer's chat
    getChatMessages: async (req, res) => {
        try {
            const { chatId } = req.params;
            const customerId = req.customer.id;
            const { page = 1, limit = 50 } = req.query;
            const offset = (page - 1) * limit;

            // Verify chat belongs to customer
            const chat = await Chat.findOne({
                where: {
                    id: chatId,
                    customer_id: customerId,
                },
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

            logger.app("info", "Customer fetched chat messages", {
                customerId,
                chatId,
                messageCount: messages.length,
            });

            res.json({
                success: true,
                data: {
                    chat: {
                        id: chat.id,
                        status: chat.status,
                        unreadCustomerCount: chat.unread_customer_count,
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
            logger.error("error", "Error fetching customer chat messages", {
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

    // Mark messages as read
    markMessagesAsRead: async (req, res) => {
        try {
            const { chatId } = req.params;
            const customerId = req.customer.id;

            // Verify chat belongs to customer
            const chat = await Chat.findOne({
                where: {
                    id: chatId,
                    customer_id: customerId,
                },
            });

            if (!chat) {
                return res.status(404).json({
                    success: false,
                    message: "Chat not found",
                });
            }

            // Reset customer unread count
            await chat.update({
                unread_customer_count: 0,
            });

            // Mark all admin messages as read
            await Message.update(
                { is_read: true, read_at: new Date() },
                {
                    where: {
                        chat_id: chatId,
                        sender_type: "admin",
                        is_read: false,
                    },
                }
            );

            logger.app("info", "Customer marked messages as read", {
                customerId,
                chatId,
            });

            res.json({
                success: true,
                message: "Messages marked as read",
            });
        } catch (error) {
            logger.error("error", "Error marking messages as read", {
                error: error.message,
                stack: error.stack,
            });

            res.status(500).json({
                success: false,
                message: "Failed to mark messages as read",
                error: error.message,
            });
        }
    },
};

module.exports = chatController;
