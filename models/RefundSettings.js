module.exports = (sequelize, DataTypes) => {
    const RefundSettings = sequelize.define(
        "RefundSettings",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            seven_days_percentage: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 90,
                validate: {
                    min: 0,
                    max: 100,
                    isInt: {
                        msg: "Seven days percentage must be an integer"
                    }
                }
            },
            three_days_percentage: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 50,
                validate: {
                    min: 0,
                    max: 100,
                    isInt: {
                        msg: "Three days percentage must be an integer"
                    }
                }
            },
            twenty_four_hours_percentage: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 10,
                validate: {
                    min: 0,
                    max: 100,
                    isInt: {
                        msg: "Twenty four hours percentage must be an integer"
                    }
                }
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
            created_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
            },
            updated_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
            },
        },
        {
            tableName: "refund_settings",
            underscored: true,
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        }
    );

    RefundSettings.associate = (models) => {
        // No direct associations needed for refund settings
    };

    return RefundSettings;
};










