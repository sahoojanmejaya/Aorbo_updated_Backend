const { Chat, Message, Customer, User } = require("../../models");
const logger = require("../../utils/logger");
const { Op } = require("sequelize");


// const chatController = {
//     // Get all chats for admin panel
//     getAllChats: async (req, res) => {
//         try {
//             const { status, search, page = 1, limit = 20 } = req.query;
//             const offset = (page - 1) * limit;

//             const whereClause = {};
//             if (status) {
//                 whereClause.status = status;
//             }

//             // Search filter for customer name or phone
//             const customerWhere = {};
//             if (search) {
//                 customerWhere[Op.or] = [
//                     { name: { [Op.like]: `%${search}%` } },
//                     { phone: { [Op.like]: `%${search}%` } },
//                     { email: { [Op.like]: `%${search}%` } },
//                 ];
//             }

//             const { count, rows: chats } = await Chat.findAndCountAll({
//                 where: whereClause,
//                 include: [
//                     {
//                         model: Customer,
//                         as: "customer",
//                         attributes: ["id", "name", "phone", "email"],
//                         where: Object.keys(customerWhere).length > 0 ? customerWhere : undefined,
//                     },
//                     {
//                         model: User,
//                         as: "admin",
//                         attributes: ["id", "name", "email"],
//                         required: false,
//                     },
//                 ],
//                 order: [["last_message_at", "DESC"]],
//                 limit: parseInt(limit),
//                 offset: parseInt(offset),
//             });

//             // Get last message for each chat
//             const chatsWithLastMessage = await Promise.all(
//                 chats.map(async (chat) => {
//                     const lastMessage = await Message.findOne({
//                         where: { chat_id: chat.id },
//                         order: [["created_at", "DESC"]],
//                         limit: 1,
//                     });

//                     return {
//                         id: chat.id,
//                         customer: chat.customer,
//                         admin: chat.admin,
//                         status: chat.status,
//                         lastMessageAt: chat.last_message_at,
//                         unreadAdminCount: chat.unread_admin_count,
//                         unreadCustomerCount: chat.unread_customer_count,
//                         lastMessage: lastMessage
//                             ? {
//                                   id: lastMessage.id,
//                                   message: lastMessage.message,
//                                   senderType: lastMessage.sender_type,
//                                   createdAt: lastMessage.created_at,
//                               }
//                             : null,
//                     };
//                 })
//             );

//             logger.app("info", "Admin fetched chats", {
//                 adminId: req.user.id,
//                 count: chats.length,
//             });

//             res.json({
//                 success: true,
//                 data: {
//                     chats: chatsWithLastMessage,
//                     pagination: {
//                         total: count,
//                         page: parseInt(page),
//                         limit: parseInt(limit),
//                         totalPages: Math.ceil(count / limit),
//                     },
//                 },
//             });
//         } catch (error) {
//             logger.error("error", "Error fetching chats", {
//                 error: error.message,
//                 stack: error.stack,
//             });

//             res.status(500).json({
//                 success: false,
//                 message: "Failed to fetch chats",
//                 error: error.message,
//             });
//         }
//     },

//     // Get messages for a specific chat
//     getChatMessages: async (req, res) => {
//         try {
//             const { chatId } = req.params;
//             const { page = 1, limit = 50 } = req.query;
//             const offset = (page - 1) * limit;

//             const chat = await Chat.findByPk(chatId, {
//                 include: [
//                     {
//                         model: Customer,
//                         as: "customer",
//                         attributes: ["id", "name", "phone", "email"],
//                     },
//                 ],
//             });

//             if (!chat) {
//                 return res.status(404).json({
//                     success: false,
//                     message: "Chat not found",
//                 });
//             }

//             const { count, rows: messages } = await Message.findAndCountAll({
//                 where: { chat_id: chatId },
//                 order: [["created_at", "ASC"]],
//                 limit: parseInt(limit),
//                 offset: parseInt(offset),
//             });

//             logger.app("info", "Admin fetched chat messages", {
//                 adminId: req.user.id,
//                 chatId,
//                 messageCount: messages.length,
//             });

