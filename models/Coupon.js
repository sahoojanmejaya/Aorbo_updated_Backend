module.exports = (sequelize, DataTypes) => {
    const Coupon = sequelize.define(
        "Coupon",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            title: {
                type: DataTypes.STRING,
                allowNull: false,
                comment: "Display title for the coupon",
            },
            vendor_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "vendors", key: "id" },
                comment: "Reference to the vendor who created this coupon (null for admin/platform coupons)",
            },
            scope: {
                type: DataTypes.ENUM('PLATFORM', 'NORMAL', 'SPECIAL', 'PREMIUM', 'INFLUENCER'),
                allowNull: false,
                defaultValue: 'NORMAL',
                comment: 'Admin-defined coupon scope/category',
            },
            config: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: 'JSON-serialised extended config (influencer, commission, tier target, etc.)',
            },
            per_user_limit: {
                type: DataTypes.INTEGER,
                allowNull: true,
                defaultValue: 1,
                comment: 'Max times a single user can use this coupon (0 = unlimited)',
            },
            target_vendor_ids: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: 'JSON array of vendor IDs this coupon is restricted to (SPECIAL scope)',
            },
            color: {
                type: DataTypes.STRING,
                allowNull: true,
                defaultValue: "#3B82F6",
                comment: "Hex color code for UI display",
            },
            code: { type: DataTypes.STRING, allowNull: false },
            description: { type: DataTypes.STRING, allowNull: true },
            discount_type: {
                type: DataTypes.ENUM("fixed", "percentage", 'conditional', 'group'),
                allowNull: false,
            },
            discount_value: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
            },
            min_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
            max_discount_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true,
            },
            max_uses: { type: DataTypes.INTEGER, allowNull: true },
            current_uses: { type: DataTypes.INTEGER, defaultValue: 0 },
            valid_from: { type: DataTypes.DATE, allowNull: false },
            valid_until: { type: DataTypes.DATE, allowNull: false },
            status: {
                type: DataTypes.ENUM("active", "inactive", "expired"),
                defaultValue: "active",
            },
            approval_status: {
                type: DataTypes.ENUM("pending", "approved", "rejected"),
                defaultValue: "pending",
                comment: "Admin approval status for the coupon",
            },
            admin_notes: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: "Admin notes for approval/rejection",
            },
            terms_and_conditions: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: "Terms and conditions for the coupon",
            },
            assigned_trek_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "treks", key: "id" },
                comment: "Specific trek this coupon is assigned to (null for general coupons)",
            },
        },
        {
            tableName: "coupons",
            underscored: true,
            paranoid: true,
            indexes: [
                {
                    unique: true,
                    fields: ["code"],
                    name: "coupons_code_idx",
                },
                {
                    fields: ["vendor_id"],
                    name: "coupons_vendor_id_idx",
                },
                {
                    fields: ["status"],
                    name: "coupons_status_idx",
                },
                {
                    fields: ["approval_status"],
                    name: "coupons_approval_status_idx",
                },
            ],
        }
    );

    Coupon.associate = (models) => {
        Coupon.belongsTo(models.Vendor, {
            foreignKey: "vendor_id",
            as: "vendor",
        });
        Coupon.belongsTo(models.Trek, {
            foreignKey: "assigned_trek_id",
            as: "assignedTrek",
        });
        Coupon.belongsToMany(models.Customer, {
            through: models.CouponAssignment,
            foreignKey: "coupon_id",
            otherKey: "customer_id",
            as: "customers",
        });
    };

    return Coupon;
};
