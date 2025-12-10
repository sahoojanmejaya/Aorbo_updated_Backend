module.exports = (sequelize, DataTypes) => {
    const Traveler = sequelize.define(
        "Traveler",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            customer_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "customers", key: "id" },
            },
            name: {
                type: DataTypes.STRING(100),
                allowNull: false,
            },
            age: {
                type: DataTypes.INTEGER,
                allowNull: false,
                validate: { min: 1, max: 120 },
            },
            gender: {
                type: DataTypes.ENUM("male", "female", "other"),
                allowNull: false,
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                defaultValue: true,
            },
        },
        {
            tableName: "travelers",
            underscored: true,
        }
    );

    Traveler.associate = (models) => {
        Traveler.belongsTo(models.Customer, {
            foreignKey: "customer_id",
            as: "customer",
        });
        Traveler.hasMany(models.BookingTraveler, {
            foreignKey: "traveler_id",
            as: "bookingTravelers",
        });
    };

    return Traveler;
};