//             res.json({
//                 success: true,
//                 data: {
//                     chat: {
//                         id: chat.id,
//                         customer: chat.customer,
//                         status: chat.status,
//                         unreadAdminCount: chat.unread_admin_count,
//                     },
//                     messages: messages.map((msg) => ({
//                         id: msg.id,
//                         chatId: msg.chat_id,
//                         message: msg.message,
//                         senderType: msg.sender_type,
//                         senderId: msg.sender_id,
//                         messageType: msg.message_type,
//                         attachmentUrl: msg.attachment_url,
//                         isRead: msg.is_read,
//                         readAt: msg.read_at,
//                         createdAt: msg.created_at,
//                     })),
//                     pagination: {
//                         total: count,
//                         page: parseInt(page),
//                         limit: parseInt(limit),
//                         totalPages: Math.ceil(count / limit),
//                     },
//                 },
//             });
//         } catch (error) {
//             logger.error("error", "Error fetching chat messages", {
//                 error: error.message,
//                 stack: error.stack,
//             });

//             res.status(500).json({
//                 success: false,
//                 message: "Failed to fetch messages",
//                 error: error.message,
//             });
//         }
//     },

//     // Create or get existing chat with a customer
//     createOrGetChat: async (req, res) => {
//         try {
//             const { customerId } = req.body;

//             if (!customerId) {
//                 return res.status(400).json({
//                     success: false,
//                     message: "Customer ID is required",
//                 });
//             }

//             // Check if customer exists
//             const customer = await Customer.findByPk(customerId);
//             if (!customer) {
//                 return res.status(404).json({
//                     success: false,
//                     message: "Customer not found",
//                 });
//             }

//             // Check if chat already exists
//             let chat = await Chat.findOne({
//                 where: { customer_id: customerId },
//                 include: [
//                     {
//                         model: Customer,
//                         as: "customer",
//                         attributes: ["id", "name", "phone", "email"],
//                     },
//                 ],
//             });

//             if (!chat) {
//                 // Create new chat
//                 chat = await Chat.create({
//                     customer_id: customerId,
//                     admin_id: req.user.id,
//                     status: "active",
//                 });

//                 chat = await Chat.findByPk(chat.id, {
//                     include: [
//                         {
//                             model: Customer,
//                             as: "customer",
//                             attributes: ["id", "name", "phone", "email"],
//                         },
//                     ],
//                 });

//                 logger.app("info", "Admin created new chat", {
//                     adminId: req.user.id,
//                     customerId,
//                     chatId: chat.id,
//                 });
//             }

//             res.json({
//                 success: true,
//                 data: {
//                     chat: {
//                         id: chat.id,
//                         customer: chat.customer,
//                         status: chat.status,
//                         unreadAdminCount: chat.unread_admin_count,
//                         lastMessageAt: chat.last_message_at,
//                     },
//                 },
//             });
//         } catch (error) {
//             logger.error("error", "Error creating/getting chat", {
//                 error: error.message,
//                 stack: error.stack,
//             });

//             res.status(500).json({
//                 success: false,
//                 message: "Failed to create/get chat",
//                 error: error.message,
//             });
//         }
//     },

//     // Update chat status
//     updateChatStatus: async (req, res) => {
//         try {
//             const { chatId } = req.params;
//             const { status } = req.body;

//             if (!["active", "closed", "archived"].includes(status)) {
//                 return res.status(400).json({
//                     success: false,
//                     message: "Invalid status",
//                 });
//             }

//             const chat = await Chat.findByPk(chatId);
//             if (!chat) {
//                 return res.status(404).json({
//                     success: false,
//                     message: "Chat not found",
//                 });
//             }

//             await chat.update({ status });

//             logger.app("info", "Admin updated chat status", {
//                 adminId: req.user.id,
//                 chatId,
//                 status,
//             });

//             res.json({
//                 success: true,
//                 message: "Chat status updated successfully",
//                 data: {
//                     chat: {
//                         id: chat.id,
//                         status: chat.status,
//                     },
//                 },
//             });
//         } catch (error) {
//             logger.error("error", "Error updating chat status", {
//                 error: error.message,
//                 stack: error.stack,
//             });

//             res.status(500).json({
//                 success: false,
//                 message: "Failed to update chat status",
//                 error: error.message,
//             });
//         }
//     },

//     // Get chat statistics
//     getChatStats: async (req, res) => {
//         try {
//             const totalChats = await Chat.count();
//             const activeChats = await Chat.count({ where: { status: "active" } });
//             const closedChats = await Chat.count({ where: { status: "closed" } });
//             const totalUnreadMessages = await Chat.sum("unread_admin_count");

//             logger.app("info", "Admin fetched chat statistics", {
//                 adminId: req.user.id,
//             });

