'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const desc = await queryInterface.describeTable('commission_logs');

        if (!desc.created_at) {
            await queryInterface.addColumn('commission_logs', 'created_at', {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            });
            console.log('Added created_at to commission_logs');
        } else {
            console.log('created_at already exists, skipping');
        }

        if (!desc.updated_at) {
            await queryInterface.addColumn('commission_logs', 'updated_at', {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
            });
            console.log('Added updated_at to commission_logs');
        } else {
            console.log('updated_at already exists, skipping');
        }
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('commission_logs', 'created_at').catch(() => {});
        await queryInterface.removeColumn('commission_logs', 'updated_at').catch(() => {});
    },
};
