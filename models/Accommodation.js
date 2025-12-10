module.exports = (sequelize, DataTypes) => {
    const Accommodation = sequelize.define(
        "Accommodation",
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
            batch_id: {
                type: DataTypes.INTEGER,
                allowNull: true, // Initially nullable for migration compatibility
                references: { model: "batches", key: "id" },
                comment: "Reference to specific batch - makes accommodations batch-specific",
            },
            type: { type: DataTypes.STRING, allowNull: false },
            details: {
                type: DataTypes.JSON,
                allowNull: true,
                get() {
                    const rawValue = this.getDataValue("details");
                    if (!rawValue) return {};
                    if (typeof rawValue === "object") return rawValue;
                    if (typeof rawValue === "string") {
                        try {
                            return JSON.parse(rawValue);
                        } catch (e) {
                            return {};
                        }
                    }
                    return {};
                },
            },
        },
        {
            tableName: "accommodations",
            underscored: true,
        }
    );

    Accommodation.associate = (models) => {
        Accommodation.belongsTo(models.Trek, {
            foreignKey: "trek_id",
            as: "trek",
        });
        Accommodation.belongsTo(models.Batch, {
            foreignKey: "batch_id",
            as: "batch",
        });
    };

    return Accommodation;
};
