const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    const Inclusion = sequelize.define("Inclusion", {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            comment: "Name of the inclusion item",
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "Optional description of the inclusion",
        },
        usage_count: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            comment: "Number of times this inclusion has been used",
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            comment: "Whether this inclusion is active",
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
        tableName: "inclusions",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
    });

    return Inclusion;
}; 