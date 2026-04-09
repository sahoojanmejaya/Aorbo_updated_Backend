const admin = require("firebase-admin");
const { Notification, Booking, Customer, Vendor, User, Trek } = require("../models");
const logger = require("../utils/logger");

class NotificationService {
    constructor() {
        this.EVENTS = {
            // Booking Events
            BOOKING_CONFIRMED: "booking_confirmed",
            BOOKING_CANCELLED: "booking_cancelled",
            PAYMENT_RECEIVED: "payment_received",
            REFUND_PROCESSED: "refund_processed",
            
            // Trek Events
            TREK_APPROVED: "trek_approved",
            TREK_REJECTED: "trek_rejected",
            BATCH_FULL: "batch_full",
            TREK_REMINDER: "trek_reminder",
            
            // Settlement Events
            SETTLEMENT_PROCESSED: "settlement_processed",
            COMMISSION_DEDUCTED: "commission_deducted",
            
            // Communication Events
            NEW_MESSAGE: "new_message",
            DISPUTE_RAISED: "dispute_raised",
            DISPUTE_RESOLVED: "dispute_resolved"
        };
    }

    /**
     * Map event name to Notification.category ENUM value
     */
    getCategory(event) {
        const map = {
            [this.EVENTS.BOOKING_CONFIRMED]: "BOOKING",
            [this.EVENTS.BOOKING_CANCELLED]: "CANCELLATION",
            [this.EVENTS.PAYMENT_RECEIVED]: "PAYMENT",
            [this.EVENTS.REFUND_PROCESSED]: "PAYMENT",
            [this.EVENTS.TREK_APPROVED]: "SYSTEM",
            [this.EVENTS.TREK_REJECTED]: "SYSTEM",
            [this.EVENTS.SETTLEMENT_PROCESSED]: "PAYMENT",
            [this.EVENTS.COMMISSION_DEDUCTED]: "PAYMENT",
            [this.EVENTS.NEW_MESSAGE]: "SYSTEM",
            [this.EVENTS.DISPUTE_RAISED]: "DISPUTE",
            [this.EVENTS.DISPUTE_RESOLVED]: "DISPUTE",
        };
        return map[event] || "SYSTEM";
    }

    /**
     * Send notification to multiple recipients
     */
    async send(event, recipients, data, priority = "normal") {
        try {
            const message = this.getBody(event, data);
            const category = this.getCategory(event);

            // 1. Send FCM notifications
            const fcmResults = await Promise.allSettled(
                recipients.map(recipient => this.sendFCM(recipient, event, data))
            );

            // 2. Store one DB record per recipient with correct model fields
            await Promise.allSettled(
                recipients.map(recipient => {
                    const record = {
                        type: "PUSH",
                        category,
                        message,
                        status: "SENT",
                    };
                    if (recipient.userType === "customer") {
                        record.customer_id = recipient.userId;
                    } else {
                        record.vendor_id = recipient.userId;
                    }
                    return Notification.create(record);
                })
            );

            // 3. Send email for critical events
            if (this.isCriticalEvent(event)) {
                await Promise.allSettled(
                    recipients.map(recipient => this.sendEmail(recipient, event, data))
                );
            }

            logger.info("notification", "Notification sent", {
                event,
                recipientCount: recipients.length,
            });
        } catch (error) {
            logger.error("notification", "Failed to send notification", {
                error: error.message,
                event,
                recipients
            });
            throw error;
        }
    }

    /**
     * Send FCM push notification
     */
    async sendFCM(recipient, event, data) {
        try {
            const { userId, userType } = recipient;
            
            // Get FCM token
            const fcmToken = await this.getFCMToken(userId, userType);
            if (!fcmToken) {
                logger.warn("notification", "No FCM token found", { userId, userType });
                return { success: false, reason: "no_token" };
            }

            // Build notification payload
            const payload = {
                notification: {
                    title: this.getTitle(event, data),
                    body: this.getBody(event, data)
                },
                data: {
                    event_type: event,
                    ...this.sanitizeData(data)
                },
                token: fcmToken
            };

            // Send via Firebase
            const response = await admin.messaging().send(payload);
            
            logger.info("notification", "FCM sent", {
                userId,
                userType,
                event,
                messageId: response
            });

            return { success: true, messageId: response };
        } catch (error) {
            logger.error("notification", "FCM send failed", {
                error: error.message,
                recipient,
                event
            });
            return { success: false, error: error.message };
        }
    }

    /**
     * Get FCM token for user
     */
    async getFCMToken(userId, userType) {
        try {
            let user;
            if (userType === "customer") {
                user = await Customer.findByPk(userId, {
                    attributes: ["fcm_token"]
                });
            } else {
                user = await User.findByPk(userId, {
                    attributes: ["fcm_token"]
                });
            }
            
            return user?.fcm_token || null;
        } catch (error) {
            logger.error("notification", "Failed to get FCM token", {
                error: error.message,
                userId,
                userType
            });
            return null;
        }
    }

    /**
     * Send email notification
     */
    async sendEmail(recipient, event, data) {
        // TODO: Implement email service (SendGrid, AWS SES, etc.)
        logger.info("notification", "Email notification queued", {
            recipient,
            event
        });
    }

