module.exports = (sequelize, DataTypes) => {
    const PaymentFailed = sequelize.define(
        "PaymentFailed",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            // Request body data fields
            order_id: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: "Razorpay order ID from request"
            },
            payment_id: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: "Razorpay payment ID from request"
            },
            signature: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: "Razorpay signature from request"
            },
            batch_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                comment: "Batch ID from request"
            },
            customer_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                comment: "Customer ID from request"
            },
            total_travelers: {
                type: DataTypes.INTEGER,
                allowNull: true,
                comment: "Number of travelers from request"
            },
            total_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true,
                comment: "Total amount from request"
            },
            final_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true,
                comment: "Final amount from request"
            },
            coupon_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                comment: "Coupon ID from request"
            },
            payment_status: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: "Payment status from request"
            },
            // Additional request data as JSON
            request_data: {
                type: DataTypes.JSON,
                allowNull: true,
                comment: "Complete request body data as JSON"
            },
            // Error details
            error_message: {
                type: DataTypes.TEXT,
                allowNull: false,
                comment: "Error message that caused the failure"
            },
            error_type: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: "SLOTS_UNAVAILABLE",
                comment: "Type of error that occurred"
            },
            // Slot availability details
            available_slots: {
                type: DataTypes.INTEGER,
                allowNull: true,
                comment: "Available slots at time of failure"
            },
            requested_slots: {
                type: DataTypes.INTEGER,
                allowNull: true,
                comment: "Requested slots that caused failure"
            },
            // Payment failed flag
            payment_failed: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
                comment: "Flag indicating payment failed"
            },
            // Timestamps
            created_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
            },
            updated_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
            },
        },
        {
            tableName: "payment_failed",
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            indexes: [
                {
                    fields: ["order_id"],
                },
                {
                    fields: ["payment_id"],
                },
                {
                    fields: ["batch_id"],
                },
                {
                    fields: ["customer_id"],
                },
                {
                    fields: ["payment_failed"],
                },
                {
                    fields: ["created_at"],
                },
            ],
        }
    );

    return PaymentFailed;
};
