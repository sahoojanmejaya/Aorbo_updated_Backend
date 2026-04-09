const { CouponAuditLog, Coupon, Trek, Vendor } = require('../models');
const { Op } = require('sequelize');

class CouponAuditService {
  /**
   * Log a coupon action
   * @param {Object} params - Audit log parameters
   * @param {number} params.couponId - ID of the coupon
   * @param {number} params.vendorId - ID of the vendor
   * @param {string} params.action - Action performed
   * @param {Object} params.details - Action-specific details
   * @param {Object} params.previousValues - Previous values (for updates)
   * @param {Object} params.newValues - New values (for updates)
   * @param {number} params.trekId - Current trek ID (for assignments)
   * @param {number} params.previousTrekId - Previous trek ID (for reassignments)
   * @param {string} params.ipAddress - IP address of the user
   * @param {string} params.userAgent - User agent string
   */
  static async logAction({
    couponId,
    vendorId,
    action,
    details = {},
    previousValues = null,
    newValues = null,
    trekId = null,
    previousTrekId = null,
    ipAddress = null,
    userAgent = null
  }) {
    try {
      await CouponAuditLog.create({
        coupon_id: couponId,
        vendor_id: vendorId,
        action,
        details: JSON.stringify(details),
        previous_values: previousValues ? JSON.stringify(previousValues) : null,
        new_values: newValues ? JSON.stringify(newValues) : null,
        trek_id: trekId,
        previous_trek_id: previousTrekId,
        ip_address: ipAddress,
        user_agent: userAgent
      });
    } catch (error) {
      console.error('Error logging coupon action:', error);
      // Don't throw error to avoid breaking the main operation
    }
  }

