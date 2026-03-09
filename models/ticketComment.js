module.exports = (sequelize, DataTypes) => {
    const TicketComment = sequelize.define(
        "TicketComment",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            issue_id: {
                type: DataTypes.INTEGER,
                
            },
            comment: {
                type: DataTypes.TEXT,
            },
             
        },
        {
            tableName: "ticket_comment",
            underscored: true,
        }
    );

    TicketComment.associate = (models) => {
 TicketComment.belongsTo(models.IssueReport, {
      foreignKey: "issue_id",
      as: "issue",
    });

    };

    return TicketComment;
};

