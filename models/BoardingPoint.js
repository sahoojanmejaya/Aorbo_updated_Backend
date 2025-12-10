module.exports = (sequelize, DataTypes) => {
    const BoardingPoint = sequelize.define(
        "BoardingPoint",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
                field: "name",
            },
            cityId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                field: "city_id",
                references: {
                    model: "cities",
                    key: "id",
                },
            },
        },
        {
            tableName: "boarding_points",
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            underscored: true,
        }
    );

    BoardingPoint.associate = (models) => {
        BoardingPoint.belongsTo(models.City, {
            foreignKey: "cityId",
            as: "city",
        });
    };

    return BoardingPoint;
};
