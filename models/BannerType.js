module.exports = (sequelize, DataTypes) => {
    const BannerType = sequelize.define(
        "BannerType",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            name: {
                type: DataTypes.STRING(255),
                allowNull: false,
                comment: "Banner type name (e.g., Top Treks, What's New)",
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: "Brief description of this banner type",
            },
            card_width: {
                type: DataTypes.ENUM("fixed", "fluid", "responsive"),
                allowNull: false,
                defaultValue: "fixed",
                comment: "Card width type for banner display",
            },
            card_height: {
                type: DataTypes.ENUM("fixed", "auto", "aspect-ratio"),
                allowNull: false,
                defaultValue: "fixed",
                comment: "Card height type for banner display",
            },
            order: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 1,
                comment: "Display order for banner type",
            },
            status: {
                type: DataTypes.ENUM("active", "inactive"),
                allowNull: false,
                defaultValue: "inactive",
                comment: "Status of the banner type",
            },
            start_date: {
                type: DataTypes.DATE,
                allowNull: true,
                comment: "Start date for banner type visibility",
            },
            end_date: {
                type: DataTypes.DATE,
                allowNull: true,
                comment: "End date for banner type visibility",
            },
        },
        {
            tableName: "banner_types",
            underscored: true,
            timestamps: true,
            paranoid: true, // Enables soft deletes (deleted_at)
        }
    );

    BannerType.associate = (models) => {
        // A banner type can have many banner items
        BannerType.hasMany(models.BannerItem, {
            foreignKey: "banner_type_id",
            as: "bannerItems",
        });
    };

    return BannerType;
};
