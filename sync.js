const { sequelize } = require("./models");

(async () => {
    try {
        await sequelize.sync({ alter: true });
        console.log("Database schema synchronized with models.");
        process.exit(0);
    } catch (err) {
        console.error("Error synchronizing database:", err);
        process.exit(1);
    }
})();
