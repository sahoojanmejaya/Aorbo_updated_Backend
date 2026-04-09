'use strict';

/**
 * Fix commission_logs table:
 * - If it doesn't exist, create it with the correct schema
 * - If it exists with old columns (total_amount, commission_percentage, vendor_amount),
 *   add the new required columns (vendor_id, trek_id, booking_amount, commission_rate)
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        const tables = await queryInterface.showAllTables();

        if (!tables.includes('commission_logs')) {
            // Table doesn't exist — create it fresh
            console.log('Creating commission_logs table...');
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
            console.log('commission_logs table created.');
        } else {
            // Table exists — add missing columns if needed
            console.log('commission_logs table exists, checking columns...');
            const desc = await queryInterface.describeTable('commission_logs');

            if (!desc.vendor_id) {
                await queryInterface.addColumn('commission_logs', 'vendor_id', {
                    type: Sequelize.INTEGER,
                    allowNull: true, // allow null to not break existing rows
                    references: { model: 'vendors', key: 'id' },
                });
                console.log('Added vendor_id to commission_logs');
            }
            if (!desc.trek_id) {
                await queryInterface.addColumn('commission_logs', 'trek_id', {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    references: { model: 'treks', key: 'id' },
                });
                console.log('Added trek_id to commission_logs');
            }
            if (!desc.booking_amount) {
                await queryInterface.addColumn('commission_logs', 'booking_amount', {
                    type: Sequelize.DECIMAL(10, 2),
                    allowNull: true,
                });
                console.log('Added booking_amount to commission_logs');
            }
            if (!desc.commission_rate) {
                await queryInterface.addColumn('commission_logs', 'commission_rate', {
                    type: Sequelize.DECIMAL(5, 2),
                    allowNull: true,
                });
                console.log('Added commission_rate to commission_logs');
            }
            if (!desc.commission_amount) {
                await queryInterface.addColumn('commission_logs', 'commission_amount', {
                    type: Sequelize.DECIMAL(10, 2),
                    allowNull: true,
                });
                console.log('Added commission_amount to commission_logs');
            }
            if (!desc.status) {
                await queryInterface.addColumn('commission_logs', 'status', {
                    type: Sequelize.ENUM('pending', 'paid', 'cancelled', 'disputed'),
                    allowNull: false,
                    defaultValue: 'pending',
                });
                console.log('Added status to commission_logs');
            }
            console.log('commission_logs schema check done.');
        }
    },

    async down(queryInterface) {
        // Only drop if we created it; otherwise just remove added columns
        await queryInterface.dropTable('commission_logs').catch(() => {});
    },
};
