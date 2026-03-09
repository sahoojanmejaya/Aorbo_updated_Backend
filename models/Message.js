module.exports = (sequelize, DataTypes) => {
    const Message = sequelize.define(
        "Message",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
          
            sender_type: {
                type: DataTypes.ENUM("admin", "customer"),
            
            },
            sender_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                comment: "ID of admin user or customer",
            },
            
       receiver_id: {
        type: DataTypes.INTEGER,
       },
            message: {
                type: DataTypes.TEXT,
                
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
            file_url: {
                type: DataTypes.STRING,
               
            },
        },
        {
            tableName: "messages",
            underscored: true,
        }
    );

    Message.associate = (models) => {
      //  Message.belongsTo(models.Chat, {
         //  foreignKey: "chat_id",
         //   as: "chat",
        //});
    };

    return Message;
};