//             res.json({
//                 success: true,
//                 data: {
//                     totalChats,
//                     activeChats,
//                     closedChats,
//                     totalUnreadMessages: totalUnreadMessages || 0,
//                 },
//             });
//         } catch (error) {
//             logger.error("error", "Error fetching chat statistics", {
//                 error: error.message,
//                 stack: error.stack,
//             });

//             res.status(500).json({
//                 success: false,
//                 message: "Failed to fetch chat statistics",
//                 error: error.message,
//             });
//         }
//     },
// };

// module.exports = chatController


const getChatByUserId = async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required"
      });
    }

    const { page = 1, limit = 10, search } = req.query;
    const offset = (page - 1) * limit;

    /* ============================
       1. Fetch all messages
    =============================*/
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { sender_id: userId },
          { receiver_id: userId }
        ]
      },
      order: [["created_at", "DESC"]],
      raw: true
    });

    if (!messages.length) {
      return res.status(200).json({
        success: true,
        message: "No chats found",
        data: {
          totalChats: 0,
          chats: []
        }
      });
    }

    /* ============================
       2. Extract unique chat users
    =============================*/
    const chatUserIds = new Set();

    messages.forEach(msg => {
      if (msg.sender_id !== userId) chatUserIds.add(msg.sender_id);
      if (msg.receiver_id !== userId) chatUserIds.add(msg.receiver_id);
    });

    /* ============================
       3. Fetch user details
    =============================*/
    const userWhere = {
      id: { [Op.in]: Array.from(chatUserIds) }
    };

    if (search) {
      userWhere[Op.or] = [
        { first_name: { [Op.like]: `%${search}%` } },
        { last_name: { [Op.like]: `%${search}%` } }
      ];
    }

    const users = await User.findAll({
      where: userWhere,
      attributes: [
        "id",
        "name",
      
        "email",
        "phone",
        
      ],
      raw: true
    });

    const userMap = {};
    users.forEach(u => {
      userMap[u.id] = u;
    });

    /* ============================
       4. Build chat list
    =============================*/
    const chatList = Array.from(chatUserIds)
      .filter(id => userMap[id])
      .slice(offset, offset + Number(limit))
      .map(chatUserId => {

        const recentMessage = messages.find(
          msg =>
            (msg.sender_id === chatUserId && msg.receiver_id === userId) ||
            (msg.receiver_id === chatUserId && msg.sender_id === userId)
        );

        const unreadCount = messages.filter(
          msg =>
            msg.sender_id === chatUserId &&
            msg.receiver_id === userId &&
            msg.is_read === 0
        ).length;

        return {
          user_id: chatUserId,
         name: userMap[chatUserId].name,
          email: userMap[chatUserId].email,
          phone_number: userMap[chatUserId].phone_number,
          last_message: recentMessage?.message || null,
          message_type: recentMessage?.message_type || null,
          last_message_time: recentMessage?.created_at || null,

          unread_count: unreadCount
        };
      });

    /* ============================
       5. Success Response
    =============================*/
    return res.status(200).json({
      success: true,
      message: "Chat list fetched successfully",
      data: {
        totalChats: chatUserIds.size,
        page: Number(page),
        limit: Number(limit),
        chats: chatList
      }
    });

  } catch (error) {
    console.error("Error fetching chat list:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};
const get_messages = async (req, res) => {
  try {
    const { userId1, userId2 } = req.params;
    const { page = 1, limit = 10, search = "" } = req.query;

    const offset = (page - 1) * limit;

    if (!userId1 || !userId2) {
      return res.status(400).json({
        success: false,
        message: "Both userId1 and userId2 are required"
      });
    }

    // SEARCH filter
    let searchFilter = {};
    if (search.trim()) {
      searchFilter = {
        chat_message: {
          [Op.like]: `%${search}%`
        }
      };
    }

    const { count, rows } = await Message.findAndCountAll({
      where: {
        [Op.or]: [
          { sender_id: userId1, receiver_id: userId2 },
          { sender_id: userId2, receiver_id: userId1 }
        ],
        ...searchFilter
      },
      order: [["createdAt", "DESC"]],
      offset,
      limit: parseInt(limit)
    });

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No messages found between the given users",
        data: []
      });
    }

    return res.status(200).json({
      success: true,
      message: "Messages fetched successfully",
      total: count,
      currentPage: parseInt(page),
      totalPages: Math.ceil(count / limit),
      data: rows
    });

  } catch (error) {
    console.error("Error occurred while fetching messages:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};
const deleteChatBetweenUsers = async (req, res) => {
  try {
    const { sender_id, receiver_id } = req.body;

    if (!sender_id || !receiver_id) {
      return res.status(400).json({
        success: false,
        message: "sender_id and receiver_id are required",
      });
    }

    const deletedCount = await Message.destroy({
      where: {
        [Sequelize.Op.or]: [
          { sender_id, receiver_id },
          { sender_id: receiver_id, receiver_id: sender_id },
        ],
      },
    });

    if (deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "No chat messages found between these users",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Deleted ${deletedCount} messages between users ${sender_id} and ${receiver_id}`,
      deletedCount,
    });

  } catch (error) {
    console.error("Error deleting chat messages:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
const deleteChatById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Message ID is required",
      });
    }

    const deleted = await Message.destroy({
      where: { id },
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Deleted message with ID ${id}`,
    });

  } catch (error) {
    console.error("Error deleting message:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
const getChatById = async (req, res) => {
  try {
   const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Message ID is required",
      });
    }

    const { page = 1, limit = 10, search } = req.query;
    const offset = (page - 1) * limit;

    /* ============================
       1. Fetch all messages
    =============================*/
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { sender_id: userId },
          { receiver_id: userId }
        ]
      },
      order: [["created_at", "DESC"]],
      raw: true
    });

    if (!messages.length) {
      return res.status(200).json({
        success: true,
        message: "No chats found",
        data: {
          totalChats: 0,
          chats: []
        }
      });
    }

    /* ============================
       2. Extract unique chat users
    =============================*/
    const chatUserIds = new Set();

    messages.forEach(msg => {
      if (msg.sender_id !== userId) chatUserIds.add(msg.sender_id);
      if (msg.receiver_id !== userId) chatUserIds.add(msg.receiver_id);
    });

    /* ============================
       3. Fetch user details
    =============================*/
    const userWhere = {
      id: { [Op.in]: Array.from(chatUserIds) }
    };

    if (search) {
      userWhere[Op.or] = [
        { first_name: { [Op.like]: `%${search}%` } },
        { last_name: { [Op.like]: `%${search}%` } }
      ];
    }

    const users = await User.findAll({
      where: userWhere,
      attributes: [
        "id",
        "name",
      
        "email",
        "phone",
        
      ],
      raw: true
    });

    const userMap = {};
    users.forEach(u => {
      userMap[u.id] = u;
    });

    /* ============================
       4. Build chat list
    =============================*/
    const chatList = Array.from(chatUserIds)
      .filter(id => userMap[id])
      .slice(offset, offset + Number(limit))
      .map(chatUserId => {

        const recentMessage = messages.find(
          msg =>
            (msg.sender_id === chatUserId && msg.receiver_id === userId) ||
            (msg.receiver_id === chatUserId && msg.sender_id === userId)
        );

        const unreadCount = messages.filter(
          msg =>
            msg.sender_id === chatUserId &&
            msg.receiver_id === userId &&
            msg.is_read === 0
        ).length;

        return {
          user_id: chatUserId,
         name: userMap[chatUserId].name,
          email: userMap[chatUserId].email,
          phone_number: userMap[chatUserId].phone_number,
          last_message: recentMessage?.message || null,
          message_type: recentMessage?.message_type || null,
          last_message_time: recentMessage?.created_at || null,

          unread_count: unreadCount
        };
      });

    /* ============================
       5. Success Response
    =============================*/
    return res.status(200).json({
      success: true,
      message: "Chat list fetched successfully",
      data: {
        totalChats: chatUserIds.size,
        page: Number(page),
        limit: Number(limit),
        chats: chatList
      }
    });

  } catch (error) {
    console.error("Error fetching chat list:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};
const   uploadAttachment = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const { sender_id, receiver_id, message_type } = req.body;
    console.log("req body", req.body);
   const file = req.file;
    const fileSize = file.size; 

   console.log("fileSize", req.file);
 //  const result = await checkAndUpdateStorage(sender_id, fileSize, DB);

//     if (result.error) {
//       return ApiError(res, 403, result.error);
//     }
 if (file) 
  req.body.upload_file = file.path;
  
    // Save to DB
    const newMessage = await Message.create({
      sender_id,
      receiver_id,
      message_type, 
      file_url: req.body.upload_file,
      message_content: null,
    });
    console.log("newmsg",newMessage);

return res.status(201).json({ success: true,message:"File uploaded successfully", newMessage})
    
  } catch (error) {
    console.log("error", error.message);
    res.status(500).json({ error: error.message });
  }
};

module.exports ={getChatByUserId,get_messages,deleteChatBetweenUsers,deleteChatById,getChatById,uploadAttachment} ;

