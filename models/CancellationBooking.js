module.exports = (sequelize, DataTypes) => {
    const CancellationBooking = sequelize.define(
        "CancellationBooking",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            booking_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "bookings", key: "id" },
                comment: "Reference to the cancelled booking"
            },
            customer_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "customers", key: "id" },
                comment: "Reference to the customer who cancelled"
            },
            trek_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "treks", key: "id" },
                comment: "Reference to the trek that was cancelled"
            },
            batch_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "batches", key: "id" },
                comment: "Reference to the batch that was cancelled"
            },
            total_refundable_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                comment: "Total amount that will be refunded to the customer"
            },
            deduction: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true,
                defaultValue: 0.00,
                comment: "Total deduction amount"
            },
            deduction_admin: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true,
                defaultValue: 0.00,
                comment: "Admin share of deduction (50% of total deduction)"
            },
            deduction_vendor: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true,
                defaultValue: 0.00,
                comment: "Vendor share of deduction (50% of total deduction)"
            },
            status: {
                type: DataTypes.ENUM("pending", "confirmed", "processed", "completed"),
                allowNull: false,
                defaultValue: "confirmed",
                comment: "Status of the cancellation request"
            },
            reason: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: "Optional reason for cancellation provided by customer"
            },
            cancellation_date: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
                comment: "Date and time when cancellation was confirmed"
            },
            processed_date: {
                type: DataTypes.DATE,
                allowNull: true,
                comment: "Date and time when refund was processed"
            },
            refund_transaction_id: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: "Transaction ID of the refund payment"
            },
            notes: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: "Internal notes for the cancellation"
            }
        },
        {
            tableName: "cancellation_bookings",
            underscored: true,
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        }
    );

    CancellationBooking.associate = (models) => {
        CancellationBooking.belongsTo(models.Booking, {
            foreignKey: "booking_id",
            as: "booking",
        });
        CancellationBooking.belongsTo(models.Customer, {
            foreignKey: "customer_id",
            as: "customer",
        });
        CancellationBooking.belongsTo(models.Trek, {
            foreignKey: "trek_id",
            as: "trek",
        });
        CancellationBooking.belongsTo(models.Batch, {
            foreignKey: "batch_id",
            as: "batch",
        });
    };

    return CancellationBooking;
};
