const { Vendor, Activity, User, sequelize, Trek,

  City,
  Batch,
  Customer,
  Booking,
  Rating,
  BookingTraveler,
  CancellationBooking, } = require("../../models"); // User model import karo

const { Op, fn, col, literal, Sequelize } = require("sequelize");
const moment = require("moment");

const fs = require('fs');
const path = require('path');
const emailService = require('../../services/emailNotificationService');
const logger = require('../../utils/logger');

/**
 * GET ALL VENDORS
 */
/**
 * GET ALL VENDORS
 */

// --- CONSTANTS ---
const STATUS = {
  NEW: 'NEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  REVERIFY: "REVERIFY",
  REVERIFICATION_PENDING: 'REVERIFICATION_PENDING',
  REVERIFICATION_UPDATED: 'REVERIFICATION_UPDATED',
  KYC_UPDATE_PENDING: 'KYC_UPDATE_PENDING'
};

const ACTION = {
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  REVERIFY: 'REVERIFY'
};


exports.getAllVendors = async (req, res) => {
  try {
    const { status, search } = req.query;

    const where = {};

    if (status) where.application_status = status;

    if (search) {
      where[Op.or] = [
        { business_name: { [Op.like]: `%${search}%` } },
        { address: { [Op.like]: `%${search}%` } }
      ];
    }

    const vendors = await Vendor.findAll({
      where,
      order: [["createdAt", "DESC"]],
      attributes: { exclude: ["password"] },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["name", "phone", "email"]
        }
      ]
    });

    if (vendors.length > 0) {
      const formatted = vendors.map(v => {
        const vendorJSON = v.toJSON();
        vendorJSON.OperatorDetails = vendorJSON.user
          ? {
            operatorName: vendorJSON.user.name,
            operatorMobile: vendorJSON.user.phone,
            operatorEmail: vendorJSON.user.email
          }
          : null;
        delete vendorJSON.user;
        return vendorJSON;
      });

      res.json({
        status: true,
        message: "Data fetched successfully",
        data: formatted
      });
    } else {
      res.json({
        status: false,
        message: "No data found",
        data: []
      });
    }
  } catch (error) {
    console.error("getAllVendors error:", error);
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

exports.getAllVendorMang = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;

    const where = {};

    if (status) where.application_status = status;

    if (search) {
      where[Op.or] = [
        { business_name: { [Op.like]: `%${search}%` } },
        { address: { [Op.like]: `%${search}%` } }
      ];
    }

    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);
    const offset = (pageNumber - 1) * pageSize;

    const { rows: vendors, count: totalCount } = await Vendor.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      attributes: { exclude: ["password"] },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["name", "phone", "email"]
        }
      ],
      limit: pageSize,
      offset: offset
    });

    if (vendors.length > 0) {
      const formatted = vendors.map(v => {
        const vendorJSON = v.toJSON();
        vendorJSON.OperatorDetails = vendorJSON.user
          ? {
            operatorName: vendorJSON.user.name,
            operatorMobile: vendorJSON.user.phone,
            operatorEmail: vendorJSON.user.email
          }
          : null;
        delete vendorJSON.user;
        return vendorJSON;
      });

      res.json({
        status: true,
        message: "Data fetched successfully",
        data: formatted,
        pagination: {
          totalRecords: totalCount,
          currentPage: pageNumber,
          totalPages: Math.ceil(totalCount / pageSize),
          pageSize: pageSize
        }
      });
    } else {
      res.json({
        status: false,
        message: "No data found",
        data: [],
        pagination: {
          totalRecords: 0,
          currentPage: pageNumber,
          totalPages: 0,
          pageSize: pageSize
        }
      });
    }
  } catch (error) {
    console.error("getAllVendors error:", error);
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};


