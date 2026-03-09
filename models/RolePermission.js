module.exports = (sequelize, DataTypes) => {
    const RolePermission = sequelize.define(
        "RolePermission",
        {
            role_id: {
                type: DataTypes.INTEGER,
                //primaryKey: true,
            },

             user_id: {
                type: DataTypes.INTEGER,
               // primaryKey: true,
            },
             pre_fix: {
                type: DataTypes.STRING,
                allowNull: false,
            },

         permission_id: {
  type: DataTypes.STRING,
  allowNull: false,
 // defaultValue: [],
 
}
            

            
        },
        {
            tableName: "role_permissions",
            underscored: true,
            timestamps: false,
        },
        
    );

    
    return RolePermission;
};
