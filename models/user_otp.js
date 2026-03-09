module.exports = (sequelize, DataTypes) => {
    const UserOtp = sequelize.define(
        "UserOtp",
        {
            id: {
                type: DataTypes.BIGINT,
                autoIncrement: true,
                primaryKey: true,
            },

            user_id: {
                type: DataTypes.BIGINT,
                allowNull: false,
            },

            mobile: {
                type: DataTypes.STRING(15),
                allowNull: false,
            },

            otp_code: {
                type: DataTypes.STRING(6),
                allowNull: false,
            },

            status: {
                type: DataTypes.ENUM("PENDING", "VERIFIED", "EXPIRED"),
                defaultValue: "PENDING",
            },

            expires_at: {
                type: DataTypes.DATE,
                allowNull: false,
            },
        },
        {
            tableName: "user_otps",
            timestamps: true,
            createdAt: "created_at",
            updatedAt: false,
        }
    );

    // 🔗 Associations
    UserOtp.associate = (models) => {
        UserOtp.belongsTo(models.User, {
            foreignKey: "user_id",
            as: "user",
        });
    };

    return UserOtp;
};
