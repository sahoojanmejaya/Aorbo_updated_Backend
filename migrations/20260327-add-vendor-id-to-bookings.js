'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const tableDescription = await queryInterface.describeTable('bookings');

        if (!tableDescription.vendor_id) {
            await queryInterface.addColumn('bookings', 'vendor_id', {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: { model: 'vendors', key: 'id' },
                after: 'trek_id'
            });
            console.log('Added vendor_id column to bookings table');
        } else {
            console.log('vendor_id already exists in bookings table, skipping');
        }
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('bookings', 'vendor_id');
    }
};
