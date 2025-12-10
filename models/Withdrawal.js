module.exports = (sequelize, DataTypes) => {
    const Withdrawal = sequelize.define(
        "Withdrawal",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            withdrawal_id: {
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: true,
                comment: "Auto-generated withdrawal ID in format WD-YYYY-MM-DD-XXXX",
                defaultValue: function () {
                    // Generate withdrawal ID: WD + current year + current month + current date + 4-digit sequence
                    const now = new Date();
                    const year = now.getFullYear();
                    const month = String(now.getMonth() + 1).padStart(2, '0');
                    const date = String(now.getDate()).padStart(2, '0');
                    const timestamp = Date.now().toString().slice(-4);
                    return `WD-${year}-${month}-${date}-${timestamp}`;
                },
            },
            vendor_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "vendors", key: "id" },
                comment: "Reference to the vendor making the withdrawal",
            },
            amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                comment: "Withdrawal amount",
            },
            tbrs_count: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                comment: "Number of TBRs included in this withdrawal",
            },
            status: {
                type: DataTypes.ENUM("pending", "completed", "rejected"),
                allowNull: false,
                defaultValue: "pending",
                comment: "Withdrawal status",
            },
            notes: {
                type: DataTypes.STRING(255),
                allowNull: true,
                comment: "Auto-generated notes based on status",
            },
            rejected_reason: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: "Reason for rejection if status is rejected",
            },
            withdrawal_date: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
                comment: "Date when withdrawal was requested",
            },
            status_change_date: {
                type: DataTypes.DATE,
                allowNull: true,
                comment: "Date when status was last changed",
            },
        },
        {
            tableName: "withdrawals",
            underscored: true,
            hooks: {
                beforeSave: (withdrawal) => {
                    // Auto-generate notes based on status
                    if (withdrawal.status === 'completed') {
                        withdrawal.notes = 'Transferred to bank account';
                    } else if (withdrawal.status === 'rejected') {
                        withdrawal.notes = 'Request rejected';
                    } else if (withdrawal.status === 'pending') {
                        withdrawal.notes = 'Payment is being processed';
                    }

                    // Update status_change_date when status changes
                    if (withdrawal.changed('status')) {
                        withdrawal.status_change_date = new Date();
                    }
                }
            }
        }
    );

    Withdrawal.associate = (models) => {
        Withdrawal.belongsTo(models.Vendor, {
            foreignKey: "vendor_id",
            as: "vendor",
        });
    };

    return Withdrawal;
};