exports.getVendorCumulativeAnalysis = async (req, res) => {
  try {
    const vendorId = req.query.user_id; // ✅ FIX HERE


    if (!vendorId) {
      return res.status(403).json({
        status: false,
        message: "Access denied",
      });
    }

    const treks = await Trek.findAll({
      where: { vendor_id: vendorId },
      attributes: [
        "id",
        "title",
        //""
      ],
      include: [
        {
          model: Batch,
          as: "batches",
          attributes: ["id"],
          required: false
        },
        {
          model: Booking,
          as: "bookings",
          attributes: ["id", "user_id", "total_amount"],
          required: false
        }
      ]
    });

    const finalData = treks.map(trek => {
      const trekData = trek.toJSON();

      const totalBatches = trekData.batches?.length || 0;

      const uniqueCustomers = new Set(
        (trekData.bookings || []).map(b => b.user_id)
      ).size;

      const totalRevenue = (trekData.bookings || []).reduce(
        (sum, b) => sum + Number(b.total_amount || 0),
        0
      );

      return {
        trek_id: trekData.id,
        trek: trekData.title,
        total_batches: totalBatches,
        rating: trekData.rating || 0,
        total_customers: uniqueCustomers,
        historical_revenue: totalRevenue
      };
    });

    return res.json({
      status: true,
      message: "Vendor cumulative analysis fetched successfully",
      data: finalData
    });

  } catch (error) {
    console.error("getVendorCumulativeAnalysis error:", error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};


exports.getVendorDashboardSummary = async (req, res) => {
  try {
    const { vendor_id } = req.params;

    if (!vendor_id) {
      return res.status(400).json({
        status: false,
        message: "vendor_id is required"
      });
    }

    // 1. Total Treks (Hub Destinations)
    const totalTreks = await Trek.count({
      where: { vendor_id: vendor_id }
    });

    // 2. Total Batches (using trek_id)
    const totalBatches = await Batch.count({
      include: [
        {
          model: Trek,
          as: "trek",
          where: { vendor_id: vendor_id },
          attributes: []
        }
      ]
    });

    // 3. Total Customers from Booking
    const totalCustomers = await Booking.count({
      where: { vendor_id: vendor_id },
      distinct: true,
      col: "user_id"
    });

    res.json({
      status: true,
      message: "Vendor dashboard summary fetched successfully",
      data: {
        total_hub_destinations: totalTreks,          // total trek
        cumulative_registered_batches: totalBatches, // total batch of those treks
        lifetime_customers_satisfied: totalCustomers // from booking table
      }
    });

  } catch (error) {
    console.error("getVendorDashboardSummary error:", error);
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};


exports.getAdminDashboardSummary = async (req, res) => {
  try {
    // 1. Total Revenue from Payment table
    const revenueResult = await Booking.findOne({
      attributes: [[fn("SUM", col("total_amount")), "total_revenue"]],
      where: { status: "confirmed" },
      raw: true
    });

    const totalRevenue = revenueResult.total_revenue || 0;

    // 2. Total Treks
    const totalTreks = await Trek.count();

    // 3. Total Vendors
    const totalVendors = await Vendor.count();

    // 4. Active Vendors
    const activeVendors = await Vendor.count({
      where: { status: "active" }
    });

    // 5. Suspended Vendors
    const suspendedVendors = await Vendor.count({
      where: { status: "suspended" }
    });

    // 6. Banned Vendors
    const bannedVendors = await Vendor.count({
      where: { status: "banned" }
    });

    // 7. Disputes (from vendor status)
    const disputeVendors = await Vendor.count({
      where: { status: "dispute" }
    });

    res.json({
      status: true,
      message: "Admin dashboard summary fetched successfully",
      data: {
        total_revenue: Number(totalRevenue),
        total_treks: totalTreks,
        quality_score: null, // as requested
        total_vendors: totalVendors,
        active_vendors: activeVendors,
        suspended_vendors: suspendedVendors,
        banned_vendors: bannedVendors,
        disputes: disputeVendors
      }
    });

  } catch (error) {
    console.error("getAdminDashboardSummary error:", error);
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};


exports.getBatchesByTrek = async (req, res) => {
  const startTime = Date.now();
  const requestId = req.headers["x-request-id"] || `get-batches-trek-${Date.now()}`;

  try {
    const { trekId } = req.query;

    if (!trekId) {
      return res.status(400).json({
        success: false,
        message: "trekId is required",
      });
    }

    // 1. Fetch batches with trek
    const batches = await Batch.findAll({
      where: { trek_id: trekId },
      include: [
        {
          model: Trek,
          as: "trek",
          attributes: ["id", "title", "mtr_id", "city_ids"]
        }
      ],
      order: [["start_date", "ASC"]]
    });

    if (!batches || batches.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No batches found for this trek",
      });
    }

    // 2. Extract city_ids from trek
    const trek = batches[0].trek;
    let cityIds = [];

    if (trek.city_ids) {
      if (Array.isArray(trek.city_ids)) {
        cityIds = trek.city_ids;
      } else if (typeof trek.city_ids === "string") {
        try {
          cityIds = JSON.parse(trek.city_ids);
        } catch (err) {
          cityIds = trek.city_ids
            .replace("[", "")
            .replace("]", "")
            .split(",")
            .map(id => id.trim());
        }
      }
    }

    console.log("cityIds----------", cityIds);

    // convert all to Number (IMPORTANT)
    cityIds = cityIds.map(id => Number(id)).filter(id => !isNaN(id));

    console.log("🔥 FINAL cityIds =>", cityIds);

    // 3. Fetch city names
    const cities = await City.findAll({
      where: { id: cityIds },
      attributes: ["id", "city_name"]   // ⚠️ agar tumhare table me "name" hai to city_name ko name karo
    });

    console.log("🔥 CITIES FROM DB =>", cities.map(c => c.toJSON()));

    const cityMap = {};
    cities.forEach(city => {
      console.log("000000000000000000", city);
      cityMap[city.id] = city.dataValues.city_name; // ⚠️ yahan bhi check: city_name ya name
    });

    const cityNames = cityIds
      .map(id => cityMap[id])
      .filter(Boolean)
      .join(", ");

    console.log("🔥 FINAL cityNames =>", cityNames);

    // 4. Format response
    const formattedBatches = batches.map(batch => ({
      id: batch.id,
      tbr_id: batch.tbr_id,
      service_name: batch.trek?.title || "-",
      source_city: cityNames,
      departure: batch.start_date,
      arrival: batch.end_date,
      slots: `${batch.booked_slots}/${batch.capacity}`,
      revenue: `₹${batch.revenue || 0}`,
      status: batch.status,
    }));

    res.json({
      success: true,
      data: formattedBatches,
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${requestId}] Failed to get batches by trek`, {
      trekId: req.query.trekId,
      duration: `${duration}ms`,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      message: "Database operation failed",
      error: error.message,
    });
  }
};








/**
 * GET VENDOR BY ID
 */
exports.getVendorById = async (req, res) => {
  try {
    const vendor = await Vendor.findByPk(req.params.id, {
      attributes: { exclude: ["password"] },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["name", "phone", "email"]
        }
      ]
    });

    if (!vendor) {
      return res.status(404).json({
        status: false,
        message: "Vendor not found"
      });
    }

    const vendorJSON = vendor.toJSON();
    vendorJSON.OperatorDetails = vendorJSON.user
      ? {
        operatorName: vendorJSON.user.name,
        operatorMobile: vendorJSON.user.phone,
        operatorEmail: vendorJSON.user.email
      }
      : null;
    delete vendorJSON.user;

    res.json({
      status: true,
      message: "Data fetched successfully",
      data: vendorJSON
    });
  } catch (error) {
    console.error("getVendorById error:", error);
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

/**
 * APPROVE / REJECT / REVERIFY
 */
exports.vendorAction = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { action, remarks } = req.body;

    if (!["APPROVE", "REJECT", "REVERIFY"].includes(action)) {
      return res.status(400).json({
        status: false,
        message: "Invalid action",
        data: null
      });
    }

    const vendor = await Vendor.findByPk(id, { transaction: t });

    if (!vendor) {
      await t.rollback();
      return res.status(404).json({
        status: false,
        message: "Vendor not found",
        data: null
      });
    }

    const statusMap = {
      APPROVE: "approved",
      REJECT: "rejected",
      REVERIFY: "reverify"
    };

    await vendor.update(
      {
        status: statusMap[action],
        remarks: remarks || null
      },
      { transaction: t }
    );

    // Audit Activity
    await Activity.create(
      {
        type: "VENDOR_STATUS_CHANGE",
        entity_id: vendor.id,
        meta: { action, remarks }
      },
      { transaction: t }
    );

    await t.commit();

    res.json({
      status: true,
      message: `Vendor ${statusMap[action]} successfully`,
      data: { status: vendor.status }
    });
  } catch (error) {
    await t.rollback();
    console.error("vendorAction error:", error);
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};


exports.getKycPendingVendors = async (req, res) => {
  console.log("********************************************************************************************");
  try {
    const vendorsList = await Vendor.findAll({
      where: {
        kyc_status: 'pending'
      },
      order: [['id', 'DESC']]
    });


    console.log("vendorsList", vendorsList);
    return res.status(200).json({
      success: true,
      count: vendorsList.length,
      data: vendorsList
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Something went wrong'
    });
  }
};


exports.updateVendorKycStatus = async (req, res) => {
  try {
    const { vendor_id, kyc_status } = req.body;

    if (!vendor_id || !kyc_status) {
      return res.status(400).json({
        success: false,
        message: "vendor_id and kyc_status are required"
      });
    }

    // const vendor = await Vendor.findByPk(vendor_id);

    const vendor = await Vendor.findOne({ where: { user_id: vendor_id } })

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found"
      });
    }

    await vendor.update({
      kyc_status: kyc_status
    });

    return res.status(200).json({
      success: true,
      message: "KYC status updated successfully",
      data: vendor
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong"
    });
  }
};






exports.changeVendorStatus = async (req, res) => {
  try {
    const { vendor_id, status, reason } = req.body;

    if (!vendor_id || !status) {
      return res.status(400).json({ success: false, message: 'vendor_id and status are required' });
    }

    if (!Object.values(STATUS).includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    // Fetch vendor along with associated user
    const vendor = await Vendor.findOne({
      where: { user_id: vendor_id },
      include: [
        {
          model: User, // assuming you have a User model associated with Vendor
          as: 'user', // check your association alias
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    /* ---------------- STATUS UPDATE ---------------- */
    vendor.application_status = status;

    // Prepare email payload data
    let emailData = {
      status,
      businessName: vendor.business_name,
      vendorId: vendor.vin_id || '',
      name: vendor.user?.name || '',
      email: vendor.user?.email || ''
    };

    if (status === 'REJECTED' || status === 'REVERIFY') {
      if (!reason) {
        return res.status(400).json({ success: false, message: 'Reason is required for this status' });
      }
      vendor.status_reason = reason;

      // send email (fire-and-forget to avoid blocking response)
      if (emailData.email) {
        sendVendorStatusEmailTest({ ...emailData, reason }).catch(err =>
          logger.error('vendor', `changeVendorStatus: failed to send ${status} email for vendor ${vendor_id}`, { error: err.message })
        );
      } else {
        logger.warn('vendor', `changeVendorStatus: skipping ${status} email for vendor ${vendor_id} — no email address found`);
      }
    } else {
      vendor.status_reason = null;
    }

    if (status === 'APPROVED') {
      logger.info('vendor', `changeVendorStatus: approving vendor ${vendor_id}`, { businessName: vendor.business_name });
      // Generate VIN only if not already generated
      if (!vendor.vin_id) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');

        vendor.vin_id = `VID-${year}${month}${day}${vendor.id}`;
        emailData.vendorId = vendor.vin_id;
        if (emailData.email) {
          sendVendorStatusEmailTest(emailData).catch(err =>
            logger.error('vendor', `changeVendorStatus: failed to send APPROVED email for vendor ${vendor_id}`, { error: err.message })
          );
        } else {
          logger.warn('vendor', `changeVendorStatus: skipping APPROVED email for vendor ${vendor_id} — no email address found`);
        }
      }
    } else {
      vendor.vin_id = null;
    }

    await vendor.save();

    return res.json({
      success: true,
      message: 'Vendor status updated successfully',
      data: {
        vendor_id: vendor.id,
        application_status: vendor.application_status,
        status_reason: vendor.status_reason
      }
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};


exports.getVendorPerformanceDashboard = async (req, res) => {
  try {
    const { filter, startDate, endDate, status } = req.query;

    let dateFilter = {};

    // ================= Date Filters =================
    if (filter === "today") {
      dateFilter = {
        created_at: {
          [Op.gte]: moment().startOf("day").toDate(),
          [Op.lte]: moment().endOf("day").toDate()
        }
      };
    }
    else if (filter === "this_week") {
      dateFilter = {
        created_at: {
          [Op.gte]: moment().startOf("week").toDate(),
          [Op.lte]: moment().endOf("week").toDate()
        }
      };
    }
    else if (filter === "this_month") {
      dateFilter = {
        created_at: {
          [Op.gte]: moment().startOf("month").toDate(),
          [Op.lte]: moment().endOf("month").toDate()
        }
      };
    }
    else if (filter === "custom" && startDate && endDate) {
      dateFilter = {
        created_at: {
          [Op.between]: [new Date(startDate), new Date(endDate)]
        }
      };
    }
    // else => all data

    // ================= Status Filter =================
    let bookingWhere = { ...dateFilter };
    if (status) {
      bookingWhere.status = status; // from booking table
    }

    // ================= Queries =================

    // Total Vendors
    const totalVendors = await Vendor.count();

    // Total Treks
    const totalTreks = await Trek.count({
      where: dateFilter
    });

    // Total Bookings
    const totalBookings = await Booking.count({
      where: bookingWhere
    });

    // Total Revenue
    const totalRevenue = await Booking.sum("total_amount", {
      where: bookingWhere
    });

    // Total Customers
    const totalCustomers = await BookingTraveler.count({
      include: [{
        model: Booking,
        as: "booking",      // 👈 VERY IMPORTANT
        required: true,
        where: bookingWhere
      }]
    });


    // Avg Rating
    const avgRating = await Rating.findOne({
      attributes: [[fn("AVG", col("rating_value")), "avg_rating"]],
      where: dateFilter,
      raw: true
    });

    // Total Cancelled
    const totalCancelled = await Booking.count({
      where: {
        ...bookingWhere,
        status: "cancelled"
      }
    });

    // Users Via Coupons (distinct users)
    const usersViaCoupons = await Booking.count({
      distinct: true,
      col: "user_id",
      where: {
        ...bookingWhere,
        coupon_id: { [Op.ne]: null }   // ya coupon_code
      }
    });

    // Total Disputes
    const totalDisputes = 0;

    // Credibility (example: % of successful bookings)
    const successfulBookings = await Booking.count({
      where: {
        ...bookingWhere,
        status: "completed"
      }
    });


    // Vendor Trek Cancellations
    const vendorTrekCancellations = await Booking.count({
      where: {
        ...bookingWhere,
        status: "cancelled"
      },
      include: [
        {
          model: Trek,
          as: "trek",
          required: true
          // agar vendor-wise chahiye to:
          // where: { vendor_id: req.user.id }
        }
      ]
    });


    // Total Reviews
    const totalReviews = await Rating.count({
      where: dateFilter
    });

    const credibility = totalBookings > 0
      ? ((successfulBookings / totalBookings) * 100).toFixed(2)
      : 0;

    // ================= Response =================
    res.json({
      success: true,
      data: {
        total_vendor: totalVendors,
        total_treks: totalTreks,
        total_bookings: totalBookings,
        total_revenue: totalRevenue || 0,
        totalReviews: totalReviews || 0,
        usersViaCoupons: usersViaCoupons || 0,
        total_customers: totalCustomers,
        vendorTrekCancellations: vendorTrekCancellations || 0,
        rating: avgRating?.avg_rating ? parseFloat(avgRating.avg_rating).toFixed(2) : 0,
        total_cancelled: totalCancelled,
        total_disputes: totalDisputes,
        credibility: credibility + "%",
        status_filter_used: status || "all"
      }
    });

  } catch (error) {
    console.error("Vendor Performance Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};



exports.getVendorPerformanceList = async (req, res) => {
  try {
    const {
      booking_status,
      user_status,
      designation,
      vendor_type,
      date_filter,     // today | this_week | this_month | all
      from_date,
      to_date
    } = req.query;

    /* ===================== DATE FILTER ===================== */
    let bookingWhere = {};
    let dateWhere = {};

    if (date_filter && date_filter !== "all") {
      let startDate, endDate;

      if (date_filter === "today") {
        startDate = moment().startOf("day").toDate();
        endDate = moment().endOf("day").toDate();
      }

      if (date_filter === "this_week") {
        startDate = moment().startOf("week").toDate();
        endDate = moment().endOf("week").toDate();
      }

      if (date_filter === "this_month") {
        startDate = moment().startOf("month").toDate();
        endDate = moment().endOf("month").toDate();
      }

      bookingWhere.created_at = { [Op.between]: [startDate, endDate] };
    }

    // Custom date range
    if (from_date && to_date) {
      bookingWhere.created_at = {
        [Op.between]: [
          moment(from_date).startOf("day").toDate(),
          moment(to_date).endOf("day").toDate()
        ]
      };
    }

    // Booking status
    if (booking_status && booking_status !== "all") {
      bookingWhere.status = booking_status;
    }

    /* ===================== USER FILTER ===================== */
    let userWhere = {};
    if (user_status && user_status !== "all") {
      userWhere.status = user_status;
    }



    /* ===================== VENDOR FILTER ===================== */
    let vendorWhere = {};
    /* if (vendor_type && vendor_type !== "all") {
       vendorWhere.vendor_type = vendor_type; // platinum | gold | normal
     }*/

    /* ===================== MAIN QUERY ===================== */
    const vendors = await Vendor.findAll({
      where: vendorWhere,
      attributes: [
        "id",
        "user_id",
        "business_logo",
        "vin_id",

        // ===== BOOKINGS =====
        [Sequelize.literal("COUNT(DISTINCT `bookings`.`id`)"), "total_bookings"],

        // ===== REVENUE =====
        [Sequelize.literal("IFNULL(SUM(`bookings`.`total_amount`),0)"), "total_revenue"],

        // ===== CUSTOMERS =====
        [
          Sequelize.literal("COUNT(DISTINCT `bookings->travelers`.`id`)"),
          "total_customers"
        ],

        // ===== CANCELLATIONS =====
        [
          Sequelize.literal(
            "SUM(CASE WHEN `bookings`.`status` = 'cancelled' THEN 1 ELSE 0 END)"
          ),
          "total_cancels"
        ],

        // ===== AVG RATING =====
        [
          Sequelize.literal(
            "ROUND(AVG(`treks->ratings`.`rating_value`),1)"
          ),
          "avg_rating"
        ],

        // ===== TOTAL REVIEWS =====
        [
          Sequelize.literal(
            "COUNT(DISTINCT `treks->ratings`.`id`)"
          ),
          "total_reviews"
        ],

        // ===== CREDIBILITY =====
        [
          Sequelize.literal(`
            ROUND(
              (
                SUM(CASE WHEN \`bookings\`.\`status\` = 'completed' THEN 1 ELSE 0 END)
                /
                NULLIF(COUNT(\`bookings\`.\`id\`),0)
              ) * 100, 1
            )
          `),
          "credibility"
        ]
      ],

      include: [
        // USER FILTERS
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "status", "created_at"],
          where: userWhere,
          required: true
        },

        // BOOKINGS FILTERS
        {
          model: Booking,
          as: "bookings",
          attributes: [],
          where: bookingWhere,
          required: false,
          include: [
            {
              model: BookingTraveler,
              as: "travelers",
              attributes: [],
              required: false
            }
          ]
        },

        // RATINGS
        {
          model: Trek,
          as: "treks",
          attributes: [],
          required: false,
          include: [
            {
              model: Rating,
              as: "ratings",
              attributes: [],
              required: false
            }
          ]
        }
      ],

      group: ["Vendor.id", "user.id"],
      raw: false
    });

    return res.json({
      success: true,
      filters_applied: {
        booking_status,
        user_status,
        designation,
        //    vendor_type,
        date_filter,
        from_date,
        to_date
      },
      count: vendors.length,
      data: vendors
    });

  } catch (error) {
    console.error("Vendor Performance List Error:", error);
    return res.status(500).json({
      success: false,
      message: "Database operation failed",
      error: error.message
    });
  }
};



