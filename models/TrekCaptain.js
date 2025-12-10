module.exports = (sequelize, DataTypes) => {
    const TrekCaptain = sequelize.define(
        "TrekCaptain",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            name: {
                type: DataTypes.STRING(255),
                allowNull: false,
                validate: {
                    notEmpty: true,
                    len: [2, 255],
                },
            },
            email: {
                type: DataTypes.STRING(255),
                allowNull: false,
                unique: true,
                validate: {
                    isEmail: true,
                    notEmpty: true,
                },
            },
            phone: {
                type: DataTypes.STRING(20),
                allowNull: false,
                validate: {
                    notEmpty: true,
                    len: [10, 20],
                },
            },
            vendor_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: "vendors",
                    key: "id",
                },
            },
            status: {
                type: DataTypes.ENUM("active", "inactive"),
                defaultValue: "active",
            },
        },
        {
            tableName: "trek_captains",
            underscored: true,
        }
    );

    TrekCaptain.associate = (models) => {
        TrekCaptain.belongsTo(models.Vendor, { foreignKey: "vendor_id", as: "vendor" });
        TrekCaptain.hasMany(models.Trek, { foreignKey: "captain_id", as: "treks" });
    };

    return TrekCaptain;
}; 