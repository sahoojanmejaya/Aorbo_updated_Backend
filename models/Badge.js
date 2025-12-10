module.exports = (sequelize, DataTypes) => {
    const Badge = sequelize.define(
        "Badge",
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
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            icon: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: "Icon class or image URL for the badge",
            },
            color: {
                type: DataTypes.STRING,
                allowNull: true,
                defaultValue: "#3B82F6",
                comment: "Hex color code for the badge",
            },
            category: {
                type: DataTypes.ENUM(
                    "achievement",
                    "difficulty",
                    "special",
                    "seasonal",
                    "certification"
                ),
                allowNull: false,
                defaultValue: "achievement",
            },
            criteria: {
                type: DataTypes.JSON,
                allowNull: true,
                comment: "JSON object defining badge criteria",
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
            sort_order: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                comment: "Order for displaying badges",
            },
        },
        {
            tableName: "badges",
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            underscored: true,
        }
    );

    Badge.associate = (models) => {
        Badge.hasMany(models.Trek, {
            foreignKey: "badge_id",
            as: "treks",
        });
    };

    return Badge;
};
