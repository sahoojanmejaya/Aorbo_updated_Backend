module.exports = (sequelize, DataTypes) => {
    const Adjustment = sequelize.define(
        "Adjustment",
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
            type: {
                type: DataTypes.ENUM("refund", "additional_charge", "discount"),
                allowNull: false,
            },
            reason: { type: DataTypes.TEXT, allowNull: true },
        },
        {
            tableName: "adjustments",
            underscored: true,
        }
    );

    Adjustment.associate = (models) => {
        Adjustment.belongsTo(models.Booking, {
            foreignKey: "booking_id",
            as: "booking",
        });
    };

    return Adjustment;
};
