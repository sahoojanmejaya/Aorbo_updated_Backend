module.exports = (sequelize, DataTypes) => {
    const PaymentLog = sequelize.define(
        "PaymentLog",
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
            },
            amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
            payment_method: { type: DataTypes.STRING, allowNull: false },
            transaction_id: { type: DataTypes.STRING, allowNull: true },
            status: {
                type: DataTypes.ENUM("pending", "success", "failed"),
                defaultValue: "pending",
            },
        },
        {
            tableName: "payment_logs",
            underscored: true,
        }
    );

    PaymentLog.associate = (models) => {
        PaymentLog.belongsTo(models.Booking, {
            foreignKey: "booking_id",
            as: "booking",
        });
    };

    return PaymentLog;
};
