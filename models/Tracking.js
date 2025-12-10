module.exports = (sequelize, DataTypes) => {
    const Tracking = sequelize.define(
        "Tracking",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            assignment_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "coupon_assignments", key: "id" },
            },
            event_type: { type: DataTypes.STRING, allowNull: false },
            event_data: { type: DataTypes.JSON, allowNull: true },
            tracked_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        },
        {
            tableName: "tracking",
            underscored: true,
        }
    );

    Tracking.associate = (models) => {
        Tracking.belongsTo(models.CouponAssignment, {
            foreignKey: "assignment_id",
            as: "assignment",
        });
    };

    return Tracking;
};
