'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Add age and gender columns
        await queryInterface.addColumn('customers', 'age', {
            type: Sequelize.INTEGER,
            allowNull: true,
            validate: {
                min: 1,
                max: 120,
            },
        });

        await queryInterface.addColumn('customers', 'gender', {
            type: Sequelize.ENUM('Male', 'Female', 'Other'),
            allowNull: true,
        });

        // Remove date_of_birth column
        await queryInterface.removeColumn('customers', 'date_of_birth');
    },

    down: async (queryInterface, Sequelize) => {
        // Add back date_of_birth column
        await queryInterface.addColumn('customers', 'date_of_birth', {
            type: Sequelize.DATEONLY,
            allowNull: true,
        });

        // Remove age and gender columns
        await queryInterface.removeColumn('customers', 'age');
        await queryInterface.removeColumn('customers', 'gender');
    }
};
