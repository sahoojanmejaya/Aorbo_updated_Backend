const db = require("../config/db");
const FinanceConfig = require("../config/finance.config");

/**
 * ============================================================
 * BOOKINGS REPOSITORY – MATCHES REAL SCHEMA
 * ============================================================
 */

/**
 * FIND BOOKINGS BY BATCH (TBR) - WITH FINANCIALS
 */
async function findByBatchId(batchId) {
  // 1. Fetch Bookings with Basic Info + Cancellation + Support
  const [rows] = await db.query(
    `SELECT
      b.id,
      b.created_at AS date,
      
      -- Status Mapping
      CASE 
        WHEN b.status = 'cancelled' THEN 'Cancelled'
        ELSE 'Active'
      END AS status,

      -- Customer Info
      c.name AS travellerName,
      c.id AS customerId,
      CONCAT(c.phone, ' | ', c.email) AS travellerDetails,
      
      -- Financial Columns (Raw)
      b.total_basic_cost,
      b.platform_fees,
      b.gst_amount,
      b.insurance_amount,
      b.free_cancellation_amount,
      b.total_amount,
      b.advance_amount,
      b.remaining_amount,
      b.discount_amount AS coupon_discount,
      b.refund_amount,
      b.deduction_amount,

      -- Cancellation Breakdown from cancellation_bookings
      cb.deduction_admin,
      cb.deduction_vendor,
      cb.total_refundable_amount AS actual_refund,
      cb.deduction AS actual_deduction,

      -- Cancellation & Support
      cb.reason AS cancellation_reason,
      ir.id AS supportTicketId, -- Use id from issue_reports
      ir.created_at AS supportTicketDate,

      -- Batch Info
      bt.end_date as arrival_time
      
    FROM bookings b
    LEFT JOIN customers c ON c.id = b.customer_id
    LEFT JOIN cancellation_bookings cb ON cb.booking_id = b.id
    LEFT JOIN issue_reports ir ON ir.booking_id = b.id
    LEFT JOIN batches bt ON bt.id = b.batch_id
    WHERE b.batch_id = ?
    ORDER BY b.created_at DESC`,
    [batchId]
  );

  const results = [];

  for (const row of rows) {
    // 2. Count Slots (Travelers)
    const [[{ slots }]] = await db.query(
      `SELECT COUNT(*) AS slots FROM booking_travelers WHERE booking_id = ?`,
      [row.id]
    );

    // 3. Sub-Traveller Details (Names + Age + Sex + ID)
    const [travelers] = await db.query(
      `SELECT t.id, t.name, t.age, t.gender FROM booking_travelers bt
         JOIN travelers t ON t.id = bt.traveler_id
         WHERE bt.booking_id = ?`,
      [row.id]
    );

    // Format: "Name (TRV-ID | Age, Gender)"
    const subTravellerDetails = travelers.map(t => {
      const parts = [];
      if (t.age) parts.push(`${t.age} Yrs`);
      if (t.gender) parts.push(t.gender.charAt(0).toUpperCase());
      const details = parts.length ? ` (${parts.join(', ')})` : '';
      return `${t.name} [TRV-${t.id}]${details}`;
    }).join(', ');

    // 4. Fetch Payments from booking_payments (Subsequent Payments)
    const [payments] = await db.query(
      `SELECT amount, method, notes, payment_type FROM booking_payments 
       WHERE booking_id = ? AND evidence_status = 'verified'`,
      [row.id]
    );

    let totalPaidFromPayments = 0;
    let appPaidFromPayments = 0;
    let vendorPaidFromPayments = 0;
    const paymentRemarks = [];
    payments.forEach(p => {
      // Sum only subsequent payments to avoid double-counting advance_amount from main table
      if (p.payment_type !== 'advance') {
        const amt = Number(p.amount) || 0;
        totalPaidFromPayments += amt;

        const isApp = !p.method.toLowerCase().includes('cash'); // Simplified: anything but cash is App-collected
        if (isApp) appPaidFromPayments += amt;
        else vendorPaidFromPayments += amt;

        const source = isApp ? 'via App' : 'to Vendor';
        paymentRemarks.push(`₹${amt} paid ${source} (${p.method})`);
      }
    });

    // 5. Calculations (Safely handle potentially missing DB columns)
    const appPaidTotal = (Number(row.advance_amount) || 0) + appPaidFromPayments;
    // 4. Calculations (Safely handle potentially missing DB columns)

    // 4. Calculations (Safely handle potentially missing DB columns)
    // Fallback logic: if basic cost missing, derive from total or fail to 0 (avoid magic 4500)
    const totalBasicCost = Number(row.total_basic_cost) || (Number(row.total_amount) ? Math.round(Number(row.total_amount) * 0.9) : 0);
    const platformFees = Number(row.platform_fees) || FinanceConfig.PLATFORM_FEE;
    const insurance = Number(row.insurance_amount) || 0;
    const freeCancel = Number(row.free_cancellation_amount) || 0;

    // Commission on Basic Cost (Rounded)
    const comm10 = Math.round(totalBasicCost * FinanceConfig.COMMISSION_RATE);

    // GST on Commission (Rounded)
    const gstComm18 = Math.round(comm10 * FinanceConfig.GST_RATE_COMM);

    // GST on Basic Cost (Rounded)
    const gst5 = Math.round(totalBasicCost * FinanceConfig.GST_RATE_BASIC);

    // GST PF (Rounded)
    const gstPF5 = Math.round(platformFees * FinanceConfig.GST_RATE_PF);

    // TCS on Total Amount (Rounded)
    const totalAmount = Number(row.total_amount) || (totalBasicCost + gst5 + platformFees);
    const tcs1 = Math.round(totalAmount * FinanceConfig.TCS_RATE);

    // TDS on Basic (Rounded)
    const tds1 = Math.round(totalBasicCost * FinanceConfig.TDS_RATE);

    // Total Taxes
    const taxes = Math.round(gstComm18 + gstPF5 + gst5 + tcs1 + tds1);

    // Vendor Share
    const vendorShare = Math.round((totalBasicCost + gst5) - (comm10 + gstComm18 + tcs1 + tds1));

    // 6. Effective Payment Status (Display vs Realized)
    let originalRemaining = Math.round(Number(row.remaining_amount) || 0);
    // Unreported Vendor Payment Logic: If trek arrived, pending is closed (assumed settled with vendor).
    if (row.arrival_time && new Date() > new Date(row.arrival_time)) {
      originalRemaining = 0;
    }

    const realizedTotalPaid = row.advance_amount > 0 ? (Number(row.advance_amount) + totalPaidFromPayments) : totalPaidFromPayments;
    const isFullyRealized = realizedTotalPaid >= Math.round(Number(row.total_amount));

    // Final mapping details
    const isCancelled = row.status && row.status.toLowerCase() === 'cancelled';

    const finalComm10 = isCancelled
      ? (row.deduction_admin !== null && row.deduction_admin !== undefined ? Number(row.deduction_admin) : (Number(row.actual_deduction) / 2))
      : comm10;

    const finalVendorShare = isCancelled
      ? (row.deduction_vendor !== null && row.deduction_vendor !== undefined ? Number(row.deduction_vendor) : (Number(row.actual_deduction) / 2))
      : vendorShare;

    // 7. Determine Dynamic Reason based on Payment Flow
    let dynamicReason = row.reason || '';
    if (!isCancelled) {
      if (isFullyRealized) {
        // Full Paid - check source
        const lastPay = payments[payments.length - 1];
        const source = lastPay ? (lastPay.method.toLowerCase().includes('cash') ? 'to Vendor' : 'via App') : 'Advance Only';
        dynamicReason = `Full Paid (₹${realizedTotalPaid} Done ${source})`;
      } else if (totalPaidFromPayments > 0) {
        dynamicReason = `Realized ₹${realizedTotalPaid} (Balance Pending)`;
      } else {
        dynamicReason = "Partial Payment - Balance Pending";
      }
    }

    results.push({
      id: row.id,
      date: new Date(row.date).toLocaleString(),
      status: row.status,
      travellerName: row.travellerName || 'Unknown',
      travellerDetails: row.travellerDetails || '',
      subTravellerDetails,
      travellerId: `CUST-${row.customerId}`, // Main booker ID
      slots: slots,
      couponDetails: row.coupon_discount ? `₹${Math.round(row.coupon_discount)}` : '',

      // Breakdown
      finalBaseFare: Math.round(totalBasicCost),
      gst5: gst5,
      pf: Math.round(platformFees),
      ti: Math.round(insurance),
      tiPolicyId: insurance > 0 ? 'INS-STD' : null,
      fc: Math.round(freeCancel),
      fcPolicyId: freeCancel > 0 ? 'FC-PRO' : null,

      totalAmount: totalAmount,
      totalPaid: appPaidTotal, // Standardize on App-held funds for the primary "Paid" column
      pendingAmount: originalRemaining,
      realizedTotalPaid: realizedTotalPaid,
      appPaidTotal: appPaidTotal,

      comm10: finalComm10,
      getComm18: gstComm18,
      getPF5: gstPF5,
      tcs1: tcs1,
      tds1: tds1,
      taxes: taxes,
      vendorShare: finalVendorShare,
      platformFixedCharges: Math.round(comm10 + platformFees + taxes),
      availableAmount: isCancelled ? 0 : Math.max(0, Math.round(appPaidTotal - (comm10 + platformFees + taxes))),

      reason: dynamicReason,
      remarks: [row.remarks, ...paymentRemarks].filter(Boolean).join(' | '),

      // Support Ticket
      supportTicketId: row.supportTicketId,
      supportTicketDate: row.supportTicketDate ? new Date(row.supportTicketDate).toLocaleString() : null,

      // Cancellation
      cxlTimeSlab: 'N/A',
      cxlReason: row.cancellation_reason || '',
      refundAmount: Math.round(Number(row.actual_refund) || Number(row.refund_amount) || 0),
      deductionAmount: Math.round(Number(row.actual_deduction) || Number(row.deduction_amount) || 0),

      // Transaction IDs (For UI Display)
      transactionIds: payments.map(p => p.ref_no || (p.payment_type === 'advance' ? 'Advance' : null)).filter(Boolean).join(', ')
    });
  }

  return results;
}