  /**
   * Get audit logs for a vendor
   * @param {number} vendorId - Vendor ID
   * @param {Object} filters - Filter options
   * @param {string} filters.action - Filter by action
   * @param {string} filters.startDate - Start date filter
   * @param {string} filters.endDate - End date filter
   * @param {number} filters.limit - Number of records to return
   * @param {number} filters.offset - Offset for pagination
   */
  static async getVendorAuditLogs(vendorId, filters = {}) {
    const {
      action,
      startDate,
      endDate,
      limit = 50,
      offset = 0
    } = filters;

    const whereClause = {
      vendor_id: vendorId
    };

    if (action && action !== 'all') {
      whereClause.action = action;
    }

    if (startDate || endDate) {
      whereClause.created_at = {};
      if (startDate) {
        whereClause.created_at[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        whereClause.created_at[Op.lte] = new Date(endDate);
      }
    }

    const auditLogs = await CouponAuditLog.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Coupon,
          as: 'coupon',
          attributes: ['id', 'code', 'title', 'discount_type', 'discount_value']
        },
        {
          model: Trek,
          as: 'trek',
          attributes: ['id', 'title']
        },
        {
          model: Trek,
          as: 'previousTrek',
          attributes: ['id', 'title']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    return auditLogs;
  }

  /**
   * Get audit logs for a specific coupon
   * @param {number} couponId - Coupon ID
   * @param {number} limit - Number of records to return
   * @param {number} offset - Offset for pagination
   */
  static async getCouponAuditLogs(couponId, limit = 50, offset = 0) {
    const auditLogs = await CouponAuditLog.findAndCountAll({
      where: { coupon_id: couponId },
      include: [
        {
          model: Trek,
          as: 'trek',
          attributes: ['id', 'title']
        },
        {
          model: Trek,
          as: 'previousTrek',
          attributes: ['id', 'title']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    return auditLogs;
  }

  /**
   * Create audit log for coupon creation
   */
  static async logCouponCreation(coupon, vendorId, req) {
    await this.logAction({
      couponId: coupon.id,
      vendorId,
      action: 'create',
      details: {
        coupon_code: coupon.code,
        title: coupon.title,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        valid_from: coupon.valid_from,
        valid_until: coupon.valid_until
      },
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });
  }

  /**
   * Create audit log for coupon update
   */
  static async logCouponUpdate(coupon, previousValues, vendorId, req) {
    await this.logAction({
      couponId: coupon.id,
      vendorId,
      action: 'update',
      details: {
        coupon_code: coupon.code,
        title: coupon.title
      },
      previousValues,
      newValues: {
        title: coupon.title,
        code: coupon.code,
        description: coupon.description,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        valid_from: coupon.valid_from,
        valid_until: coupon.valid_until,
        terms_and_conditions: coupon.terms_and_conditions
      },
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });
  }

  /**
   * Create audit log for coupon deletion
   */
  static async logCouponDeletion(coupon, vendorId, req) {
    await this.logAction({
      couponId: coupon.id,
      vendorId,
      action: 'delete',
      details: {
        coupon_code: coupon.code,
        title: coupon.title
      },
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });
  }

  /**
   * Create audit log for coupon assignment
   */
  static async logCouponAssignment(coupon, trek, vendorId, req) {
    // Fetch trek details if only ID is provided
    let trekDetails = trek;
    if (trek.id && !trek.name) {
      const { Trek } = require('../models');
      trekDetails = await Trek.findByPk(trek.id);
    }

    await this.logAction({
      couponId: coupon.id,
      vendorId,
      action: 'assign',
      details: {
        coupon_code: coupon.code,
        trek_name: trekDetails?.name || trekDetails?.title || `Trek ID: ${trek.id}`
      },
      trekId: trek.id,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });
  }

  /**
   * Create audit log for coupon unassignment
   */
  static async logCouponUnassignment(coupon, previousTrek, vendorId, req) {
    // Fetch trek details if only ID is provided
    let trekDetails = previousTrek;
    if (previousTrek.id && !previousTrek.name) {
      const { Trek } = require('../models');
      trekDetails = await Trek.findByPk(previousTrek.id);
    }

    await this.logAction({
      couponId: coupon.id,
      vendorId,
      action: 'unassign',
      details: {
        coupon_code: coupon.code,
        previous_trek_name: trekDetails?.name || trekDetails?.title || `Trek ID: ${previousTrek.id}`
      },
      previousTrekId: previousTrek.id,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });
  }

  /**
   * Create audit log for coupon reassignment
   */
  static async logCouponReassignment(coupon, previousTrek, newTrek, vendorId, req) {
    // Fetch trek details if only IDs are provided
    let previousTrekDetails = previousTrek;
    let newTrekDetails = newTrek;
    
    if (previousTrek.id && !previousTrek.name) {
      const { Trek } = require('../models');
      previousTrekDetails = await Trek.findByPk(previousTrek.id);
    }
    
    if (newTrek.id && !newTrek.name) {
      const { Trek } = require('../models');
      newTrekDetails = await Trek.findByPk(newTrek.id);
    }

    await this.logAction({
      couponId: coupon.id,
      vendorId,
      action: 'reassign',
      details: {
        coupon_code: coupon.code,
        from_trek_name: previousTrekDetails?.name || previousTrekDetails?.title || `Trek ID: ${previousTrek.id}`,
        to_trek_name: newTrekDetails?.name || newTrekDetails?.title || `Trek ID: ${newTrek.id}`
      },
      trekId: newTrek.id,
      previousTrekId: previousTrek.id,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });
  }

  /**
   * Create audit log for coupon expiration
   */
  static async logCouponExpiration(coupon, vendorId) {
    await this.logAction({
      couponId: coupon.id,
      vendorId,
      action: 'expire',
      details: {
        coupon_code: coupon.code,
        expired_at: new Date().toISOString()
      }
    });
  }

  /**
   * Create audit log for coupon approval
   */
  static async logCouponApproval(coupon, vendorId, req) {
    await this.logAction({
      couponId: coupon.id,
      vendorId,
      action: 'approve',
      details: {
        coupon_code: coupon.code,
        admin_notes: coupon.admin_notes
      },
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });
  }

  /**
   * Create audit log for coupon rejection
   */
  static async logCouponRejection(coupon, vendorId, req) {
    await this.logAction({
      couponId: coupon.id,
      vendorId,
      action: 'reject',
      details: {
        coupon_code: coupon.code,
        admin_notes: coupon.admin_notes
      },
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });
  }

  /**
   * Create audit log for coupon application
   */
  static async logCouponApplication(coupon, bookingId, customerId, discountAmount, originalAmount, finalAmount, trekId, batchId, vendorId, req) {
    await this.logAction({
      couponId: coupon.id,
      vendorId,
      action: 'applied',
      details: {
        coupon_code: coupon.code,
        booking_id: bookingId,
        customer_id: customerId,
        discount_amount: discountAmount,
        original_amount: originalAmount,
        final_amount: finalAmount,
        trek_id: trekId,
        batch_id: batchId
      },
      trekId: trekId,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });
  }
}

module.exports = CouponAuditService;
