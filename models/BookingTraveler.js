module.exports = (sequelize, DataTypes) => {
    const BookingTraveler = sequelize.define(
        "BookingTraveler",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            booking_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "bookings", key: "id" },
            },
            traveler_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "travelers", key: "id" },
            },
            is_primary: {
                type: DataTypes.BOOLEAN,
                defaultValue: false, // Indicates if this is the primary contact for the booking
            },
            special_requirements: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            accommodation_preference: {
                type: DataTypes.ENUM("single", "shared", "family", "any"),
                defaultValue: "any",
            },
            meal_preference: {
                type: DataTypes.ENUM("veg", "non_veg", "vegan", "jain"),
                defaultValue: "veg",
            },
            status: {
                type: DataTypes.ENUM("confirmed", "cancelled", "no_show"),
                defaultValue: "confirmed",
            },
        },
        {
            tableName: "booking_travelers",
            underscored: true,
            indexes: [
                {
                    unique: true,
                    fields: ["booking_id", "traveler_id"],
                },
            ],
        }
    );

    BookingTraveler.associate = (models) => {
        BookingTraveler.belongsTo(models.Booking, {
            foreignKey: "booking_id",
            as: "booking",
        });
        BookingTraveler.belongsTo(models.Traveler, {
            foreignKey: "traveler_id",
            as: "traveler",
        });
    };

    return BookingTraveler;
};
