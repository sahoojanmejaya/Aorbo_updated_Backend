/**
 * CouponRedemption Model
 * 
 * @description Sequelize model for coupon redemption tracking
 * @author Kiro AI Assistant
 * @created 2026-03-09 16:25:00 IST
 * @updated 2026-03-09 16:25:00 IST
 */

module.exports = (sequelize, DataTypes) => {
    const CouponRedemption = sequelize.define(
        "CouponRedemption",
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
                comment: "Reference to the redeemed coupon",
            },
            customer_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "customers", key: "id" },
                comment: "Reference to the customer who redeemed the coupon",
            },
            booking_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "bookings", key: "id" },
                comment: "Reference to the booking where coupon was used",
            },
            discount_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                comment: "Actual discount amount applied",
            },
            original_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                comment: "Original amount before discount",
            },
            final_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                comment: "Final amount after discount",
            },
            status: {
                type: DataTypes.ENUM('pending', 'used', 'expired', 'cancelled'),
                allowNull: false,
                defaultValue: 'pending',
                comment: "Redemption status",
            },
            redeemed_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
                comment: "When the coupon was redeemed",
            },
            used_at: {
                type: DataTypes.DATE,
                allowNull: true,
                comment: "When the coupon was actually used/applied",
            },
            notes: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: "Additional notes about the redemption",
            }
        },
        {
            tableName: "coupon_redemptions",
            timestamps: true,
            underscored: true,
        }
    );

    CouponRedemption.associate = (models) => {
        CouponRedemption.belongsTo(models.Coupon, {
            foreignKey: "coupon_id",
            as: "coupon",
        });
        CouponRedemption.belongsTo(models.Customer, {
            foreignKey: "customer_id",
            as: "customer",
        });
        CouponRedemption.belongsTo(models.Booking, {
            foreignKey: "booking_id",
            as: "booking",
        });
    };

    return CouponRedemption;
};