'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Add remaining_amount column to bookings table
        const table = await queryInterface.describeTable('bookings');
        if (!table['remaining_amount']) {
            await queryInterface.addColumn('bookings', 'remaining_amount', {
                type: Sequelize.DECIMAL(10, 2),
                allowNull: true,
                defaultValue: 0.0,
                comment: 'Remaining amount to be paid'
            });
        }
    },

    down: async (queryInterface, Sequelize) => {
        // Remove the remaining_amount column
        await queryInterface.removeColumn('bookings', 'remaining_amount');
    }
};
