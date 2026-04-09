module.exports = (sequelize, DataTypes) => {
    const CouponUsage = sequelize.define(
        "CouponUsage",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            coupon_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "coupons", key: "id" }
            },
            customer_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "customers", key: "id" }
            },
            booking_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "bookings", key: "id" }
            },
            discount_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false
            },
            used_at: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW
            }
        },
        {
            tableName: "coupon_usages",
            timestamps: true,
            underscored: true,
            indexes: [
                { fields: ["coupon_id"] },
                { fields: ["customer_id"] },
                { fields: ["booking_id"] },
                { fields: ["coupon_id", "customer_id"] }
            ]
        }
    );

    return CouponUsage;
};
