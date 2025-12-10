module.exports = (sequelize, DataTypes) => {
    const Settlement = sequelize.define(
        "Settlement",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            vendor_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "vendors", key: "id" },
            },
            period_start: { type: DataTypes.DATEONLY, allowNull: false },
            period_end: { type: DataTypes.DATEONLY, allowNull: false },
            total_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
            status: {
                type: DataTypes.ENUM("pending", "completed"),
                defaultValue: "pending",
            },
        },
        {
            tableName: "settlements",
            underscored: true,
            timestamps: true,
        }
    );

    Settlement.associate = (models) => {
        Settlement.belongsTo(models.Vendor, {
            foreignKey: "vendor_id",
            as: "vendor",
        });
    };

    return Settlement;
};
