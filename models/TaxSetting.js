module.exports = (sequelize, DataTypes) => {
    const TaxSetting = sequelize.define(
        "TaxSetting",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            tax_name: {
                type: DataTypes.STRING,
                allowNull: false,
                comment: "e.g., GST, Service Tax"
            },
            tax_type: {
                type: DataTypes.ENUM("percentage", "fixed"),
                allowNull: false,
                defaultValue: "percentage"
            },
            tax_value: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false
            },
            vendor_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "vendors", key: "id" },
                comment: "Null for platform-wide taxes"
            },
            status: {
                type: DataTypes.ENUM("active", "inactive"),
                defaultValue: "active"
            },
            effective_from: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            },
            effective_until: {
                type: DataTypes.DATE,
                allowNull: true
            }
        },
        {
            tableName: "tax_settings",
            timestamps: true,
            underscored: true,
            indexes: [
                { fields: ["vendor_id"] },
                { fields: ["status"] }
            ]
        }
    );

    return TaxSetting;
};
