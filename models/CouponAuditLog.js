const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CouponAuditLog = sequelize.define('CouponAuditLog', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    coupon_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'coupons',
        key: 'id'
      }
    },
    vendor_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'vendors',
        key: 'id'
      },
      comment: 'Null when the action was performed by an admin'
    },
    action: {
      type: DataTypes.ENUM('create', 'update', 'delete', 'assign', 'unassign', 'reassign', 'expire', 'approve', 'reject', 'applied', 'status_change'),
      allowNull: false
    },
    details: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'JSON string containing action-specific details'
    },
    previous_values: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'JSON string containing previous values for updates'
    },
    new_values: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'JSON string containing new values for updates'
    },
    trek_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'treks',
        key: 'id'
      }
    },
    previous_trek_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'treks',
        key: 'id'
      }
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'coupons_audit_logs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['coupon_id']
      },
      {
        fields: ['vendor_id']
      },
      {
        fields: ['action']
      },
      {
        fields: ['created_at']
      },
      {
        fields: ['trek_id']
      }
    ]
  });

  CouponAuditLog.associate = (models) => {
    // Association with Coupon
    CouponAuditLog.belongsTo(models.Coupon, {
      foreignKey: 'coupon_id',
      as: 'coupon'
    });

    // Association with Vendor
    CouponAuditLog.belongsTo(models.Vendor, {
      foreignKey: 'vendor_id',
      as: 'vendor'
    });

    // Association with Trek (current trek)
    CouponAuditLog.belongsTo(models.Trek, {
      foreignKey: 'trek_id',
      as: 'trek'
    });

    // Association with Trek (previous trek)
    CouponAuditLog.belongsTo(models.Trek, {
      foreignKey: 'previous_trek_id',
      as: 'previousTrek'
    });
  };

  return CouponAuditLog;
};
