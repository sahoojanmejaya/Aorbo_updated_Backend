'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const tables = await queryInterface.showAllTables();
        if (!tables.includes('refund_settings')) {
        await queryInterface.createTable('refund_settings', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },
            seven_days_percentage: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 90,
                validate: {
                    min: 0,
                    max: 100
                }
            },
            three_days_percentage: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 50,
                validate: {
                    min: 0,
                    max: 100
                }
            },
            twenty_four_hours_percentage: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 10,
                validate: {
                    min: 0,
                    max: 100
                }
            },
            is_active: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true
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
        try { await queryInterface.addIndex('refund_settings', ['is_active']); } catch (_) {}
        try { await queryInterface.addIndex('refund_settings', ['created_at']); } catch (_) {}

        // Insert default refund settings
        await queryInterface.bulkInsert('refund_settings', [{
            seven_days_percentage: 90,
            three_days_percentage: 50,
            twenty_four_hours_percentage: 10,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
        }]);
        }
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('refund_settings');
    }
};







