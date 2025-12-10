module.exports = (sequelize, DataTypes) => {
    const Rating = sequelize.define(
        "Rating",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            trek_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "treks", key: "id" },
                comment: "Reference to the trek being rated",
            },
            customer_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "customers", key: "id" },
                comment: "Reference to the customer who gave the rating",
            },
            booking_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "bookings", key: "id" },
                comment:
                    "Reference to the booking this rating is for (optional)",
            },
            batch_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "batches", key: "id" },
                comment: "Reference to the specific batch this rating is for (optional)",
            },
            rating_value: {
                type: DataTypes.DECIMAL(3, 2),
                allowNull: false,
                validate: {
                    min: 0,
                    max: 5,
                },
                comment: "Rating value (0.00 to 5.00)",
            },
            comment: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: "Optional comment for this specific rating category",
            },
            is_verified: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: "Whether this rating is from a verified booking",
            },
            title: {
                type: DataTypes.STRING(255),
                allowNull: true,
                comment: "Title of the review",
            },
            content: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: "Content of the review",
            },
            is_approved: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: "Whether this rating is approved for display",
            },
            is_hide: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: "Whether this rating is hidden from display",
            },
            is_helpful: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                comment: "Number of helpful votes for this rating",
            },
            status: {
                type: DataTypes.ENUM('pending', 'approved', 'rejected', 'spam'),
                allowNull: false,
                defaultValue: 'pending',
                comment: "Status of the rating",
            },
            // Boolean category fields - individual rating preferences
            safety_security_rated: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: "Boolean flag indicating if customer rated safety & security category",
            },
            organizer_manner_rated: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: "Boolean flag indicating if customer rated organizer manner category",
            },
            trek_planning_rated: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: "Boolean flag indicating if customer rated trek planning category",
            },
            women_safety_rated: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: "Boolean flag indicating if customer rated women safety category",
            },
            // Report column (admin use only - not populated by API)
            report: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: "Boolean flag indicating if this rating has been reported (admin use only)",
            },
        },
        {
            tableName: "ratings",
            underscored: true,
        }
    );

    Rating.associate = (models) => {
        Rating.belongsTo(models.Trek, {
            foreignKey: "trek_id",
            as: "trek",
        });
        Rating.belongsTo(models.Customer, {
            foreignKey: "customer_id",
            as: "customer",
        });
        Rating.belongsTo(models.Booking, {
            foreignKey: "booking_id",
            as: "booking",
        });
        Rating.belongsTo(models.Batch, {
            foreignKey: "batch_id",
            as: "batch",
        });
    };

    return Rating;
};
