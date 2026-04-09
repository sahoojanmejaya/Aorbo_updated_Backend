'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const tables = await queryInterface.showAllTables();
        if (!tables.includes('cancellation_policy_settings')) {
        await queryInterface.createTable('cancellation_policy_settings', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },
            policy_type: {
                type: Sequelize.ENUM('flexible', 'standard'),
                allowNull: false,
                comment: 'Type of cancellation policy'
            },
            // Flexible Policy Settings
            flexible_advance_non_refundable: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true,
                comment: 'Whether advance payment is non-refundable in flexible policy'
            },
            flexible_full_payment_24h_deduction: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 100,
                comment: 'Deduction percentage for full payment within 24h (flexible policy)'
            },
            // Standard Policy Settings
            standard_72h_plus_deduction: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 20,
                comment: 'Deduction percentage for 72h+ before trek (standard policy)'
            },
            standard_48_72h_deduction: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 50,
                comment: 'Deduction percentage for 48-72h before trek (standard policy)'
            },
            standard_24_48h_deduction: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 70,
                comment: 'Deduction percentage for 24-48h before trek (standard policy)'
            },
            standard_under_24h_deduction: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 100,
                comment: 'Deduction percentage for under 24h before trek (standard policy)'
            },
            is_active: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true,
                comment: 'Whether this policy setting is active'
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW
            }
        });

        // Add indexes for better performance
        try { await queryInterface.addIndex('cancellation_policy_settings', ['policy_type']); } catch (_) {}
        try { await queryInterface.addIndex('cancellation_policy_settings', ['is_active']); } catch (_) {}

        // Insert default policy settings
        await queryInterface.bulkInsert('cancellation_policy_settings', [
            {
                policy_type: 'flexible',
                flexible_advance_non_refundable: true,
                flexible_full_payment_24h_deduction: 100,
                standard_72h_plus_deduction: 20,
                standard_48_72h_deduction: 50,
                standard_24_48h_deduction: 70,
                standard_under_24h_deduction: 100,
                is_active: true,
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                policy_type: 'standard',
                flexible_advance_non_refundable: true,
                flexible_full_payment_24h_deduction: 100,
                standard_72h_plus_deduction: 20,
                standard_48_72h_deduction: 50,
                standard_24_48h_deduction: 70,
                standard_under_24h_deduction: 100,
                is_active: true,
                created_at: new Date(),
                updated_at: new Date()
            }
        ]);
        }
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('cancellation_policy_settings');
    }
};
