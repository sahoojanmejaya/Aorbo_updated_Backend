module.exports = (sequelize, DataTypes) => {
    const City = sequelize.define(
        "City",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            cityName: {
                type: DataTypes.STRING,
                allowNull: false,
                field: "city_name",
            },
            isPopular: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                field: "is_popular",
            },
            stateId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                field: "state_id",
                references: {
                    model: "states",
                    key: "id",
                },
            },
        },
        {
            tableName: "cities",
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            underscored: true,
        }
    );

    City.associate = (models) => {
        City.belongsTo(models.State, {
            foreignKey: "stateId",
            as: "state",
        });
        City.hasMany(models.BoardingPoint, {
            foreignKey: "cityId",
            as: "boardingPoints",
        });
    };

    return City;
};
