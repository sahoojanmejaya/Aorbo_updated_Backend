module.exports = (sequelize, DataTypes) => {
    const WithdrawalLog = sequelize.define(
        "WithdrawalLog",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            request_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "withdrawal_requests", key: "id" },
            },
            status: {
                type: DataTypes.ENUM("pending", "processed", "failed"),
                allowNull: false,
            },
            amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
            processed_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
            note: { type: DataTypes.TEXT, allowNull: true },
        },
        {
            tableName: "withdrawal_logs",
            underscored: true,
            timestamps: true,
        }
    );

    WithdrawalLog.associate = (models) => {
        WithdrawalLog.belongsTo(models.WithdrawalRequest, {
            foreignKey: "request_id",
            as: "request",
        });
    };

    return WithdrawalLog;
};
