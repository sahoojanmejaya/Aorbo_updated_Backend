module.exports = (sequelize, DataTypes) => {
    const Permission = sequelize.define(
        "Permission",
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
            tableName: "permissions",
            underscored: true,
            timestamps: true,
        }
    );

    Permission.associate = (models) => {
        Permission.belongsToMany(models.Role, {
            through: models.RolePermission,
            foreignKey: "permission_id",
            otherKey: "role_id",
            as: "roles",
        });
    };

    return Permission;
};
