const {
    Vendor,
     Booking,
    Trek,Batch
} = require("../../models");
const { Op } = require("sequelize");
const { calculateActiveTaxes, calculateCancelledTaxes } = require("../../services/taxService");
//getTaxes

// exports.getTaxes = async (req, res) => {
//   try {
//     const { from, to } = req.query;

//     const where = {};
//     if (from && to) {
//       where.createdAt = { [Op.between]: [from, to] };
//     }

//     const bookings = await Booking.findAll({
//       where,
//       include: [
//         { model: Vendor, as: "vendor", attributes: ["id", "company_info"] },
//         { model: Trek, as: "trek", attributes: ["id", "title","base_price" ] }
//       ],
//       order: [["createdAt", "ASC"]]
//     });

//     let summary = {
//       totalbase_price: 0,
//       totalPlatformFeeGst: 0,
//       totalCommissionGst: 0,
//       totalTcs: 0,
//       totalTds: 0
//     };
//  const vendorMap = {};
//     const heatmapMap = {};
//     const ledger = [];

//     for (const b of bookings) {
//       const base_price = Number(b.trek?.base_price);
//       const taxes = b.status === "cancelled"
//         ? calculateCancelledTaxes(base_price)
//         : calculateActiveTaxes(base_price);

//       summary.totalbase_price += base_price;
//       summary.totalPlatformFeeGst += taxes.platformFeeGst || 0;
//       summary.totalCommissionGst += taxes.commissionGst || 0;
//       summary.totalTcs += taxes.tcs || 0;
//       summary.totalTds += taxes.tds || 0;

//            let dateKey = "unknown";
//       if (b.created_at) {
//         dateKey = new Date(b.created_at).toISOString().split("T")[0];
//       }
//       heatmapMap[dateKey] = (heatmapMap[dateKey] || 0) + taxes.totalLiability;
//   let vendorInfo = null;
//       if (b.vendor?.company_info) {
//         try {
//           vendorInfo = JSON.parse(b.vendor.company_info);
//         } catch (err) {
//           console.error("Invalid vendor JSON:", b.vendor.company_info);
//         }
//       }
//       ledger.push({
//         vendorName: vendorInfo?.company_name || null,
//         //tbrId: b.trek?.tbr_id,
//         trekName: b.trek?.title,
//         completedDate: dateKey,
//         base_price,
//         ...taxes
//       });
//     }

//     const heatmap = Object.entries(heatmapMap).map(([date, liability]) => ({
//       date,
//       liability: Number(liability.toFixed(2))
//     }));

//     return res.json({
//       success: true,
//       summary: {
//         totalbase_price: Number(summary.totalbase_price.toFixed(2)),
//         totalPlatformFeeGst: Number(summary.totalPlatformFeeGst.toFixed(2)),
//         totalCommissionGst: Number(summary.totalCommissionGst.toFixed(2)),
//         totalTcs: Number(summary.totalTcs.toFixed(2)),
//         totalTds: Number(summary.totalTds.toFixed(2))
//       },
//       heatmap,
//       ledger
//     });

//   } catch (error) {
//     console.error("Compliance Analytics Error:", error);
//     res.status(500).json({ success: false, message: "Internal server error" });
//   }
// };

