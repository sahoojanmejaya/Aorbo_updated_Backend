
/**
 * Global Tax Configuration Policy
 */
const POLICY = {
  GST_RATE: 0.05,
  CANCEL_GST_RATE: 0.05, 
  COMMISSION_GST_RATE: 0.18,
  TCS_TDS_RATE: 0.01,
  FIXED_PLATFORM_FEE: 10,
};

const calculateActiveTaxes = (base_price) => {
  const gst = base_price* POLICY.GST_RATE;
  const platformFeeGst = POLICY.FIXED_PLATFORM_FEE * POLICY.GST_RATE;
  const commissionGst = base_price * POLICY.COMMISSION_GST_RATE;
  const tcs = base_price* POLICY.TCS_TDS_RATE;
  const tds = base_price* POLICY.TCS_TDS_RATE;

  return {
    gst: Number(gst.toFixed(2)),
    platformFee: POLICY.FIXED_PLATFORM_FEE,
    platformFeeGst: Number(platformFeeGst.toFixed(2)),
    commissionGst: Number(commissionGst.toFixed(2)),
    tcs: Number(tcs.toFixed(2)),
    tds: Number(tds.toFixed(2)),
    totalLiability: Number((gst + platformFeeGst + commissionGst + tcs + tds).toFixed(2))
  };
};

const calculateCancelledTaxes = (base_price) => {
  // Cancelled logic usually differs (e.g., no platform fee on cancellation)
  const gst = base_price * POLICY.CANCEL_GST_RATE;
  const commissionGst = base_price * POLICY.COMMISSION_GST_RATE;
  const tcs = base_price * POLICY.TCS_TDS_RATE;
  const tds = base_price * POLICY.TCS_TDS_RATE;

  return {
    cgst: Number((gst / 2).toFixed(2)),
    sgst: Number((gst / 2).toFixed(2)),
    commissionGst: Number(commissionGst.toFixed(2)),
    tcs: Number(tcs.toFixed(2)),
    tds: Number(tds.toFixed(2)),
    totalLiability: Number((gst + commissionGst + tcs + tds).toFixed(2))
  };
};

module.exports = { calculateActiveTaxes, calculateCancelledTaxes, POLICY };

