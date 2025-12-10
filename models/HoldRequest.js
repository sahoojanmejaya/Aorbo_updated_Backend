const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    const HoldRequest = sequelize.define("HoldRequest", {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        vendor_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: "vendors", key: "id" },
            comment: "Reference to the vendor making the request",
        },
        trek_ids: {
            type: DataTypes.JSON,
            allowNull: true,
            comment: "JSON array of trek IDs for multiple trek holds",
        },
        batch_ids: {
            type: DataTypes.JSON,
            allowNull: true,
            comment: "JSON array of batch IDs for multiple batch holds",
        },
        request_type: {
            type: DataTypes.ENUM("slot_hold", "date_hold", "capacity_hold"),
            allowNull: false,
            defaultValue: "slot_hold",
            comment: "Type of hold request",
        },
        status: {
            type: DataTypes.ENUM("pending", "approved", "rejected", "expired"),
            allowNull: false,
            defaultValue: "pending",
            comment: "Current status of the hold request",
        },
        hold_start_date: {
            type: DataTypes.DATE,
            allowNull: false,
            comment: "Start date of the hold period",
        },
        hold_end_date: {
            type: DataTypes.DATE,
            allowNull: false,
            comment: "End date of the hold period",
        },
        reason: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "Reason for the hold request",
        },
        admin_notes: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "Admin notes on the request",
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: false,
            comment: "When the hold request expires",
        },
        approved_at: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: "When the request was approved",
        },
        approved_by: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: { model: "users", key: "id" },
            comment: "Admin who approved the request",
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
        updated_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    }, {
        tableName: "hold_requests",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
    });

    HoldRequest.associate = (models) => {
        HoldRequest.belongsTo(models.Vendor, { foreignKey: "vendor_id", as: "vendor" });
        HoldRequest.belongsTo(models.User, { foreignKey: "approved_by", as: "approver" });
    };

    return HoldRequest;
}; 