exports.getVendorUnderperformersList = async (req, res) => {
  try {
    const {
      date_type = "all",
      from_date,
      to_date,
      booking_status = "all",
      user_status = "all",
      vendor_type = "all",
      designation = "all"
    } = req.query;

    /* ================= DATE FILTER ================= */
    let dateWhere = {};
    if (date_type === "today") {
      dateWhere = {
        created_at: {
          [Op.gte]: moment().startOf("day").toDate(),
          [Op.lte]: moment().endOf("day").toDate()
        }
      };
    } else if (date_type === "week") {
      dateWhere = {
        created_at: {
          [Op.gte]: moment().startOf("week").toDate(),
          [Op.lte]: moment().endOf("week").toDate()
        }
      };
    } else if (date_type === "month") {
      dateWhere = {
        created_at: {
          [Op.gte]: moment().startOf("month").toDate(),
          [Op.lte]: moment().endOf("month").toDate()
        }
      };
    } else if (date_type === "custom" && from_date && to_date) {
      dateWhere = {
        created_at: {
          [Op.between]: [from_date, to_date]
        }
      };
    }

    /* ================= BOOKING FILTER ================= */
    let bookingWhere = { ...dateWhere };
    if (booking_status !== "all") {
      bookingWhere.status = booking_status;
    }

    /* ================= USER FILTER ================= */
    let userWhere = {};
    if (user_status !== "all") {
      userWhere.status = user_status;
    }


    /* ================= VENDOR FILTER ================= */
    let vendorWhere = {};

    /* ================= QUERY ================= */
    const vendors = await Vendor.findAll({
      where: vendorWhere,

      attributes: [
        "id",
        "user_id",
        "vin_id",
        "business_logo",

        // BOOKINGS
        [Sequelize.literal("COUNT(DISTINCT `bookings`.`id`)"), "total_bookings"],

        // REVENUE
        [Sequelize.literal("IFNULL(SUM(`bookings`.`total_amount`),0)"), "total_revenue"],

        // CUSTOMERS
        [
          Sequelize.literal("COUNT(DISTINCT `bookings->travelers`.`id`)"),
          "total_customers"
        ],

        // CANCELLATIONS
        [
          Sequelize.literal(
            "SUM(CASE WHEN `bookings`.`status` = 'cancelled' THEN 1 ELSE 0 END)"
          ),
          "total_cancels"
        ],

        // AVG RATING (FROM TREK → RATING)
        [
          Sequelize.literal("ROUND(AVG(`treks->ratings`.`rating_value`),1)"),
          "avg_rating"
        ],

        // TOTAL REVIEWS
        [
          Sequelize.literal("COUNT(DISTINCT `treks->ratings`.`id`)"),
          "total_reviews"
        ],

        // CREDIBILITY
        [
          Sequelize.literal(`
            ROUND(
              (
                SUM(CASE WHEN \`bookings\`.\`status\` = 'completed' THEN 1 ELSE 0 END)
                /
                NULLIF(COUNT(\`bookings\`.\`id\`),0)
              ) * 100,
              1
            )
          `),
          "credibility"
        ]
      ],

      include: [
        {
          model: User,
          as: "user",
          where: userWhere,
          attributes: [
            "id",
            "name",
            "email",
            "status",

            "created_at"
          ],
          required: true
        },

        {
          model: Booking,
          as: "bookings",
          attributes: [],
          where: bookingWhere,
          required: false,
          include: [
            {
              model: BookingTraveler,
              as: "travelers",
              attributes: [],
              required: false
            }
          ]
        },

        {
          model: Trek,
          as: "treks",
          attributes: [],
          required: false,
          include: [
            {
              model: Rating,
              as: "ratings",
              attributes: [],
              required: false
            }
          ]
        }
      ],

      group: ["Vendor.id", "user.id"],

      // 🔴 UNDERPERFORMERS (LOW RATING)
      having: Sequelize.literal(
        "AVG(`treks->ratings`.`rating_value`) <= 2.5"
      ),

      order: [[Sequelize.literal("avg_rating"), "ASC"]],

      subQuery: false
    });

    res.json({
      success: true,
      count: vendors.length,
      data: vendors
    });

  } catch (error) {
    console.error("Vendor Underperformer Error:", error);
    res.status(500).json({
      success: false,
      message: "Database operation failed",
      error: error.message
    });
  }
};

