module.exports = (sequelize, DataTypes) => {
    const Cancellation = sequelize.define(
        "Cancellation",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            booking_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                unique: true,
                references: { model: "bookings", key: "id" },
            },
            reason: { type: DataTypes.TEXT, allowNull: true },
            refund_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
            cancelled_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        },
        {
            tableName: "cancellations",
            underscored: true,
        }
    );

    Cancellation.associate = (models) => {
        Cancellation.belongsTo(models.Booking, {
            foreignKey: "booking_id",
            as: "booking",
        });
    };

    return Cancellation;
};