    /**
     * Booking confirmation notification
     */
    async sendBookingConfirmation(bookingId) {
        try {
            const booking = await Booking.findByPk(bookingId, {
                include: [
                    { model: Customer, as: "customer" },
                    { model: Trek, as: "trek" },
                    { model: Vendor, as: "vendor" }
                ]
            });

            if (!booking) {
                throw new Error("Booking not found");
            }

            const data = {
                booking_id: booking.id,
                trek_name: booking.trek.name,
                amount: booking.final_amount,
                travelers: booking.total_travelers,
                trek_date: booking.batch?.start_date
            };

            // Send to customer
            await this.send(
                this.EVENTS.BOOKING_CONFIRMED,
                [{ userId: booking.customer_id, userType: "customer" }],
                data,
                "high"
            );

            // Send to vendor
            await this.send(
                this.EVENTS.PAYMENT_RECEIVED,
                [{ userId: booking.vendor.user_id, userType: "vendor" }],
                {
                    ...data,
                    vendor_amount: booking.final_amount - (booking.commission_amount || 0)
                },
                "normal"
            );

            // Send to admin
            const adminUsers = await User.findAll({
                where: { role: "admin", status: "active" }
            });
            
            if (adminUsers.length > 0) {
                await this.send(
                    this.EVENTS.BOOKING_CONFIRMED,
                    adminUsers.map(admin => ({ userId: admin.id, userType: "admin" })),
                    data,
                    "low"
                );
            }
        } catch (error) {
            logger.error("notification", "Booking confirmation failed", {
                error: error.message,
                bookingId
            });
        }
    }

    /**
     * Trek approval notification
     */
    async sendTrekApproval(trekId, approved, adminNotes) {
        try {
            const trek = await Trek.findByPk(trekId, {
                include: [{ model: Vendor, as: "vendor" }]
            });

            if (!trek) {
                throw new Error("Trek not found");
            }

            const event = approved ? this.EVENTS.TREK_APPROVED : this.EVENTS.TREK_REJECTED;
            const data = {
                trek_id: trek.id,
                trek_name: trek.name,
                admin_notes: adminNotes
            };

            await this.send(
                event,
                [{ userId: trek.vendor.user_id, userType: "vendor" }],
                data,
                "high"
            );
        } catch (error) {
            logger.error("notification", "Trek approval notification failed", {
                error: error.message,
                trekId
            });
        }
    }

    /**
     * Settlement notification
     */
    async sendSettlementNotification(vendorId, amount, bookingIds) {
        try {
            const vendor = await Vendor.findByPk(vendorId);
            if (!vendor) {
                throw new Error("Vendor not found");
            }

            const data = {
                amount,
                booking_count: bookingIds.length,
                booking_ids: bookingIds
            };

            await this.send(
                this.EVENTS.SETTLEMENT_PROCESSED,
                [{ userId: vendor.user_id, userType: "vendor" }],
                data,
                "high"
            );
        } catch (error) {
            logger.error("notification", "Settlement notification failed", {
                error: error.message,
                vendorId
            });
        }
    }

    /**
     * New message notification
     */
    async sendMessageNotification(recipientId, recipientType, senderName, message) {
        try {
            const data = {
                sender_name: senderName,
                message_preview: message.substring(0, 100)
            };

            await this.send(
                this.EVENTS.NEW_MESSAGE,
                [{ userId: recipientId, userType: recipientType }],
                data,
                "normal"
            );
        } catch (error) {
            logger.error("notification", "Message notification failed", {
                error: error.message,
                recipientId
            });
        }
    }

    /**
     * Get notification title based on event
     */
    getTitle(event, data) {
        const titles = {
            [this.EVENTS.BOOKING_CONFIRMED]: "Booking Confirmed! 🎉",
            [this.EVENTS.BOOKING_CANCELLED]: "Booking Cancelled",
            [this.EVENTS.PAYMENT_RECEIVED]: "Payment Received",
            [this.EVENTS.REFUND_PROCESSED]: "Refund Processed",
            [this.EVENTS.TREK_APPROVED]: "Trek Approved! ✅",
            [this.EVENTS.TREK_REJECTED]: "Trek Rejected",
            [this.EVENTS.SETTLEMENT_PROCESSED]: "Settlement Processed 💰",
            [this.EVENTS.NEW_MESSAGE]: "New Message",
            [this.EVENTS.DISPUTE_RAISED]: "Dispute Raised"
        };
        
        return titles[event] || "Notification";
    }

    /**
     * Get notification body based on event
     */
    getBody(event, data) {
        const bodies = {
            [this.EVENTS.BOOKING_CONFIRMED]: `Your booking for ${data.trek_name} is confirmed!`,
            [this.EVENTS.PAYMENT_RECEIVED]: `Payment of ₹${data.amount} received for ${data.trek_name}`,
            [this.EVENTS.TREK_APPROVED]: `Your trek "${data.trek_name}" has been approved`,
            [this.EVENTS.TREK_REJECTED]: `Your trek "${data.trek_name}" was rejected: ${data.admin_notes}`,
            [this.EVENTS.SETTLEMENT_PROCESSED]: `₹${data.amount} has been settled to your account`,
            [this.EVENTS.NEW_MESSAGE]: `${data.sender_name}: ${data.message_preview}`
        };
        
        return bodies[event] || "You have a new notification";
    }

    /**
     * Check if event is critical (requires email)
     */
    isCriticalEvent(event) {
        const criticalEvents = [
            this.EVENTS.BOOKING_CONFIRMED,
            this.EVENTS.PAYMENT_RECEIVED,
            this.EVENTS.REFUND_PROCESSED,
            this.EVENTS.SETTLEMENT_PROCESSED,
            this.EVENTS.DISPUTE_RAISED
        ];
        
        return criticalEvents.includes(event);
    }

    /**
     * Sanitize data for FCM (convert to strings)
     */
    sanitizeData(data) {
        const sanitized = {};
        for (const [key, value] of Object.entries(data)) {
            if (typeof value === "object") {
                sanitized[key] = JSON.stringify(value);
            } else {
                sanitized[key] = String(value);
            }
        }
        return sanitized;
    }
}

module.exports = new NotificationService();
