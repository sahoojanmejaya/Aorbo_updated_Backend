module.exports = (sequelize, DataTypes) => {
    const SafetyGuideline = sequelize.define(
        "SafetyGuideline",
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
            guideline: { type: DataTypes.TEXT, allowNull: false },
        },
        {
            tableName: "safety_guidelines",
            underscored: true,
        }
    );

    SafetyGuideline.associate = (models) => {
        SafetyGuideline.belongsTo(models.Trek, {
            foreignKey: "trek_id",
            as: "trek",
        });
    };

    return SafetyGuideline;
};
