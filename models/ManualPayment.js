module.exports = (sequelize, DataTypes) => {
    const ManualPayment = sequelize.define(
        "ManualPayment",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "users", key: "id" },
            },
            amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
            payment_date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
            description: { type: DataTypes.TEXT, allowNull: true },
        },
        {
            tableName: "manual_payments",
            underscored: true,
            timestamps: true,
        }
    );

    ManualPayment.associate = (models) => {
        ManualPayment.belongsTo(models.User, {
            foreignKey: "user_id",
            as: "user",
        });
    };

    return ManualPayment;
};
