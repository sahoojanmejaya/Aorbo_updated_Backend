module.exports = (sequelize, DataTypes) => {
    const PushNotification = sequelize.define(
        "PushNotification",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            title: { type: DataTypes.STRING, allowNull: false },
            message: { type: DataTypes.TEXT, allowNull: false },
        },
        {
            tableName: "push_notifications",
            underscored: true,
            timestamps: true,
        }
    );

    return PushNotification;
};
