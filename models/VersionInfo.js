module.exports = (sequelize, DataTypes) => {
    const VersionInfo = sequelize.define(
        "VersionInfo",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            version: { type: DataTypes.STRING, allowNull: false },
            notes: { type: DataTypes.TEXT, allowNull: true },
            release_date: { type: DataTypes.DATE, allowNull: false },
        },
        {
            tableName: "version_info",
            underscored: true,
            timestamps: true,
        }
    );

    return VersionInfo;
};
