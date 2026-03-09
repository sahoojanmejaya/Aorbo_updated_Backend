module.exports = (sequelize, DataTypes) => {
  const FaqCategory = sequelize.define(
    "FaqCategory",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      folder_name: {
        type: DataTypes.STRING
      },
      colors: {
        type: DataTypes.STRING
      },
      display_limit: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      status: {
        type: DataTypes.ENUM("ACTIVE", "INACTIVE"),
        defaultValue: "ACTIVE"
      }
    },
    {
      tableName: "faq_categories",
      timestamps: true
    }
  );

  // 🔥 ASSOCIATION HERE
  FaqCategory.associate = (models) => {
    FaqCategory.hasMany(models.FAQ, {
      foreignKey: "category_id",
      as: "faqs"
    });
  };

  return FaqCategory;
};
