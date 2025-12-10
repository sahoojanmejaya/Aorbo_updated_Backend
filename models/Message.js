module.exports = (sequelize, DataTypes) => {
    const Message = sequelize.define(
        "Message",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            chat_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: "chats",
                    key: "id",
                },
            },
            sender_type: {
                type: DataTypes.ENUM("admin", "customer"),
                allowNull: false,
            },
            sender_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                comment: "ID of admin user or customer",
            },
            message: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            message_type: {
                type: DataTypes.ENUM("text", "image", "file"),
                defaultValue: "text",
            },
            attachment_url: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            is_read: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
            },
            read_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        {
            tableName: "messages",
            underscored: true,
        }
    );

    Message.associate = (models) => {
        Message.belongsTo(models.Chat, {
            foreignKey: "chat_id",
            as: "chat",
        });
    };

    return Message;
};