exports.getTopPerformers = async (req, res) => {
  try {
    const query = `
      SELECT 
        v.id,
        v.business_name,
        v.vin_id,
        v.business_logo,
        IFNULL(AVG(r.rating_value), 0) AS average_rating,
        SUM(b.total_amount) AS revenue
      FROM vendors v
      INNER JOIN treks t ON t.vendor_id = v.id
      INNER JOIN bookings b ON b.trek_id = t.id
      LEFT JOIN ratings r ON r.trek_id = t.id
      GROUP BY v.id
      ORDER BY revenue DESC
      LIMIT 20
    `;

    const revenueLeaders = await sequelize.query(query, {
      type: sequelize.QueryTypes.SELECT
    });

    res.json({
      success: true,
      data: revenueLeaders
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Database operation failed",
      error: error.message
    });
  }
};

exports.getVendorOverview = async (req, res) => {
  //try {
  const { vendorId } = req.params;

  /* ===================== 1. VENDOR + USER ===================== */
  const vendor = await Vendor.findOne({
    where: { id: vendorId },
    attributes: ["id", "user_id"],
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "name", "email", "status"]
      }
    ]
  });

  if (!vendor) {
    return res.status(404).json({
      success: false,
      message: "Vendor not found"
    });
  }

  /* ===================== 2. FINANCIAL PERFORMANCE ===================== */
  const financial = await Vendor.findOne({
    where: { id: vendorId },
    attributes: [
      [Sequelize.literal("COUNT(DISTINCT `bookings`.`id`)"), "total_bookings"],
      [
        Sequelize.literal(
          "IFNULL(SUM(`bookings`.`total_amount`),0)"
        ),
        "total_revenue"
      ],
      [
        Sequelize.literal(
          "COUNT(DISTINCT `bookings->travelers`.`id`)"
        ),
        "total_customers"
      ],
      [
        Sequelize.literal(
          "ROUND(AVG(`treks->ratings`.`rating_value`),1)"
        ),
        "avg_rating"
      ]
    ],
    include: [
      {
        model: Booking,
        as: "bookings",
        attributes: [],
        required: false,
        include: [
          {
            model: BookingTraveler,
            as: "travelers",
            attributes: [],
            required: false
          }
        ]
      },
      {
        model: Trek,
        as: "treks",
        attributes: [],
        required: false,
        include: [
          {
            model: Rating,
            as: "ratings",
            attributes: [],
            required: false
          }
        ]
      }
    ],
    raw: true
  });

  /* ===================== 3. OPERATIONAL METRICS ===================== */
  const operational = await Vendor.findOne({
    where: { id: vendorId },
    attributes: [
      [
        Sequelize.literal("COUNT(DISTINCT `treks`.`id`)"),
        "total_treks"
      ],
      [
        Sequelize.literal(
          "SUM(CASE WHEN `treks`.`status` = 'active' THEN 1 ELSE 0 END)"
        ),
        "active_treks"
      ],
      [
        Sequelize.literal(
          "SUM(CASE WHEN `bookings`.`status` = 'cancelled' THEN 1 ELSE 0 END)"
        ),
        "cancellations"
      ],
      [
        Sequelize.literal(
          "(SELECT COUNT(*) FROM issue_reports WHERE issue_reports.vendor_id = Vendor.id)"
        ),
        "support_tickets"
      ]
    ],
    include: [
      {
        model: Trek,
        as: "treks",
        attributes: [],
        required: false
      },
      {
        model: Booking,
        as: "bookings",
        attributes: [],
        required: false
      }
    ],
    raw: true
  });

  /* ===================== 4. BOOKING LOGS ===================== */
  const booking_logs = await Booking.findAll({
    where: { vendor_id: vendorId },
    attributes: [
      "id",
      "trek_id",
      "total_amount",
      "status",
      "created_at"
    ],
    include: [
      {
        model: BookingTraveler,
        as: "travelers",
        //  attributes: ["name"],
        limit: 1
      }
    ],
    order: [["created_at", "DESC"]],
    limit: 50
  });

  /* ===================== 5. CUSTOMER REVIEWS ===================== */
  const customer_reviews = await Rating.findAll({
    attributes: ["rating_value", "created_at"],
    include: [
      {
        model: Trek,
        as: "trek",
        where: { vendor_id: vendorId },
        attributes: []
      },
      {
        model: Customer,
        as: "customer",
        attributes: ["id", "name"]
      }
    ],
    order: [["created_at", "DESC"]],
    limit: 50
  });

  /* ===================== 6. ADMINISTRATION ===================== */
  const administration = {
    current_status: vendor.user.status,
    allowed_actions: ["block", "unblock", "ban"]
  };

  /* ===================== FINAL RESPONSE ===================== */
  return res.json({
    success: true,
    vendor,
    financial_performance: financial,
    operational_metrics: operational,
    booking_logs,
    customer_reviews,
    administration
  });

  /*} catch (error) {
    console.error("Vendor Overview Error:", error);
    return res.status(500).json({
      success: false,
      message: "Database operation failed",
      error: error.message
    });
  }*/
};