/**
 * CALCULATE FINANCE SUMMARY (Aggregated Stats)
 */
function calculateFinanceSummary(bookings) {
  const summary = {
    activePaid: 0,
    activeSlots: 0,
    cancelledPaid: 0,
    cancelledSlots: 0,
    refundsIssued: 0,
    vendorShare: 0, // Active Vendor Share
    cancelledVendorShare: 0,
    pendingPayments: 0,
    totalBookings: bookings.length,

    // New Aggregates
    totalComm: 0,
    totalPF: 0,
    gstComm: 0,
    gstPF: 0,
    gstBase: 0,
    tcs: 0,
    tds: 0,
    activeAvailable: 0,
    cancelledAvailable: 0
  };

  bookings.forEach(b => {
    const isCancelled = b.status && b.status.toLowerCase() === 'cancelled';
    if (isCancelled) {
      summary.cancelledPaid += Number(b.realizedTotalPaid || b.totalPaid || 0);
      summary.cancelledSlots += Number(b.slots || 0);
      summary.refundsIssued += Number(b.refundAmount || 0);
      summary.cancelledVendorShare += Number(b.vendorShare || 0);
      summary.cancelledAvailable += Number(b.availableAmount || 0);

      // Add cancelled booking's platform financials if retained
      summary.totalComm += Number(b.comm10 || 0);
      summary.totalPF += Number(b.pf || 0);
      summary.gstComm += Number(b.getComm18 || 0);
      summary.gstPF += Number(b.getPF5 || 0);
      summary.gstBase += Number(b.gst5 || 0);
      summary.tcs += Number(b.tcs1 || 0);
      summary.tds += Number(b.tds1 || 0);

    } else {
      // For Active, use the REALIZED total (e.g. 15k) for the Gross KPI
      summary.activePaid += Number(b.realizedTotalPaid || b.totalPaid || 0);
      summary.activeSlots += Number(b.slots || 0);
      summary.vendorShare += Number(b.vendorShare || 0);
      summary.pendingPayments += Number(b.pendingAmount || 0);
      summary.activeAvailable += Number(b.availableAmount || 0);

      // Add active booking's platform financials
      summary.totalComm += Number(b.comm10 || 0);
      summary.totalPF += Number(b.pf || 0);
      summary.gstComm += Number(b.getComm18 || 0);
      summary.gstPF += Number(b.getPF5 || 0);
      summary.gstBase += Number(b.gst5 || 0);
      summary.tcs += Number(b.tcs1 || 0);
      summary.tds += Number(b.tds1 || 0);
    }
  });

  summary.totalPlatformShare = summary.totalComm + summary.totalPF;
  summary.totalTaxes = summary.gstComm + summary.gstPF + summary.gstBase + summary.tcs + summary.tds;

  return summary;
}

