module.exports = (sequelize, DataTypes) => {
    const Policy = sequelize.define(
        "Policy",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            name: { type: DataTypes.STRING, allowNull: false },
            content: { type: DataTypes.TEXT, allowNull: false },
            version: { type: DataTypes.STRING, allowNull: true },
            effective_date: { type: DataTypes.DATE, allowNull: true },
        },
        {
            tableName: "policies",
            underscored: true,
            timestamps: true,
        }
    );

    return Policy;
};