exports.getTopPerformersDashboard = async (req, res) => {
  try {

    // 1️⃣ Revenue Leaders
    const revenueLeadersQuery = `
      SELECT 
        v.id,
        v.business_name,
        v.business_logo,
        SUM(b.total_amount) AS total_revenue
      FROM vendors v
      INNER JOIN treks t ON t.vendor_id = v.id
      INNER JOIN bookings b ON b.trek_id = t.id
      GROUP BY v.id
      ORDER BY total_revenue DESC
      LIMIT 5
    `;

    // 2️⃣ High Booking Volume
    const bookingVolumeQuery = `
      SELECT 
        v.id,
        v.business_name,
        v.business_logo,
        COUNT(b.id) AS total_bookings
      FROM vendors v
      INNER JOIN treks t ON t.vendor_id = v.id
      INNER JOIN bookings b ON b.trek_id = t.id
      GROUP BY v.id
      ORDER BY total_bookings DESC
      LIMIT 5
    `;

    // 3️⃣ Highest Rated Vendors
    const highestRatedQuery = `
      SELECT 
        v.id,
        v.business_name,
        v.business_logo,
        ROUND(IFNULL(AVG(r.rating_value),0),1) AS average_rating
      FROM vendors v
      INNER JOIN treks t ON t.vendor_id = v.id
      LEFT JOIN ratings r ON r.trek_id = t.id
      GROUP BY v.id
      HAVING average_rating > 0
      ORDER BY average_rating DESC
      LIMIT 5
    `;

    // 4️⃣ Highest Paid Vendors (same revenue but strict payment focus)
    const highestPaidQuery = `
      SELECT 
        v.id,
        v.business_name,
        v.business_logo,
        SUM(b.total_amount) AS highest_paid
      FROM vendors v
      INNER JOIN treks t ON t.vendor_id = v.id
      INNER JOIN bookings b ON b.trek_id = t.id
      WHERE b.payment_status = 'paid'
      GROUP BY v.id
      ORDER BY highest_paid DESC
      LIMIT 5
    `;

    const [
      revenueLeaders,
      bookingVolume,
      highestRated,
      highestPaid
    ] = await Promise.all([
      sequelize.query(revenueLeadersQuery, { type: sequelize.QueryTypes.SELECT }),
      sequelize.query(bookingVolumeQuery, { type: sequelize.QueryTypes.SELECT }),
      sequelize.query(highestRatedQuery, { type: sequelize.QueryTypes.SELECT }),
      sequelize.query(highestPaidQuery, { type: sequelize.QueryTypes.SELECT })
    ]);

    res.json({
      success: true,
      data: {
        revenueLeaders,
        bookingVolume,
        highestRated,
        highestPaid
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Database operation failed",
      error: error.message
    });
  }
};


exports.getLowPerformers = async (req, res) => {
  try {
    const query = `
      SELECT 
        v.id,
        v.business_name,
        v.vin_id,
        v.business_logo,
        IFNULL(AVG(r.rating_value), 0) AS average_rating,
        SUM(b.total_amount) AS revenue
      FROM vendors v
      INNER JOIN treks t ON t.vendor_id = v.id
      INNER JOIN bookings b ON b.trek_id = t.id
      LEFT JOIN ratings r ON r.trek_id = t.id
      GROUP BY v.id
      HAVING average_rating <= 2
      ORDER BY revenue ASC
      LIMIT 20
    `;

    const lowPerformers = await sequelize.query(query, {
      type: sequelize.QueryTypes.SELECT
    });

    res.json({
      success: true,
      data: lowPerformers
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Database operation failed",
      error: error.message
    });
  }
};


exports.getAttentionRequired = async (req, res) => {
  try {
    // 1️⃣ High Disputes
    const highDisputesQuery = `
      SELECT 
        v.id,
        v.business_name,
        v.vin_id,
        v.business_logo,
        COUNT(b.id) AS dispute_count
      FROM vendors v
      INNER JOIN treks t ON t.vendor_id = v.id
      INNER JOIN bookings b ON b.trek_id = t.id AND b.status = 'dispute'
      GROUP BY v.id
      ORDER BY dispute_count DESC
      LIMIT 10
    `;
    const highDisputes = await sequelize.query(highDisputesQuery, { type: sequelize.QueryTypes.SELECT });

    // 2️⃣ Frequent Cancels
    const frequentCancelsQuery = `
      SELECT 
        v.id,
        v.business_name,
        v.vin_id,
        v.business_logo,
        COUNT(b.id) AS cancel_count
      FROM vendors v
      INNER JOIN treks t ON t.vendor_id = v.id
      INNER JOIN bookings b ON b.trek_id = t.id AND b.status = 'cancel'
      GROUP BY v.id
      ORDER BY cancel_count DESC
      LIMIT 10
    `;
    const frequentCancels = await sequelize.query(frequentCancelsQuery, { type: sequelize.QueryTypes.SELECT });

    // 3️⃣ Critical Ratings
    const criticalRatingsQuery = `
      SELECT 
        v.id,
        v.business_name,
        v.vin_id,
        v.business_logo,
        IFNULL(AVG(r.rating_value), 0) AS average_rating
      FROM vendors v
      INNER JOIN treks t ON t.vendor_id = v.id
      LEFT JOIN ratings r ON r.trek_id = t.id
      GROUP BY v.id
      HAVING average_rating <= 3
      ORDER BY average_rating ASC
      LIMIT 10
    `;
    const criticalRatings = await sequelize.query(criticalRatingsQuery, { type: sequelize.QueryTypes.SELECT });

    res.json({
      success: true,
      data: {
        highDisputes,
        frequentCancels,
        criticalRatings
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Database operation failed",
      error: error.message
    });
  }
};



/* ================= DYNAMIC MESSAGE GENERATOR ================= */

/*function generateEmailPayload(data) {
  const { status, businessName, vendorId, reason, name } = data;

  switch (status) {

    case STATUS.APPROVED:
      return {
        subject: `Congratulations! Account Approved - ${businessName}`,
        notificationTitle: 'Application Approved',
        notificationBody: 'Your vendor account has been approved 🎉',
        body: `
          <p>Dear ${name},</p>
          <p>We are thrilled to inform you that your operator account application for
          <strong>${businessName}</strong> has been successfully <strong>APPROVED</strong>.</p>
          <p><strong>Your unique Vendor ID is:</strong> ${vendorId}</p>
          <p>You can now log in to your dashboard using your registered email address.</p>
          <p>Welcome to our platform!</p>
          <p>Best Regards,<br/>The Team</p>
        `
      };

    case STATUS.REJECTED:
      return {
        subject: `Application Update - ${businessName}`,
        notificationTitle: 'Application Rejected',
        notificationBody: 'Your application has been rejected',
        body: `
          <p>Dear ${name},</p>
          <p>We regret to inform you that your application for an operator account has been declined.</p>
          <p><strong>Reason for decision:</strong><br/>${reason}</p>
          <p>If you have any questions or would like to appeal this decision, please contact support.</p>
          <p>Best Regards,<br/>Admin Team</p>
        `
      };

    case STATUS.REVERIFICATION_PENDING:
      return {
        subject: `Action Required: Corrections Needed for ${businessName}`,
        notificationTitle: 'Action Required',
        notificationBody: 'Please update your application details',
        body: `
          <p>Dear ${name},</p>
          <p>Thank you for your submission. Our team has reviewed your application and we require a few updates to proceed further.</p>
          <p><strong>Please address the following issue(s):</strong><br/>${reason}</p>
          <p>Kindly log in to your portal and update the information at your earliest convenience.</p>
          <p>Best Regards,<br/>Verification Team</p>
        `
      };

    default:
      return {
        subject: 'Application Status Updated',
        notificationTitle: 'Status Updated',
        notificationBody: 'Your application status has been updated',
        body: `<p>Your application status has been updated.</p>`
      };
  }
}*/


/**
 * UPDATE VENDOR (KYC / PROFILE)
 */
exports.updateVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const [updated] = await Vendor.update(updates, {
      where: { id }
    });

    if (!updated) {
      return res.status(404).json({
        status: false,
        message: "Vendor not found",
        data: null
      });
    }

    res.json({
      status: true,
      message: "Vendor updated successfully",
      data: null
    });
  } catch (error) {
    console.error("updateVendor error:", error);
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

/**
 * GET VENDOR ACTIVITY LOGS
 */
exports.getVendorActivities = async (req, res) => {
  try {
    const activities = await Activity.findAll({
      where: { entity_id: req.params.id },
      order: [["createdAt", "DESC"]]
    });

    if (activities.length > 0) {
      res.json({
        status: true,
        message: "Activities fetched successfully",
        data: activities
      });
    } else {
      res.json({
        status: false,
        message: "No activities found",
        data: []
      });
    }
  } catch (error) {
    console.error("getVendorActivities error:", error);
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};


exports.sendMailZoho = async (req, res) => {
  try {
    const { to, subject, html } = req.body;

    if (!to || !subject || !html) {
      return res.status(400).json({
        success: false,
        message: "to, subject and html are required",
      });
    }

    const result = await emailService.transporter.sendMail({
      from: `contact@aorbotreks.com`,
      to,
      subject,
      html,

    });

    console.log(`📨 Email sent to ${to}:`, result.messageId);

    return res.status(200).json({
      success: true,
      message: "Email sent successfully",
      messageId: result.messageId,
    });

  } catch (err) {
    console.error("❌ Email send error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Failed to send email",
      error: err.message,
    });
  }
};



exports.getAuditLog = async (req, res) => {
  try {
    const { status, start_date, end_date, search } = req.query;

    const where = {
      application_status: {
        [Op.in]: ["APPROVED", "REJECTED", "REVERIFY"]
      }
    };

    // 🔹 Status filter
    if (status) {
      where.application_status = status;
    }

    // 🔹 Date filter
    if (start_date && end_date) {
      where.updated_at = {
        [Op.between]: [
          new Date(start_date),
          new Date(end_date)
        ]
      };
    } else {
      where.updated_at = {
        [Op.gte]: literal("DATE_SUB(CURDATE(), INTERVAL 7 DAY)")
      };
    }

    // 🔍 Search filter
    if (search) {
      where[Op.or] = [
        { vin_id: { [Op.like]: `%${search}%` } },
        { application_status: { [Op.like]: `%${search}%` } },
        //   { '$user.name$': { [Op.like]: `%${search}%` } }
      ];
    }

    const vendors = await Vendor.findAll({
      where,
      attributes: [
        "id",
        "application_status",
        "business_name",
        "vin_id",
        "status_reason",
        "remark",
        "updated_at",
        [fn("DATE", col("Vendor.updated_at")), "log_date"]
      ],
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name"]
        }
      ],
      order: [["updated_at", "DESC"]]
    });

    // ❌ No Data Found
    if (!vendors || vendors.length === 0) {
      return res.status(200).json({
        status: false,
        message: "No data found",
        total_actions: 0,
        total_approved: 0,
        total_rejected: 0,
        total_reverify: 0,
        slots: {}
      });
    }

    // 🔁 Group by Date
    const groupedData = {};
    vendors.forEach(v => {
      const date = v.getDataValue("log_date");
      if (!groupedData[date]) groupedData[date] = [];
      groupedData[date].push(v);
    });

    // 🔢 Counts
    const [total_approved, total_rejected, total_reverify] = await Promise.all([
      Vendor.count({ where: { ...where, application_status: "APPROVED" } }),
      Vendor.count({ where: { ...where, application_status: "REJECTED" } }),
      Vendor.count({ where: { ...where, application_status: "REVERIFY" } })
    ]);

    return res.status(200).json({
      status: true,
      message: "Data fetched successfully",
      total_actions: total_approved + total_rejected + total_reverify,
      total_approved,
      total_rejected,
      total_reverify,
      slots: groupedData
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: false,
      message: err.message
    });
  }
};





