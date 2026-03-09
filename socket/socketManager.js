const logger = require("../utils/logger");
const { Chat, Message, Customer, User,sequelize,IssueReport } = require("../models");
const { Op } = require("sequelize");

// Store connected users and their socket IDs
// const connectedUsers = new Map();

// const socketManager = {
//     io: null,

//     initialize(io) {
//         this.io = io;

//         io.on("connection", (socket) => {
//             logger.app("info", "Client connected to chat", {
//                 socketId: socket.id,
//             });

//             // User joins with their role and ID
//             socket.on("user:join", async ({ userType, userId }) => {
//                 try {
//                     const userKey = `${userType}:${userId}`;
//                     connectedUsers.set(userKey, socket.id);
//                     socket.userType = userType;
//                     socket.userId = userId;

//                     logger.app("info", "User joined chat", {
//                         userType,
//                         userId,
//                         socketId: socket.id,
//                     });

//                     socket.emit("user:joined", {
//                         success: true,
//                         message: "Connected to chat server",
//                     });
//                 } catch (error) {
//                     logger.error("error", "Error in user:join", {
//                         error: error.message,
//                     });
//                 }
//             });

//             // Admin joins a specific chat room
//             socket.on("chat:join", async ({ chatId }) => {
//                 try {
//                     socket.join(`chat:${chatId}`);

//                     logger.app("info", "User joined chat room", {
//                         chatId,
//                         socketId: socket.id,
//                     });

//                     socket.emit("chat:joined", {
//                         success: true,
//                         chatId,
//                     });
//                 } catch (error) {
//                     logger.error("error", "Error in chat:join", {
//                         error: error.message,
//                     });
//                 }
//             });

//             // Send message
//             socket.on("message:send", async (data) => {
//                 try {
//                     const { chatId, message, senderType, senderId } = data;

//                     // Create message in database
//                     const newMessage = await Message.create({
//                         chat_id: chatId,
//                         sender_type: senderType,
//                         sender_id: senderId,
//                         message: message,
//                         message_type: "text",
//                         is_read: false,
//                     });

//                     // Update chat's last message time and unread counts
//                     const chat = await Chat.findByPk(chatId);
//                     if (chat) {
//                         await chat.update({
//                             last_message_at: new Date(),
//                             unread_customer_count:
//                                 senderType === "admin"
//                                     ? chat.unread_customer_count + 1
//                                     : chat.unread_customer_count,
//                             unread_admin_count:
//                                 senderType === "customer"
//                                     ? chat.unread_admin_count + 1
//                                     : chat.unread_admin_count,
//                         });
//                     }

//                     // Broadcast message to chat room
//                     io.to(`chat:${chatId}`).emit("message:received", {
//                         id: newMessage.id,
//                         chatId: chatId,
//                         message: message,
//                         senderType: senderType,
//                         senderId: senderId,
//                         createdAt: newMessage.created_at,
//                         isRead: false,
//                     });

//                     logger.app("info", "Message sent", {
//                         chatId,
//                         senderType,
//                         senderId,
//                     });
//                 } catch (error) {
//                     logger.error("error", "Error in message:send", {
//                         error: error.message,
//                         stack: error.stack,
//                     });

//                     socket.emit("message:error", {
//                         error: "Failed to send message",
//                     });
//                 }
//             });

//             // Mark messages as read
//             socket.on("messages:mark_read", async ({ chatId, userType }) => {
//                 try {
//                     const chat = await Chat.findByPk(chatId);
//                     if (!chat) {
//                         return;
//                     }

//                     // Update unread count based on user type
//                     if (userType === "admin") {
//                         await chat.update({
//                             unread_admin_count: 0,
//                         });

//                         // Mark all customer messages as read
//                         await Message.update(
//                             { is_read: true, read_at: new Date() },
//                             {
//                                 where: {
//                                     chat_id: chatId,
//                                     sender_type: "customer",
//                                     is_read: false,
//                                 },
//                             }
//                         );
//                     } else {
//                         await chat.update({
//                             unread_customer_count: 0,
//                         });

