module.exports = (sequelize, DataTypes) => {
    const ApiKey = sequelize.define(
        "ApiKey",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            key: {
                type: DataTypes.STRING,
                allowNull: false,
                // unique: true is managed via migrations to avoid duplicate indexes
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "users", key: "id" },
            },
        },
        {
            tableName: "api_keys",
            underscored: true,
            timestamps: true,
        }
    );

    ApiKey.associate = (models) => {
        ApiKey.belongsTo(models.User, { foreignKey: "user_id", as: "user" });
    };

    return ApiKey;
};
