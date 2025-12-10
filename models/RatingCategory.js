module.exports = (sequelize, DataTypes) => {
    const RatingCategory = sequelize.define(
        "RatingCategory",
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
                comment:
                    "Name of the rating category (e.g., Safety and Security, Organizer Manner, etc.)",
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: "Description of what this category measures",
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
                comment:
                    "Whether this category is active and can be used for ratings",
            },
            sort_order: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                comment: "Order in which categories should be displayed",
            },
        },
        {
            tableName: "rating_categories",
            underscored: true,
        }
    );

    RatingCategory.associate = (models) => {
        // No associations needed - RatingCategory is no longer used
    };

    return RatingCategory;
};
