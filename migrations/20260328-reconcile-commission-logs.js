'use strict';

/**
 * Ensure commission_logs has ALL columns the CommissionLog model expects.
 * Safe to run multiple times — skips columns that already exist.
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        const desc = await queryInterface.describeTable('commission_logs');

        const columnsToAdd = [
            { name: 'booking_id',        def: { type: Sequelize.INTEGER,       allowNull: true, references: { model: 'bookings', key: 'id' } } },
            { name: 'vendor_id',         def: { type: Sequelize.INTEGER,       allowNull: true, references: { model: 'vendors',  key: 'id' } } },
            { name: 'trek_id',           def: { type: Sequelize.INTEGER,       allowNull: true, references: { model: 'treks',    key: 'id' } } },
            { name: 'booking_amount',    def: { type: Sequelize.DECIMAL(10,2), allowNull: true } },
            { name: 'commission_rate',   def: { type: Sequelize.DECIMAL(5,2),  allowNull: true } },
            { name: 'commission_amount', def: { type: Sequelize.DECIMAL(10,2), allowNull: true } },
            { name: 'payment_reference', def: { type: Sequelize.STRING(100),   allowNull: true } },
            { name: 'paid_at',           def: { type: Sequelize.DATE,          allowNull: true } },
            { name: 'notes',             def: { type: Sequelize.TEXT,          allowNull: true } },
        ];

        for (const col of columnsToAdd) {
            if (!desc[col.name]) {
                await queryInterface.addColumn('commission_logs', col.name, col.def);
                console.log(`Added ${col.name} to commission_logs`);
            } else {
                console.log(`${col.name} already exists, skipping`);
            }
        }

        // Fix status column ENUM if it has wrong values
        if (desc.status) {
            // Can't easily alter ENUM; skip if exists
            console.log('status column exists, skipping');
        } else {
            await queryInterface.addColumn('commission_logs', 'status', {
                type: Sequelize.ENUM('pending', 'paid', 'cancelled', 'disputed'),
                allowNull: false,
                defaultValue: 'pending',
            });
            console.log('Added status to commission_logs');
        }
    },

    async down() {},
};