exports.getTaxes = async (req, res) => {
  try {
    const { from, to, month, year } = req.query;

    const where = {};


    if (from && to) {
      where.createdAt = { [Op.between]: [from, to] };
    }

    if (!from && !to && (month || year)) {
      const y = year ? Number(year) : new Date().getFullYear();
      const m = month ? Number(month) - 1 : 0;

      let start = new Date(y, m, 1);
      let end;

      if (month) {
        end = new Date(y, m + 1, 0, 23, 59, 59);
      } else {
        start = new Date(y, 0, 1);
        end = new Date(y, 11, 31, 23, 59, 59);
      }

      where.createdAt = { [Op.between]: [start, end] };
    }

    const bookings = await Booking.findAll({
      where,
      include: [
        { model: Vendor, as: "vendor", attributes: ["id", "company_info"] },
        { model: Trek, as: "trek", attributes: ["id", "title", "base_price"],
           include: [
        {
          model: Batch,
          as: "batches",
          attributes: ["tbr_id"]
        }
      ]
         }
      ],
      order: [["createdAt", "ASC"]]
    });

    let summary = {
      totalbase_price: 0,
      totalPlatformFeeGst: 0,
      totalCommissionGst: 0,
      totalTcs: 0,
      totalTds: 0
    };

    const vendorMap = {};
    const heatmapMap = {};

    for (const b of bookings) {
      const vendorId = b.vendor?.id;
      if (!vendorId) continue;

      const base_price = Number(b.trek?.base_price || 0);
      const taxes = b.status === "cancelled"
        ? calculateCancelledTaxes(base_price)
        : calculateActiveTaxes(base_price);

      summary.totalbase_price += base_price;
      summary.totalPlatformFeeGst += taxes.platformFeeGst || 0;
      summary.totalCommissionGst += taxes.commissionGst || 0;
      summary.totalTcs += taxes.tcs || 0;
      summary.totalTds += taxes.tds || 0;

      const dateKey = b.createdAt
        ? new Date(b.createdAt).toISOString().split("T")[0]
        : "unknown";

     if (!heatmapMap[dateKey]) {
  heatmapMap[dateKey] = {
    liability: 0,
    gst: 0,
    platformFeeGst: 0,
    commissionGst: 0,
    tcs: 0,
    tds: 0
  };
}

heatmapMap[dateKey].liability += taxes.totalLiability || 0;
heatmapMap[dateKey].gst += taxes.gst || 0;
heatmapMap[dateKey].platformFeeGst += taxes.platformFeeGst || 0;
heatmapMap[dateKey].commissionGst += taxes.commissionGst || 0;
heatmapMap[dateKey].tcs += taxes.tcs || 0;
heatmapMap[dateKey].tds += taxes.tds || 0;


      let vendorInfo = null;
      if (b.vendor?.company_info) {
        try { vendorInfo = JSON.parse(b.vendor.company_info); } catch {}
      }

      if (!vendorMap[vendorId]) {
        vendorMap[vendorId] = {
          vendorId,
          vendorName: vendorInfo?.company_name || null,
          tbr_id: b.trek?.batches?.[0]?.tbr_id || null,
          totalbase_price: 0,
          totalPlatformFeeGst: 0,
          totalCommissionGst: 0,
          totalTcs: 0,
          totalTds: 0,
          totalLiability: 0,
          cancelGst: 0,
          createdAt: b.createdAt || null
        
        };
      }

      vendorMap[vendorId].totalbase_price += base_price;
      vendorMap[vendorId].totalPlatformFeeGst += taxes.platformFeeGst || 0;
      vendorMap[vendorId].totalCommissionGst += taxes.commissionGst || 0;
      vendorMap[vendorId].totalTcs += taxes.tcs || 0;
      vendorMap[vendorId].totalTds += taxes.tds || 0;
      vendorMap[vendorId].totalLiability += taxes.totalLiability || 0;
      if (b.status === "cancelled") {
  vendorMap[vendorId].cancelGst += (taxes.cgst || 0) + (taxes.sgst || 0);
}
    }

    const ledger = Object.values(vendorMap).map(v => ({
      ...v,
      totalbase_price: Number(v.totalbase_price.toFixed(2)),
      totalPlatformFeeGst: Number(v.totalPlatformFeeGst.toFixed(2)),
      totalCommissionGst: Number(v.totalCommissionGst.toFixed(2)),
      totalTcs: Number(v.totalTcs.toFixed(2)),
      totalTds: Number(v.totalTds.toFixed(2)),
      totalLiability: Number(v.totalLiability.toFixed(2)),
      cancelGst: Number(v.cancelGst.toFixed(2)),

 createdAt: v.createdAt,
    }));

const heatmap = Object.entries(heatmapMap).map(([date, values]) => ({
  date,
  liability: Number(values.liability.toFixed(2)),
  gst: Number(values.gst.toFixed(2)),
  platformFeeGst: Number(values.platformFeeGst.toFixed(2)),
  commissionGst: Number(values.commissionGst.toFixed(2)),
  tcs: Number(values.tcs.toFixed(2)),
  tds: Number(values.tds.toFixed(2))
}));


    return res.json({
      success: true,
      summary,
      heatmap,
      ledger
    });

  } catch (error) {
    console.error("Compliance Analytics Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
