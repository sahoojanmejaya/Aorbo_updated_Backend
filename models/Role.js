module.exports = (sequelize, DataTypes) => {
    const Role = sequelize.define(
        "Role",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            description: {
                type: DataTypes.STRING,
            },
        },
        {
            tableName: "roles",
            underscored: true,
        }
    );

    Role.associate = (models) => {
        Role.hasMany(models.User, { foreignKey: "roleId", as: "users" });
    };

    return Role;
};
