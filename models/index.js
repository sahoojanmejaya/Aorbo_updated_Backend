const fs = require("fs");
const path = require("path");
const Sequelize = require("sequelize");
const logger = require("../utils/logger");
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || "development";
const config = require("../config/config")[env];

const db = {};
const sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    config
);

// Test database connection
sequelize
    .authenticate()
    .then(() => {
        logger.database(
            "info",
            "Database connection established successfully",
            {
                database: config.database,
                host: config.host,
                dialect: config.dialect,
            }
        );
    })
    .catch((err) => {
        logger.database("error", "Unable to connect to the database", {
            error: err.message,
            database: config.database,
            host: config.host,
            dialect: config.dialect,
        });
    });

fs.readdirSync(__dirname)
    .filter(
        (file) =>
            file.indexOf(".") !== 0 &&
            file !== basename &&
            file.slice(-3) === ".js" &&
            fs.statSync(path.join(__dirname, file)).isFile()
    )
    .forEach((file) => {
        try {
            const model = require(path.join(__dirname, file));
            if (typeof model === "function") {
                const modelInstance = model(sequelize, Sequelize.DataTypes);
                db[modelInstance.name] = modelInstance;
            }
        } catch (error) {
            logger.database("warn", `Could not load model from file ${file}`, {
                error: error.message,
                stack: error.stack,
            });
        }
    });

Object.keys(db).forEach((modelName) => {
    if (db[modelName].associate) {
        db[modelName].associate(db);
    }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
