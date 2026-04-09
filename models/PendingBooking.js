module.exports = (sequelize, DataTypes) => {
    const PendingBooking = sequelize.define(
        "PendingBooking",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            order_id: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
                comment: "Razorpay order ID"
            },
            customer_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "customers", key: "id" }
            },
            batch_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "batches", key: "id" }
            },
            trek_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "treks", key: "id" }
            },
            vendor_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "vendors", key: "id" }
            },
            traveler_count: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            travelers: {
                type: DataTypes.JSON,
                allowNull: false,
                comment: "Array of traveler details"
            },
            fare_data: {
                type: DataTypes.JSON,
                allowNull: false,
                comment: "Encrypted fare calculation data"
            },
            amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false
            },
            status: {
                type: DataTypes.ENUM("pending", "completed", "expired", "failed"),
                defaultValue: "pending"
            },
            booking_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                comment: "Created booking ID after payment verification"
            },
            expires_at: {
                type: DataTypes.DATE,
                allowNull: false,
                comment: "Booking session expiry (15 minutes)"
            }
        },
        {
            tableName: "pending_bookings",
            timestamps: true,
            underscored: true,
            indexes: [
                { fields: ["order_id"] },
                { fields: ["customer_id"] },
                { fields: ["status"] },
                { fields: ["expires_at"] }
            ]
        }
    );

    return PendingBooking;
};
