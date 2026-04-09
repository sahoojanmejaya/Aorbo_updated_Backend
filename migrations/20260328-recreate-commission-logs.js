'use strict';

/**
 * The commission_logs table was originally created for a different purpose
 * (influencer coupon audit trail) with id as varchar(50) PRIMARY KEY.
 * This causes duplicate primary key errors on the second booking.
 *
 * This migration renames the old table and creates a fresh one with the
 * correct schema matching the CommissionLog Sequelize model.
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Rename old table as backup (don't drop in case data is needed)
        try {
            await queryInterface.renameTable('commission_logs', 'commission_logs_old_backup');
            console.log('Renamed commission_logs to commission_logs_old_backup');
        } catch (e) {
            console.log('Could not rename (may not exist):', e.message);
        }

        // Create fresh table with correct schema
        await queryInterface.createTable('commission_logs', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            vendor_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'vendors', key: 'id' },
            },
            booking_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'bookings', key: 'id' },
            },
            trek_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'treks', key: 'id' },
            },
            booking_amount: {
                type: Sequelize.DECIMAL(10, 2),
                allowNull: false,
            },
            commission_rate: {
                type: Sequelize.DECIMAL(5, 2),
                allowNull: false,
            },
            commission_amount: {
                type: Sequelize.DECIMAL(10, 2),
                allowNull: false,
            },
            status: {
                type: Sequelize.ENUM('pending', 'paid', 'cancelled', 'disputed'),
                allowNull: false,
                defaultValue: 'pending',
            },
            payment_reference: {
                type: Sequelize.STRING(100),
                allowNull: true,
            },
            paid_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            notes: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
        });

        console.log('Created new commission_logs table with correct schema.');
    },

    async down(queryInterface) {
        await queryInterface.dropTable('commission_logs').catch(() => {});
        try {
            await queryInterface.renameTable('commission_logs_old_backup', 'commission_logs');
        } catch (e) {}
    },
};
