module.exports = (sequelize, DataTypes) => {
    const Sale = sequelize.define(
        "Sale",
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
            sale_date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        },
        {
            tableName: "sales",
            underscored: true,
            timestamps: true,
        }
    );

    Sale.associate = (models) => {
        Sale.belongsTo(models.Booking, {
            foreignKey: "booking_id",
            as: "booking",
        });
    };

    return Sale;
};