/**
 * --------------------------------------------------
 * FIND All
 * --------------------------------------------------
 */
async function findAll({ limit = 50, offset = 0, search = '' }) {
  const conditions = [];
  const values = [];

  if (search) {
    conditions.push("(c.name LIKE ? OR t.title LIKE ? OR b.id LIKE ?)");
    values.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const query = `
    SELECT
      b.id,
      b.status,
      b.created_at,
      b.total_amount,
      b.payment_status,
      c.name AS customerName,
      t.title AS trekName,
      bt.start_date,
      bt.end_date
    FROM bookings b
    LEFT JOIN customers c ON c.id = b.customer_id
    LEFT JOIN treks t ON t.id = b.trek_id
    LEFT JOIN batches bt ON bt.id = b.batch_id
    ${whereClause}
    ORDER BY b.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM bookings b
    LEFT JOIN customers c ON c.id = b.customer_id
    LEFT JOIN treks t ON t.id = b.trek_id
    ${whereClause}
  `;

  const [rows] = await db.query(query, [...values, limit, offset]);
  const [[count]] = await db.query(countQuery, values);

  return {
    rows,
    total: count.total
  };
}

/**
 * 
 * FIND BY ID
 */
async function findById(bookingId) {
  const [rows] = await db.query(
    `SELECT
      b.id,
      b.status,
      b.created_at,
      c.id AS customerId,
      c.name AS customerName,
      c.phone AS customerPhone,
      t.id AS trekId,
      t.title AS trekName,
      bt.id AS batchId,
      bt.tbr_id,
      bt.start_date,
      bt.start_date,
      bt.end_date,
      
      -- Financials for Policy Calculation
      CASE 
        WHEN b.total_basic_cost > 0 THEN b.total_basic_cost 
        ELSE (b.total_amount * 0.95) 
      END AS finalBaseFare, 
      CASE 
        WHEN b.payment_status IN ('completed', 'full_paid') THEN b.total_amount
        ELSE b.advance_amount
      END AS totalPaid,
      b.total_amount,
      b.advance_amount AS paid_amount,
      b.remaining_amount AS pending_amount,
      b.payment_status,
      b.cancellation_policy_type,
      b.refund_amount
    FROM bookings b
    JOIN customers c ON c.id = b.customer_id
    JOIN treks t ON t.id = b.trek_id
    JOIN batches bt ON bt.id = b.batch_id
    WHERE b.id = ?
    LIMIT 1`,
    [bookingId]
  );

  const booking = rows[0];
  if (!booking) return null;

  const [travelers] = await db.query(
    `SELECT 
       t.id, t.name, t.age, t.gender
     FROM booking_travelers bt
     LEFT JOIN travelers t ON t.id = bt.traveler_id
     WHERE bt.booking_id = ?`,
    [bookingId]
  );

  return {
    ...booking,
    travelers
  };
}

async function create({ customerId, trekId, batchId }) {
  // ... basic create implementation
  return {};
}
async function markCancelled(bookingId, { refundAmount, deductionAmount, reason, cxlTimeSlab }, conn) {
  const connection = conn || db;

  // 0. Fetch necessary info for cancellation_bookings NOT NULL constraints
  const [bRows] = await connection.query(
    "SELECT customer_id, trek_id, batch_id FROM bookings WHERE id = ?",
    [bookingId]
  );
  if (!bRows.length) throw new Error("Booking not found");
  const b = bRows[0];

  // 1. Update Booking Status & Financials
  await connection.query(
    `UPDATE bookings 
     SET status = 'cancelled',
         refund_amount = ?,
         deduction_amount = ?,
         updated_at = NOW()
     WHERE id = ?`,
    [refundAmount, deductionAmount, bookingId]
  );

  // 2. Insert into Cancellation Bookings (Where Reason is stored)
  // Delete existing if any (to allow retries/manual overrides)
  await connection.query("DELETE FROM cancellation_bookings WHERE booking_id = ?", [bookingId]);

  const dedShare = (Number(deductionAmount) || 0) / 2;

  await connection.query(
    `INSERT INTO cancellation_bookings
     (booking_id, customer_id, trek_id, batch_id, total_refundable_amount, deduction, deduction_admin, deduction_vendor, reason, status, cancellation_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', NOW(), NOW(), NOW())`,
    [
      bookingId,
      b.customer_id,
      b.trek_id,
      b.batch_id,
      refundAmount,
      deductionAmount,
      dedShare, // Admin share
      dedShare, // Vendor share
      reason
    ]
  );

  return true;
}
async function countByBatch(batchId) { return 0; }

/**
 * --------------------------------------------------
 * FIND ACTIVE BOOKINGS (For Taxes Panel)
 * --------------------------------------------------
 */
/**
 * 
 * FIND ACTIVE BOOKINGS (For Taxes Panel) - UPDATED CALC
 */
async function findActiveBookings({ startDate, endDate, vendorId }) {
  console.log("--- findActiveBookings CALLED (Backend Calc) ---");

  const conditions = ["b.status != 'cancelled'"];
  const params = [];

  if (startDate) {
    conditions.push("b.created_at >= ?");
    params.push(startDate);
  }
  if (endDate) {
    conditions.push("b.created_at <= ?");
    params.push(endDate);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const query = `
      SELECT 
          bt.tbr_id AS realTbrId,
          b.vendor_id AS vendorId,
          b.status,
          b.created_at AS completedDate,
          b.total_amount AS totalAmount,
          b.total_basic_cost AS baseFare,
          b.gst_amount AS gstAmount,
          b.platform_fees AS platformFees,
          b.insurance_amount AS insurance,
          b.free_cancellation_amount AS freeCancel
      FROM bookings b
      LEFT JOIN batches bt ON bt.id = b.batch_id
      ${whereClause}
      ORDER BY b.created_at DESC
      LIMIT 100
  `;

  const [rows] = await db.query(query, params);

  return rows.map(r => {
    // 1. Base Values (Use actual DB values)
    const baseFare = Number(r.baseFare) || 0;
    const pf = Number(r.platformFees) || 0;
    const totalAmount = Number(r.totalAmount) || 0;

    // 2. Computed Values (Standard Rates)
    const comm10 = Math.round(baseFare * FinanceConfig.COMMISSION_RATE);
    const commGst18 = Math.round(comm10 * FinanceConfig.GST_RATE_COMM);

    const gst5 = Math.round(baseFare * FinanceConfig.GST_RATE_BASIC); // Or use r.gstAmount if strictly recorded
    const pfGst5 = Math.round(pf * FinanceConfig.GST_RATE_PF);

    const tcs1 = Math.round(totalAmount * FinanceConfig.TCS_RATE);
    const tds1 = Math.round(baseFare * FinanceConfig.TDS_RATE);

    const totalLiability = Math.round(gst5 + pfGst5 + commGst18 + tcs1 + tds1);

    return {
      tbrId: r.realTbrId || "N/A",
      trekCompanyName: `V-${r.vendorId || '?'}`,
      status: "active",
      completedDate: r.completedDate,
      basefare: Math.round(baseFare),
      tax: {
        totalLiability: totalLiability,
        gst: gst5,
        platformFeeGst: pfGst5,
        commissionGst: commGst18,
        tcs: tcs1,
        tds: tds1
      }
    };
  });
}

/**
 * --------------------------------------------------
 * GET SUMMARY STATS (For Taxes Panel) - UPDATED CALC
 * --------------------------------------------------
 */
async function getSummaryStats({ startDate, endDate, vendorId }) {
  const conditions = ["b.status != 'cancelled'"];
  const params = [];

  if (startDate) params.push(startDate) && conditions.push("b.created_at >= ?");
  if (endDate) params.push(endDate) && conditions.push("b.created_at <= ?");

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  // Accurate Sums from DB
  const query = `
      SELECT 
          SUM(b.total_basic_cost) as totalBase,
          SUM(b.total_amount) as grandTotal,
          SUM(b.platform_fees) as totalPF
      FROM bookings b
      ${whereClause}
  `;

  const [[result]] = await db.query(query, params);

  const totalBase = Number(result.totalBase) || 0;
  const grandTotal = Number(result.grandTotal) || 0;
  const totalPF = Number(result.totalPF) || 0;

  // Compute Aggregate Taxes
  const totalGst = Math.round(totalBase * FinanceConfig.GST_RATE_BASIC);
  const totalComm = Math.round(totalBase * FinanceConfig.COMMISSION_RATE);
  const totalCommGst = Math.round(totalComm * FinanceConfig.GST_RATE_COMM);
  const totalPfGst = Math.round(totalPF * FinanceConfig.GST_RATE_PF);
  const totalTcs = Math.round(grandTotal * FinanceConfig.TCS_RATE);
  const totalTds = Math.round(totalBase * FinanceConfig.TDS_RATE);

  const totalLiability = Math.round(totalGst + totalCommGst + totalPfGst + totalTcs + totalTds);

  return {
    totalGst,
    totalPlatformFeeGst: totalPfGst,
    totalCommissionGst: totalCommGst,
    totalTcs,
    totalTds,
    totalLiability
  };
}


module.exports = {
  create,
  findAll,
  findById,
  findByBatchId,
  markCancelled,
  countByBatch,
  findActiveBookings,
  getSummaryStats,
  calculateFinanceSummary
};
