module.exports = (sequelize, DataTypes) => {
    const Settlement = sequelize.define(
        "Settlement",
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
            booking_ids: {
                type: DataTypes.JSON,
                allowNull: false,
                comment: "Array of booking IDs included in this settlement"
            },
            total_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                comment: "Total booking amount"
            },
            commission_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                comment: "Platform commission deducted"
            },
            payout_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                comment: "Amount paid to vendor"
            },
            settlement_date: {
                type: DataTypes.DATE,
                allowNull: false
            },
            status: {
                type: DataTypes.ENUM("pending", "processing", "processed", "failed"),
                defaultValue: "pending"
            },
            payout_method: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: "Bank transfer, Razorpay payout, etc."
            },
            payout_reference: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: "External payout reference ID"
            },
            processed_by: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "users", key: "id" }
            },
            processed_at: {
                type: DataTypes.DATE,
                allowNull: true
            },
            notes: {
                type: DataTypes.TEXT,
                allowNull: true
            }
        },
        {
            tableName: "settlements",
            timestamps: true,
            underscored: true,
            indexes: [
                { fields: ["vendor_id"] },
                { fields: ["status"] },
                { fields: ["settlement_date"] }
            ]
        }
    );

    return Settlement;
};
