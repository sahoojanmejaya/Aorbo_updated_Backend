'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const desc = await queryInterface.describeTable('commission_logs');

        if (!desc.booking_id) {
            await queryInterface.addColumn('commission_logs', 'booking_id', {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: { model: 'bookings', key: 'id' },
            });
            console.log('Added booking_id to commission_logs');
        } else {
            console.log('booking_id already exists in commission_logs, skipping');
        }

        // Also ensure trek_id exists (belt-and-suspenders)
        if (!desc.trek_id) {
            await queryInterface.addColumn('commission_logs', 'trek_id', {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: { model: 'treks', key: 'id' },
            });
            console.log('Added trek_id to commission_logs');
        }
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('commission_logs', 'booking_id').catch(() => {});
        await queryInterface.removeColumn('commission_logs', 'trek_id').catch(() => {});
    },
};
