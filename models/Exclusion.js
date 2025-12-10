const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    const Exclusion = sequelize.define("Exclusion", {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            comment: "Name of the exclusion item",
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "Optional description of the exclusion",
        },
        usage_count: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            comment: "Number of times this exclusion has been used",
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            comment: "Whether this exclusion is active",
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
        updated_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    }, {
        tableName: "exclusions",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
    });

    return Exclusion;
}; 