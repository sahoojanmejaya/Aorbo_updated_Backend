module.exports = (sequelize, DataTypes) => {
    const BannerItem = sequelize.define(
        "BannerItem",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            banner_type_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "banner_types", key: "id" },
                comment: "Reference to the banner type this item belongs to",
            },
            title: {
                type: DataTypes.STRING(255),
                allowNull: false,
                comment: "Title of the banner item",
            },
            subtitle: {
                type: DataTypes.STRING(500),
                allowNull: true,
                comment: "Subtitle of the banner item",
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: "Description of the banner item",
            },
            description_main: {
                type: DataTypes.JSON,
                allowNull: true,
                comment: "Main descriptions array stored as JSON",
            },
            sub_description: {
                type: DataTypes.JSON,
                allowNull: true,
                comment: "Dynamic rows array stored as JSON",
            },
            icon_url: {
                type: DataTypes.STRING(500),
                allowNull: true,
                comment: "URL of the icon for the banner item",
            },
            img_url: {
                type: DataTypes.STRING(500),
                allowNull: true,
                comment: "URL of the main image for the banner item",
            },
            background_type: {
                type: DataTypes.ENUM("solid", "gradient", "image"),
                allowNull: false,
                defaultValue: "gradient",
                comment: "Type of background for the banner item",
            },
            text_color: {
                type: DataTypes.STRING(7),
                allowNull: false,
                defaultValue: "#FFFFFF",
                comment: "Hex color code for text color",
            },
            text_alignment: {
                type: DataTypes.ENUM("left", "center", "right"),
                allowNull: false,
                defaultValue: "left",
                comment: "Text alignment for the banner item",
            },
            primary_color: {
                type: DataTypes.STRING(7),
                allowNull: false,
                defaultValue: "#1E90FF",
                comment: "Primary color for the banner item",
            },
            secondary_color: {
                type: DataTypes.STRING(7),
                allowNull: true,
                comment: "Secondary color for gradient backgrounds",
            },
            background_image: {
                type: DataTypes.STRING(500),
                allowNull: true,
                comment: "URL of the background image",
            },
            button_text: {
                type: DataTypes.STRING(100),
                allowNull: true,
                defaultValue: "View More",
                comment: "Text for the call-to-action button",
            },
            link_url: {
                type: DataTypes.STRING(500),
                allowNull: true,
                comment: "URL for the call-to-action link",
            },
            priority: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 1,
                comment: "Priority/order for displaying the banner item",
            },
            status: {
                type: DataTypes.ENUM("active", "inactive"),
                allowNull: false,
                defaultValue: "active",
                comment: "Status of the banner item",
            },
            start_date: {
                type: DataTypes.DATE,
                allowNull: true,
                comment: "Start date for banner item visibility",
            },
            end_date: {
                type: DataTypes.DATE,
                allowNull: true,
                comment: "End date for banner item visibility",
            },
        },
        {
            tableName: "banner_items",
            underscored: true,
            timestamps: true,
            paranoid: true, // Enables soft deletes (deleted_at)
        }
    );

    BannerItem.associate = (models) => {
        // A banner item belongs to a banner type
        BannerItem.belongsTo(models.BannerType, {
            foreignKey: "banner_type_id",
            as: "bannerType",
        });
    };

    return BannerItem;
};
