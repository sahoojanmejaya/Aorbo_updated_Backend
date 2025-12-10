"use strict";

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn("customers", "is_active", {
            type: Sequelize.BOOLEAN,
            defaultValue: true,
            allowNull: false,
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn("customers", "is_active");
    },
};
