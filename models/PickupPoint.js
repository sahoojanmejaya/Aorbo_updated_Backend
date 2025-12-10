const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    const PickupPoint = sequelize.define("PickupPoint", {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: "Name of the pickup point",
        },
        city_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: "cities", key: "id" },
            comment: "Reference to the city",
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
        updated_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    }, {
        tableName: "boarding_points", // Map to boarding_points table
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
    });

    PickupPoint.associate = (models) => {
        PickupPoint.belongsTo(models.City, { foreignKey: "city_id", as: "city" });
    };

    return PickupPoint;
}; 