module.exports = (sequelize, DataTypes) => {
    const ScheduledMessage = sequelize.define(
        "ScheduledMessage",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            type: {
                type: DataTypes.ENUM("alert", "email", "push"),
                allowNull: false,
            },
            content: { type: DataTypes.JSON, allowNull: false },
            scheduled_at: { type: DataTypes.DATE, allowNull: false },
            status: {
                type: DataTypes.ENUM("pending", "sent", "canceled"),
                defaultValue: "pending",
            },
        },
        {
            tableName: "scheduled_messages",
            underscored: true,
            timestamps: true,
        }
    );

    return ScheduledMessage;
};
