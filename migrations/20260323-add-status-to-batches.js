'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const table = await queryInterface.describeTable('batches');
        if (!table.status) {
            await queryInterface.addColumn('batches', 'status', {
                type: Sequelize.ENUM('active', 'completed', 'cancelled'),
                allowNull: false,
                defaultValue: 'active',
                after: 'captain_id',
            });
        }

        // Mark any existing batch whose end_date is in the past as completed
        await queryInterface.sequelize.query(`
            UPDATE batches
            SET status = 'completed'
            WHERE end_date < CURDATE()
              AND status = 'active'
        `);
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('batches', 'status');
        await queryInterface.sequelize.query("DROP TYPE IF EXISTS `enum_batches_status`");
    },
};
