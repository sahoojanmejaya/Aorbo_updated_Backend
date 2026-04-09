const { VendorActivityLogs } = require("../models");

const addVendorLog = async ({
  vendor_id,
  performed_by = null,
  action = null,
  reason = null,
  details = null,
  status = true
}) => {
  try {
    if (!vendor_id) return;

    await VendorActivityLogs.create({
      vendor_id,
      performed_datetime: new Date(),
      performed_by,
      action,
      reason,
      details,
      status
    });

  } catch (error) {
    console.error("Vendor Activity Log Error:", error.message);
    // intentionally no throw (logging should not break main flow)
  }
};

module.exports = addVendorLog;