module.exports = (sequelize, DataTypes) => {
    const RolePermission = sequelize.define(
        "RolePermission",
        {
            role_id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
            },
            permission_id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
            },
        },
        {
            tableName: "role_permissions",
            underscored: true,
            timestamps: false,
        }
    );

    return RolePermission;
};
