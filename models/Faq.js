module.exports = (sequelize, DataTypes) => {
  const FAQ = sequelize.define(
    "FAQ",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      category_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      question: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      answer: {
        type: DataTypes.TEXT,
        allowNull: false
      },
       tag: {
  type: DataTypes.ARRAY(DataTypes.STRING),
  allowNull: true
},
      role_type: {
        type: DataTypes.ENUM("admin", "vendor", "customer", "user"),
        allowNull: false
      },
      status: {
        type: DataTypes.ENUM("LIVE", "DRAFT", "ARCHIVE", "AUDIT"),
        defaultValue: "DRAFT"
      },
      top_list: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      }
    },
    {
      tableName: "faqs",
      timestamps: true,
      underscored: true
    }
  );

  // 🔥 ASSOCIATION HERE
  FAQ.associate = (models) => {
    FAQ.belongsTo(models.FaqCategory, {
      foreignKey: "category_id",
      as: "category"
    });
  };

  return FAQ;
};
