'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Check if column already exists
        const tableDescription = await queryInterface.describeTable('issue_reports');
        if (!tableDescription.disputed_amount) {
            await queryInterface.addColumn('issue_reports', 'disputed_amount', {
                type: Sequelize.DECIMAL(10, 2),
                allowNull: true,
                comment: 'Amount disputed by the customer'
            });
        }
    },

    down: async (queryInterface, Sequelize) => {
        // Remove disputed_amount column from issue_reports table
        await queryInterface.removeColumn('issue_reports', 'disputed_amount');
    }
};
