module.exports = (sequelize, DataTypes) => {
    const Activity = sequelize.define(
        "Activity",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
                collate: "utf8mb4_unicode_ci",
            },
            category_name: {
                type: DataTypes.STRING,
                allowNull: false,
                collate: "utf8mb4_unicode_ci",
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
        },
        {
            tableName: "activities",
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            underscored: true,
        }
    );

    Activity.associate = (models) => {
        // Add associations here if needed in the future
        // For example, if activities are linked to treks or other entities
    };

    return Activity;
};
