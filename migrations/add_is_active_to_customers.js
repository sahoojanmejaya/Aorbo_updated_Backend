"use strict";

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const table = await queryInterface.describeTable("customers");
        if (!table["is_active"]) {
            await queryInterface.addColumn("customers", "is_active", {
                type: Sequelize.BOOLEAN,
                defaultValue: true,
                allowNull: false,
            });
        }
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn("customers", "is_active");
    },
};
