module.exports = (sequelize, DataTypes) => {
    const Chat = sequelize.define(
        "Chat",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            customer_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: "customers",
                    key: "id",
                },
            },
            admin_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: "users",
                    key: "id",
                },
                comment: "Admin user assigned to this chat",
            },
            status: {
                type: DataTypes.ENUM("active", "closed", "archived"),
                defaultValue: "active",
            },
            last_message_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            unread_customer_count: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
                comment: "Unread messages count for customer",
            },
            unread_admin_count: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
                comment: "Unread messages count for admin",
            },
             
    
        },
        {
            tableName: "chats",
            underscored: true,
        }
    );

    Chat.associate = (models) => {
        Chat.belongsTo(models.Customer, {
            foreignKey: "customer_id",
            as: "customer",
        });
        Chat.belongsTo(models.User, {
            foreignKey: "admin_id",
            as: "admin",
        });
       // Chat.hasMany(models.Message, {
         //   foreignKey: "chat_id",
         //   as: "messages",
        //});
    };

    return Chat;
};
