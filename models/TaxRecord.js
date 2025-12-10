module.exports = (sequelize, DataTypes) => {
    const TaxRecord = sequelize.define(
        "TaxRecord",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            sale_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "sales", key: "id" },
            },
            tax_rate: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
            tax_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
        },
        {
            tableName: "tax_records",
            underscored: true,
            timestamps: true,
        }
    );

    TaxRecord.associate = (models) => {
        TaxRecord.belongsTo(models.Sale, { foreignKey: "sale_id", as: "sale" });
    };

    return TaxRecord;
};
