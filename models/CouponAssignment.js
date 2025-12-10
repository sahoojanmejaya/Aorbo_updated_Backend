module.exports = (sequelize, DataTypes) => {
    const CouponAssignment = sequelize.define(
        "CouponAssignment",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            coupon_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "coupons", key: "id" },
            },
            customer_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "customers", key: "id" },
            },
            booking_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "bookings", key: "id" },
                comment: "Booking where this coupon was applied",
            },
            assigned_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
            used_at: { type: DataTypes.DATE, allowNull: true },
        },
        {
            tableName: "coupon_assignments",
            underscored: true,
        }
    );

    CouponAssignment.associate = (models) => {
        CouponAssignment.belongsTo(models.Coupon, {
            foreignKey: "coupon_id",
            as: "coupon",
        });
        CouponAssignment.belongsTo(models.Customer, {
            foreignKey: "customer_id",
            as: "customer",
        });
        CouponAssignment.belongsTo(models.Booking, {
            foreignKey: "booking_id",
            as: "booking",
        });
        CouponAssignment.hasMany(models.Tracking, {
            foreignKey: "assignment_id",
            as: "tracking",
        });
    };

    return CouponAssignment;
};
