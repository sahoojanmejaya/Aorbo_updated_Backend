module.exports = (sequelize, DataTypes) => {
    const Category = sequelize.define(
        "Category",
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
            name: { type: DataTypes.STRING, allowNull: false },
        },
        {
            tableName: "categories",
            underscored: true,
        }
    );

    Category.associate = (models) => {
        Category.belongsTo(models.Trek, { foreignKey: "trek_id", as: "trek" });
    };

    return Category;
};
