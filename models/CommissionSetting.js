module.exports = (sequelize, DataTypes) => {
    const CommissionSetting = sequelize.define(
        "CommissionSetting",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            vendor_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "vendors", key: "id" }
            },
            commission_type: {
                type: DataTypes.ENUM("percentage", "fixed"),
                allowNull: false,
                defaultValue: "percentage"
            },
            commission_value: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                comment: "Percentage (0-100) or fixed amount"
            },
            effective_from: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            },
            effective_until: {
                type: DataTypes.DATE,
                allowNull: true,
                comment: "Null means indefinite"
            },
            status: {
                type: DataTypes.ENUM("active", "inactive"),
                defaultValue: "active"
            },
            created_by_admin_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "users", key: "id" }
            },
            notes: {
                type: DataTypes.TEXT,
                allowNull: true
            }
        },
        {
            tableName: "commission_settings",
            timestamps: true,
            underscored: true,
            indexes: [
                { fields: ["vendor_id"] },
                { fields: ["status"] },
                { fields: ["effective_from"] }
            ]
        }
    );

    return CommissionSetting;
};
