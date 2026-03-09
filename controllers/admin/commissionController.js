const { CommissionSector } = require("../../models"); // User model import karo

/**
 * CREATE
 */
exports.createCommission = async (req, res) => {
  try {
    const {
      sector_type,
      platform_commission,
      start_date,
      end_date,
      quick_range_months,
      status,
    } = req.body;

    const data = await CommissionSector.create({
      sector_type,
      platform_commission,
      start_date,
      end_date,
      quick_range_months,
      status,
    });

    return res.status(201).json({
      success: true,
      message: "Commission sector created successfully",
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Database operation failed",
      error: error.message,
    });
  }
};

/**
 * UPDATE
 */
exports.updateCommission = async (req, res) => {
  try {
    const { id } = req.params;

    const updated = await CommissionSector.update(req.body, {
      where: { id },
    });

    if (!updated[0]) {
      return res.status(404).json({
        success: false,
        message: "Commission sector not found",
      });
    }

    return res.json({
      success: true,
      message: "Commission sector updated successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Database operation failed",
      error: error.message,
    });
  }
};

/**
 * DELETE
 */
exports.deleteCommission = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await CommissionSector.destroy({
      where: { id },
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Commission sector not found",
      });
    }

    return res.json({
      success: true,
      message: "Commission sector deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Database operation failed",
      error: error.message,
    });
  }
};

/**
 * LIST ALL
 */
exports.getAllCommissions = async (req, res) => {
  try {
    const { sector_type, status } = req.query;

    const where = {};

    if (sector_type) where.sector_type = sector_type;
    if (status) where.status = status;

    const data = await CommissionSector.findAll({
      where,
      order: [["id", "DESC"]],
    });

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Database operation failed",
      error: error.message,
    });
  }
};