//                         // Mark all admin messages as read
//                         await Message.update(
//                             { is_read: true, read_at: new Date() },
//                             {
//                                 where: {
//                                     chat_id: chatId,
//                                     sender_type: "admin",
//                                     is_read: false,
//                                 },
//                             }
//                         );
//                     }

//                     // Notify other users in the chat
//                     io.to(`chat:${chatId}`).emit("messages:marked_read", {
//                         chatId,
//                         userType,
//                     });

//                     logger.app("info", "Messages marked as read", {
//                         chatId,
//                         userType,
//                     });
//                 } catch (error) {
//                     logger.error("error", "Error in messages:mark_read", {
//                         error: error.message,
//                     });
//                 }
//             });

//             // User typing indicator
//             socket.on("user:typing", ({ chatId, userType, userName }) => {
//                 socket.to(`chat:${chatId}`).emit("user:typing", {
//                     chatId,
//                     userType,
//                     userName,
//                 });
//             });

//             socket.on("user:stop_typing", ({ chatId, userType }) => {
//                 socket.to(`chat:${chatId}`).emit("user:stop_typing", {
//                     chatId,
//                     userType,
//                 });
//             });

//             // Disconnect
//             socket.on("disconnect", () => {
//                 // Remove user from connected users
//                 if (socket.userType && socket.userId) {
//                     const userKey = `${socket.userType}:${socket.userId}`;
//                     connectedUsers.delete(userKey);
//                 }

//                 logger.app("info", "Client disconnected from chat", {
//                     socketId: socket.id,
//                     userType: socket.userType,
//                     userId: socket.userId,
//                 });
//             });
//         });

//         logger.app("info", "Socket.IO manager initialized");
//     },

//     // Helper method to emit to specific user
//     emitToUser(userType, userId, event, data) {
//         const userKey = `${userType}:${userId}`;
//         const socketId = connectedUsers.get(userKey);
//         if (socketId && this.io) {
//             this.io.to(socketId).emit(event, data);
//         }
//     },
// };
const chatSocket = (io) => {
io.on("connection", (socket) => {
console.log("A user connected");

  socket.on("send_attachment", (data) => {
      const {id, sender_id, receiver_id, file_url,message_type } = data;
      console.log("event_data",data)
    
      io.emit("receive_attachment", {
        id,
        sender_id,
        receiver_id,
        file_url, 
        message_type,
        timestamp: new Date(),
      });
    });
socket.on("chat_message", async (data) => {
try {
const {
sender_id,
receiver_id,
message,
message_status,
message_type,
} = data;

// Validate input data
if (!sender_id || !receiver_id || !message) {
console.error("Invalid data received:", data);
return;
}
     

    // Handle file/audio sharing
    

    // Fetch user details
    const users = await User.findAll({
      where: {
        id: {
         [Op.in]: [sender_id, receiver_id],
},
},
});
if (!users || users.length < 1) {
console.error("users not found for provided IDs");
return;
}
// Extract names
//const senderName = User.find(user => user.id === sender_id)?.name || "Unknown Sender";
//const receiverName = User.find(user => user.id === receiver_id)?.name || "Unknown Receiver";

// Store the message in the database
const newMessage = await Message.create({
sender_id,
receiver_id,
message,
message_status,
message_type,
});
// Emit the message back with its details
io.emit("chat_message", {
id: newMessage.id,

sender_id: newMessage.sender_id,
receiver_id: newMessage.receiver_id,
message: newMessage.message,
message_status: newMessage.message_status,
message_type: newMessage.message_type,
createdAt: newMessage.createdAt,
updatedAt: newMessage.updatedAt,
});
} catch (error) {
console.error("Error saving message:", error.stack);
}
});

socket.on("disconnect", () => {
console.log("A user disconnected");
});
});
}


module.exports =chatSocket ;

    
