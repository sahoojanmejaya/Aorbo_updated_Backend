module.exports = (sequelize, DataTypes) => {
    const ItineraryItem = sequelize.define(
        "ItineraryItem",
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
            },
            activities: {
                type: DataTypes.JSON,
                allowNull: true,
                get() {
                    const rawValue = this.getDataValue("activities");
                    if (!rawValue) return [];
                    if (Array.isArray(rawValue)) return rawValue;
                    if (typeof rawValue === "string") {
                        try {
                            const parsed = JSON.parse(rawValue);
                            return Array.isArray(parsed) ? parsed : [];
                        } catch (e) {
                            return [];
                        }
                    }
                    return [];
                },
            },
        },
        {
            tableName: "itinerary_items",
            underscored: true,
        }
    );

    ItineraryItem.associate = (models) => {
        ItineraryItem.belongsTo(models.Trek, {
            foreignKey: "trek_id",
            as: "trek",
        });
    };

    return ItineraryItem;
};
