module.exports = (sequelize, DataTypes) => {
    const Mapping = sequelize.define(
        "Mapping",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            trekId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                field: "trek_id",
                references: {
                    model: "treks",
                    key: "id",
                },
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
            mappingType: {
                type: DataTypes.ENUM("pickup", "destination", "route"),
                allowNull: false,
                field: "mapping_type",
                defaultValue: "pickup",
            },
            distance: {
                type: DataTypes.DECIMAL(8, 2), // Distance in KM
                defaultValue: 0,
            },
            travelTime: {
                type: DataTypes.STRING, // e.g., "2h 30m"
                field: "travel_time",
            },
            transportMode: {
                type: DataTypes.ENUM("bus", "train", "flight", "car", "mixed"),
                field: "transport_mode",
                defaultValue: "bus",
            },
            isActive: {
                type: DataTypes.BOOLEAN,
                defaultValue: true,
                field: "is_active",
            },
            priority: {
                type: DataTypes.INTEGER,
                defaultValue: 1, // 1 = highest priority
            },
            notes: {
                type: DataTypes.TEXT,
            },
        },
        {
            tableName: "mappings",
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            underscored: true,
        }
    );

    Mapping.associate = (models) => {
        Mapping.belongsTo(models.City, {
            foreignKey: "cityId",
            as: "city",
        });
        Mapping.belongsTo(models.Trek, {
            foreignKey: "trekId",
            as: "trek",
        });
    };

    return Mapping;
};
