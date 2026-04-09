'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const table = await queryInterface.describeTable('bookings');

        const safeAdd = async (col, def) => {
            if (!table[col]) await queryInterface.addColumn('bookings', col, def);
        };

        await safeAdd('cancellation_policy_type', {
            type: Sequelize.ENUM('flexible', 'standard'),
            allowNull: true,
            comment: 'Type of cancellation policy selected by customer'
        });
        await safeAdd('advance_amount', {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: true,
            defaultValue: 0.0,
            comment: 'Amount paid as advance payment'
        });
        await safeAdd('policy_version', {
            type: Sequelize.STRING,
            allowNull: true,
            comment: 'Version/snapshot of policy at booking time'
        });
        await safeAdd('deduction_amount', {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: true,
            comment: 'Calculated deduction amount for cancellation'
        });
        await safeAdd('refund_amount', {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: true,
            comment: 'Calculated refund amount for cancellation'
        });
        await safeAdd('cancellation_rule', {
            type: Sequelize.TEXT,
            allowNull: true,
            comment: 'Rule applied for cancellation calculation'
        });

        // Update payment_status enum to include advance_only and full_paid
        await queryInterface.changeColumn('bookings', 'payment_status', {
            type: Sequelize.ENUM(
                "pending", "partial", "completed", "failed",
                "refunded", "advance_only", "full_paid"
            ),
            allowNull: false,
            defaultValue: "pending"
        });

        // Add indexes (safe)
        const safeAddIndex = async (cols, name) => {
            try { await queryInterface.addIndex('bookings', cols, { name }); } catch (_) {}
        };
        await safeAddIndex(['cancellation_policy_type'], 'bookings_cancellation_policy_type');
        await safeAddIndex(['policy_version'], 'bookings_policy_version');
    },

    down: async (queryInterface, Sequelize) => {
        // Remove the added columns
        await queryInterface.removeColumn('bookings', 'cancellation_policy_type');
        await queryInterface.removeColumn('bookings', 'advance_amount');
        await queryInterface.removeColumn('bookings', 'policy_version');
        await queryInterface.removeColumn('bookings', 'deduction_amount');
        await queryInterface.removeColumn('bookings', 'refund_amount');
        await queryInterface.removeColumn('bookings', 'cancellation_rule');

        // Revert payment_status enum to original values
        await queryInterface.changeColumn('bookings', 'payment_status', {
            type: Sequelize.ENUM(
                "pending",
                "partial",
                "completed",
                "failed",
                "refunded"
            ),
            allowNull: false,
            defaultValue: "pending"
        });

        // Remove indexes
        await queryInterface.removeIndex('bookings', ['cancellation_policy_type']);
        await queryInterface.removeIndex('bookings', ['policy_version']);
    }
};
