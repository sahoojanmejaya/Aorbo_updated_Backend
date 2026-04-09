const { Notification } = require("../../models");
const { Op } = require("sequelize");

/**
 * 🔔 Add Notification (Trigger based)
 */
exports.addNotification = async (req, res) => {
  try {
    const {
      vendor_id,
      customer_id,
      type,
      category,
      message,
      status
    } = req.body;

    const notification = await Notification.create({
      vendor_id,
      customer_id,
      type,
      category,
      message,
      status: status || "SENT",
      notification_id: `NTF-${Date.now()}`
    });

    res.json({
      status: true,
      message: "Notification added successfully",
      data: notification
    });

  } catch (error) {
    console.error("addNotification error:", error);
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};


/**
 * 📜 Get Vendor Notification History (for UI like image)
 */
exports.getVendorNotifications = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { type, category, fromDate, toDate, search } = req.query;

    let where = { vendor_id: vendorId };

    if (type) where.type = type;
    if (category) where.category = category;

    if (fromDate && toDate) {
      where.created_at = {
        [Op.between]: [new Date(fromDate), new Date(toDate)]
      };
    }

    if (search) {
      where.message = { [Op.like]: `%${search}%` };
    }

    const notifications = await Notification.findAll({
      where,
      order: [["created_at", "DESC"]]
    });

    res.json({
      status: true,
      message: "Notification list fetched successfully",
      data: notifications
    });

  } catch (error) {
    console.error("getVendorNotifications error:", error);
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};
