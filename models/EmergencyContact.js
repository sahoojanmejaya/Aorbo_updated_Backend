module.exports = (sequelize, DataTypes) => {
    const EmergencyContact = sequelize.define(
        "EmergencyContact",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            customer_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: "customers",
                    key: "id",
                },
                onDelete: "CASCADE",
                onUpdate: "CASCADE",
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            phone: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            relationship: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            priority: {
                type: DataTypes.INTEGER,
                allowNull: true,
                defaultValue: 1,
                validate: {
                    min: 1,
                    max: 3,
                },
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                defaultValue: true,
            },
        },
        {
            tableName: "emergency_contacts",
            underscored: true,
        }
    );

    EmergencyContact.associate = (models) => {
        EmergencyContact.belongsTo(models.Customer, {
            foreignKey: "customer_id",
            as: "customer",
        });
    };

    return EmergencyContact;
};
