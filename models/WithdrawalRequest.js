module.exports = (sequelize, DataTypes) => {
    const WithdrawalRequest = sequelize.define(
        "WithdrawalRequest",
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
            status: {
                type: DataTypes.ENUM("pending", "approved", "rejected"),
                defaultValue: "pending",
            },
            requested_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
            processed_at: { type: DataTypes.DATE, allowNull: true },
        },
        {
            tableName: "withdrawal_requests",
            underscored: true,
            timestamps: true,
        }
    );

    WithdrawalRequest.associate = (models) => {
        WithdrawalRequest.belongsTo(models.User, {
            foreignKey: "user_id",
            as: "user",
        });
        WithdrawalRequest.hasMany(models.WithdrawalLog, {
            foreignKey: "request_id",
            as: "logs",
        });
    };

    return WithdrawalRequest;
};
