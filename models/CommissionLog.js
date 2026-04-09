/**
 * CommissionLog Model
 * 
 * @description Sequelize model for commission tracking
 * @author Kiro AI Assistant
 * @created 2026-03-09 16:26:00 IST
 * @updated 2026-03-09 16:26:00 IST
 */

module.exports = (sequelize, DataTypes) => {
    const CommissionLog = sequelize.define(
        "CommissionLog",
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
                comment: "Reference to the vendor earning commission",
            },
            booking_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "bookings", key: "id" },
                comment: "Reference to the booking generating commission",
            },
            trek_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "treks", key: "id" },
                comment: "Reference to the trek",
            },
            booking_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                comment: "Total booking amount",
            },
            commission_rate: {
                type: DataTypes.DECIMAL(5, 2),
                allowNull: false,
                comment: "Commission rate percentage",
            },
            commission_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                comment: "Calculated commission amount",
            },
            status: {
                type: DataTypes.ENUM('pending', 'paid', 'cancelled', 'disputed'),
                allowNull: false,
                defaultValue: 'pending',
                comment: "Commission payment status",
            },
            payment_reference: {
                type: DataTypes.STRING(100),
                allowNull: true,
                comment: "Payment reference number when paid",
            },
            paid_at: {
                type: DataTypes.DATE,
                allowNull: true,
                comment: "When the commission was paid",
            },
            notes: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: "Additional notes about the commission",
            }
        },
        {
            tableName: "commission_logs",
            timestamps: true,
            underscored: true,
        }
    );

    CommissionLog.associate = (models) => {
        CommissionLog.belongsTo(models.Vendor, {
            foreignKey: "vendor_id",
            as: "vendor",
        });
        CommissionLog.belongsTo(models.Booking, {
            foreignKey: "booking_id",
            as: "booking",
        });
        CommissionLog.belongsTo(models.Trek, {
            foreignKey: "trek_id",
            as: "trek",
        });
    };

    return CommissionLog;
};