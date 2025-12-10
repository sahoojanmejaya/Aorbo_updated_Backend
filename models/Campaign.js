module.exports = (sequelize, DataTypes) => {
    const Campaign = sequelize.define(
        "Campaign",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            name: { type: DataTypes.STRING, allowNull: false },
            description: { type: DataTypes.TEXT, allowNull: true },
            start_date: { type: DataTypes.DATE, allowNull: false },
            end_date: { type: DataTypes.DATE, allowNull: false },
            status: {
                type: DataTypes.ENUM("draft", "active", "paused", "completed"),
                defaultValue: "draft",
            },
        },
        {
            tableName: "campaigns",
            underscored: true,
        }
    );

    return Campaign;
};