async function sendVendorStatusEmailTest(data) {
  console.log("---------------------------------------------------sms");
  const { status, businessName, vendorId, reason, name, email } = data;
  var urlLogin = (process.env.FRONTEND_URL || "http://localhost:5173") + "/vendor/registration";
  console.log("---------------------------------------------------status");
  let payload;

  switch (status) {
    case STATUS.APPROVED:
      payload = {
        subject: `Congratulations! Account Approved - ${businessName}`,
        body: `
        <div style="font-family: Arial, sans-serif; color: #333; line-height:1.6; max-width:600px; margin:auto; border:1px solid #e0e0e0; border-radius:8px; overflow:hidden;">
            
            <!-- Header -->
            <div style="background-color:#1e40af; color:white; padding:20px; text-align:center;">
                <img src="cid:arobo-logo" alt="Arobo Logo" style="height:50px; margin-bottom:10px;">
                <h2 style="margin:0; font-size:22px;">Account Approved!</h2>
            </div>

            <!-- Body -->
            <div style="padding:20px;">
                <p>Dear <strong>${name}</strong>,</p>

                <p>
                    We are pleased to inform you that your operator account for 
                    <strong>${businessName}</strong> has been <strong style="color:#16a34a;">APPROVED</strong>.
                </p>

                <p><strong>Vendor ID:</strong> ${vendorId}</p>

                <!-- Login Credentials Box -->
                <div style="margin:25px 0; padding:15px; background:#f1f5f9; border:1px dashed #1e40af; border-radius:6px;">
                    <h3 style="margin-top:0; color:#1e40af;">🔐 Login Credentials</h3>
                    <p style="margin:5px 0;"><strong>Email:</strong> ${email}</p>
                    <p style="margin:5px 0;"><strong>Temporary Password:</strong> ${data.name}</p>
                    <p style="font-size:13px; color:#555; margin-top:10px;">
                        ⚠️ For security reasons, please change your password after first login.
                    </p>
                </div>

                <!-- Login Button -->
                <div style="text-align:center; margin:30px 0;">
                    <a href="${urlLogin}"
                       style="background:#1e40af; color:#ffffff; text-decoration:none; padding:12px 25px;
                              border-radius:6px; font-size:16px; display:inline-block;">
                        👉 Click to Login
                    </a>
                </div>

                <p>
                    You can now access your dashboard and start managing your services.
                </p>

                <p style="margin-top:30px;">
                    Best Regards,<br/>
                    <strong>The Arobo Team</strong>
                </p>
            </div>

            <!-- Footer -->
            <div style="background:#f8f9fa; color:#555; text-align:center; padding:15px; font-size:12px;">
                &copy; 2025 Arobo Platform. All rights reserved.
            </div>
        </div>
        `
      };
      break;


    case STATUS.REJECTED:
      payload = {
        subject: `Application Update - ${businessName}`,
        body: `
                     <div style="font-family: Arial, sans-serif; color: #333; line-height:1.6; max-width: 600px; margin: auto; border:1px solid #e0e0e0; border-radius:8px; overflow:hidden;">
                    <div style="background-color:#dc2626; color:white; padding:20px; text-align:center;">
                        <img src="cid:arobo-logo" alt="Arobo Logo" style="height:50px; margin-bottom:10px;">
                        <h2 style="margin:0; font-size:22px;">Application Rejected</h2>
                    </div>
                    <div style="padding:20px;">
                        <p>Dear <strong>${name}</strong>,</p>
                        <p>We regret to inform you that your application for <strong>${businessName}</strong> has been <strong>REJECTED</strong>.</p>
                        <p><strong>Reason:</strong> ${reason}</p>
                        <p>If you have any questions or would like to appeal, please contact support.</p>
                        <p style="margin-top:30px;">Best Regards,<br/><strong>The Arobo Team</strong></p>
                    </div>
                    <div style="background:#f8f9fa; color:#555; text-align:center; padding:15px; font-size:12px;">
                        &copy; 2025 Arobo Platform. All rights reserved.
                    </div>
                </div>
                `
      };
      break;

    case STATUS.REVERIFY:
      payload = {
        subject: `Action Required: Corrections Needed for ${businessName}`,
        body: `
        <div style="font-family: Arial, sans-serif; color:#333; line-height:1.6;
                    max-width:600px; margin:auto; border:1px solid #e0e0e0;
                    border-radius:8px; overflow:hidden;">

            <!-- Header -->
            <div style="background-color:#f59e0b; color:white; padding:20px; text-align:center;">
                <img src="cid:arobo-logo" alt="Arobo Logo" style="height:50px; margin-bottom:10px;">
                <h2 style="margin:0; font-size:22px;">Action Required</h2>
            </div>

            <!-- Body -->
            <div style="padding:20px;">
                <p>Dear <strong>${name}</strong>,</p>

                <p>
                    Our team has reviewed your application for 
                    <strong>${businessName}</strong> and requires some updates.
                </p>

                
                <p style="background:#fff7ed; padding:10px; border-left:4px solid #f59e0b;">
                    <strong>Issues to address:</strong><br/>
                    ${reason}
                </p>

                

                <!-- Login Credentials Box -->
                <div style="margin:25px 0; padding:15px; background:#f1f5f9;
                            border:1px dashed #1e40af; border-radius:6px;">
                    <h3 style="margin-top:0; color:#1e40af;">🔐 Login Credentials</h3>
                    <p style="margin:5px 0;"><strong>Email:</strong> ${email}</p>
                    <p style="margin:5px 0;">
                        <strong>Temporary Password:</strong> ${data.name}
                    </p>
                    <p style="font-size:13px; color:#555; margin-top:10px;">
                        ⚠️ For security reasons, please change your password after first login.
                    </p>
                </div>

                <!-- Login Button -->
                <div style="text-align:center; margin:30px 0;">
                    <a href="${urlLogin}"
                       style="background:#1e40af; color:#ffffff; text-decoration:none;
                              padding:12px 30px; border-radius:6px;
                              font-size:16px; display:inline-block;">
                        👉 Click to Login
                    </a>
                </div>

                <p>
                    Please log in to your portal and update the required information
                    at the earliest to proceed with verification.
                </p>

                <p style="margin-top:30px;">
                    Best Regards,<br/>
                    <strong>The Arobo Team</strong>
                </p>
            </div>

            <!-- Footer -->
            <div style="background:#f8f9fa; color:#555; text-align:center;
                        padding:15px; font-size:12px;">
                &copy; 2025 Arobo Platform. All rights reserved.
            </div>
        </div>
        `
      };
      break;


    default:
      payload = {
        subject: 'Application Status Updated',
        body: `<p>Your application status has been updated.</p>`
      };
  }

  try {
    // Directly send email using transporter (bypassing sendErrorNotification)
    const result = await emailService.transporter.sendMail({
      from: emailService.config.from,
      to: email,
      subject: payload.subject,
      html: payload.body,
      attachments: [
        {
          filename: 'updated_logo.webp',
          path: 'https://www.aorbotreks.com/static/images/updated_logo.webp',
          cid: 'arobo-logo'
        }
      ]

    });

    console.log(`📨 Test email sent successfully to ${email}:`, result.messageId);
    return { success: true, messageId: result.messageId };

  } catch (err) {
    console.error(`❌ Failed to send test vendor email to ${email}:`, err.message);
    return { success: false, error: err.message };
  }
}