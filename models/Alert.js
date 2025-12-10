module.exports = (sequelize, DataTypes) => {
    const Alert = sequelize.define(
        "Alert",
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
            tableName: "alerts",
            underscored: true,
            timestamps: true,
        }
    );

    return Alert;
};
