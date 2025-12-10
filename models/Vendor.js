module.exports = (sequelize, DataTypes) => {
    const Vendor = sequelize.define(
        "Vendor",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "users", key: "id" },
            },
            company_info: {
                type: DataTypes.JSON,
                allowNull: true,
            },
            status: {
                type: DataTypes.ENUM("active", "inactive", "suspended"),
                defaultValue: "inactive",
            },
            // Personal Information
            address: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            // Business Information
            business_name: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            business_type: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            business_entity: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            business_address: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            gstin: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            // Bank Details
            account_holder_name: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            bank_name: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            ifsc_code: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            account_number: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            // Document paths
            pan_card_path: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            id_proof_path: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            cancelled_cheque_path: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            gstin_certificate_path: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            msme_certificate_path: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            shop_establishment_path: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            // Document verification status
            pan_card_verified: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
            },
            id_proof_verified: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
            },
            cancelled_cheque_verified: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
            },
            gstin_certificate_verified: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
            },
            msme_certificate_verified: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
            },
            shop_establishment_verified: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
            },
            // KYC Status
            kyc_status: {
                type: DataTypes.ENUM("pending", "in_progress", "completed", "rejected"),
                defaultValue: "pending",
            },
            kyc_step: {
                type: DataTypes.INTEGER,
                defaultValue: 1,
            },
        },
        {
            tableName: "vendors",
            underscored: true,
        }
    );

    Vendor.associate = (models) => {
        Vendor.belongsTo(models.User, { foreignKey: "user_id", as: "user" });
        Vendor.hasMany(models.Trek, { foreignKey: "vendor_id", as: "treks" });
        Vendor.hasMany(models.Coupon, { foreignKey: "vendor_id", as: "coupons" });
        Vendor.hasMany(models.Withdrawal, { foreignKey: "vendor_id", as: "withdrawals" });
    };

    return Vendor;
};
