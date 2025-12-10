module.exports = (sequelize, DataTypes) => {
    const CancellationPolicySettings = sequelize.define(
        "CancellationPolicySettings",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            policy_type: {
                type: DataTypes.ENUM("flexible", "standard"),
                allowNull: false,
                comment: "Type of cancellation policy"
            },
            // Flexible Policy Settings
            flexible_advance_non_refundable: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
                comment: "Whether advance payment is non-refundable in flexible policy"
            },
            flexible_full_payment_24h_deduction: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 100,
                validate: {
                    min: 0,
                    max: 100
                },
                comment: "Deduction percentage for full payment within 24h (flexible policy)"
            },
            // Standard Policy Settings
            standard_72h_plus_deduction: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 20,
                validate: {
                    min: 0,
                    max: 100
                },
                comment: "Deduction percentage for 72h+ before trek (standard policy)"
            },
            standard_48_72h_deduction: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 50,
                validate: {
                    min: 0,
                    max: 100
                },
                comment: "Deduction percentage for 48-72h before trek (standard policy)"
            },
            standard_24_48h_deduction: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 70,
                validate: {
                    min: 0,
                    max: 100
                },
                comment: "Deduction percentage for 24-48h before trek (standard policy)"
            },
            standard_under_24h_deduction: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 100,
                validate: {
                    min: 0,
                    max: 100
                },
                comment: "Deduction percentage for under 24h before trek (standard policy)"
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
                comment: "Whether this policy setting is active"
            },
            created_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
            },
            updated_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
            },
        },
        {
            tableName: "cancellation_policy_settings",
            underscored: true,
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        }
    );

    CancellationPolicySettings.associate = (models) => {
        // No direct associations needed for policy settings
    };

    return CancellationPolicySettings;
};
