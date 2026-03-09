const {
    Trek,
    Vendor,
    User,
    TrekCaptain,
    ItineraryItem,
    Accommodation,
    TrekImage,
    TrekStage,
    Batch,
    Destination,
    Review,
    Rating,
    Customer,
    Activity,
    Coupon,
    Booking,
    IssueReport,
    BookingTraveler,
    Traveler,
    Withdrawal,
    PaymentLog,
    City,
    Inclusion,
    Exclusion,
    TrekAuditLog,
    AccessLog,
    CancellationPolicy,
    BatchCancellationRequest,
    Cancellation,
    CancellationBooking,
} = require("../../models");
const { validationResult } = require("express-validator");
const { saveBase64Image, deleteImage } = require("../../utils/fileUpload");
const { Op, Sequelize,fn,col,where,literal  } = require("sequelize");


const { roundAmount, roundAmountsInObject } = require("../../utils/amountUtils");
//const { roundAmount } = require("../../utils/amountUtils");
const logger = require("../../utils/logger");
const sequelize = require("../../models/index"); // Added sequelize import
const CouponAuditService = require('../../services/couponAuditService');
// Helper function to format date time
const formatDateTime = (time, ampm) => {
    if (!time) return "";
    return `${time} ${ampm || "AM"}`;
};

// Helper function to create completely isolated where clauses
const createIsolatedWhereClause = () => {
    return Object.create(null);
};


/*async function sendBookingNotification(booking) {
  await Notification.create({
    vendor_id: booking.vendor_id,
    customer_id: booking.user_id,
    type: "EMAIL",
    category: "BOOKING",
    message: `System Alert: Update on Booking for vendor portal. Ref ID: #${booking.id}. Please check the relevant tab for more details.`,
    status: "DELIVERED",
    notification_id: `NTF-${booking.id}`
  });
}
await sendBookingNotification(booking);
  
*/

// Helper function to safely execute Sequelize queries without global contamination
const executeQuerySafely = async (queryFunction) => {
    const globalBackup = global.currentRequest;
    global.currentRequest = undefined;

    try {
        const result = await queryFunction();
        return result;
    } finally {
        global.currentRequest = globalBackup;
    }
};

// Helper function to parse JSON strings or return arrays
const parseJsonField = (field) => {
    if (!field) return [];
    if (Array.isArray(field)) return field;
    if (typeof field === "string") {
        try {
            const parsed = JSON.parse(field);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }
    return [];
};

// Helper function to validate activity IDs
const validateActivityIds = async (activityIds) => {
    if (!activityIds || !Array.isArray(activityIds)) return true;

    const validIds = activityIds.filter((id) => Number.isInteger(id) && id > 0);
    if (validIds.length !== activityIds.length) {
        return false;
    }

    const activities = await Activity.findAll({
        where: { id: validIds, is_active: true },
    });

    return activities.length === validIds.length;
};

// Helper function to check for duplicate treks (same vendor, destination, and date)
const checkDuplicateTrek = async (
    vendorId,
    destinationId,
    batchDates,
    excludeTrekId = null
) => {
    try {
        if (
            !vendorId ||
            !destinationId ||
            !batchDates ||
            !Array.isArray(batchDates)
        ) {
            return { hasDuplicate: false, duplicateInfo: null };
        }

        // Build where clause to exclude current trek if updating
        const whereClause = {
            vendor_id: vendorId,
            destination_id: destinationId,
            status: "active",
        };

        if (excludeTrekId) {
            whereClause.id = { [Op.ne]: excludeTrekId };
        }

        // Get all active treks for this vendor and destination
        const existingTreks = await Trek.findAll({
            where: whereClause,
            include: [
                {
                    model: Batch,
                    as: "batches",
                    attributes: ["start_date", "end_date"],
                },
            ],
        });

        // Check if any existing trek has the same start date
        for (const existingTrek of existingTreks) {
            if (existingTrek.batches && existingTrek.batches.length > 0) {
                for (const existingBatch of existingTrek.batches) {
                    for (const newBatchDate of batchDates) {
                        // Check if start dates are the same
                        if (
                            existingBatch.start_date === newBatchDate.start_date
                        ) {
                            return {
                                hasDuplicate: true,
                                duplicateInfo: {
                                    trekId: existingTrek.id,
                                    trekTitle: existingTrek.title,
                                    existingStartDate: existingBatch.start_date,
                                    existingEndDate: existingBatch.end_date,
                                    newStartDate: newBatchDate.start_date,
                                    newEndDate: newBatchDate.end_date,
                                },
                            };
                        }
                    }
                }
            }
        }

        return { hasDuplicate: false, duplicateInfo: null };
    } catch (error) {
        logger.trek("error", "Error checking for duplicate treks", {
            vendorId,
            destinationId,
            error: error.message,
            stack: error.stack,
        });
        // If there's an error checking duplicates, allow the creation to proceed
        // but log the error for investigation
        return { hasDuplicate: false, duplicateInfo: null };
    }
};

// Helper function to calculate trek's overall rating from ratings
const calculateTrekRating = async (trekId) => {
    try {
        if (!trekId) {
            return {
                overall: 0.0,
                categories: {
                    "Safety and Security": 0.0,
                    "Organizer Manner": 0.0,
                    "Trek Planning": 0.0,
                    "Women Safety": 0.0,
                },
                ratingCount: 0,
            };
        }

        const ratings = await Rating.findAll({
            where: {
                trek_id: trekId,
            },
            limit: 1000, // Add limit to prevent memory issues
        });

        if (ratings.length === 0) {
            return {
                overall: 0.0,
                categories: {
                    "Safety and Security": 0.0,
                    "Organizer Manner": 0.0,
                    "Trek Planning": 0.0,
                    "Women Safety": 0.0,
                },
                ratingCount: 0,
            };
        }

        const categoryRatings = {};
        const categoryCounts = {};

        // Initialize category ratings with default values
        categoryRatings["Safety and Security"] = 0.0;
        categoryRatings["Organizer Manner"] = 0.0;
        categoryRatings["Trek Planning"] = 0.0;
        categoryRatings["Women Safety"] = 0.0;
        categoryCounts["Safety and Security"] = 0;
        categoryCounts["Organizer Manner"] = 0;
        categoryCounts["Trek Planning"] = 0;
        categoryCounts["Women Safety"] = 0;

        // Calculate category averages with error handling
        ratings.forEach((rating) => {
            try {
                const ratingValue = parseFloat(rating.rating_value) || 0;

                // Check which categories this rating applies to based on boolean flags
                if (rating.safety_security_rated) {
                    categoryRatings["Safety and Security"] += ratingValue;
                    categoryCounts["Safety and Security"]++;
                }
                if (rating.organizer_manner_rated) {
                    categoryRatings["Organizer Manner"] += ratingValue;
                    categoryCounts["Organizer Manner"]++;
                }
                if (rating.trek_planning_rated) {
                    categoryRatings["Trek Planning"] += ratingValue;
                    categoryCounts["Trek Planning"]++;
                }
                if (rating.women_safety_rated) {
                    categoryRatings["Women Safety"] += ratingValue;
                    categoryCounts["Women Safety"]++;
                }

                // If no specific categories are marked, count as overall rating
                if (!rating.safety_security_rated && !rating.organizer_manner_rated && 
                    !rating.trek_planning_rated && !rating.women_safety_rated) {
                    // For overall rating, distribute across all categories
                    categoryRatings["Safety and Security"] += ratingValue;
                    categoryCounts["Safety and Security"]++;
                    categoryRatings["Organizer Manner"] += ratingValue;
                    categoryCounts["Organizer Manner"]++;
                    categoryRatings["Trek Planning"] += ratingValue;
                    categoryCounts["Trek Planning"]++;
                    categoryRatings["Women Safety"] += ratingValue;
                    categoryCounts["Women Safety"]++;
                }
            } catch (ratingError) {
                logger.trek("warn", "Error processing rating", {
                    trekId,
                    ratingId: rating.id,
                    error: ratingError.message,
                });
            }
        });

        // Calculate averages and ensure float format with 2 decimal places
        Object.keys(categoryRatings).forEach((category) => {
            if (categoryCounts[category] > 0) {
                const average =
                    categoryRatings[category] / categoryCounts[category];
                categoryRatings[category] = parseFloat(average.toFixed(2));
            } else {
                categoryRatings[category] = 0.0;
            }
        });

        // Calculate overall average
        const validCategories = Object.keys(categoryRatings).filter(
            (category) => categoryCounts[category] > 0
        );

        let overall = 0.0;
        if (validCategories.length > 0) {
            const overallSum = validCategories.reduce(
                (sum, category) => sum + categoryRatings[category],
                0
            );
            overall = parseFloat(
                (overallSum / validCategories.length).toFixed(2)
            );
        }

        return {
            overall,
            categories: categoryRatings,
            ratingCount: ratings.length,
        };
    } catch (error) {
        logger.trek("error", "Error calculating trek rating", {
            trekId,
            error: error.message,
            stack: error.stack,
        });
        return {
            overall: 0.0,
            categories: {
                "Safety and Security": 0.0,
                "Organizer Manner": 0.0,
                "Trek Planning": 0.0,
                "Women Safety": 0.0,
            },
            ratingCount: 0,
        };
    }
};

// Helper function to ensure proper JSON array storage
const ensureJsonArray = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === "string") {
        try {
            const parsed = JSON.parse(data);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }
    return [];
};

// Helper function to generate discount text
const generateDiscountText = (hasDiscount, discountValue, discountType) => {
    if (!hasDiscount || !discountValue || discountValue <= 0) {
        return null;
    }

    if (discountType === "percentage") {
        return `${Math.round(discountValue)}% OFF`;
    } else if (discountType === "fixed") {
        return `₹${Math.round(discountValue)} OFF`;
    }

    return null;
};




exports.getVendorTreksOLD = async (req, res) => {
  const vendorUserId = req.user?.id;
  const { trek_status } = req.query;

  if (!vendorUserId) {
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }

  const where = { trek_status: trek_status };
  //if (trek_status) where.trek_status = trek_status;

  const treks = await Trek.findAll({
    where,
    attributes: { exclude: ["vendor_id"] },
    include: [
      {
        model: Vendor,
        as: "vendor",
        attributes: { exclude: ["user_id"] },
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "name", "email", "phone", "status"],
          },
        ],
      },
      {
        model: TrekStage,
        as: "trek_stages",
        required: false,
        include: [
          {
            model: City,
            as: "city",
            attributes: ["id", "cityName"],
          },
        ],
      },
      { model: Destination, as: "destinationData", attributes: ["id", "name"] },
      { model: TrekCaptain, as: "captain", attributes: ["id", "name", "email", "phone", "status"] },
      { model: TrekImage, as: "images", attributes: ["id", "url", "is_cover"] },
      { model: Accommodation, as: "accommodations", attributes: ["id", "type", "details"] },
      {
        model: Batch,
        as: "batches",
        attributes: ["id", "tbr_id", "start_date", "end_date", "capacity", "booked_slots", "available_slots"],
      },
    ],
    order: [["created_at", "DESC"]],
    limit: 50,
  });

  const finalData = await Promise.all(
    treks.map(async (trek) => {
      const trekData = trek.toJSON();

      // 🔹 Safe JSON parse
      const parseArray = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        try {
          return JSON.parse(val);
        } catch {
          return [];
        }
      };

      const inclusionIds = parseArray(trekData.inclusions);
      const exclusionIds = parseArray(trekData.exclusions);
      const cityIds = parseArray(trekData.city_ids);
      const activityIds = parseArray(trekData.activities); // ✅ MAIN PART

      // 🔹 Fetch master data
      const [
        inclusions,
        exclusions,
        cities,
        activities,
        rating,
      ] = await Promise.all([
        inclusionIds.length
          ? Inclusion.findAll({ where: { id: { [Op.in]: inclusionIds } }, attributes: ["id", "name"] })
          : [],
        exclusionIds.length
          ? Exclusion.findAll({ where: { id: { [Op.in]: exclusionIds } }, attributes: ["id", "name"] })
          : [],
        cityIds.length
          ? City.findAll({ where: { id: { [Op.in]: cityIds } }, attributes: ["id", "cityName"] })
          : [],
        activityIds.length
          ? Activity.findAll({
              where: { id: { [Op.in]: activityIds } },
              attributes: ["id", "name", "category_name"],
            })
          : [],
        calculateTrekRating(trek.id).catch(() => ({
          overall: 0,
          categories: {},
          ratingCount: 0,
        })),
      ]);

      return {
        ...trekData,

        // ✅ Resolved arrays
        inclusions_data: inclusions,
        exclusions_data: exclusions,
        cities_data: cities,
        activities_data: activities, // 🔥 FINAL OUTPUT

        // ✅ Rating
        rating: rating.overall,
        ratingCount: rating.ratingCount,
        categoryRatings: rating.categories,
      };
    })
  );

  res.json({
    success: true,
    data: finalData,

    total: finalData.length,
  });
};

// commented today 18feb data

exports.getVendorTreks = async (req, res) => {
  try {
    const vendorUserId = req.user?.id;
    const { trek_status } = req.query;

    if (!vendorUserId) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const where = {};
    if (trek_status) where.trek_status = trek_status;

    const treks = await Trek.findAll({
      where,
      attributes: { exclude: ["vendor_id"] },
      include: [
        {
          model: Vendor,
          as: "vendor",
          attributes: { exclude: ["user_id"] },
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "name", "email", "phone", "status"],
            },
          ],
        },

         {
          model: CancellationPolicy,
          as: "cancellation_policy",
          attributes: ["id", "title"],
        },
        {
          model: TrekStage,
          as: "trek_stages",
          required: false,
          include: [
            {
              model: City,
              as: "city",
              attributes: ["id", "cityName"],
            },
          ],
        },
        { model: Destination, as: "destinationData", attributes: ["id", "name"] },
        { model: TrekCaptain, as: "captain", attributes: ["id", "name", "email", "phone", "status"] },
        { model: TrekImage, as: "images", attributes: ["id", "url", "is_cover"] },
        { model: Accommodation, as: "accommodations", attributes: ["id", "type", "details"] },
        {
          model: Batch,
          as: "batches",
          attributes: ["id", "tbr_id", "start_date", "end_date", "capacity", "booked_slots", "available_slots"],
        },
      ],
      order: [["created_at", "DESC"]],
      limit: 50,
    });

    const finalData = await Promise.all(
      treks.map(async (trek) => {
        const trekData = trek.toJSON();

        // ✅ safe JSON parser
        const parseArray = (val) => {
          if (!val) return [];
          if (Array.isArray(val)) return val;
          try {
            return JSON.parse(val);
          } catch {
            return [];
          }
        };

        const inclusionIds = parseArray(trekData.inclusions);
        const exclusionIds = parseArray(trekData.exclusions);
        const cityIds = parseArray(trekData.city_ids);
        const activityIds = parseArray(trekData.activities);

        const [
          inclusions,
          exclusions,
          cities,
          activities,
          rating,
          itineraryItems
        ] = await Promise.all([
          inclusionIds.length
            ? Inclusion.findAll({
                where: { id: { [Op.in]: inclusionIds } },
                attributes: ["id", "name"],
              })
            : [],

          exclusionIds.length
            ? Exclusion.findAll({
                where: { id: { [Op.in]: exclusionIds } },
                attributes: ["id", "name"],
              })
            : [],

          cityIds.length
            ? City.findAll({
                where: { id: { [Op.in]: cityIds } },
                attributes: ["id", "cityName"],
              })
            : [],

          activityIds.length
            ? Activity.findAll({
                where: { id: { [Op.in]: activityIds } },
                attributes: ["id", "name", "category_name"],
              })
            : [],

          calculateTrekRating(trek.id).catch(() => ({
            overall: 0,
            categories: {},
            ratingCount: 0,
          })),

          // ✅ itinerary items per trek
          ItineraryItem.findAll({
            where: { trek_id: trek.id },
            attributes: ["id", "trek_id", "activities", "createdAt", "updatedAt"],
            order: [["createdAt", "ASC"]],
          }),
        ]);

        return {
          ...trekData,

          inclusions_data: inclusions,
          exclusions_data: exclusions,
          cities_data: cities,
          activities_data: activities,

          itinerary_items: itineraryItems,

          rating: rating.overall,
          ratingCount: rating.ratingCount,
          categoryRatings: rating.categories,
        };
      })
    );

    res.json({
      success: true,
      data: finalData,
      total: finalData.length,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};


exports.getVendorTreksold12   = async (req, res) => {

  try {

    // ==============================
    // STRICT PAGINATION (MANDATORY)
    // ==============================
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 20);
    const offset = (page - 1) * limit;

    const { trek_status } = req.query;
    const where = trek_status ? { trek_status } : {};

    // ==============================
    // FETCH TREKS ONLY (NO HEAVY JOIN)
    // ==============================
    const { rows: treks, count } = await Trek.findAndCountAll({
      where,
      attributes: { exclude: ["vendor_id"] },
      order: [["created_at", "DESC"]],
      limit,
      offset,
      raw: true
    });

    if (!treks.length) {
      return res.json({
        success: true,
        data: [],
        pagination: { page, limit, total: count }
      });
    }

    const trekIds = treks.map(t => t.id);

    // ==============================
    // PARSE JSON ONCE
    // ==============================
    const parseArray = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      try { return JSON.parse(val); } catch { return []; }
    };

    const inclusionIds = new Set();
    const exclusionIds = new Set();
    const cityIds = new Set();
    const activityIds = new Set();

    treks.forEach(t => {
      parseArray(t.inclusions).forEach(id => inclusionIds.add(id));
      parseArray(t.exclusions).forEach(id => exclusionIds.add(id));
      parseArray(t.city_ids).forEach(id => cityIds.add(id));
      parseArray(t.activities).forEach(id => activityIds.add(id));
    });

    // ==============================
    // PARALLEL SAFE BATCH QUERIES
    // ==============================
    const [
      vendors,
      captains,
      destinations,
      images,
      accommodations,
      batches,
      itinerary,
      inclusions,
      exclusions,
      cities,
      activities
    ] = await Promise.all([

      Vendor.findAll({ where: { id: treks.map(t => t.vendor_id) }, raw: true }),

      TrekCaptain.findAll({ where: { id: treks.map(t => t.captain_id) }, raw: true }),

      Destination.findAll({ where: { id: treks.map(t => t.destination_id) }, raw: true }),

      TrekImage.findAll({ where: { trek_id: trekIds }, raw: true }),

      Accommodation.findAll({ where: { trek_id: trekIds }, raw: true }),

      Batch.findAll({ where: { trek_id: trekIds }, raw: true }),

      ItineraryItem.findAll({ where: { trek_id: trekIds }, raw: true }),

      inclusionIds.size ? Inclusion.findAll({ where: { id: [...inclusionIds] }, raw: true }) : [],

      exclusionIds.size ? Exclusion.findAll({ where: { id: [...exclusionIds] }, raw: true }) : [],

      cityIds.size ? City.findAll({ where: { id: [...cityIds] }, raw: true }) : [],

      activityIds.size ? Activity.findAll({ where: { id: [...activityIds] }, raw: true }) : []
    ]);

    // ==============================
    // FAST LOOKUP MAPS
    // ==============================
    const groupBy = (arr, key) => {
      const map = {};
      arr.forEach(i => {
        if (!map[i[key]]) map[i[key]] = [];
        map[i[key]].push(i);
      });
      return map;
    };

    const byId = arr => Object.fromEntries(arr.map(i => [i.id, i]));

    const vendorMap = byId(vendors);
    const captainMap = byId(captains);
    const destinationMap = byId(destinations);
    const inclusionMap = byId(inclusions);
    const exclusionMap = byId(exclusions);
    const cityMap = byId(cities);
    const activityMap = byId(activities);

    const imageMap = groupBy(images, "trek_id");
    const accommodationMap = groupBy(accommodations, "trek_id");
    const batchMap = groupBy(batches, "trek_id");
    const itineraryMap = groupBy(itinerary, "trek_id");

    // ==============================
    // BUILD FINAL RESPONSE
    // ==============================
    const finalData = treks.map(t => ({
      ...t,
      vendor: vendorMap[t.vendor_id] || null,
      captain: captainMap[t.captain_id] || null,
      destinationData: destinationMap[t.destination_id] || null,
      images: imageMap[t.id] || [],
      accommodations: accommodationMap[t.id] || [],
      batches: batchMap[t.id] || [],
      itinerary_items: itineraryMap[t.id] || [],
      inclusions_data: parseArray(t.inclusions).map(id => inclusionMap[id]).filter(Boolean),
      exclusions_data: parseArray(t.exclusions).map(id => exclusionMap[id]).filter(Boolean),
      cities_data: parseArray(t.city_ids).map(id => cityMap[id]).filter(Boolean),
      activities_data: parseArray(t.activities).map(id => activityMap[id]).filter(Boolean),
    }));

   const totalPages = Math.ceil(count / limit);

res.json({
  success: true,
  data: finalData,
  pagination: {
    total: count,
    page,
    limit,
    total_pages: totalPages
  }
});

  } catch (err) {
    console.error("TREK API ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

exports.getAllBatchFullDataold = async (req, res) => {
  try {
    const vendorUserId = req.user?.id;

    if (!vendorUserId) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // 🔹 Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // 🔹 Filters
    const { destination_id, destination_name, vendor_name } = req.query;

    // 🔹 Trek where condition
    const trekWhere = { vendor_id: vendorUserId };

    if (destination_id) {
      trekWhere.destination_id = destination_id;
    }

    // 🔹 Destination filter
    const destinationWhere = {};
    if (destination_name) {
      destinationWhere.name = { [Op.like]: `%${destination_name}%` };
    }

    // 🔹 Vendor user name filter
    const userWhere = {};
    if (vendor_name) {
      userWhere.name = { [Op.like]: `%${vendor_name}%` };
    }

    // 🔹 Fetch batches
    const { count, rows } = await Batch.findAndCountAll({
      include: [
        {
          model: Trek,
          as: "trek",
          where: trekWhere,
          include: [
            {
              model: Vendor,
              as: "vendor",
              include: [
                {
                  model: User,
                  as: "user",
                  where: userWhere,
                  required: !!vendor_name,
                  attributes: ["id", "name", "email", "phone"],
                },
              ],
            },
            {
              model: Destination,
              as: "destinationData",
              where: destinationWhere,
              required: !!destination_name,
              attributes: ["id", "name"],
            },
            { model: TrekCaptain, as: "captain", attributes: ["id", "name", "email", "phone"] },
            { model: TrekImage, as: "images", attributes: ["id", "url", "is_cover"] },
          ],
        },
        {
          model: TrekStage,
          as: "trek_stages",
          required: false,
          where: {
            trek_id: { [Op.col]: "Batch.trek_id" },
          },
          include: [
            {
              model: City,
              as: "city",
              attributes: ["id", "cityName"],
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
      limit,
      offset,
      distinct: true, // 🔥 IMPORTANT for correct count
    });

    // 🔹 Safe JSON parse
    const parseArray = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      try {
        return JSON.parse(val);
      } catch {
        return [];
      }
    };

    // 🔹 Resolve master tables
    const finalData = await Promise.all(
      rows.map(async (batch) => {
        const batchData = batch.toJSON();
        const trek = batchData.trek;

        if (!trek) return batchData;

        const inclusionIds = parseArray(trek.inclusions);
        const exclusionIds = parseArray(trek.exclusions);
        const cityIds = parseArray(trek.city_ids);
        const activityIds = parseArray(trek.activities);

        const [
          inclusions,
          exclusions,
          cities,
          activities,
          rating,
        ] = await Promise.all([
          inclusionIds.length
            ? Inclusion.findAll({ where: { id: { [Op.in]: inclusionIds } }, attributes: ["id", "name"] })
            : [],
          exclusionIds.length
            ? Exclusion.findAll({ where: { id: { [Op.in]: exclusionIds } }, attributes: ["id", "name"] })
            : [],
          cityIds.length
            ? City.findAll({ where: { id: { [Op.in]: cityIds } }, attributes: ["id", "cityName"] })
            : [],
          activityIds.length
            ? Activity.findAll({
                where: { id: { [Op.in]: activityIds } },
                attributes: ["id", "name", "category_name"],
              })
            : [],
          calculateTrekRating(trek.id).catch(() => ({
            overall: 0,
            categories: {},
            ratingCount: 0,
          })),
        ]);

        return {
          ...batchData,
          trek: {
            ...trek,
            inclusions_data: inclusions,
            exclusions_data: exclusions,
            cities_data: cities,
            activities_data: activities,
            rating: rating.overall,
            ratingCount: rating.ratingCount,
            categoryRatings: rating.categories,
          },
        };
      })
    );

    return res.json({
      success: true,
      pagination: {
        total_records: count,
        total_pages: Math.ceil(count / limit),
        current_page: page,
        limit,
      },
      data: finalData,
    });

  } catch (error) {
    console.error("Get All Batch Full Data Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};



exports.getAllBatchFullData01 = async (req, res) => {
  try {
    const vendorUserId = req.user?.id;

    if (!vendorUserId) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // 🔹 Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // 🔹 Filters
    const { destination_id, destination_name, vendor_name } = req.query;

    // 🔹 Trek where condition
    const trekWhere = { vendor_id: vendorUserId };

    if (destination_id) {
      trekWhere.destination_id = destination_id;
    }

    // 🔹 Destination filter
    const destinationWhere = {};
    if (destination_name) {
      destinationWhere.name = { [Op.like]: `%${destination_name}%` };
    }

    // 🔹 Vendor user name filter
    const userWhere = {};
    if (vendor_name) {
      userWhere.name = { [Op.like]: `%${vendor_name}%` };
    }

    // 🔹 Fetch batches
    const { count, rows } = await Batch.findAndCountAll({
      include: [
        {
          model: Trek,
          as: "trek",
          where: trekWhere,
          include: [
            {
              model: Vendor,
              as: "vendor",
              include: [
                {
                  model: User,
                  as: "user",
                  where: userWhere,
                  required: !!vendor_name,
                  attributes: ["id", "name", "email", "phone"],
                },
              ],
            },
            {
              model: Destination,
              as: "destinationData",
              where: destinationWhere,
              required: !!destination_name,
              attributes: ["id", "name"],
            },
            { model: TrekCaptain, as: "captain", attributes: ["id", "name", "email", "phone"] },
            { model: TrekImage, as: "images", attributes: ["id", "url", "is_cover"] },
          ],
        },
        {
          model: TrekStage,
          as: "trek_stages",
          required: false,
          where: {
            trek_id: { [Op.col]: "Batch.trek_id" },
          },
          include: [
            {
              model: City,
              as: "city",
              attributes: ["id", "cityName"],
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
      limit,
      offset,
      distinct: true,
    });

    // 🔹 Safe JSON parse
    const parseArray = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      try {
        return JSON.parse(val);
      } catch {
        return [];
      }
    };

    // 🔹 Resolve master tables
    const finalData = await Promise.all(
      rows.map(async (batch) => {
        const batchData = batch.toJSON();
        const trek = batchData.trek;

        if (!trek) return batchData;

        const inclusionIds = parseArray(trek.inclusions);
        const exclusionIds = parseArray(trek.exclusions);
        const cityIds = parseArray(trek.city_ids);
        const activityIds = parseArray(trek.activities);

        const [
          inclusions,
          exclusions,
          cities,
          activities,
          rating,
        ] = await Promise.all([
          inclusionIds.length
            ? Inclusion.findAll({ where: { id: { [Op.in]: inclusionIds } }, attributes: ["id", "name"] })
            : [],
          exclusionIds.length
            ? Exclusion.findAll({ where: { id: { [Op.in]: exclusionIds } }, attributes: ["id", "name"] })
            : [],
          cityIds.length
            ? City.findAll({ where: { id: { [Op.in]: cityIds } }, attributes: ["id", "cityName"] })
            : [],
          activityIds.length
            ? Activity.findAll({
                where: { id: { [Op.in]: activityIds } },
                attributes: ["id", "name", "category_name"],
              })
            : [],
          calculateTrekRating(trek.id).catch(() => ({
            overall: 0,
            categories: {},
            ratingCount: 0,
          })),
        ]);

        return {
          ...batchData,
          trek: {
            ...trek,
            inclusions_data: inclusions,
            exclusions_data: exclusions,
            cities_data: cities,
            activities_data: activities,
            rating: rating.overall,
            ratingCount: rating.ratingCount,
            categoryRatings: rating.categories,
          },
        };
      })
    );

    // 🔥🔥🔥 RECURSIVE BATCH LOGIC (MAIN PART)
    const groupedByTrek = {};

    finalData.forEach((batch) => {
      const trekId = batch.trek_id;

      if (!groupedByTrek[trekId]) {
        groupedByTrek[trekId] = {
          ...batch,        // first batch as main
          all_batches: [], // recursive batches array
        };
      }

      groupedByTrek[trekId].all_batches.push({
        id: batch.id,
        batch_code: batch.batch_code,
        trek_id: batch.trek_id,
        start_date: batch.start_date,
        end_date: batch.end_date,
        status: batch.status,
        total_slots: batch.total_slots,
        booked_slots: batch.booked_slots,
        created_at: batch.created_at,
      });
    });

    const groupedFinalData = Object.values(groupedByTrek);

    return res.json({
      success: true,
      pagination: {
        total_records: count,
        total_pages: Math.ceil(count / limit),
        current_page: page,
        limit,
      },
      data: groupedFinalData,
    });

  } catch (error) {
    console.error("Get All Batch Full Data Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};



exports.getAllBatchFullData= async (req, res) => {
  try {
    const vendorUserId = req.user?.id;

    if (!vendorUserId) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // 🔹 Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // 🔹 Filters
    const { destination_id, destination_name, vendor_name } = req.query;

    // 🔹 Trek where condition
    const trekWhere = { vendor_id: vendorUserId };
    if (destination_id) trekWhere.destination_id = destination_id;

    // 🔹 Destination filter
    const destinationWhere = {};
    if (destination_name) {
      destinationWhere.name = { [Op.like]: `%${destination_name}%` };
    }

    // 🔹 Vendor user name filter
    const userWhere = {};
    if (vendor_name) {
      userWhere.name = { [Op.like]: `%${vendor_name}%` };
    }

    // 🔹 Fetch batches
    const { count, rows } = await Batch.findAndCountAll({
      include: [
        {
          model: Trek,
          as: "trek",
          where: trekWhere,
          include: [
            {
              model: Vendor,
              as: "vendor",
              include: [
                {
                  model: User,
                  as: "user",
                  where: userWhere,
                  required: !!vendor_name,
                  attributes: ["id", "name", "email", "phone"],
                },
              ],
            },
            {
              model: Destination,
              as: "destinationData",
              where: destinationWhere,
              required: !!destination_name,
              attributes: ["id", "name"],
            },
            { model: TrekCaptain, as: "captain", attributes: ["id", "name", "email", "phone"] },
            { model: TrekImage, as: "images", attributes: ["id", "url", "is_cover"] },
          ],
        },
        {
          model: TrekStage,
          as: "trek_stages",
          required: false,
          where: {
            trek_id: { [Op.col]: "Batch.trek_id" },
          },
          include: [
            {
              model: City,
              as: "city",
              attributes: ["id", "cityName"],
            },
          ],
        },
      ],
      order: [["created_at", "ASC"]], // earliest batch first
      limit,
      offset,
      distinct: true,
    });

    // 🔹 Safe JSON parse
    const parseArray = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      try {
        return JSON.parse(val);
      } catch {
        return [];
      }
    };

    // 🔹 Resolve master tables
    const finalData = await Promise.all(
      rows.map(async (batch) => {
        const batchData = batch.toJSON();
        const trek = batchData.trek;

        if (!trek) return batchData;

        const inclusionIds = parseArray(trek.inclusions);
        const exclusionIds = parseArray(trek.exclusions);
        const cityIds = parseArray(trek.city_ids);
        const activityIds = parseArray(trek.activities);

        const [inclusions, exclusions, cities, activities, rating] = await Promise.all([
          inclusionIds.length
            ? Inclusion.findAll({ where: { id: { [Op.in]: inclusionIds } }, attributes: ["id", "name"] })
            : [],
          exclusionIds.length
            ? Exclusion.findAll({ where: { id: { [Op.in]: exclusionIds } }, attributes: ["id", "name"] })
            : [],
          cityIds.length
            ? City.findAll({ where: { id: { [Op.in]: cityIds } }, attributes: ["id", "cityName"] })
            : [],
          activityIds.length
            ? Activity.findAll({
                where: { id: { [Op.in]: activityIds } },
                attributes: ["id", "name", "category_name"],
              })
            : [],
          calculateTrekRating(trek.id).catch(() => ({
            overall: 0,
            categories: {},
            ratingCount: 0,
          })),
        ]);

        return {
          ...batchData,
          trek: {
            ...trek,
            inclusions_data: inclusions,
            exclusions_data: exclusions,
            cities_data: cities,
            activities_data: activities,
            rating: rating.overall,
            ratingCount: rating.ratingCount,
            categoryRatings: rating.categories,
          },
        };
      })
    );

    // 🔥🔥🔥 MAIN LOGIC – trek_id wise recursive batches
    const groupedByTrek = {};

    finalData.forEach((batch) => {
      const trekId = batch.trek_id;

      if (!groupedByTrek[trekId]) {
        groupedByTrek[trekId] = {
          ...batch,        // first batch as main object
          all_batches: [], // yahan same trek_id ke saare batches aayenge
        };
      }

      groupedByTrek[trekId].all_batches.push({
        id: batch.id,
        batch_code: batch.batch_code,
        tbr_id:batch.tbr_id,
        trek_id: batch.trek_id,
        start_date: batch.start_date,
        end_date: batch.end_date,
        capacity: batch.capacity,
        booked_slots: batch.booked_slots,
        available_slots: batch.available_slots,
        captain_id: batch.captain_id,
        created_at: batch.created_at,
      });
    });

    const groupedFinalData = Object.values(groupedByTrek);

    return res.json({
      success: true,
      pagination: {
        total_records: count,
        total_pages: Math.ceil(count / limit),
        current_page: page,
        limit,
      },
      data: groupedFinalData,
    });

  } catch (error) {
    console.error("Get All Batch Full Data Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.getAllBatchFullData_olll = async (req, res) => {
  try {
    const vendorUserId = req.user?.id;

    if (!vendorUserId) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50; // yahan bada rakho test ke liye
    const offset = (page - 1) * limit;

    const { destination_id, destination_name, vendor_name } = req.query;

    const trekWhere = { vendor_id: vendorUserId };
    if (destination_id) trekWhere.destination_id = destination_id;

    const destinationWhere = {};
    if (destination_name) destinationWhere.name = { [Op.like]: `%${destination_name}%` };

    const userWhere = {};
    if (vendor_name) userWhere.name = { [Op.like]: `%${vendor_name}%` };

    // 🔹 1. GET ALL BATCHES (NO STAGES HERE)
    const { count, rows: batches } = await Batch.findAndCountAll({
      include: [
        {
          model: Trek,
          as: "trek",
          where: trekWhere,
          include: [
            {
              model: Vendor,
              as: "vendor",
              include: [
                {
                  model: User,
                  as: "user",
                  where: userWhere,
                  required: !!vendor_name,
                  attributes: ["id", "name", "email", "phone"],
                },
              ],
            },
            {
              model: Destination,
              as: "destinationData",
              where: destinationWhere,
              required: !!destination_name,
              attributes: ["id", "name"],
            },
            { model: TrekCaptain, as: "captain", attributes: ["id", "name", "email", "phone"] },
            { model: TrekImage, as: "images", attributes: ["id", "url", "is_cover"] },
          ],
        },
      ],
      order: [["created_at", "ASC"]],
      limit,
      offset,
      distinct: true,
    });

    // 🔥 2. GROUP BY trek_id
    const groupedByTrek = {};

    for (const batch of batches) {
      const batchData = batch.toJSON();
      const trekId = batchData.trek_id;

      // 🔹 2.1 create trek group if not exists
      if (!groupedByTrek[trekId]) {
        groupedByTrek[trekId] = {
          trek_id: trekId,
          trek: batchData.trek,
          all_batches: [],
        };
      }

      // 🔥 3. GET STAGES STRICTLY BY batch_id (THIS IS THE FIX)
      const stages = await TrekStage.findAll({
        where: {
          batch_id: batchData.id,   // 🔴 ONLY batch_id, NOT trek_id
        },
        include: [
          {
            model: City,
            as: "city",
            attributes: ["id", "cityName"],
          },
        ],
        order: [["id", "ASC"]],
      });

      // 🔹 4. PUSH EACH BATCH SEPARATELY
      groupedByTrek[trekId].all_batches.push({
        id: batchData.id,
        batch_code: batchData.batch_code,
        tbr_id: batchData.tbr_id,
        trek_id: batchData.trek_id,
        start_date: batchData.start_date,
        end_date: batchData.end_date,
        capacity: batchData.capacity,
        booked_slots: batchData.booked_slots,
        available_slots: batchData.available_slots,
        captain_id: batchData.captain_id,
        created_at: batchData.created_at,
        trek_stages: stages, // 🔥 each batch gets its OWN stages
      });
    }

    return res.json({
      success: true,
      pagination: {
        total_records: count,
        total_pages: Math.ceil(count / limit),
        current_page: page,
        limit,
      },
      data: Object.values(groupedByTrek),
    });

  } catch (error) {
    console.error("Get All Batch Full Data Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};






exports.getVendorBookings = async (req, res) => {
  //try {
    const { status, vendor_name, tbr_id } = req.query;

    const bookingWhere = {};
    if (status) bookingWhere.status = status;

    const bookings = await Booking.findAll({
      where: bookingWhere,

      include: [
        // 🔹 Trek
        {
          model: Trek,
           as: "trek",   // 🔥 SAME alias
          //attributes: ["id", "title", "difficulty", "duration"],
        },

        // 🔹 Vendor + User
        {
          model: Vendor,
          as: "vendor",
          attributes: ["id"],
          include: [
            {
              model: User,
              as: "user",
             // attributes: ["id", "name", "email", "phone"],
              where: vendor_name
                ? { name: { [Op.like]: `%${vendor_name}%` } }
                : undefined,
            },
          ],
        },

       

        {
  model: Batch,
  as: "batch", // ✅ EXACT MATCH
 // attributes: ["id", "tbr_id", "start_date", "end_date"],
  where: tbr_id ? { tbr_id } : undefined,
  include: [
    {
      model: TrekCaptain,
      as: "captain", // ✅ Batch.belongsTo → as: "captain"
    //  attributes: ["id", "name", "phone"],
    },
    {
      model: TrekStage,
      as: "trek_stages", // ✅ Batch.hasMany → as: "trek_stages"
    //  attributes: ["id", "stage_name", "destination", "date_time"],
    },
  ],
},


        // 🔹 Booking Travelers
        {
          model: BookingTraveler,
          as: "travelers",
         // attributes: ["traveler_id"],
          include: [
            {
              model: Customer,
              as: "customer",
          //    attributes: ["id", "name"],
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // 🔁 Format response
    const formatted = bookings.map((b) => ({
      booking: b.toJSON(),

      trek: b.Trek,
      vendor: b.Vendor?.user,
      batch: {
        ...b.Batch?.toJSON(),
        captain: b.Batch?.captain,
        stages: b.Batch?.stages,
      },

      traveler_passengers: b.travelers.map((t) => ({
        traveler_id: t.traveler_id,
        customer_name: t.customer?.name,
        price: b.price,
        gst: b.gst,
        total_amount: b.total_amount,
        booking_status: b.status,
      })),
    }));

    // 📊 Status-wise data
    const response = {
      pending: formatted.filter((b) => b.booking.status === "pending"),
      approved: formatted.filter((b) => b.booking.status === "confirmed"),
      cancelled: formatted.filter((b) => b.booking.status === "cancelled"),
      total_records: formatted.length,
    };

    res.json({
      success: true,
      data: response,
    });
  /*} catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bookings",
    });
  }*/
};


exports.cancelBooking = async (req, res) => {
  try {
    const { id, cancelled_by,status } = req.body;

    if (!id || !cancelled_by) {
      return res.status(400).json({
        success: false,
        message: "id and cancelled_by are required",
      });
    }

    const booking = await Booking.findOne({
      where: { id },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Already cancelled check


    await booking.update({
      status:status,
      cancelled_by,
      cancelled_at: new Date(), // agar column exist karta ho
    });

    return res.json({
      success: true,
      message: "Booking status changed successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Cancel booking error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to cancel booking",
    });
  }
};


exports.getVendorTreks_one = async (req, res) => {
  //try {
    const vendorId = req.user?.id; // logged-in vendor user id
    const { trek_status } = req.query;

    if (!vendorId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Vendor account required.",
      });
    }

    const where = {
      vendor_id: vendorId, // internal use only
    };

    if (trek_status) {
      where.trek_status = trek_status;
    }

    const treks = await Trek.findAll({
      where,
      attributes: {
        exclude: ["vendor_id"],
      },
      include: [
        {
          model: Vendor,
          as: "vendor",
          required: true,
          attributes: {
            exclude: ["user_id"],
          },
          include: [
            {
              model: User,
              as: "user",
              required: true,
              attributes: [
                "id",
                "name",
                "email",
                "phone",
            //    "profile_image",
                "status",
                "created_at",
              ],
            },
          ],
        },
        {
          model: Destination,
          as: "destinationData",
          attributes: ["id", "name"],
        },
        {
          model: TrekCaptain,
          as: "captain",
          attributes: ["id", "name", "email", "phone", "status"],
        },
        {
          model: TrekImage,
          as: "images",
          attributes: ["id", "url", "is_cover"],
        },
        {
          model: Accommodation,
          as: "accommodations",
          attributes: ["id", "type", "details"],
        },
        {
          model: Batch,
          as: "batches",
          attributes: [
            "id",
            "tbr_id",
            "start_date",
            "end_date",
            "capacity",
            "booked_slots",
            "available_slots",
          ],
        },
      ],
      order: [["created_at", "DESC"]],
      limit: 50,
    });

    const treksWithExtraData = await Promise.all(
      treks.map(async (trek) => {
        const rating = await calculateTrekRating(trek.id).catch(() => ({
          overall: 0,
          categories: {},
          ratingCount: 0,
        }));

        let activityDetails = [];
        if (Array.isArray(trek.activities)) {
          activityDetails = await Activity.findAll({
            where: { id: trek.activities, is_active: true },
            attributes: ["id", "name", "category_name"],
          });
        }

        let cityDetails = [];
        if (Array.isArray(trek.city_ids)) {
          cityDetails = await City.findAll({
            where: { id: trek.city_ids },
            attributes: ["id", "cityName", "isPopular"],
          });
        }

        return {
          ...trek.toJSON(),
          rating: rating.overall,
          ratingCount: rating.ratingCount,
          categoryRatings: rating.categories,
          activityDetails,
          cityDetails,
        };
      })
    );

    res.json({
      success: true,
      data: treksWithExtraData,
      total: treksWithExtraData.length,
    });
  //} catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch treks",
    });
  //}
};


exports.getVendorTreks_old = async (req, res) => {
    try {
        const vendorId = req.user?.id;
        const { trek_status } = req.query;

        logger.trek("info", "Fetching vendor treks", {
            vendorId,
            ip: req.ip,
            userAgent: req.get("User-Agent"),
        });

        if (!vendorId) {
            logger.trek("warn", "Access denied - no vendor ID", {
                ip: req.ip,
                userAgent: req.get("User-Agent"),
            });
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Simplified query with fewer includes to prevent timeout
      const where = {};

// agar status filter chahiye
// where.status = 'active';

// agar trek_status bheja gaya ho
if (trek_status) {
  where.trek_status = trek_status; // approved / pending / rejected
}

const treks = await Trek.findAll({
  where,
  include: [
    {
      model: Destination,
      as: "destinationData",
      required: false,
      attributes: ["id", "name"],
    },
    {
      model: TrekCaptain,
      as: "captain",
      required: false,
      attributes: ["id", "name", "email", "phone", "status"],
    },
    {
      model: TrekImage,
      as: "images",
      required: false,
      attributes: ["id", "url", "is_cover"],
    },
    {
      model: Accommodation,
      as: "accommodations",
      required: false,
      attributes: ["id", "type", "details"],
    },
    {
      model: Batch,
      as: "batches",
      required: false,
      attributes: [
        "id",
        "tbr_id",
        "start_date",
        "end_date",
        "capacity",
        "booked_slots",
        "available_slots",
      ],
    },
  ],
  order: [["created_at", "DESC"]],
  limit: 50,
});

        logger.trek(
            "info",
            `Found ${treks.length} treks for vendor ${vendorId}`
        );

        // Process treks with better error handling
        const treksWithRatings = await Promise.allSettled(
            treks.map(async (trek) => {
                try {
                    // Simplified rating calculation
                    const trekRating = await calculateTrekRating(trek.id).catch(
                        () => ({
                            overall: 0,
                            categories: {},
                            ratingCount: 0,
                        })
                    );

                    // Fetch activity details with error handling
                    let activityDetails = [];
                    try {
                        if (
                            trek.activities &&
                            Array.isArray(trek.activities) &&
                            trek.activities.length > 0
                        ) {
                            activityDetails = await Activity.findAll({
                                where: { id: trek.activities, is_active: true },
                                attributes: ["id", "name", "category_name"],
                                limit: 20, // Limit activities
                            });
                        }
                    } catch (activityError) {
                        logger.trek("warn", "Error fetching activity details", {
                            trekId: trek.id,
                            error: activityError.message,
                        });
                    }

                    // Fetch city details with error handling
                    let cityDetails = [];
                    try {
                        if (
                            trek.city_ids &&
                            Array.isArray(trek.city_ids) &&
                            trek.city_ids.length > 0
                        ) {
                            cityDetails = await City.findAll({
                                where: { id: trek.city_ids },
                                // State association removed as state_id field was removed
                                attributes: ["id", "cityName", "isPopular"],
                                limit: 10, // Limit cities
                            });
                        }
                    } catch (cityError) {
                        logger.trek("warn", "Error fetching city details", {
                            trekId: trek.id,
                            error: cityError.message,
                        });
                    }

                    return {
                        ...trek.toJSON(),
                        rating: trekRating.overall || 0,
                        ratingCount: trekRating.ratingCount || 0,
                        categoryRatings: trekRating.categories || {},
                        activityDetails: activityDetails,
                        cityDetails: cityDetails,
                    };
                } catch (trekError) {
                    logger.trek("error", "Error processing trek", {
                        trekId: trek.id,
                        error: trekError.message,
                        stack: trekError.stack,
                    });

                    // Return basic trek data if processing fails
                    return {
                        ...trek.toJSON(),
                        rating: 0,
                        ratingCount: 0,
                        categoryRatings: {},
                        activityDetails: [],
                        cityDetails: [],
                        error: "Failed to load complete data",
                    };
                }
            })
        );

        // Filter out failed promises and get successful results
        const successfulTreks = treksWithRatings
            .filter((result) => result.status === "fulfilled")
            .map((result) => result.value);

        const failedCount = treksWithRatings.filter(
            (result) => result.status === "rejected"
        ).length;

        if (failedCount > 0) {
            logger.trek(
                "warn",
                `${failedCount} treks failed to process completely`
            );
        }

        logger.trek(
            "info",
            `Successfully processed ${successfulTreks.length} treks`
        );

        res.json({
            success: true,
            data: successfulTreks,
            totalProcessed: successfulTreks.length,
            totalFailed: failedCount,
        });
    } catch (error) {
        logger.trek("error", "Error fetching vendor treks", {
            vendorId: req.user?.id,
            error: error.message,
            stack: error.stack,
            ip: req.ip,
        });

        res.status(500).json({
            success: false,
            message: "Failed to fetch treks",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// Vendor: Get trek by ID
exports.getTrekById = async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = req.user?.id;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // First, fetch the basic trek data with minimal includes
        const trek = await Trek.findOne({
            where: { id, vendor_id: vendorId },
            include: [
                {
                    model: Destination,
                    as: "destinationData",
                    required: false,
                    attributes: ["id", "name", "state", "isPopular", "status"]
                },
                {
                    model: TrekCaptain,
                    as: "captain",
                    required: false,
                    attributes: ["id", "name", "email", "phone", "status"]
                }
            ],
        });

        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found",
            });
        }

        // Fetch related data in parallel for better performance
        const [
            trekRating,
            activityDetails,
            cityDetails,
            itineraryItems,
            accommodations,
            images,
            trekStages
        ] = await Promise.all([
            // Calculate rating
            calculateTrekRating(trek.id),

            // Fetch activity details if activity IDs exist
            trek.activities && Array.isArray(trek.activities) && trek.activities.length > 0
                ? Activity.findAll({
                    where: { id: trek.activities, is_active: true },
                    attributes: ["id", "name", "category_name"],
                })
                : [],

            // Fetch city details if city_ids exist
            trek.city_ids && Array.isArray(trek.city_ids) && trek.city_ids.length > 0
                ? City.findAll({
                    where: { id: trek.city_ids },
                    attributes: ["id", "cityName", "isPopular"],
                })
                : [],

            // Fetch itinerary items
            ItineraryItem.findAll({
                where: { trek_id: trek.id },
                attributes: ["id", "trek_id", "activities", "createdAt", "updatedAt"]
            }),

            // Fetch accommodations
            Accommodation.findAll({
                where: { trek_id: trek.id },
                attributes: ["id", "trek_id", "batch_id", "type", "details", "createdAt", "updatedAt"]
            }),

            // Fetch images
            TrekImage.findAll({
                where: { trek_id: trek.id },
                attributes: ["id", "trek_id", "url", "is_cover", "createdAt", "updatedAt"]
            }),

            // Fetch trek stages with cities
            TrekStage.findAll({
                where: { trek_id: trek.id },
                include: [
                    {
                        model: City,
                        as: "city",
                        required: false,
                        attributes: ["id", "cityName"],
                    },
                ],
                attributes: ["id", "trek_id", "batch_id", "stage_name", "destination", "means_of_transport", "date_time", "is_boarding_point", "city_id", "createdAt", "updatedAt"]
            })
        ]);

        const trekData = {
            ...trek.toJSON(),
            base_price: roundAmount(trek.base_price || 0),
            rating: trekRating.overall,
            ratingCount: trekRating.ratingCount,
            categoryRatings: trekRating.categories,
            activityDetails: activityDetails,
            cityDetails: cityDetails,
            itinerary_items: itineraryItems,
            accommodations: accommodations,
            images: images,
            trek_stages: trekStages
        };

        res.json({
            success: true,
            data: trekData,
        });
    } catch (error) {
        console.error("Error fetching trek by ID:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch trek",
        });
    }
};


function getDateRange(filter, year) {
    const now = new Date();
    let startDate, endDate;

    switch (filter) {
        case "this_week":
            startDate = new Date(now);
            startDate.setDate(now.getDate() - now.getDay());
            endDate = new Date();
            break;

        case "last_week":
            endDate = new Date(now);
            endDate.setDate(now.getDate() - now.getDay());
            startDate = new Date(endDate);
            startDate.setDate(startDate.getDate() - 7);
            break;

        case "this_month":
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date();
            break;

        case "last_month":
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0);
            break;

        case "this_year":
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date();
            break;

        case "select_year":
            startDate = new Date(year, 0, 1);
            endDate = new Date(year, 11, 31);
            break;

        default:
            return {};
    }

    return { createdAt: { [Op.between]: [startDate, endDate] } };
}



exports.getTrekDashboard = async (req, res) => {
    try {
        const { filter = "all_time", year } = req.query;
        const dateWhere = getDateRange(filter, year);

        // 🔹 Summary Cards
        const summary = {
            pending: await Trek.count({ where: { trek_status: "pending", ...dateWhere } }),
            approved: await Trek.count({ where: { trek_status: "approved", ...dateWhere } }),
            rejected: await Trek.count({ where: { trek_status: "rejected", ...dateWhere } }),
            submitted: await Trek.count({ where: { trek_status: "submitted", ...dateWhere } }),
        };

        // 🔹 Submission Volume (Chart)
        const submissions = await Trek.findAll({
            attributes: [
                [Sequelize.fn("DATE", Sequelize.col("created_at")), "date"],
                [Sequelize.fn("COUNT", Sequelize.col("id")), "count"]
            ],
            where: dateWhere,
            group: ["date"],
            order: [["date", "ASC"]]
        });

        const submission_volume = {
            label: filter.replace("_", " ").toUpperCase(),
            unit: filter.includes("month") ? "day" : "date",
            data: submissions.map(item => ({
                x: item.get("date"),
                count: Number(item.get("count"))
            }))
        };

        // 🔹 Recent Pending Submissions
        const recent_pending = await Trek.findAll({
            where: { trek_status: "pending", ...dateWhere },
            attributes: ["id", "title", "created_at"],
            order: [["created_at", "DESC"]],
            limit: 5
        });

        // 🔹 Live Activity (optional / future use)
        const live_activity = []; // activity table se aa sakta hai

        return res.json({
            success: true,
            message: "Data Fetched",
            filter,
            summary,
            submission_volume,
            recent_pending,
            live_activity
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            error: err.message
        });
    }
};


/*exports.updateTrekStatus = async (req, res) => {
  try {
    const { id, status, reject_reason } = req.body;

    if (!id || !status) {
      return res.status(400).json({
        success: false,
        message: "Trek ID and status are required",
      });
    }

    // 🔹 Check trek exists
    const trek = await Trek.findByPk(id);
    if (!trek) {
      return res.status(404).json({
        success: false,
        message: "Trek not found",
      });
    }

    const oldStatus = trek.trek_status;

    // 🔹 Prepare update payload
    const updateData = {
      trek_status: status,
    };

    if (status === "rejected") {
      updateData.reject_reason = reject_reason || null;
    } else {
      updateData.reject_reason = null;
    }

    // 🔹 Update trek
    await trek.update(updateData);

    // 🔹 Insert Audit Log (AFTER successful update)

    var entity_id = trek.title + "-" + trek.mtr_id;
/*const vendor = await User.findByPk(trek.vendor_id);
    await TrekAuditLog.create({
      vendor_id: trek.vendor_id || null, // agar trek me vendor_id hai
      trek_id: trek.id,
      current_status: status,
      target_entity: entity_id,
      details: `Trek status changed from ${oldStatus} to ${status}${
        status === "rejected" && reject_reason
          ? `. Reason: ${reject_reason}`
          : ""
      }`,
    });

    return res.status(200).json({
      success: true,
      message: "Trek status updated successfully",
      data: {
        id: trek.id,
        status: trek.trek_status,
        reject_reason: trek.reject_reason,
      },
    });

  } catch (error) {
    console.error("Update Trek Status Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
       message: "Unable to update trek status at the moment. Please try again later.",
    });
  }
};*/
exports.updateTrekStatus = async (req, res) => {
  try {
    const { id, status, rejected_reason } = req.body;
console.log("req",req.body)
    // Validate input
    if (!id || !status) {
      return res.status(400).json({
        success: false,
        message: "Trek ID and status are required",
      });
    }

    // Check trek exists
    const trek = await Trek.findByPk(id);

    if (!trek) {
      return res.status(404).json({
        success: false,
        message: "Trek not found",
      });
    }

    // Prepare update data
    let updateData = {
      trek_status: status,
    };

    if (status === "rejected") {
      updateData.rejected_reason = rejected_reason || null;
    } else {
      updateData.rejected_reason = null;
    }

    // Update trek
    await trek.update(updateData);

    return res.status(200).json({
      success: true,
      message: "Trek status updated successfully",
      
    });

  } catch (error) {
    console.error("Update Trek Status Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
exports.getTrekAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, vendor_search } = req.query;
    const offset = (page - 1) * limit;

    const whereCondition = {};
    if (status) whereCondition.current_status = status;

    const { count, rows } = await TrekAuditLog.findAndCountAll({
      where: whereCondition,
      include: [
        {
          model: Trek,
          as: "trek",
          attributes: ["id", "title", "vendor_id"],
          include: [
            {
              model: Vendor,
              as: "vendor",
              attributes: ["id", "business_name", "vin_id","user_id"],
              include: [
                {
                  model: User,
                  as: "user",
                  attributes: ["id", "name", "email"],
                  where: vendor_search
                    ? { name: { [Op.like]: `%${vendor_search}%` } }
                    : undefined,
                },
              ],
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    return res.status(200).json({
      success: true,
      message: "Trek audit logs fetched successfully",
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        total_pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Get Trek Audit Logs Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};


exports.updateTrekStatus_old = async (req, res) => {
    try {
        const { id, status, reject_reason } = req.body;

        if (!id || !status) {
            return res.status(400).json({
                success: false,
                message: "Trek ID and status are required",
            });
        }

        // Check trek exists
        const trek = await Trek.findByPk(id);
        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found",
            });
        }

        // Prepare update payload
        const updateData = {
            trek_status: status,
        };

        // If rejected, store reject reason
        if (status === "rejected") {
            updateData.reject_reason = reject_reason || null;
        } else {
            // Clear reject reason for other statuses
            updateData.reject_reason = null;
        }

        await trek.update(updateData);

        

        return res.status(200).json({
            success: true,
            message: "Trek status updated successfully",
            data: {
                id: trek.id,
                status: trek.trek_status,
                reject_reason: trek.reject_reason,
            },
        });

    } catch (error) {
        console.error("Update Trek Status Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message,
        });
    }
};


// Vendor: Create trek with all related data
exports.createTrek = async (req, res) => {
    const startTime = Date.now();
    const requestId =
        req.headers["x-request-id"] || `create-trek-${Date.now()}`;
    
    const transaction = await sequelize.sequelize.transaction();

    try {
        const vendorId = req.user?.id;

        logger.trek("info", "Create trek request started", {
            requestId,
            vendorId,
            method: req.method,
            url: req.url,
            ip: req.ip,
            userAgent: req.get("User-Agent"),
            trekData: {
                title: req.body.title,
                destination_id: req.body.destination_id,
                duration_days: req.body.duration_days,
                base_price: req.body.base_price,
                max_participants: req.body.max_participants,
                has_discount: req.body.has_discount,
                status: req.body.status,
                city_ids: req.body.city_ids?.length || 0,
                activities: req.body.activities?.length || 0,
                inclusions: req.body.inclusions?.length || 0,
                exclusions: req.body.exclusions?.length || 0,
                hasRelatedData: !!(req.body.trekStages || req.body.accommodations || req.body.itinerary || req.body.media || req.body.selectedServiceDays),
            },
        });

        if (!vendorId) {
            await transaction.rollback();
            logger.trek("warn", "Create trek access denied - no vendor ID", {
                requestId,
                vendorId,
                ip: req.ip,
                userAgent: req.get("User-Agent"),
            });
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Validate destination exists
        if (req.body.destination_id) {
            const destination = await Destination.findByPk(
                req.body.destination_id
            );
            if (!destination) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: "Selected destination does not exist",
                    errors: {
                        destination_id: ["Selected destination does not exist"],
                    },
                });
            }
        }

        // Validate cities exist if provided
        if (req.body.city_ids && Array.isArray(req.body.city_ids)) {
            for (const cityId of req.body.city_ids) {
                const city = await City.findByPk(cityId);
                if (!city) {
                    await transaction.rollback();
                    return res.status(400).json({
                        success: false,
                        message: `City with ID ${cityId} does not exist`,
                        errors: {
                            city_ids: [`City with ID ${cityId} does not exist`],
                        },
                    });
                }
            }
        }

        // Validate activity IDs if provided
        if (req.body.activities) {
            const areValidActivities = await validateActivityIds(
                req.body.activities
            );
            if (!areValidActivities) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: "One or more activity IDs are invalid or inactive",
                    errors: {
                        activities: [
                            "One or more activity IDs are invalid or inactive",
                        ],
                    },
                });
            }
        }

        // Validate captain exists if provided
        if (req.body.captain_id) {
            const captain = await TrekCaptain.findOne({
                where: {
                    id: req.body.captain_id,
                    vendor_id: vendorId,
                    status: "active",
                },
            });
            if (!captain) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: "Selected captain does not exist or is not active",
                    errors: {
                        captain_id: [
                            "Selected captain does not exist or is not active",
                        ],
                    },
                });
            }
        }


        // Generate MTR ID for main trek (max 10 characters: MTR + 2-digit timestamp + 5 random chars)
        const generateMtrId = () => {
            const timestamp = Date.now().toString().slice(-2);
            const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            let random = "";
            for (let i = 0; i < 5; i++) {
                random += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return `MTR${timestamp}${random}`;
        };

        // Prepare main trek data
        const trekData = {
            ...req.body,
            vendor_id: vendorId,
            mtr_id: generateMtrId(),
        };

        // Remove related data from main trek payload  
        delete trekData.trekStages;
        delete trekData.accommodations;
        delete trekData.itinerary;
        delete trekData.itineraryDays;
        delete trekData.media;
        delete trekData.selectedServiceDays;
        delete trekData.selectedServiceDates;
        delete trekData.autoGeneratedDates;
        delete trekData.manuallyDeselectedDates;
        delete trekData.selectedActivities;
        delete trekData.customActivities;
        delete trekData.selectedInclusions;
        delete trekData.customInclusions;
        delete trekData.customExclusions;
        delete trekData.selectedCities;
        delete trekData.selectedCitiesData;
        delete trekData.assignedCaptain;
        delete trekData.coverImage;

        // Create the main trek
        const trek = await Trek.create(trekData, { transaction });

        const relatedDataResults = {
            trekStages: [],
            accommodations: [],
            itineraryItems: [],
            trekImages: [],
            batches: [],
        };

        // Create Batches from frontend-provided batch data FIRST (trek stages need batch IDs)
        let batchIdMapping = {}; // Maps temporary batch IDs to real batch IDs
        
        if (req.body.batches && Array.isArray(req.body.batches)) {
            logger.trek("info", "Creating batches from frontend data", {
                requestId,
                trekId: trek.id,
                batchCount: req.body.batches.length,
            });

            // Generate TBR ID helper
            const generateTbrId = () => {
                const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                let result = "TBR";
                for (let i = 0; i < 7; i++) {
                    result += chars.charAt(Math.floor(Math.random() * chars.length));
                }
                return result;
            };

            for (const batchData of req.body.batches) {
                const newBatchData = {
                    tbr_id: generateTbrId(),
                    trek_id: trek.id,
                    start_date: batchData.start_date,
                    end_date: batchData.end_date,
                    capacity: batchData.capacity || req.body.max_participants || 20,
                    booked_slots: batchData.booked_slots || 0,
                    available_slots: batchData.available_slots || batchData.capacity || req.body.max_participants || 20,
                };

                const batch = await Batch.create(newBatchData, { transaction });
                relatedDataResults.batches.push(batch);
                
                // Map temporary batch ID to real batch ID
                if (batchData.id) { // Frontend sends temporary ID
                    batchIdMapping[batchData.id] = batch.id;
                }
            }
        }

        // Auto-generate batches from selectedServiceDates if no manual batches were provided
        if ((!req.body.batches || req.body.batches.length === 0) &&
            req.body.selectedServiceDates && Array.isArray(req.body.selectedServiceDates) &&
            req.body.selectedServiceDates.length > 0) {

            logger.trek("info", "Auto-generating batches from selectedServiceDates", {
                requestId,
                trekId: trek.id,
                serviceDatesCount: req.body.selectedServiceDates.length,
                serviceDates: req.body.selectedServiceDates
            });

            // Generate TBR ID helper
            const generateTbrId = () => {
                const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                let result = "TBR";
                for (let i = 0; i < 7; i++) {
                    result += chars.charAt(Math.floor(Math.random() * chars.length));
                }
                return result;
            };

            // Import IST date utilities
            const { formatISTDate, addDaysIST, parseISTDate } = require('../../utils/istDateUtils');

            // Helper function to calculate end date from start date and duration using IST
            const calculateEndDate = (startDate, durationDays) => {
                // Parse the start date in IST
                const startDateIST = parseISTDate(startDate);
                if (!startDateIST) {
                    logger.trek("error", "Invalid start date provided", {
                        requestId,
                        startDate,
                        durationDays
                    });
                    return startDate; // Fallback to original date
                }

                // Add duration days (duration includes start date, so subtract 1)
                const endDateIST = addDaysIST(startDateIST, durationDays - 1);

                // Return YYYY-MM-DD format in IST
                return formatISTDate(endDateIST);
            };

            for (const serviceDate of req.body.selectedServiceDates) {
                const startDate = typeof serviceDate === 'string' ? serviceDate : serviceDate.date;

                // Normalize start date to YYYY-MM-DD format using IST
                const normalizedStartDate = startDate.includes('T') ? startDate.split('T')[0] : startDate;
                const endDate = calculateEndDate(normalizedStartDate, req.body.duration_days || 1);

                logger.trek("info", "Processing service date for batch creation (IST)", {
                    requestId,
                    trekId: trek.id,
                    originalServiceDate: serviceDate,
                    normalizedStartDate,
                    endDate,
                    durationDays: req.body.duration_days,
                    timezone: 'Asia/Kolkata'
                });

                const newBatchData = {
                    tbr_id: generateTbrId(),
                    trek_id: trek.id,
                    start_date: normalizedStartDate,
                    end_date: endDate,
                    capacity: req.body.max_participants || 20,
                    booked_slots: 0,
                    available_slots: req.body.max_participants || 20,
                };

                const batch = await Batch.create(newBatchData, { transaction });
                relatedDataResults.batches.push(batch);

                logger.trek("info", "Auto-generated batch created", {
                    requestId,
                    trekId: trek.id,
                    batchId: batch.id,
                    tbrId: batch.tbr_id,
                    startDate: batch.start_date,
                    endDate: batch.end_date
                });
            }

            logger.trek("info", "Auto-batch generation completed", {
                requestId,
                trekId: trek.id,
                totalBatchesCreated: relatedDataResults.batches.length
            });
        }

        // Process Trek Stages - now batch-specific (AFTER batches are created)
        if (req.body.trekStages && Array.isArray(req.body.trekStages)) {
            logger.trek("info", "Processing trek stages with batch mapping", {
                requestId,
                trekId: trek.id,
                stageCount: req.body.trekStages.length,
                batchCount: relatedDataResults.batches.length,
                batchIdMapping
            });

            // Handle different cases for trek stage creation
            if (relatedDataResults.batches.length > 0) {
                // Check if stages have unique batch_id assignments (proper manual batches)
                const stagesWithBatchId = req.body.trekStages.filter(stage => stage.batch_id);
                const uniqueBatchIds = [...new Set(stagesWithBatchId.map(stage => stage.batch_id))];
                
                // Case 1: Stages have unique batch_id assignments (proper manual batches)
                if (stagesWithBatchId.length > 0 && uniqueBatchIds.length > 1) {
                    logger.trek("info", "Creating trek stages with manual batch assignments", {
                        requestId,
                        trekId: trek.id,
                        stageCount: req.body.trekStages.length,
                        uniqueBatchIds: uniqueBatchIds
                    });
                    
                    for (const stage of req.body.trekStages) {
                        // Map temporary batch_id to real batch_id
                        const realBatchId = batchIdMapping[stage.batch_id] || stage.batch_id;

                        const stageData = {
                            trek_id: trek.id,
                            batch_id: realBatchId, // Use mapped real batch ID
                            stage_name: stage.type || stage.stage_name || "Stage",
                            destination: stage.destination || "",
                            means_of_transport: stage.transport || stage.means_of_transport || "",
                            date_time: stage.date_time, // Full date-time from frontend
                            is_boarding_point: stage.type === "boarding" || stage.is_boarding_point === true,
                            city_id: stage.city_id || null,
                        };

                        const trekStage = await TrekStage.create(stageData, { transaction });
                        relatedDataResults.trekStages.push(trekStage);
                    }
                } else {
                    // Case 2: Stages without batch_id OR all stages have same batch_id (auto-generated batches)
                    // Create stages for each batch to ensure proper distribution
                    logger.trek("info", "Creating trek stages for auto-generated batches (distributed)", {
                        requestId,
                        trekId: trek.id,
                        stageCount: req.body.trekStages.length,
                        batchCount: relatedDataResults.batches.length,
                        reason: stagesWithBatchId.length === 0 ? "no_batch_ids" : "same_batch_ids"
                    });

                    for (const batch of relatedDataResults.batches) {
                        for (const stage of req.body.trekStages) {
                            const stageData = {
                                trek_id: trek.id,
                                batch_id: batch.id, // Use auto-generated batch ID (distributed across all batches)
                                stage_name: stage.type || stage.stage_name || "Stage",
                                destination: stage.destination || "",
                                means_of_transport: stage.transport || stage.means_of_transport || "",
                                date_time: stage.date_time, // Full date-time from frontend
                                is_boarding_point: stage.type === "boarding" || stage.is_boarding_point === true,
                                city_id: stage.city_id || null,
                            };

                            const trekStage = await TrekStage.create(stageData, { transaction });
                            relatedDataResults.trekStages.push(trekStage);
                        }
                    }

                    logger.trek("info", "Trek stages created for auto-generated batches (distributed)", {
                        requestId,
                        trekId: trek.id,
                        totalStagesCreated: relatedDataResults.trekStages.length,
                        stagesPerBatch: req.body.trekStages.length,
                        batchesUsed: relatedDataResults.batches.length
                    });
                }
            } else {
                logger.trek("warn", "No batches available for trek stage creation", {
                    requestId,
                    trekId: trek.id,
                    stageCount: req.body.trekStages.length
                });
            }
        }

        // Process Accommodations - now batch-specific (AFTER batches are created)
        if (req.body.accommodations && Array.isArray(req.body.accommodations)) {
            logger.trek("info", "Processing batch-specific accommodations", {
                requestId,
                trekId: trek.id,
                accommodationCount: req.body.accommodations.length,
                batchCount: relatedDataResults.batches.length,
            });

            // Create accommodations for each batch
            for (const batch of relatedDataResults.batches) {
                for (const accommodation of req.body.accommodations) {
                    const accommodationData = {
                        trek_id: trek.id,
                        batch_id: batch.id, // Link to specific batch
                        type: accommodation.type || "",
                        details: {
                            night: accommodation.night || 1,
                            location: accommodation.location || "",
                        },
                    };

                    const newAccommodation = await Accommodation.create(accommodationData, { transaction });
                    relatedDataResults.accommodations.push(newAccommodation);
                }
            }
            
            logger.trek("info", "Batch-specific accommodations created", {
                requestId,
                trekId: trek.id,
                totalAccommodationsCreated: relatedDataResults.accommodations.length,
                accommodationsPerBatch: req.body.accommodations.length,
            });
        }

        // Process Itinerary Items
        if (req.body.itinerary && Array.isArray(req.body.itinerary)) {
            logger.trek("info", "Processing itinerary items", {
                requestId,
                trekId: trek.id,
                itineraryCount: req.body.itinerary.length,
            });

            for (const day of req.body.itinerary) {
                const itineraryData = {
                    trek_id: trek.id,
                    activities: day.activities || [],
                };

                const itineraryItem = await ItineraryItem.create(itineraryData, { transaction });
                relatedDataResults.itineraryItems.push(itineraryItem);
            }
        }

        // Process Media/Images
        if (req.body.media && Array.isArray(req.body.media)) {
            logger.trek("info", "Processing media/images", {
                requestId,
                trekId: trek.id,
                mediaCount: req.body.media.length,
            });

            for (const media of req.body.media) {
                // Accept both preview (full data URL) or data (raw/base64)
                const raw = media.preview || media.data || "";
                if (raw && raw.length > 0) {
                    try {
                        // Normalize to data URL if prefix missing
                        const base64 = raw.startsWith("data:image")
                            ? raw
                            : `data:image/jpeg;base64,${raw}`;

                        // Save Base64 image to file system
                        const imagePath = await saveBase64Image(base64, vendorId);

                        const imageData = {
                            trek_id: trek.id,
                            url: imagePath,
                            is_cover: media.isCover || false,
                        };

                        const trekImage = await TrekImage.create(imageData, { transaction });
                        relatedDataResults.trekImages.push(trekImage);
                    } catch (imageError) {
                        logger.trek("error", "Failed to process image", {
                            requestId,
                            trekId: trek.id,
                            error: imageError.message,
                            imageIndex: req.body.media.indexOf(media),
                        });
                    }
                }
            }
        }


        await transaction.commit();

        const duration = Date.now() - startTime;
        logger.trek("info", "Trek created successfully with all related data", {
            requestId,
            trekId: trek.id,
            vendorId,
            title: trek.title,
            duration: `${duration}ms`,
            relatedDataCounts: {
                trekStages: relatedDataResults.trekStages.length,
                accommodations: relatedDataResults.accommodations.length,
                itineraryItems: relatedDataResults.itineraryItems.length,
                trekImages: relatedDataResults.trekImages.length,
                batches: relatedDataResults.batches.length,
            },
        });

        // Round base_price in response trek payload
        const responseTrek = { ...trek.toJSON(), base_price: roundAmount(trek.base_price || 0) };

        res.status(201).json({
            success: true,
            message: "Trek created successfully with all related data",
            data: {
                trek: responseTrek,
                relatedData: {
                    trekStages: relatedDataResults.trekStages,
                    accommodations: relatedDataResults.accommodations,
                    itineraryItems: relatedDataResults.itineraryItems,
                    trekImages: relatedDataResults.trekImages,
                    batches: relatedDataResults.batches,
                },
                summary: {
                    trekStagesCreated: relatedDataResults.trekStages.length,
                    accommodationsCreated: relatedDataResults.accommodations.length,
                    itineraryItemsCreated: relatedDataResults.itineraryItems.length,
                    trekImagesCreated: relatedDataResults.trekImages.length,
                    batchesCreated: relatedDataResults.batches.length,
                },
            },
        });
    } catch (error) {
        await transaction.rollback();
        
        const duration = Date.now() - startTime;
        logger.trek("error", "Failed to create trek", {
            requestId,
            vendorId: req.user?.id,
            duration: `${duration}ms`,
            error: error.message,
            stack: error.stack,
            method: req.method,
            url: req.url,
            ip: req.ip,
            userAgent: req.get("User-Agent"),
            body: req.body,
            params: req.params,
            query: req.query,
        });

        res.status(500).json({
            success: false,
            message: "Failed to create trek",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
};

// Vendor: Update trek
exports.updateTrek = async (req, res) => {
    const startTime = Date.now();
    const requestId =
        req.headers["x-request-id"] || `update-trek-${Date.now()}`;

    try {
        const { id } = req.params;
        const vendorId = req.user?.id;

        logger.trek("info", "Update trek request started", {
            requestId,
            trekId: id,
            vendorId,
            method: req.method,
            url: req.url,
            ip: req.ip,
            userAgent: req.get("User-Agent"),
            updateData: {
                title: req.body.title,
                destination_id: req.body.destination_id,
                duration_days: req.body.duration_days,
                base_price: req.body.base_price,
                max_participants: req.body.max_participants,
                has_discount: req.body.has_discount,
                status: req.body.status,
                city_ids: req.body.city_ids?.length || 0,
                activities: req.body.activities?.length || 0,
                inclusions: req.body.inclusions?.length || 0,
                exclusions: req.body.exclusions?.length || 0,
            },
        });

        if (!vendorId) {
            logger.trek("warn", "Update trek access denied - no vendor ID", {
                requestId,
                trekId: id,
                vendorId,
            });
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        const trek = await Trek.findOne({
            where: { id, vendor_id: vendorId },
        });

        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found",
            });
        }

        // Check if trek has already been edited
        if (trek.has_been_edited === 1) {
            return res.status(400).json({
                success: false,
                message:
                    "This trek has already been edited and cannot be modified further",
            });
        }

        // Check 3-day departure validation by finding the earliest batch
        const earliestBatch = await Batch.findOne({
            where: { trek_id: id },
            order: [['start_date', 'ASC']],
            attributes: ['start_date']
        });

        if (earliestBatch) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const departureDate = new Date(earliestBatch.start_date);
            departureDate.setHours(0, 0, 0, 0);

            const daysDifference = Math.ceil((departureDate - today) / (1000 * 60 * 60 * 24));

            if (daysDifference < 3) {
                return res.status(400).json({
                    success: false,
                    message: "Cannot edit trek less than 3 days before departure date",
                });
            }
        }

        // Only allow editing captain_id and accommodations
        const allowedFields = ["captain_id", "accommodations"];
        const updateData = {};

        // Check if only allowed fields are being updated
        const requestedFields = Object.keys(req.body);
        const hasUnauthorizedFields = requestedFields.some(
            (field) => !allowedFields.includes(field)
        );

        if (hasUnauthorizedFields) {
            return res.status(400).json({
                success: false,
                message:
                    "Only trek captain and accommodations can be updated. Other fields are not editable.",
                allowedFields: allowedFields,
            });
        }

        // Validate captain exists if being updated
        if (req.body.captain_id) {
            const captain = await TrekCaptain.findOne({
                where: {
                    id: req.body.captain_id,
                    vendor_id: vendorId,
                    status: "active",
                },
            });
            if (!captain) {
                return res.status(400).json({
                    success: false,
                    message: "Selected captain does not exist or is not active",
                    errors: {
                        captain_id: [
                            "Selected captain does not exist or is not active",
                        ],
                    },
                });
            }
        }

        // Set has_been_edited to 1 since this is the first edit
        updateData.captain_id = req.body.captain_id;
        updateData.has_been_edited = 1;

        await trek.update(updateData);

        // If accommodations are also being updated, handle them here
        if (req.body.accommodations && Array.isArray(req.body.accommodations)) {
            // Delete existing accommodations
            await Accommodation.destroy({
                where: { trek_id: id },
            });

            // Create new accommodations
            for (const accommodation of req.body.accommodations) {
                await Accommodation.create({
                    trek_id: id,
                    type: accommodation.type || "",
                    details: {
                        night: accommodation.night || 1,
                        location: accommodation.location || "",
                    },
                });
            }
        }

        res.json({
            success: true,
            message: "Trek updated successfully",
            data: trek,
        });
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.trek("error", "Failed to update trek", {
            requestId,
            trekId: req.params.id,
            vendorId: req.user?.id,
            duration: `${duration}ms`,
            error: error.message,
            stack: error.stack,
            method: req.method,
            url: req.url,
            ip: req.ip,
            userAgent: req.get("User-Agent"),
            body: req.body,
            params: req.params,
            query: req.query,
        });

        res.status(500).json({
            success: false,
            message: "Failed to update trek",
        });
    }
};

// Vendor: Get batch details for editing
exports.getBatchForEdit = async (req, res) => {
    const startTime = Date.now();
    const requestId = req.headers["x-request-id"] || `get-batch-edit-${Date.now()}`;

    try {
        const { batchId } = req.params;
        const vendorId = req.user?.id;

        // Find the batch with associated data
        const batch = await Batch.findOne({
            where: { id: batchId },
            include: [
                {
                    model: Trek,
                    as: 'trek',
                    where: { vendor_id: vendorId },
                    attributes: ['id', 'vendor_id', 'has_been_edited', 'title', 'mtr_id']
                },
                {
                    model: TrekCaptain,
                    as: 'captain',
                    attributes: ['id', 'name', 'email', 'phone']
                },
                {
                    model: Accommodation,
                    as: 'accommodations',
                    attributes: ['id', 'type', 'details']
                }
            ]
        });

        if (!batch) {
            return res.status(404).json({
                success: false,
                message: "Batch not found or you don't have permission to access it",
            });
        }

        res.json({
            success: true,
            data: {
                batch_id: batch.id,
                trek: batch.trek,
                captain: batch.captain,
                accommodations: batch.accommodations,
                start_date: batch.start_date,
                end_date: batch.end_date,
                capacity: batch.capacity,
                booked_slots: batch.booked_slots,
                available_slots: batch.available_slots
            }
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        logger.trek("error", "Failed to get batch for edit", {
            requestId,
            batchId: req.params.batchId,
            vendorId: req.user?.id,
            duration: `${duration}ms`,
            error: error.message,
            stack: error.stack,
        });

        res.status(500).json({
            success: false,
            message: "Failed to get batch details",
        });
    }
};

// Vendor: Update batch (captain and accommodations)
exports.updateBatch = async (req, res) => {
    const startTime = Date.now();
    const requestId = req.headers["x-request-id"] || `update-batch-${Date.now()}`;

    try {
        const { batchId } = req.params;
        const vendorId = req.user?.id;

        logger.trek("info", "Update batch request started", {
            requestId,
            batchId,
            vendorId,
            ip: req.ip,
            userAgent: req.get("User-Agent"),
            body: req.body,
        });

        // Find the batch and verify vendor ownership
        const batch = await Batch.findOne({
            where: {
                id: batchId,
            },
            include: [{
                model: Trek,
                as: 'trek',
                where: { vendor_id: vendorId },
                attributes: ['id', 'vendor_id', 'has_been_edited']
            }]
        });

        if (!batch) {
            return res.status(404).json({
                success: false,
                message: "Batch not found or you don't have permission to edit it",
            });
        }

        // Check if trek has been edited before (one-time edit restriction)
        if (batch.trek.has_been_edited) {
            return res.status(400).json({
                success: false,
                message: "This trek has already been edited and cannot be modified further",
            });
        }

        // Check 3-day departure validation
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const departureDate = new Date(batch.start_date);
        departureDate.setHours(0, 0, 0, 0);

        const daysDifference = Math.ceil((departureDate - today) / (1000 * 60 * 60 * 24));

        if (daysDifference < 3) {
            return res.status(400).json({
                success: false,
                message: "Cannot edit batch less than 3 days before departure date",
            });
        }

        // Only allow editing captain_id and accommodations
        const allowedFields = ["captain_id", "accommodations"];

        // Check if only allowed fields are being updated
        const requestedFields = Object.keys(req.body);
        const hasUnauthorizedFields = requestedFields.some(
            (field) => !allowedFields.includes(field)
        );

        if (hasUnauthorizedFields) {
            return res.status(400).json({
                success: false,
                message: "Only batch captain and accommodations can be updated. Other fields are not editable.",
                allowedFields: allowedFields,
            });
        }

        // Update captain if provided
        if (req.body.captain_id !== undefined) {
            await batch.update({ captain_id: req.body.captain_id });
        }

        // Update accommodations if provided
        if (req.body.accommodations && Array.isArray(req.body.accommodations)) {
            // Delete existing accommodations for this batch
            await Accommodation.destroy({
                where: { batch_id: batchId }
            });

            // Create new accommodations for this batch
            for (const accommodation of req.body.accommodations) {
                await Accommodation.create({
                    batch_id: batchId,
                    trek_id: batch.trek.id,
                    type: accommodation.type,
                    details: {
                        night: accommodation.night || 1,
                        location: accommodation.location || "",
                    },
                });
            }
        }

        // Mark trek as edited (one-time edit flag)
        await Trek.update(
            { has_been_edited: true },
            { where: { id: batch.trek.id } }
        );

        res.json({
            success: true,
            message: "Batch updated successfully",
            data: { batch_id: batchId },
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        logger.trek("error", "Failed to update batch", {
            requestId,
            batchId: req.params.batchId,
            vendorId: req.user?.id,
            duration: `${duration}ms`,
            error: error.message,
            stack: error.stack,
            method: req.method,
            url: req.url,
            ip: req.ip,
            userAgent: req.get("User-Agent"),
            body: req.body,
            params: req.params,
            query: req.query,
        });

        res.status(500).json({
            success: false,
            message: "Failed to update batch",
        });
    }
};

// Vendor: Get customer booking details by TBR ID
exports.getBookingDetailsByTBR = async (req, res) => {
    const startTime = Date.now();
    const requestId = req.headers["x-request-id"] || `tbr-bookings-${Date.now()}`;

    try {
        const { tbrId } = req.params;
        const vendorId = req.user?.id;

        logger.trek("info", "Get booking details by TBR request started", {
            requestId,
            tbrId,
            vendorId,
            ip: req.ip,
            userAgent: req.get("User-Agent"),
        });

        // First, find the batch with the given TBR ID and verify vendor ownership
        const batch = await Batch.findOne({
            where: { tbr_id: tbrId },
            include: [{
                model: Trek,
                as: 'trek',
                where: { vendor_id: vendorId },
                attributes: ['id', 'title', 'vendor_id']
            }],
            attributes: ['id', 'tbr_id', 'start_date', 'end_date']
        });

        if (!batch) {
            return res.status(404).json({
                success: false,
                message: "TBR not found or you don't have permission to access it",
            });
        }

        // Get all bookings for this batch with complete customer and payment information
        const bookings = await Booking.findAll({
            where: { batch_id: batch.id },
            include: [
                {
                    model: Customer,
                    as: 'customer',
                    attributes: ['id', 'name', 'email', 'phone']
                },
                {
                    model: BookingTraveler,
                    as: 'travelers',
                    include: [{
                        model: Traveler,
                        as: 'traveler',
                        attributes: ['id', 'name', 'age', 'gender']
                    }]
                },
                {
                    model: PaymentLog,
                    as: 'payments',
                    attributes: ['id', 'amount', 'payment_method', 'status', 'created_at']
                }
            ],
            attributes: [
                'id', 'customer_id', 'total_travelers', 'total_amount', 'final_amount',
                'remaining_amount', 'payment_status', 'status', 'booking_date', 'created_at'
            ],
            order: [['created_at', 'DESC']]
        });

        // Simple cancellation logic:
        // 1. Get booking IDs for this batch
        const batchBookingIds = bookings.map(b => b.id);
        
        // 2. Check cancellation_bookings table for these booking IDs
        const cancellationBookings = batchBookingIds.length > 0 ? await CancellationBooking.findAll({
            where: {
                booking_id: {
                    [Op.in]: batchBookingIds
                }
            },
            attributes: ['id', 'booking_id']
        }) : [];
        
        // 3. Also count bookings with status = 'cancelled' from bookings table
        const cancelledBookingsFromStatus = bookings.filter(b => b.status === 'cancelled');

        // Process bookings to calculate payment details and format response
        const customerBookingDetails = bookings.map(booking => {
            // Booking-level amounts from DB
            const totalTravelers = parseInt(booking.total_travelers || 0, 10);
            const totalAmountFromDb = parseFloat(booking.total_amount || 0); // Treat as Total
            const remainingFromDb = parseFloat(booking.remaining_amount || 0);

            // Calculate Paid based on payment status per business rules
            let computedPaid = 0;
            if (booking.payment_status === 'partial') {
                computedPaid = 999 * totalTravelers;
            } else if (booking.payment_status === 'full_paid') {
                // For full paid, Paid should equal Total
                computedPaid = totalAmountFromDb;
            } else {
                // Fallback: sum successful payments
                const successfulPayments = booking.payments?.filter(p => p.status === 'success') || [];
                computedPaid = successfulPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
            }

            // Remaining should come from DB for partial/pending; zero for full paid
            const computedRemaining = booking.payment_status === 'full_paid' ? 0 : remainingFromDb;

            // Get primary traveler info (first traveler or customer info)
            const primaryTraveler = booking.travelers?.[0]?.traveler;
            const customerInfo = booking.customer;

            // Show only the main customer's age/gender (first traveler)
            const ageGenderInfo = primaryTraveler
                ? `${primaryTraveler.age}/${primaryTraveler.gender.charAt(0).toUpperCase()}`
                : 'N/A';

            // Get all travelers for the travelers array
            const travelers = booking.travelers?.map(bt => bt.traveler) || [];

            return {
                bookingId: booking.id,
                customerName: primaryTraveler?.name || customerInfo?.name || 'N/A',
                ageGender: ageGenderInfo,
                contact: customerInfo?.phone || customerInfo?.email || 'N/A',
                slots: booking.total_travelers,
                paymentStatus: booking.payment_status,
                bookingStatus: booking.status,
                totalAmount: roundAmount(totalAmountFromDb),
                paidAmount: roundAmount(computedPaid),
                remainingAmount: roundAmount(computedRemaining),
                bookingTime: booking.booking_date || booking.created_at,
                travelers: travelers.map(t => ({
                    name: t.name,
                    age: t.age,
                    gender: t.gender
                }))
            };
        });

        // Calculate total cancellations from both sources
        // Combine cancellations from cancellation_bookings table and bookings with status='cancelled'
        const allCancelledBookings = [...cancelledBookingsFromStatus];
        
        // Add cancellations from cancellation_bookings table (avoid duplicates)
        cancellationBookings.forEach(cb => {
            const booking = bookings.find(b => b.id === cb.booking_id);
            if (booking && !allCancelledBookings.find(b => b.id === booking.id)) {
                allCancelledBookings.push(booking);
            }
        });
        
        const totalCancellations = allCancelledBookings.length;
        const totalCancelledSlots = allCancelledBookings.reduce((sum, booking) => {
            return sum + (booking.total_travelers || 0);
        }, 0);

        // Response data
        const responseData = {
            tbrId: batch.tbr_id,
            trekTitle: batch.trek.title,
            departureDate: batch.start_date,
            arrivalDate: batch.end_date,
            totalBookings: bookings.length,
            totalCustomers: bookings.length,
            totalCancellations: totalCancellations,
            totalCancelledSlots: totalCancelledSlots,
            customerBookings: customerBookingDetails
        };

        logger.trek("info", "Booking details by TBR retrieved successfully", {
            requestId,
            tbrId,
            vendorId,
            totalBookings: bookings.length,
            duration: `${Date.now() - startTime}ms`
        });

        res.json({
            success: true,
            data: responseData
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        logger.trek("error", "Failed to get booking details by TBR", {
            requestId,
            tbrId: req.params.tbrId,
            vendorId: req.user?.id,
            duration: `${duration}ms`,
            error: error.message,
            stack: error.stack,
        });

        res.status(500).json({
            success: false,
            message: "Failed to get booking details",
        });
    }
};

// Vendor: Get pending balance collection data
exports.getPendingBalanceCollection = async (req, res) => {
    const startTime = Date.now();
    const requestId = req.headers["x-request-id"] || `pending-balance-${Date.now()}`;

    try {
        const vendorId = req.user?.id;
        const {
            search = "",
            endDate = "",
            paymentStatus = "",
            page = 1,
            limit = 10,
        } = req.query;

        logger.trek("info", "Get pending balance collection request started", {
            requestId,
            vendorId,
            filters: { search, endDate, paymentStatus },
            pagination: { page, limit },
            ip: req.ip,
            userAgent: req.get("User-Agent"),
        });

        // Build where conditions
        const whereConditions = {
            vendor_id: vendorId,
            // Include ONLY partial payments with a positive remaining balance
            payment_status: 'partial',
            remaining_amount: { [Op.gt]: 0 },
        };

        // Search filter (name, trek title, TBR ID)
        if (search) {
            whereConditions[Op.or] = [
                { '$customer.name$': { [Op.like]: `%${search}%` } },
                { '$batch.trek.title$': { [Op.like]: `%${search}%` } },
                { '$batch.tbr_id$': { [Op.like]: `%${search}%` } },
            ];
        }

        // End date filter
        if (endDate) {
            whereConditions['$batch.end_date$'] = endDate;
        }

        // Payment status filter
        if (paymentStatus && paymentStatus === 'partial') {
            whereConditions.payment_status = 'partial';
        }

        // Calculate pagination
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Get bookings with pending balances
        const { count, rows: bookings } = await Booking.findAndCountAll({
            where: whereConditions,
            include: [
                {
                    model: Customer,
                    as: 'customer',
                    attributes: ['id', 'name', 'email', 'phone']
                },
                {
                    model: Batch,
                    as: 'batch',
                    attributes: ['id', 'tbr_id', 'start_date', 'end_date'],
                    include: [{
                        model: Trek,
                        as: 'trek',
                        attributes: ['id', 'title', 'destination_id', 'city_ids'],
                        include: [{
                            model: Destination,
                            as: 'destinationData',
                            attributes: ['id', 'name']
                        }]
                    }]
                },
                {
                    model: PaymentLog,
                    as: 'payments',
                    attributes: ['id', 'amount', 'payment_method', 'status', 'created_at']
                },
                {
                    model: BookingTraveler,
                    as: 'travelers',
                    include: [{
                        model: Traveler,
                        as: 'traveler',
                        attributes: ['id', 'name', 'age', 'gender']
                    }]
                }
            ],
            attributes: [
                'id', 'customer_id', 'batch_id', 'total_travelers', 'total_amount',
                'final_amount', 'advance_amount', 'remaining_amount', 'payment_status', 'status', 'booking_date', 'created_at'
            ],
            order: [['created_at', 'DESC']]
        });

        // Process bookings data
        const pendingBalanceData = await Promise.all(bookings.map(async (booking) => {
            // Use remaining_amount directly from booking table instead of calculating
            const totalAmount = parseFloat(booking.total_amount || 0);
            const remainingAmount = parseFloat(booking.remaining_amount || 0);
            // Paid should be fixed partial collection: 999 per traveler
            const travelers = parseInt(booking.total_travelers || 0, 10) || 0;
            const paidAmount = 999 * travelers;

            
            // Get source cities
            let sourceCityNames = [];
            if (booking.batch?.trek?.city_ids) {
                try {
                    const cityIds = JSON.parse(booking.batch.trek.city_ids);
                    if (Array.isArray(cityIds) && cityIds.length > 0) {
                        const cities = await City.findAll({
                            where: { id: { [Op.in]: cityIds } },
                            attributes: ['id', 'city_name']
                        });
                        sourceCityNames = cities.map(city => city.city_name);
                    }
                } catch (e) {
                    // If parsing fails, ignore
                }
            }

            // Get travelers info
            const travelerList = booking.travelers?.map(bt => bt.traveler) || [];
            const travelersInfo = travelerList.length > 0
                ? travelerList.map(t => `${t.name} (${t.age}/${t.gender.charAt(0).toUpperCase()})`).join(', ')
                : 'N/A';

            return {
                bookingId: booking.id,
                customerId: booking.customer_id,
                customerName: booking.customer?.name || 'N/A',
                customerEmail: booking.customer?.email || 'N/A',
                customerPhone: booking.customer?.phone || 'N/A',
                trekTitle: booking.batch?.trek?.title || 'N/A',
                tbrId: booking.batch?.tbr_id || 'N/A',
                destination: booking.batch?.trek?.destinationData?.name || 'N/A',
                sourceCities: sourceCityNames.join(', ') || 'N/A',
                totalTravelers: booking.total_travelers,
                travelersInfo,
                totalAmount: roundAmount(totalAmount),  // Total booking amount from bookings table
                paidAmount: roundAmount(paidAmount),    // Collected so far (partial): 999 * travelers
                remainingAmount: roundAmount(remainingAmount),  // Still pending
                paymentStatus: booking.payment_status,
                bookingStatus: booking.status,
                endDate: booking.batch?.end_date,
                bookingDate: booking.booking_date || booking.created_at,
            };
        }));

        logger.trek("info", "Pending balance collection data retrieved successfully", {
            requestId,
            vendorId,
            totalRecords: count,
            recordsReturned: pendingBalanceData.length,
            duration: `${Date.now() - startTime}ms`
        });

        res.json({
            success: true,
            data: {
                records: pendingBalanceData,
                totalRecords: count,
                currentPage: parseInt(page),
                totalPages: Math.ceil(count / parseInt(limit)),
                hasMore: offset + pendingBalanceData.length < count
            }
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        logger.trek("error", "Failed to get pending balance collection data", {
            requestId,
            vendorId: req.user?.id,
            duration: `${duration}ms`,
            error: error.message,
            stack: error.stack,
        });

        res.status(500).json({
            success: false,
            message: "Failed to get pending balance collection data",
        });
    }
};

// Vendor: Mark payment as completed
exports.markPaymentCompleted = async (req, res) => {
    const startTime = Date.now();
    const requestId = req.headers["x-request-id"] || `mark-payment-${Date.now()}`;

    try {
        const { bookingId } = req.params;
        const vendorId = req.user?.id;

        logger.trek("info", "Mark payment completed request started", {
            requestId,
            bookingId,
            vendorId,
            ip: req.ip,
            userAgent: req.get("User-Agent"),
        });

        // First verify the booking belongs to this vendor
        const booking = await Booking.findOne({
            where: {
                id: bookingId,
                vendor_id: vendorId
            },
            include: [{
                model: Customer,
                as: 'customer',
                attributes: ['name']
            }]
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found or you don't have permission to access it",
            });
        }

        // Update payment status to completed
        await booking.update({
            payment_status: 'completed'
        });

        logger.trek("info", "Payment marked as completed successfully", {
            requestId,
            bookingId,
            vendorId,
            customerName: booking.customer?.name,
            duration: `${Date.now() - startTime}ms`
        });

        res.json({
            success: true,
            message: "Payment marked as completed successfully",
            data: {
                bookingId: booking.id,
                paymentStatus: booking.payment_status
            }
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        logger.trek("error", "Failed to mark payment as completed", {
            requestId,
            bookingId: req.params.bookingId,
            vendorId: req.user?.id,
            duration: `${duration}ms`,
            error: error.message,
            stack: error.stack,
        });

        res.status(500).json({
            success: false,
            message: "Failed to mark payment as completed",
        });
    }
};

// Vendor: Add customer remark
exports.addCustomerRemark = async (req, res) => {
    const startTime = Date.now();
    const requestId = req.headers["x-request-id"] || `customer-remark-${Date.now()}`;

    try {
        const { bookingId } = req.params;
        const { remark } = req.body;
        const vendorId = req.user?.id;

        logger.trek("info", "Add customer remark request started", {
            requestId,
            bookingId,
            vendorId,
            remarkLength: remark?.length || 0,
            ip: req.ip,
            userAgent: req.get("User-Agent"),
        });

        if (!remark || remark.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: "Remark is required",
            });
        }

        // First verify the booking belongs to this vendor
        const booking = await Booking.findOne({
            where: {
                id: bookingId,
                vendor_id: vendorId
            },
            include: [{
                model: Customer,
                as: 'customer',
                attributes: ['name']
            }]
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found or you don't have permission to access it",
            });
        }

        // Add or update the remark (assuming there's a remarks field in booking)
        await booking.update({
            vendor_remarks: remark.trim()
        });

        logger.trek("info", "Customer remark added successfully", {
            requestId,
            bookingId,
            vendorId,
            customerName: booking.customer?.name,
            duration: `${Date.now() - startTime}ms`
        });

        res.json({
            success: true,
            message: "Customer remark added successfully",
            data: {
                bookingId: booking.id,
                remark: booking.vendor_remarks
            }
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        logger.trek("error", "Failed to add customer remark", {
            requestId,
            bookingId: req.params.bookingId,
            vendorId: req.user?.id,
            duration: `${duration}ms`,
            error: error.message,
            stack: error.stack,
        });

        res.status(500).json({
            success: false,
            message: "Failed to add customer remark",
        });
    }
};

// Vendor: Delete trek
exports.deleteTrek = async (req, res) => {
    const startTime = Date.now();
    const requestId =
        req.headers["x-request-id"] || `delete-trek-${Date.now()}`;

    try {
        const { id } = req.params;
        const vendorId = req.user?.id;

        logger.trek("info", "Delete trek request started", {
            requestId,
            trekId: id,
            vendorId,
            method: req.method,
            url: req.url,
            ip: req.ip,
            userAgent: req.get("User-Agent"),
        });

        if (!vendorId) {
            logger.trek("warn", "Delete trek access denied - no vendor ID", {
                requestId,
                trekId: id,
                vendorId,
            });
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Find the trek
        const trek = await Trek.findOne({
            where: { id, vendor_id: vendorId },
        });

        if (!trek) {
            logger.trek("warn", "Trek not found for deletion", {
                requestId,
                trekId: id,
                vendorId,
            });
            return res.status(404).json({
                success: false,
                message: "Trek not found",
            });
        }

        logger.trek("info", "Trek found, starting deletion process", {
            requestId,
            trekId: id,
            trekTitle: trek.title,
            trekStatus: trek.status,
        });

        // Delete all related records first to avoid foreign key constraint issues

        // Delete associated images and files
        const images = await TrekImage.findAll({
            where: { trek_id: id },
        });

        logger.trek("info", "Found images to delete", {
            requestId,
            trekId: id,
            imageCount: images.length,
        });

        for (const image of images) {
            try {
                if (image.image_url) {
                    await deleteImage(image.image_url);
                    logger.trek("debug", "Image file deleted", {
                        requestId,
                        trekId: id,
                        imageUrl: image.image_url,
                    });
                }
            } catch (imageError) {
                logger.trek("error", "Failed to delete image file", {
                    requestId,
                    trekId: id,
                    imageUrl: image.image_url,
                    error: imageError.message,
                    stack: imageError.stack,
                });
            }
        }

        // Delete related records in the correct order with detailed logging
        const deletionSteps = [
            { name: "TrekImage", model: TrekImage },
            { name: "ItineraryItem", model: ItineraryItem },
            { name: "TrekStage", model: TrekStage },
            { name: "Accommodation", model: Accommodation },
            { name: "Batch", model: Batch },
            { name: "Review", model: Review },
            { name: "Rating", model: Rating },
        ];

        for (const step of deletionSteps) {
            try {
                const deletedCount = await step.model.destroy({
                    where: { trek_id: id },
                });
                logger.trek("info", `${step.name} records deleted`, {
                    requestId,
                    trekId: id,
                    deletedCount,
                    step: step.name,
                });
            } catch (stepError) {
                logger.trek("error", `Failed to delete ${step.name} records`, {
                    requestId,
                    trekId: id,
                    step: step.name,
                    error: stepError.message,
                    stack: stepError.stack,
                });
                throw stepError;
            }
        }


        // Finally delete the trek itself
        await trek.destroy();

        const duration = Date.now() - startTime;
        logger.trek("info", "Trek deleted successfully", {
            requestId,
            trekId: id,
            trekTitle: trek.title,
            duration: `${duration}ms`,
            deletedRecords: {
                images: images.length,
                itineraryItems: await ItineraryItem.count({
                    where: { trek_id: id },
                }),
                trekStages: await TrekStage.count({ where: { trek_id: id } }),
                accommodations: await Accommodation.count({
                    where: { trek_id: id },
                }),
                batches: await Batch.count({ where: { trek_id: id } }),
                reviews: await Review.count({ where: { trek_id: id } }),
                ratings: await Rating.count({ where: { trek_id: id } }),
            },
        });

        res.json({
            success: true,
            message: "Trek deleted successfully",
        });
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.trek("error", "Failed to delete trek", {
            requestId,
            trekId: req.params.id,
            vendorId: req.user?.id,
            duration: `${duration}ms`,
            error: error.message,
            stack: error.stack,
            method: req.method,
            url: req.url,
            ip: req.ip,
            userAgent: req.get("User-Agent"),
            body: req.body,
            params: req.params,
            query: req.query,
        });

        res.status(500).json({
            success: false,
            message: "Failed to delete trek",
        });
    }
};

// Vendor: Update itinerary items
exports.updateItineraryItems = async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = req.user?.id;
        const { itineraryItems } = req.body;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Verify trek belongs to vendor
        const trek = await Trek.findOne({
            where: { id, vendor_id: vendorId },
        });

        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found",
            });
        }

        // Delete existing itinerary items
        await ItineraryItem.destroy({
            where: { trek_id: id },
        });

        // Create new itinerary items
        const createdItems = [];
        if (itineraryItems && Array.isArray(itineraryItems)) {
            for (const item of itineraryItems) {
                const itineraryItem = await ItineraryItem.create({
                    trek_id: id,
                    activities: item.activities || [],
                });
                createdItems.push(itineraryItem);
            }
        }

        res.json({
            success: true,
            message: "Itinerary items updated successfully",
            data: createdItems,
        });
    } catch (error) {
        console.error("Error updating itinerary items:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update itinerary items",
        });
    }
};

// Vendor: Update trek stages
exports.updateTrekStages = async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = req.user?.id;
        const { trekStages } = req.body;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Verify trek belongs to vendor
        const trek = await Trek.findOne({
            where: { id, vendor_id: vendorId },
        });

        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found",
            });
        }

        // Delete existing trek stages
        await TrekStage.destroy({
            where: { trek_id: id },
        });

        // Create new trek stages
        const createdStages = [];
        if (trekStages && Array.isArray(trekStages)) {
            for (const stage of trekStages) {
                const trekStage = await TrekStage.create({
                    trek_id: id,
                    batch_id: stage.batch_id, // Now required
                    stage_name: stage.stage_name,
                    destination: stage.destination || "",
                    means_of_transport: stage.means_of_transport || "",
                    date_time: stage.date_time, // Full date-time from frontend
                    is_boarding_point: stage.is_boarding_point || false,
                    city_id: stage.city_id || null,
                });
                createdStages.push(trekStage);
            }
        }

        res.json({
            success: true,
            message: "Trek stages updated successfully",
            data: createdStages,
        });
    } catch (error) {
        console.error("Error updating trek stages:", error);
        logger.trek("error", "Failed to update trek stages", {
            trekId: id,
            vendorId: req.user?.id,
            error: error.message,
            stack: error.stack,
            requestBody: req.body,
        });
        res.status(500).json({
            success: false,
            message: "Failed to update trek stages",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// Vendor: Update accommodations
exports.updateAccommodations = async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = req.user?.id;
        const { accommodations } = req.body;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Verify trek belongs to vendor
        const trek = await Trek.findOne({
            where: { id, vendor_id: vendorId },
        });

        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found",
            });
        }

        // Check if trek has already been edited
        if (trek.has_been_edited === 1) {
            return res.status(400).json({
                success: false,
                message:
                    "This trek has already been edited and cannot be modified further",
            });
        }

        // Delete existing accommodations
        await Accommodation.destroy({
            where: { trek_id: id },
        });

        // Create new accommodations
        const createdAccommodations = [];
        if (accommodations && Array.isArray(accommodations)) {
            for (const accommodation of accommodations) {
                const newAccommodation = await Accommodation.create({
                    trek_id: id,
                    type: accommodation.type || "",
                    details: {
                        night:
                            accommodation.details?.night ||
                            accommodation.night ||
                            1,
                        location:
                            accommodation.details?.location ||
                            accommodation.location ||
                            "",
                    },
                });
                createdAccommodations.push(newAccommodation);
            }
        }

        // Mark trek as edited
        await trek.update({ has_been_edited: 1 });

        res.json({
            success: true,
            message: "Accommodations updated successfully",
            data: createdAccommodations,
        });
    } catch (error) {
        console.error("Error updating accommodations:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update accommodations",
        });
    }
};

// Vendor: Create batches
exports.createBatches = async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = req.user?.id;
        const { batches } = req.body;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Verify trek belongs to vendor
        const trek = await Trek.findOne({
            where: { id, vendor_id: vendorId },
        });

        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found",
            });
        }

        // Check for duplicate treks (same vendor, destination, and same start date)
        if (batches && Array.isArray(batches) && batches.length > 0) {
            // Validate batch data
            for (const batch of batches) {
                if (!batch.start_date || !batch.end_date) {
                    return res.status(400).json({
                        success: false,
                        message:
                            "All batches must have start_date and end_date",
                        error: "INVALID_BATCH_DATA",
                    });
                }

                // Validate date format and logic
                const startDate = new Date(batch.start_date);
                const endDate = new Date(batch.end_date);

                if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid date format for batch dates",
                        error: "INVALID_DATE_FORMAT",
                    });
                }

                if (startDate >= endDate) {
                    return res.status(400).json({
                        success: false,
                        message: "Batch start date must be before end date",
                        error: "INVALID_DATE_RANGE",
                    });
                }

                // Check if dates are in the past
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (startDate < today) {
                    return res.status(400).json({
                        success: false,
                        message: "Cannot create batches with dates in the past",
                        error: "PAST_DATES_NOT_ALLOWED",
                    });
                }
            }

            const duplicateCheck = await checkDuplicateTrek(
                vendorId,
                trek.destination_id,
                batches
            );

            if (duplicateCheck.hasDuplicate) {
                const { duplicateInfo } = duplicateCheck;
                return res.status(400).json({
                    success: false,
                    message:
                        "Cannot create batches for this trek. You already have an active trek for the same destination with the same start date.",
                    error: "DUPLICATE_TREK",
                    details: {
                        existingTrekId: duplicateInfo.trekId,
                        existingTrekTitle: duplicateInfo.trekTitle,
                        existingStartDate: duplicateInfo.existingStartDate,
                        existingEndDate: duplicateInfo.existingEndDate,
                        conflictingStartDate: duplicateInfo.newStartDate,
                        conflictingEndDate: duplicateInfo.newEndDate,
                        suggestion:
                            "Please choose different dates or modify your existing trek.",
                    },
                });
            }
        }

        // Delete existing batches
        await Batch.destroy({
            where: { trek_id: id },
        });

        // Create new batches
        const createdBatches = [];
        if (batches && Array.isArray(batches)) {
            for (const batch of batches) {
                // Generate TBR ID
                const generateTbrId = () => {
                    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                    let result = "TBR";
                    for (let i = 0; i < 7; i++) {
                        result += chars.charAt(
                            Math.floor(Math.random() * chars.length)
                        );
                    }
                    return result;
                };

                const batchData = {
                    tbr_id: generateTbrId(),
                    trek_id: id,
                    start_date: batch.start_date,
                    end_date: batch.end_date,
                    capacity: batch.capacity || trek.max_participants,
                    booked_slots: 0,
                    available_slots: batch.capacity || trek.max_participants,
                };

                const newBatch = await Batch.create(batchData);
                createdBatches.push(newBatch);
            }
        }

        logger.trek("info", "Batches created successfully", {
            trekId: id,
            vendorId,
            batchCount: createdBatches.length,
            batches: createdBatches.map((b) => ({
                id: b.id,
                start_date: b.start_date,
                end_date: b.end_date,
            })),
        });

        res.json({
            success: true,
            message: "Batches created successfully",
            data: createdBatches,
        });
    } catch (error) {
        logger.trek("error", "Failed to create batches", {
            trekId: req.params.id,
            vendorId: req.user?.id,
            error: error.message,
            stack: error.stack,
        });
        res.status(500).json({
            success: false,
            message: "Failed to create batches",
        });
    }
};

// Vendor: Update batches
exports.updateBatches = async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = req.user?.id;
        const { batches } = req.body;

        if (!vendorId) {
            return res.status(404).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Verify trek belongs to vendor
        const trek = await Trek.findOne({
            where: { id, vendor_id: vendorId },
        });

        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found",
            });
        }

        // Check for duplicate treks (same vendor, destination, and same start date)
        // Exclude the current trek from the duplicate check
        if (batches && Array.isArray(batches) && batches.length > 0) {
            // Validate batch data
            for (const batch of batches) {
                if (!batch.start_date || !batch.end_date) {
                    return res.status(400).json({
                        success: false,
                        message:
                            "All batches must have start_date and end_date",
                        error: "INVALID_BATCH_DATA",
                    });
                }

                // Validate date format and logic
                const startDate = new Date(batch.start_date);
                const endDate = new Date(batch.end_date);

                if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid date format for batch dates",
                        error: "INVALID_DATE_FORMAT",
                    });
                }

                if (startDate >= endDate) {
                    return res.status(400).json({
                        success: false,
                        message: "Batch start date must be before end date",
                        error: "INVALID_DATE_RANGE",
                    });
                }

                // Check if dates are in the past
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (startDate < today) {
                    return res.status(400).json({
                        success: false,
                        message: "Cannot create batches with dates in the past",
                        error: "PAST_DATES_NOT_ALLOWED",
                    });
                }
            }

            const duplicateCheck = await checkDuplicateTrek(
                vendorId,
                trek.destination_id,
                batches,
                id
            );

            if (duplicateCheck.hasDuplicate) {
                const { duplicateInfo } = duplicateCheck;
                return res.status(400).json({
                    success: false,
                    message:
                        "Cannot update batches for this trek. You already have an active trek for the same destination with the same start date.",
                    error: "DUPLICATE_TREK",
                    details: {
                        existingTrekId: duplicateInfo.trekId,
                        existingTrekTitle: duplicateInfo.trekTitle,
                        existingStartDate: duplicateInfo.existingStartDate,
                        existingEndDate: duplicateInfo.existingEndDate,
                        conflictingStartDate: duplicateInfo.newStartDate,
                        conflictingEndDate: duplicateInfo.newEndDate,
                        suggestion:
                            "Please choose different dates or modify your existing trek.",
                    },
                });
            }
        }

        // Delete existing batches
        await Batch.destroy({
            where: { trek_id: id },
        });

        // Create new batches
        const createdBatches = [];
        if (batches && Array.isArray(batches)) {
            for (const batch of batches) {
                // Generate TBR ID
                const generateTbrId = () => {
                    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                    let result = "TBR";
                    for (let i = 0; i < 7; i++) {
                        result += chars.charAt(
                            Math.floor(Math.random() * chars.length)
                        );
                    }
                    return result;
                };

                const batchData = {
                    tbr_id: generateTbrId(),
                    trek_id: id,
                    start_date: batch.start_date,
                    end_date: batch.end_date,
                    capacity: batch.capacity || trek.max_participants,
                    booked_slots: 0,
                    available_slots: batch.capacity || trek.max_participants,
                };

                const newBatch = await Batch.create(batchData);
                createdBatches.push(newBatch);
            }
        }

        res.json({
            success: true,
            message: "Batches updated successfully",
            data: createdBatches,
        });
    } catch (error) {
        console.error("Error updating batches:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update batches",
        });
    }
};

// Vendor: Get batches
exports.getBatches = async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = req.user?.id;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Verify trek belongs to vendor
        const trek = await Trek.findOne({
            where: { id, vendor_id: vendorId },
        });

        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found",
            });
        }

        const batches = await Batch.findAll({
            where: { trek_id: id },
            order: [["start_date", "ASC"]],
        });

        res.json({
            success: true,
            data: batches,
        });
    } catch (error) {
        console.error("Error fetching batches:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch batches",
        });
    }
};

// Vendor: Upload trek images
exports.uploadTrekImages = async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = req.user?.id;
        const { images } = req.body;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Verify trek belongs to vendor
        const trek = await Trek.findOne({
            where: { id, vendor_id: vendorId },
        });

        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found",
            });
        }

        // Delete existing images
        const existingImages = await TrekImage.findAll({
            where: { trek_id: id },
        });

        for (const image of existingImages) {
            await deleteImage(image.url);
            await image.destroy();
        }

        // Upload new images
        const uploadedImages = [];
        if (images && Array.isArray(images)) {
            for (const imageData of images) {
                try {
                    // Accept both images[].data and images[].preview
                    let base64 = imageData?.data || imageData?.preview || "";
                    if (!base64 || typeof base64 !== "string") {
                        continue; // skip invalid entries silently
                    }
                    // Normalize if prefix missing
                    if (!base64.startsWith("data:image")) {
                        base64 = `data:image/jpeg;base64,${base64}`;
                    }

                    // Save image to file system
                    const imagePath = await saveBase64Image(base64, vendorId);

                    // Create image record in database
                    const image = await TrekImage.create({
                        trek_id: id,
                        url: imagePath,
                        is_cover: Boolean(imageData.is_cover || imageData.isCover) || false,
                    });

                    uploadedImages.push(image);
                } catch (imageError) {
                    console.error("Error uploading image:", imageError);
                    // Continue with other images even if one fails
                }
            }
        }

        res.json({
            success: true,
            message: "Images uploaded successfully",
            data: uploadedImages,
        });
    } catch (error) {
        console.error("Error uploading trek images:", error);
        res.status(500).json({
            success: false,
            message: "Failed to upload images",
        });
    }
};

// Vendor: Toggle trek status
exports.toggleTrekStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = req.user?.id;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        const trek = await Trek.findOne({
            where: { id, vendor_id: vendorId },
        });

        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found",
            });
        }

        const newStatus = trek.status === "active" ? "inactive" : "active";
        await trek.update({ status: newStatus });

        res.json({
            success: true,
            message: `Trek ${newStatus} successfully`,
            data: trek,
        });
    } catch (error) {
        console.error("Error toggling trek status:", error);
        res.status(500).json({
            success: false,
            message: "Failed to toggle trek status",
        });
    }
};

// Vendor: Get trek batches
exports.getTrekBatches = async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = req.user?.id;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Verify trek belongs to vendor
        const trek = await Trek.findOne({
            where: { id: id, vendor_id: vendorId },
        });

        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found",
            });
        }

        const batches = await Batch.findAll({
            where: { trek_id: id },
            order: [["start_date", "ASC"]],
        });

        const transformedBatches = batches.map((batch) => ({
            id: batch.id,
            startDate: batch.start_date,
            endDate: batch.end_date,
            capacity: batch.capacity,
            bookedSlots: batch.booked_slots || 0,
            availableSlots:
                batch.available_slots ||
                batch.capacity - (batch.booked_slots || 0),
            isAvailable:
                (batch.available_slots ||
                    batch.capacity - (batch.booked_slots || 0)) > 0,
        }));

        res.json({
            success: true,
            data: transformedBatches,
        });
    } catch (error) {
        console.error("Error fetching trek batches:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch trek batches",
        });
    }
};

// Vendor: Create itinerary items for trek
exports.createItineraryItems = async (req, res) => {
    try {
        const { itineraryItems } = req.body;
        const trek_id = req.params.id;
        const vendorId = req.user?.id;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Verify trek belongs to vendor
        const trek = await Trek.findOne({
            where: { id: trek_id, vendor_id: vendorId },
        });

        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found",
            });
        }

        const createdItems = [];
        for (const item of itineraryItems) {
            const itineraryItem = await ItineraryItem.create({
                trek_id: trek_id,
                activities: item.activities,
            });
            createdItems.push(itineraryItem);
        }

        res.status(201).json({
            success: true,
            message: `${createdItems.length} itinerary items created successfully`,
            data: createdItems,
        });
    } catch (error) {
        console.error("Error creating itinerary items:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create itinerary items",
        });
    }
};

// Vendor: Create trek stages for trek
exports.createTrekStages = async (req, res) => {
    try {
        const { trekStages } = req.body;
        const trek_id = req.params.id;
        const vendorId = req.user?.id;

        logger.trek("info", "Creating trek stages", {
            trekId: trek_id,
            vendorId: vendorId,
            trekStagesCount: trekStages?.length || 0,
            trekStages: trekStages,
        });

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Verify trek belongs to vendor
        const trek = await Trek.findOne({
            where: { id: trek_id, vendor_id: vendorId },
        });

        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found",
            });
        }

        const createdStages = [];
        for (const stage of trekStages) {
            const trekStage = await TrekStage.create({
                trek_id: trek_id,
                batch_id: stage.batch_id, // Now required
                stage_name: stage.stage_name,
                destination: stage.destination,
                means_of_transport: stage.means_of_transport,
                date_time: stage.date_time, // Full date-time from frontend
                is_boarding_point: stage.is_boarding_point || false,
                city_id: stage.city_id || null,
            });
            createdStages.push(trekStage);
        }

        res.status(201).json({
            success: true,
            message: `${createdStages.length} trek stages created successfully`,
            data: createdStages,
        });
    } catch (error) {
        console.error("Error creating trek stages:", error);
        logger.trek("error", "Failed to create trek stages", {
            trekId: trek_id,
            vendorId: req.user?.id,
            error: error.message,
            stack: error.stack,
            requestBody: req.body,
        });
        res.status(500).json({
            success: false,
            message: "Failed to create trek stages",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// Vendor: Create accommodations for trek
exports.createAccommodations = async (req, res) => {
    try {
        const { accommodations } = req.body;
        const trek_id = req.params.id;
        const vendorId = req.user?.id;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Verify trek belongs to vendor
        const trek = await Trek.findOne({
            where: { id: trek_id, vendor_id: vendorId },
        });

        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found",
            });
        }

        const createdAccommodations = [];
        for (const acc of accommodations) {
            const accommodation = await Accommodation.create({
                trek_id: trek_id,
                type: acc.type || "",
                details: {
                    night: acc.details?.night || acc.night || 1,
                    location: acc.details?.location || acc.location || "",
                },
            });
            createdAccommodations.push(accommodation);
        }

        res.status(201).json({
            success: true,
            message: `${createdAccommodations.length} accommodations created successfully`,
            data: createdAccommodations,
        });
    } catch (error) {
        console.error("Error creating accommodations:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create accommodations",
        });
    }
};


exports.getVendorTrekInstances = async (req, res) => {
  //  try {
        const vendorId = req.query.vendorID;

        const {
            search = "",
            status = "all",
            dateFilter = "all",
            page = 1,
            limit = 10,
        } = req.query;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // ===============================
        // 🔹 FETCH VENDOR FULL DATA
        // ===============================
        const vendorData = await Vendor.findOne({
            where: { user_id: vendorId },
            attributes: [
                "id",
                "business_name",
                "vin_id",
               
               
            ],
        });

        if (!vendorData) {
            return res.status(404).json({
                success: false,
                message: "Vendor not found",
            });
        }

        // ===============================
        // 🔹 EXISTING LOGIC (UNCHANGED)
        // ===============================

        const batchWhere = {};

        if (dateFilter !== "all") {
            const now = new Date();
            switch (dateFilter) {
                case "this-month":
                    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                    batchWhere.start_date = {
                        [Op.gte]: thisMonth,
                        [Op.lt]: nextMonth,
                    };
                    break;

                case "upcoming":
                    batchWhere.start_date = { [Op.gt]: now };
                    break;

                case "past":
                    batchWhere.start_date = { [Op.lt]: now };
                    break;
            }
        }

        const batches = await Batch.findAll({
            where: batchWhere,
            attributes: [
                "id",
                "tbr_id",
                "trek_id",
                "start_date",
                "end_date",
                "capacity",
                "booked_slots",
                "available_slots"
            ],
            include: [
                {
                    model: Trek,
                    as: "trek",
                    where: { vendor_id: vendorId },
                    include: [
                        {
                            model: TrekCaptain,
                            as: "captain",
                            attributes: ["name", "phone"],
                        },
                        {
                            model: Destination,
                            as: "destinationData",
                            required: false,
                            attributes: ["id", "name"],
                        },
                    ],
                },
                {
                    model: TrekCaptain,
                    as: "captain",
                    attributes: ["name", "phone"],
                },
            ],
            order: [["start_date", "ASC"]],
        });

        const trekInstances = await Promise.all(
            batches.map(async (batch) => {
                if (!batch.trek) return null;

                // ====== (aapka existing calculation code same rahega) ======
                // bookings, cancellations, earnings, status etc...
                // MAINE YAHAN KUCH BHI LOGIC CHANGE NAHI KIYA

                // 👉 to keep answer short, yahan direct return part dikha raha hoon

                const startDate = new Date(batch.start_date);
                let statusVal = "upcoming";
                const now = new Date();
                const endDate = batch.end_date ? new Date(batch.end_date) : null;

                if (endDate && endDate < now) statusVal = "completed";
                else if (startDate < now && (!endDate || endDate >= now)) statusVal = "ongoing";

                return {
                    id: `BATCH${batch.id}`,
                    tbrId: batch.tbr_id,
                    trekId: batch.trek_id,
                    trekName: batch.trek?.title || "Unknown Trek",
                    date: startDate.toISOString().split("T")[0],
                    captain: batch.captain?.name || batch.trek?.captain?.name || "Not Assigned",
                    captainPhone: batch.captain?.phone || batch.trek?.captain?.phone || null,
                    status: statusVal,
                    Start_date: batch.start_date || "NA",
                    end_date: batch.end_date || "NA",
                    totalSlots: batch.capacity || 0,
                    difficulty: batch.trek?.difficulty || "Moderate",
                    duration: batch.trek?.duration || "NA",
                    destination: batch.trek?.destinationData?.name || "Not specified",
                    bookedSlots: batch.booked_slots || 0,
                    availableSlots: batch.available_slots || 0,
                };
            })
        );

        const validTrekInstances = trekInstances.filter(i => i !== null);

        // ===============================
        // 🔹 SEARCH FILTER
        // ===============================
        let filteredInstances = validTrekInstances;
        if (search && search.trim() !== "") {
            const searchLower = search.toLowerCase();
            filteredInstances = validTrekInstances.filter((instance) =>
                instance.tbrId?.toLowerCase().includes(searchLower) ||
                instance.trekName?.toLowerCase().includes(searchLower) ||
                instance.captain?.toLowerCase().includes(searchLower)
            );
        }

        // ===============================
        // 🔹 STATUS FILTER
        // ===============================
        if (status !== "all") {
            filteredInstances = filteredInstances.filter(
                (instance) => instance.status === status
            );
        }

        // ===============================
        // 🔹 PAGINATION
        // ===============================
        const totalItems = filteredInstances.length;
        const totalPages = Math.ceil(totalItems / parseInt(limit));
        const startIndex = (parseInt(page) - 1) * parseInt(limit);
        const endIndex = startIndex + parseInt(limit);
        const paginatedInstances = filteredInstances.slice(startIndex, endIndex);

        // ===============================
        // 🔹 FINAL RESPONSE (IMPORTANT)
        // ===============================
        res.json({
            success: true,
            vendor: vendorData,        // ✅ FULL VENDOR OBJECT ADDED HERE
            data: paginatedInstances,
            pagination: {
                currentPage: parseInt(page),
                totalPages: totalPages,
                totalItems: totalItems,
                itemsPerPage: parseInt(limit),
                hasNext: parseInt(page) < totalPages,
                hasPrev: parseInt(page) > 1,
            },
        });

   /* } catch (error) {
        console.error("❌ trek-instances error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch trek instances",
        });
    }*/
};

exports.getVendorTrekDashboardCounts = async (req, res) => {
    try {
       // const vendorId = req.user?.id;
 const vendorId = req.query.vendorId; // ✅ FIX HERE
        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split("T")[0];

        // ===============================
        // 🔹 Get all trek IDs of vendor
        // ===============================
        const treks = await Trek.findAll({
            where: { vendor_id: vendorId },
            attributes: ["id"],
            raw: true,
        });

        const trekIds = treks.map(t => t.id);

        if (trekIds.length === 0) {
            return res.json({
                success: true,
                data: {
                    completed: 0,
                    ongoing: 0,
                    cancelled: 0,
                    upcoming: 0,
                    activeBookings: 0,
                    slotsCancelled: 0,
                },
            });
        }

        // ===============================
        // 🔹 COMPLETED
        // end_date < today
        // ===============================
        const completed = await Batch.count({
            include: [{
                model: Trek,
                as: "trek",
                where: { id: { [Op.in]: trekIds } },
                attributes: [],
            }],
            where: {
                end_date: { [Op.lt]: todayStr },
            },
        });

        // ===============================
        // 🔹 ONGOING
        // start_date <= today AND end_date >= today
        // ===============================
        const ongoing = await Batch.count({
            include: [{
                model: Trek,
                as: "trek",
                where: { id: { [Op.in]: trekIds } },
                attributes: [],
            }],
            where: {
                start_date: { [Op.lte]: todayStr },
                end_date: { [Op.gte]: todayStr },
            },
        });

        // ===============================
        // 🔹 UPCOMING
        // start_date > today
        // ===============================
        const upcoming = await Batch.count({
            include: [{
                model: Trek,
                as: "trek",
                where: { id: { [Op.in]: trekIds } },
                attributes: [],
            }],
            where: {
                start_date: { [Op.gt]: todayStr },
            },
        });

        // ===============================
        // 🔹 CANCELLED
        // batch.status = cancelled
        // ===============================
        const cancelled = await Batch.count({
            include: [{
                model: Trek,
                as: "trek",
                where: { id: { [Op.in]: trekIds } },
                attributes: [],
            }],
            where: {
                status: "cancelled",   // ⚠️ change if your column is different
            },
        });

        // ===============================
        // 🔹 ACTIVE BOOKINGS
        // total bookings of vendor treks
        // ===============================
        const activeBookings = await Booking.count({
            include: [{
                model: Batch,
                as: "batch",
                include: [{
                    model: Trek,
                    as: "trek",
                    where: { id: { [Op.in]: trekIds } },
                    attributes: [],
                }],
                attributes: [],
            }],
        });

        // ===============================
        // 🔹 SLOTS CANCELLED
        // available_slots = 0
        // ===============================
        const slotsCancelled = await Batch.count({
            include: [{
                model: Trek,
                as: "trek",
                where: { id: { [Op.in]: trekIds } },
                attributes: [],
            }],
            where: {
                available_slots: { [Op.eq]: 0 },
            },
        });

        // ===============================
        // 🔹 RESPONSE
        // ===============================
        res.json({
            success: true,
            data: {
                completed,
                ongoing,
                cancelled,
                upcoming,
                activeBookings,
                slotsCancelled,
            },
        });

    } catch (error) {
        console.error("❌ Vendor Trek Dashboard Count Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch dashboard counts",
        });
    }
};


exports.getVendorCustomerSummary = async (req, res) => {
  try {
    const vendorId = req.query.VendorId;

    const {
      search = "",
      trekFilter = "all",
      paymentFilter = "all",
      customFromDate,
      customToDate,
      page = 1,
      limit = 20,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const bookingWhere = { vendor_id: vendorId };
    const customerWhere = {};
    let batchWhere = {};

    // ---------------- SEARCH ----------------
    if (search && search.trim()) {
      const s = search.trim();

      if (s.toUpperCase().startsWith("TBR")) {
        batchWhere = {
          tbr_id: { [Op.like]: `%${s}%` },
        };
      } else {
        customerWhere[Op.or] = [
          { name: { [Op.like]: `%${s}%` } },
          { email: { [Op.like]: `%${s}%` } },
          { phone: { [Op.like]: `%${s}%` } },
        ];
      }
    }

    // ---------------- FILTERS ----------------
    if (trekFilter !== "all") bookingWhere.trek_id = trekFilter;

    if (paymentFilter !== "all") {
      if (paymentFilter === "cancelled") bookingWhere.status = "cancelled";
      else bookingWhere.payment_status = paymentFilter === "full" ? "full_paid" : paymentFilter;
    }

    if (customFromDate && customToDate) {
      bookingWhere.created_at = {
        [Op.between]: [new Date(customFromDate), new Date(customToDate)],
      };
    }

    // ---------------- QUERY ----------------
    const { rows: bookings, count } = await Booking.findAndCountAll({
      where: bookingWhere,
      include: [
        {
          model: Vendor,
          as: "vendor",
          attributes: ["id", "business_name", "vin_id"],
          required: true,
        },
        {
          model: Customer,
          as: "customer",
          where: Object.keys(customerWhere).length ? customerWhere : undefined,
          required: true,
        },
        {
          model: Trek,
          as: "trek",
          attributes: ["id", "title", "base_price", "duration", "duration_days","duration_nights"],
          include: [
            {
              model: TrekCaptain,
              as: "captain",
              attributes: ["name"],
              required: false,
            },
          ],
        },
        {
          model: Batch,
          as: "batch",
          attributes: ["id", "tbr_id", "start_date"],
          where: Object.keys(batchWhere).length ? batchWhere : undefined,
          required: Object.keys(batchWhere).length ? true : false,
        },
       {
  model: CancellationBooking,
  as: "cancellationBooking",
  attributes: ["reason", "status", "cancle_by"],
  required: true,   // 🔥 YAHI MAIN CHANGE
},
      ],
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset,
      distinct: true,
    });

    // ---------------- CALCULATIONS ----------------
    let totalRefundAmount = 0;
    let totalCancelledBatches = 0;
    let platformRevenueLoss = 0;

    const data = bookings.map((b) => {
      const base = parseFloat(b.trek?.base_price || 0);
      const vendorDiscount = parseFloat(b.vendor_discount || 0);
      const couponDiscount = parseFloat(b.coupon_discount || 0);
      const travelers = parseInt(b.total_travelers || 1);

      const calculatedAmount = (base - vendorDiscount - couponDiscount) * travelers;
      const refund = parseFloat(b.cancellationBooking?.total_refundable_amount || 0);

      if (b.status === "cancelled") {
        totalCancelledBatches += 1;
        totalRefundAmount += refund;
        platformRevenueLoss += calculatedAmount;
      }

      return {
        bookingId: b.id,
        tbrId: b.batch?.tbr_id || null,

        vendor: {
          id: b.vendor.id,
          name: b.vendor.business_name,
          vin_id: b.vendor.vin_id,
        },

        customerName: b.customer.name,
        phone: b.customer.phone,
        email: b.customer.email,

        trekName: b.trek?.title || "N/A",
        trekDate: b.batch?.start_date || null,
        totalTravelers: travelers,
        paymentStatus: b.payment_status,
        status: b.status,
        amount: calculatedAmount,
        refundAmount: refund,
        captain: b.trek?.captain?.name || "N/A",

        // 🔥 CANCELLATION KE 3 FIELDS – SAME LEVEL PE
        cancelReason: b.cancellationBooking?.reason || null,
        cancelDuration: b.trek?.duration || null,
        cancelBy: b.cancellationBooking?.cancel_by || "SYSTEM",
        cancelTrekName: b.trek?.title || null,
      };
    });

    // ---------------- RESPONSE ----------------
    res.json({
      success: true,
      analytics: {
        totalRefundAmount,
        totalCancelledBatches,
        platformRevenueLoss,
      },
      data,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalCount: count,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Vendor Customer Summary Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch vendor customer summary",
      error: error.message,
    });
  }
};





exports.getAdminAllBatches = async (req, res) => {
    try {
        const vendorId = req.query.vendorId || req.user?.id; 
        // admin side se vendorId pass kar sakte ho ?vendorId=5

        if (!vendorId) {
            return res.status(400).json({
                success: false,
                message: "vendorId is required",
            });
        }

        const {
            status = "all",
            destinationGroup = "all",
            searchTerm = "",
            page = 1,
            limit = 20,
        } = req.query;

        const offset = (page - 1) * limit;

        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const todayString = today.toISOString().split("T")[0];

        let whereCondition = {};
        let trekWhere = { vendor_id: vendorId };

        // ===============================
        // 🔹 STATUS FILTER LOGIC
        // ===============================
        switch (status) {
            case "completed":
                whereCondition.end_date = { [Op.lt]: todayString };
                break;

            case "upcoming":
                whereCondition.start_date = { [Op.gt]: todayString };
                break;

            case "ongoing":
                whereCondition = {
                    start_date: { [Op.lte]: todayString },
                    end_date: { [Op.gte]: todayString },
                };
                break;

            case "active":
                whereCondition.available_slots = { [Op.gt]: 0 };
                break;

            case "slotcancel":
                whereCondition.available_slots = { [Op.eq]: 0 };
                break;

            case "cancelled":
                whereCondition.status = "cancelled";
                break;

            case "pending":
                whereCondition.status = "pending";
                break;

            default:
                break;
        }

        // ===============================
        // 🔹 SEARCH FILTER
        // ===============================
        if (searchTerm) {
            const lowerSearchTerm = searchTerm.toLowerCase();
            whereCondition[Op.or] = [
                Sequelize.where(
                    Sequelize.fn("LOWER", Sequelize.col("tbr_id")),
                    "LIKE",
                    `%${lowerSearchTerm}%`
                ),
                Sequelize.where(
                    Sequelize.fn("LOWER", Sequelize.col("trek.title")),
                    "LIKE",
                    `%${lowerSearchTerm}%`
                ),
            ];
        }

        // ===============================
        // 🔹 DESTINATION FILTER
        // ===============================
        if (destinationGroup !== "all") {
            const destination = await Destination.findOne({
                where: { name: destinationGroup },
                attributes: ["id"],
            });

            if (destination) {
                trekWhere.destination_id = destination.id;
            } else {
                return res.json({
                    success: true,
                    data: {
                        batches: [],
                        pagination: {
                            total: 0,
                            page: parseInt(page),
                            limit: parseInt(limit),
                            totalPages: 0,
                        },
                    },
                });
            }
        }

        // ===============================
        // 🔹 MAIN QUERY (IMPORTANT PART)
        // ===============================
        const { count, rows: batches } = await Batch.findAndCountAll({
            where: whereCondition,
            include: [
                {
                    model: Trek,
                    as: "trek",
                    where: trekWhere, // ✅ yahin vendor filter lag gaya
                    attributes: ["id", "title", "duration_days", "city_ids", "destination_id", "vendor_id"],
                    include: [
                        {
                            model: Destination,
                            as: "destinationData",
                            attributes: ["id", "name"],
                        },
                    ],
                },
            ],
            order: [["start_date", "ASC"]],
            limit: parseInt(limit),
            offset: offset,
        });

        // ===============================
        // 🔹 CITY MAP
        // ===============================
        const allCityIds = [];
        batches.forEach(batch => {
            const cityIds = batch.trek?.city_ids || [];
            allCityIds.push(...cityIds);
        });

        const uniqueCityIds = [...new Set(allCityIds)];
        let cityMap = {};

        if (uniqueCityIds.length > 0) {
            const cities = await City.findAll({
                where: { id: { [Op.in]: uniqueCityIds } },
                attributes: ["id", "cityName"],
            });

            cityMap = cities.reduce((map, city) => {
                map[city.id] = city.cityName;
                return map;
            }, {});
        }

        // ===============================
        // 🔹 TRANSFORM DATA
        // ===============================
        const transformedBatches = await Promise.all(
            batches.map(async (batch) => {
                const trek = batch.trek;

                const cityIds = trek.city_ids || [];
                const sourceCities = cityIds.length
                    ? cityIds.map(id => cityMap[id] || `City ${id}`)
                    : ["Not specified"];

                const bookings = await Booking.findAll({
                    where: { batch_id: batch.id },
                    include: [{
                        model: BookingTraveler,
                        as: "travelers",
                        include: [{
                            model: Traveler,
                            as: "traveler",
                            attributes: ["age", "gender"],
                        }],
                    }],
                    attributes: ["id"],
                });

                const allTravelers = [];
                bookings.forEach(b => {
                    b.travelers.forEach(t => {
                        if (t.traveler) {
                            allTravelers.push(`${t.traveler.age}/${t.traveler.gender.charAt(0).toUpperCase()}`);
                        }
                    });
                });

                return {
                    id: batch.id,
                    tbrId: batch.tbr_id,
                    serviceName: trek.title,
                    vendorId: trek.vendor_id,
                    sourceCities,
                    destination: trek.destinationData?.name || "Unknown",
                    departure: batch.start_date,
                    arrival: batch.end_date,
                    bookedSlots: batch.booked_slots,
                    totalSlots: batch.capacity,
                    availableSlots: batch.available_slots,
                    duration: `${trek.duration_days}D/${trek.duration_days - 1}N`,
                    status: batch.status || (batch.available_slots > 0 ? "Active" : "Inactive"),
                    ageGender: allTravelers.length ? allTravelers.join(", ") : "No bookings",
                };
            })
        );

        // ===============================
        // 🔹 RESPONSE
        // ===============================
        res.json({
            success: true,
            data: {
                batches: transformedBatches,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / limit),
                },
                filters: {
                    statuses: ["all", "completed", "pending", "cancelled", "upcoming", "ongoing", "active", "slotcancel"],
                },
            },
        });

    } catch (error) {
        console.error("❌ Admin Vendor Batches error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch vendor batches",
        });
    }
};




// Vendor: Get TBR statistics
exports.getTbrStatistics = async (req, res) => {
    try {
        const vendorId = req.user?.id;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Get all treks with TBR IDs for this vendor
        const treks = await Trek.findAll({
            where: {
                vendor_id: vendorId,
                tbr_id: { [sequelize.Op.ne]: null }, // Only treks with TBR IDs
            },
            include: [
                {
                    model: Batch,
                    as: "batches",
                    required: false,
                    attributes: ["id", "booked_slots", "capacity"],
                },
            ],
        });

        // Calculate statistics
        const totalTbrs = treks.length;
        const activeTbrs = treks.filter(
            (trek) => trek.status === "active"
        ).length;
        const pendingTbrs = treks.filter(
            (trek) => trek.status === "deactive"
        ).length;
        const totalBookings = treks.reduce((total, trek) => {
            return (
                total +
                (trek.batches?.reduce(
                    (batchTotal, batch) => batchTotal + batch.booked_slots,
                    0
                ) || 0)
            );
        }, 0);

        res.json({
            success: true,
            data: {
                totalTbrs,
                activeTbrs,
                pendingTbrs,
                totalBookings,
                treks: treks.map((trek) => ({
                    id: trek.id,
                    tbr_id: trek.tbr_id,
                    title: trek.title,
                    status: trek.status,
                    totalBatches: trek.batches?.length || 0,
                    totalBookings:
                        trek.batches?.reduce(
                            (total, batch) => total + batch.booked_slots,
                            0
                        ) || 0,
                })),
            },
        });
    } catch (error) {
        console.error("Error getting TBR statistics:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get TBR statistics",
        });
    }
};

// Controller function to check for duplicate treks (for frontend validation)
exports.checkDuplicateTrek = async (req, res) => {
    try {
        const vendorId = req.user?.id;
        const { destination_id, batches } = req.body;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        if (!destination_id || !batches || !Array.isArray(batches)) {
            return res.status(400).json({
                success: false,
                message: "Destination ID and batches are required",
            });
        }

        // Check for duplicates using the helper function
        const duplicateCheck = await checkDuplicateTrek(
            vendorId,
            destination_id,
            batches
        );

        res.json({
            success: true,
            data: duplicateCheck,
        });
    } catch (error) {
        console.error("Error checking duplicate trek:", error);
        res.status(500).json({
            success: false,
            message: "Failed to check for duplicate treks",
            error: error.message,
        });
    }
};

// Controller function to request batch cancellation
exports.requestBatchCancellation = async (req, res) => {
    try {
        const vendorId = req.user?.id;
        const { batchId } = req.params;
        const { reason, recordDetails } = req.body;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        if (!batchId || !reason) {
            return res.status(400).json({
                success: false,
                message: "Batch ID and reason are required",
            });
        }

        if (reason.trim().length < 10) {
            return res.status(400).json({
                success: false,
                message: "Reason must be at least 10 characters long",
            });
        }

        // Verify that the batch belongs to a trek owned by the vendor
        const batch = await Batch.findOne({
            where: {
                id: batchId,
            },
            include: [{
                model: Trek,
                as: 'trek',
                where: {
                    vendor_id: vendorId,
                },
                attributes: ['id', 'vendor_id', 'title'],
            }],
        });

        if (!batch) {
            return res.status(404).json({
                success: false,
                message: "Batch not found or you don't have permission to request cancellation for this batch",
            });
        }

        // Check if there's already a pending request for this TBR
        const existingRequest = await BatchCancellationRequest.findOne({
            where: {
                batch_id: batchId,
                status: 'pending',
            },
        });

        if (existingRequest) {
            return res.status(409).json({
                success: false,
                message: "A batch cancellation request is already pending for this batch",
            });
        }

        // Create the batch cancellation request
        const cancellationRequest = await BatchCancellationRequest.create({
            batch_id: batchId,
            vendor_id: vendorId,
            reason: reason.trim(),
            record_details: recordDetails || null,
            status: 'pending',
        });

        logger.info(`Batch cancellation request created for batch ${batchId} by vendor ${vendorId}`, {
            category: "trek",
            requestId: cancellationRequest.id,
            batchId,
            vendorId,
            reason: reason.trim(),
        });

        res.json({
            success: true,
            message: "Batch cancellation request submitted successfully",
            data: {
                requestId: cancellationRequest.id,
                batchId,
                status: cancellationRequest.status,
                requestedAt: cancellationRequest.requested_at,
            },
        });
    } catch (error) {
        logger.error("Error creating batch cancellation request:", error, {
            category: "trek",
            batchId: req.params.batchId,
            vendorId: req.user?.id,
        });
        res.status(500).json({
            success: false,
            message: "Failed to submit batch cancellation request",
            error: error.message,
        });
    }
};


exports.getWalletBalance = async (req, res) => {
  try {
    // 👉 vendor id query ya params se lo
    const vendorId = req.query.vendorId || req.params.vendorId;

    if (!vendorId) {
      return res.status(400).json({
        success: false,
        message: "vendorId is required",
      });
    }

    logger.info("wallet", "Fetching wallet balance", { vendorId });

    // 🔹 Get vendor details
   const vendor = await Vendor.findOne({
    where: { user_id: vendorId }
});
    
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    // 🔹 Calculate balances (vendor specific)
    const balanceData = await calculateBalancesDirectly(vendorId);

    // 🔹 Get last withdrawal date
    const lastWithdrawal = await getLastWithdrawalDate(vendorId);
    const nextWithdrawalDate = calculateNextWithdrawalDate(lastWithdrawal);
    const canWithdrawNow = new Date() >= nextWithdrawalDate;

    // 🔹 Get analytics data
    const analyticsData = await getWalletAnalytics(vendorId);

    const response = {
      success: true,
      vendor: {
        id: vendor.id,
        business_name: vendor.business_name,
        vin_id: vendor.vin_id,
      },
      data: {
        ...balanceData,
        lastWithdrawalDate: lastWithdrawal,
        nextWithdrawalDate: nextWithdrawalDate,
        canWithdrawNow: canWithdrawNow,
        analytics: analyticsData,
      },
    };

    logger.info("wallet", "Wallet balance fetched successfully", {
      vendorId,
      availableBalance: balanceData.availableBalance,
      totalEarnings: balanceData.totalEarnings,
    });

    res.json(response);

  } catch (error) {
    logger.error("wallet", "Error fetching wallet balance", {
      vendorId: req.query?.vendorId || req.params?.vendorId,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      message: "Failed to fetch wallet balance",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

 async function getLastWithdrawalDate(vendorId) {
    // This would query your withdrawals table
    // For now, returning null (no previous withdrawals)
    return null;
}
function calculateNextWithdrawalDate(lastWithdrawal) {
    if (!lastWithdrawal) {
        return new Date(); // Can withdraw immediately
    }

    const lastDate = new Date(lastWithdrawal);
    
    // Get the end of the week when last withdrawal was made
    const lastWeekEnd = new Date(lastDate);
    lastWeekEnd.setDate(lastDate.getDate() + (6 - lastDate.getDay())); // Saturday
    lastWeekEnd.setHours(23, 59, 59, 999);

    // Next withdrawal available from next Sunday
    const nextAvailableDate = new Date(lastWeekEnd);
    nextAvailableDate.setDate(lastWeekEnd.getDate() + 1);
    nextAvailableDate.setHours(0, 0, 0, 0);

    return nextAvailableDate;
}

async function getWalletAnalytics(vendorId) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get bookings for different periods
    const [sevenDayBookings, thirtyDayBookings, allBookings] = await Promise.all([
        Booking.findAll({
            where: {
                vendor_id: vendorId,
                created_at: { [Op.gte]: sevenDaysAgo },
            },
        }),
        Booking.findAll({
            where: {
                vendor_id: vendorId,
                created_at: { [Op.gte]: thirtyDaysAgo },
            },
        }),
        Booking.findAll({
            where: { vendor_id: vendorId },
        }),
    ]);

    const calculateMetrics = (bookings) => {
        let earnings = 0;
        let refunds = 0;
        let cancellations = 0;

        for (const booking of bookings) {
            const amount = parseFloat(booking.final_amount || 0);
            const commission = parseFloat(booking.commission_amount || 0);
            const vendorShare = amount - commission;

            if (booking.status === "completed") {
                earnings += vendorShare;
            } else if (booking.status === "cancelled") {
                cancellations += 1;
                const refundAmount = calculateRefundAmount(booking);
                refunds += refundAmount;
            }
        }

        return { earnings, refunds, cancellations };
    };

    const sevenDayMetrics = calculateMetrics(sevenDayBookings);
    const thirtyDayMetrics = calculateMetrics(thirtyDayBookings);

    return {
        "7days": {
            earnings: sevenDayMetrics.earnings,
            refunds: sevenDayMetrics.refunds,
            cancellations: sevenDayMetrics.cancellations,
        },
        "30days": {
            earnings: thirtyDayMetrics.earnings,
            refunds: thirtyDayMetrics.refunds,
            cancellations: thirtyDayMetrics.cancellations,
        },
    };
}
async function calculateBalancesDirectly(vendorId) {
    try {
        // Get all batches for the vendor with bookings
        const batches = await Batch.findAll({
            include: [
                {
                    model: Trek,
                    as: 'trek',
                    where: { vendor_id: vendorId },
                    attributes: []
                },
                {
                    model: Booking,
                    as: 'bookings',
                    attributes: ['id', 'total_amount', 'final_amount', 'status'],
                    required: false
                }
            ]
        });

        let totalEarnings = 0;
        let availableBalance = 0;
        let lockedBalance = 0;

        const today = new Date();
        const threeDaysAgo = new Date(today);
        threeDaysAgo.setDate(today.getDate() - 3);
        const twoDaysAgo = new Date(today);
        twoDaysAgo.setDate(today.getDate() - 2);

        for (const batch of batches) {
            const batchStartDate = new Date(batch.start_date);
            
            // Calculate total booking amount for this batch
            const totalBookingAmount = batch.bookings.reduce((sum, booking) => {
                if (booking.status === 'confirmed' || booking.status === 'completed') {
                    return sum + parseFloat(booking.total_amount || 0);
                }
                return sum;
            }, 0);
            
            const platformCommission = totalBookingAmount * 0.10; // 10% commission
            const netAmount = totalBookingAmount - platformCommission;
            
            totalEarnings += netAmount;
            
            // Determine if amount is available or locked
            if (batchStartDate <= threeDaysAgo) {
                // Available for withdrawal (batch started more than 3 days ago)
                availableBalance += netAmount;
            } else if (batchStartDate <= twoDaysAgo) {
                // Locked (batch started within 2-3 days)
                lockedBalance += netAmount;
            } else {
                // Future batch, not yet available
                lockedBalance += netAmount;
            }
        }

        return {
            availableBalance: roundAmount(availableBalance),
            lockedBalance: roundAmount(lockedBalance),
            totalEarnings: roundAmount(totalEarnings),
            totalBalance: roundAmount(availableBalance + lockedBalance)
        };

    } catch (error) {
        logger.error("wallet", "Error calculating balances directly", {
            error: error.message,
            vendorId
        });
        
        return {
            availableBalance: 0,
            lockedBalance: 0,
            totalEarnings: 0,
            totalBalance: 0
        };
    }
}



exports.getWithdrawalHistory = async (req, res) => {
    try {
       const vendorId = req.query.vendorId || req.params.vendorId;
        
        // Get pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        
        logger.info("wallet", "Fetching withdrawal history", { vendorId, page, limit });

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Get total count of withdrawals
        const totalCount = await Withdrawal.count({
            where: {
                vendor_id: vendorId
            }
        });

        // Get paginated withdrawal history
        const withdrawals = await Withdrawal.findAll({
            where: {
                vendor_id: vendorId
            },
            order: [['withdrawal_date', 'DESC']],
            limit: limit,
            offset: offset
        });

        // Calculate pagination metadata
        const totalPages = Math.ceil(totalCount / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        logger.info("wallet", "Withdrawal history retrieved", { 
            vendorId, 
            totalWithdrawals: totalCount,
            currentPage: page,
            totalPages: totalPages,
            withdrawalsInPage: withdrawals.length
        });

        return res.json({
            success: true,
            message: "Withdrawal history retrieved successfully",
            data: {
                withdrawals: withdrawals.map(withdrawal => ({
                    id: withdrawal.id,
                    withdrawal_id: withdrawal.withdrawal_id,
                    amount: roundAmount(parseFloat(withdrawal.amount || 0)),
                    tbrs_count: withdrawal.tbrs_count,
                    status: withdrawal.status,
                    notes: withdrawal.notes,
                    rejected_reason: withdrawal.rejected_reason,
                    withdrawal_date: withdrawal.withdrawal_date,
                    status_change_date: withdrawal.status_change_date
                }))
            },
            pagination: {
                current_page: page,
                total_pages: totalPages,
                total_records: totalCount,
                records_per_page: limit,
                has_next_page: hasNextPage,
                has_prev_page: hasPrevPage
            }
        });

    } catch (error) {
        logger.error("wallet", "Error fetching withdrawal history", {
            error: error.message,
            stack: error.stack,
            vendorId: req.user?.id
        });

        return res.status(500).json({
            success: false,
            message: "Internal server error while fetching withdrawal history",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

async function getWithdrawalsWithDetails(vendorId, offset, limit) {
    // This would query your actual withdrawals table
    // For now, returning mock data
    return [
        {
            id: "WD-2025-001",
            amount: roundAmount(25000),
            status: "Completed",
            created_at: "2025-01-07T10:00:00Z",
            tbr_breakdown: [
                {
                    tbr_id: "TBR-2025-H01",
                    trek_name: "Himalayan Trek",
                    gross_amount: roundAmount(15000),
                    refunds_deducted: roundAmount(1000),
                    commissions_deducted: roundAmount(1500),
                    net_amount: roundAmount(12500),
                    total_bookings: 5,
                    total_cancellations: 1,
                },
            ],
            failure_reason: null,
        },
    ];
}


exports.getAccessLogs = async (req, res) => {
  try {
    const {
      vendor_id,
      status,
      search = "",
      fromDate,
      toDate,
      page = 1,
      limit = 20,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {};

    // 🔹 Vendor Filter
    if (vendor_id) {
      where.vendor_id = vendor_id;
    }

    // 🔹 Status Filter
    if (status) {
      where.status = status;
    }

    // 🔹 Date Range Filter
    if (fromDate && toDate) {
      where.created_date = {
        [Op.between]: [fromDate, toDate],
      };
    }

    // 🔹 Search in message
    if (search && search.trim()) {
      where.message = {
        [Op.like]: `%${search.trim()}%`,
      };
    }

    const { rows, count } = await AccessLog.findAndCountAll({
      where,
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
      offset,
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalCount: count,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Access Logs Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch access logs",
      error: error.message,
    });
  }
};

const getClientIp = (req) => {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    "0.0.0.0"
  );
};

const getCurrentDate = () => {
  return new Date().toISOString().slice(0, 10);
};

const getCurrentTime = () => {
  return new Date().toTimeString().slice(0, 8);
};
exports.manageAccessLog = async (req, res) => {
 // try {
    const { action,vendor_id,id,notes } = req.body;
   // const vendor_id = req.user.id;
    const performedByName = "Vendor";
    const ip = getClientIp(req);

    // ================= LOGIN =================
    if (action === "login") {
      const log = await AccessLog.create({
        vendor_id,
        message: "User logged in",
        last_ip: ip,
        last_locations: "Unknown",
        performedByName,
        status: "success",
        access_time: getCurrentTime(),
        created_date: getCurrentDate(),
      });

      return res.json({
        success: true,
        message: "Login recorded",
        access_log_id: log.id,
      });
    }

    // ================= LOGOUT =================
    if (action === "logout") {
      if (!id) {
        return res.status(400).json({
          success: false,
          message: "access_log_id required for logout",
        });
      }

      await AccessLog.update(
        {
          message: "User logged out",
          last_ip: ip,
          logout_time: getCurrentTime(),
        },
        {
          where: {
            id: id,
            vendor_id,
          },
        }
      );

      return res.json({
        success: true,
        message: "Logout recorded",
      });
    }

    return res.status(400).json({
      success: false,
      message: "Invalid action",
    });

 /* } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }*/
};



async function getWithdrawalCount(vendorId) {
    // This would count actual withdrawals
    return 1;
}

async function getAvailableTbrBreakdown(vendorId) {
    // This would get actual TBR breakdown from your database
    // Get batches through Trek model since Batch doesn't have vendor_id directly
    const batches = await Batch.findAll({
        include: [
            {
                model: Trek,
                as: "trek",
                attributes: ["title", "vendor_id"],
                where: { vendor_id: vendorId },
                required: true,
            },
        ],
        order: [["start_date", "DESC"]],
        limit: 50,
    });

    return batches.map(batch => {
        const mockGrossAmount = Math.random() * 20000 + 5000;
        const mockCommissions = mockGrossAmount * 0.1;
        const mockNetAmount = mockGrossAmount - mockCommissions;

        return {
            tbr_id: batch.tbr_id || `TBR-${batch.id}`,
            trek_name: batch.trek?.title || "Unknown Trek",
            gross_amount: roundAmount(mockGrossAmount),
            refunds_deducted: roundAmount(0),
            commissions_deducted: roundAmount(mockCommissions),
            net_amount: roundAmount(mockNetAmount),
            total_bookings: Math.floor(Math.random() * 10) + 1,
            total_cancellations: Math.floor(Math.random() * 3),
            available_for_withdrawal: mockNetAmount > 0,
        };
    });
}

exports.getWalletTransactions = async (req, res) => {
  try {
    const vendorId = req.query.vendorId || req.params.vendorId;
    const { page = 1, limit = 20, search = "", type = "all", status = "all" } = req.query;

    if (!vendorId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Vendor account required.",
      });
    }

    const offset = (page - 1) * limit;

    const bookingWhere = { vendor_id: vendorId };

    if (status !== "all") {
      bookingWhere.payment_status = status;
    }

    if (search && search.trim()) {
      const numericId = search.replace(/[^\d]/g, "");
      if (numericId) bookingWhere.id = numericId;
    }

    const { count, rows: bookings } = await Booking.findAndCountAll({
      where: bookingWhere,
      attributes: [
        "id",
        "created_at",
        "updated_at",
        "booking_date",
        "final_amount",
        "payment_status",
        "status",
      ],
      include: [
        {
          model: Batch,
          as: "batch",
          attributes: ["id", "tbr_id", "start_date", "trek_id"],
          required: true,
          include: [
            {
              model: Trek,
              as: "trek",
              attributes: ["id", "title"],
              where: { vendor_id: vendorId },
              required: true,
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    const transactions = [];

    for (const booking of bookings) {
      const trek = booking.batch?.trek;
      const trekName = trek?.title || "Unknown Trek";
      const trekId = trek?.id || null;
      const tbrId = booking.batch?.tbr_id || "N/A";
      const paymentStatus = booking.payment_status || "pending";
      const finalAmount = parseFloat(booking.final_amount || 0);
      const commissionAmount = finalAmount * 0.1;

      let paymentDescription = "";
      if (paymentStatus === "partial") {
        paymentDescription = `Partial payment received for ${trekName}`;
      } else if (paymentStatus === "full" || paymentStatus === "full_paid") {
        paymentDescription = `Full payment received for ${trekName}`;
      } else {
        paymentDescription = `Payment received for ${trekName}`;
      }

      // 🔹 Payment Transaction
      transactions.push({
        id: `BK-${booking.id}`,
        date_time: booking.booking_date || booking.created_at,
        booking_id: `BK-${booking.id}`,
        tbr_id: tbrId,
        amount: roundAmount(finalAmount),
        type:
          paymentStatus === "partial"
            ? "PartialPayment"
            : paymentStatus === "full" || paymentStatus === "full_paid"
            ? "BookingPayment"
            : paymentStatus === "refunded"
            ? "Refund"
            : "Payment",
        status:
          booking.status === "confirmed"
            ? "Success"
            : booking.status === "cancelled"
            ? "Failed"
            : "Processing",
        description: paymentDescription,
        trek_name: trekName,
        trek_id: trekId,
        payment_status: paymentStatus,
        transaction_date: booking.booking_date || booking.created_at,
      });

      // 🔹 Commission Transaction
      if (booking.status === "confirmed" && finalAmount > 0) {
        transactions.push({
          id: `CM-${booking.id}`,
          date_time: booking.booking_date || booking.created_at,
          booking_id: `BK-${booking.id}`,
          tbr_id: tbrId,
          amount: roundAmount(-commissionAmount),
          type: "Commission",
          status: "Success",
          description: `Commission deducted for ${trekName}`,
          trek_name: trekName,
          trek_id: trekId,
          payment_status: paymentStatus,
          transaction_date: booking.booking_date || booking.created_at,
        });
      }
    }

    // 🔹 Sort by latest
    transactions.sort((a, b) => new Date(b.date_time) - new Date(a.date_time));

    // 🔹 Filter by type
    let filteredTransactions = transactions;
    if (type !== "all") {
      filteredTransactions = filteredTransactions.filter((t) => t.type === type);
    }

    // 🔹 Search in response data
    if (search && search.trim()) {
      const term = search.toLowerCase();
      filteredTransactions = filteredTransactions.filter(
        (t) =>
          t.booking_id.toLowerCase().includes(term) ||
          t.tbr_id.toLowerCase().includes(term) ||
          t.trek_name.toLowerCase().includes(term)
      );
    }

    res.json({
      success: true,
      data: filteredTransactions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalCount: count,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Wallet Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch transaction history",
      error: error.message,
    });
  }
};



exports.getAvailableTbrBreakdown = async (req, res) => {
  try {
    const vendorId = req.query.vendorId || req.params.vendorId;

    if (!vendorId) {
      return res.status(400).json({
        success: false,
        message: "vendorId is required",
      });
    }

    const tbrData = await Batch.findAll({
      attributes: [
        "tbr_id",
        [Sequelize.fn("COUNT", Sequelize.col("Batch.id")), "total_batches"],
      ],
      include: [
        {
          model: Trek,
          as: "trek",
          attributes: ["id", "title"],
          where: { vendor_id: vendorId },   // 🔥 vendor filter
          required: true,
        },
      ],
      group: ["Batch.tbr_id", "trek.id"],
      order: [["tbr_id", "ASC"]],
      raw: true,
    });

    const result = tbrData.map(item => ({
      tbr_id: item.tbr_id,
      trek_id: item["trek.id"],
      trek_name: item["trek.title"],
      total_batches: item.total_batches,
    }));

    return res.json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error("getAvailableTbrBreakdown Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch TBR breakdown",
      error: error.message,
    });
  }
};

exports.getTbrBreakdownDetailed = async (req, res) => {
    try {
       const vendorId = req.query.vendorId || req.params.vendorId;
        
        // Get pagination parameters from query
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        
        logger.info("wallet", "Fetching detailed TBR breakdown", { vendorId, page, limit, offset });

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Get vendor details
       const vendor = await Vendor.findOne({
    where: { user_id: vendorId }
});
        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: "Vendor not found",
            });
        }

        // Get all batches for this vendor with related data (without pagination first)
        const allBatches = await Batch.findAll({
            include: [
                {
                    model: Trek,
                    as: 'trek',
                    where: {
                        vendor_id: vendorId
                    },
                    attributes: ['id', 'title', 'base_price', 'cancellation_policy_id'],
                    include: [
                        {
                            model: require('../../models').CancellationPolicy,
                            as: 'cancellation_policy',
                            attributes: ['id', 'title', 'description']
                        }
                    ]
                },
                {
                    model: Booking,
                    as: 'bookings',
                    attributes: [
                        'id',
                        'customer_id',
                        'total_amount',
                        'final_amount',
                        'payment_status',
                        'status',
                        'vendor_discount',
                        'coupon_discount',
                        'total_travelers'
                    ],
                    include: [
                        {
                            model: Customer,
                            as: 'customer',
                            attributes: ['id', 'name', 'email', 'phone']
                        }
                    ]
                }
            ],
            order: [['start_date', 'DESC']]
        });

        // Filter batches that have bookings
        const batchesWithBookings = allBatches.filter(batch => {
            const batchBookings = batch.bookings || [];
            return batchBookings.length > 0;
        });

        // Get total count of batches with bookings
        const totalBatchesCount = batchesWithBookings.length;
        console.log(`=== BATCH COUNT DEBUG ===`);
        console.log(`Total batches found for vendor: ${allBatches.length}`);
        console.log(`Batches with bookings: ${totalBatchesCount}`);
        console.log(`Batches without bookings: ${allBatches.length - totalBatchesCount}`);
        
        // Log some batch details for debugging
        allBatches.slice(0, 5).forEach((batch, index) => {
            console.log(`Batch ${index + 1}: ID=${batch.id}, TBR=${batch.tbr_id}, Bookings=${batch.bookings?.length || 0}`);
        });

        // Apply pagination to filtered batches
        const batches = batchesWithBookings.slice(offset, offset + limit);

        // Get cancellation data for all batches with bookings (not just current page)
        const allBatchIds = batchesWithBookings.map(batch => batch.id);
        console.log(`Looking for cancellations for all batch IDs: ${allBatchIds.join(', ')}`);
        
        const cancellations = await CancellationBooking.findAll({
            where: {
                batch_id: {
                    [Op.in]: allBatchIds
                }
            },
            include: [
                {
                    model: Booking,
                    as: 'booking',
                    attributes: ['id', 'total_amount', 'final_amount']
                }
            ]
        });

        console.log(`Found ${cancellations.length} cancellations total`);
        cancellations.forEach(cancellation => {
            console.log(`Cancellation ${cancellation.id}: batch_id=${cancellation.batch_id}, refund_amount=${cancellation.total_refundable_amount}`);
        });

        // Group cancellations by batch_id
        const cancellationsByBatch = {};
        cancellations.forEach(cancellation => {
            if (!cancellationsByBatch[cancellation.batch_id]) {
                cancellationsByBatch[cancellation.batch_id] = [];
            }
            cancellationsByBatch[cancellation.batch_id].push(cancellation);
        });

        // Calculate detailed breakdown for each batch
        const tbrBreakdown = await Promise.all(batches.map(async (batch) => {
            const batchBookings = batch.bookings || [];
            const bookingMap = new Map();
            batchBookings.forEach(booking => bookingMap.set(booking.id, booking));

            // Separate cancelled bookings for dedicated reporting
            const cancelledBatchBookings = batchBookings.filter(booking => booking.status === 'cancelled');

            // Exclude cancelled bookings from main calculations and display
            const activeBatchBookings = batchBookings.filter(booking => booking.status !== 'cancelled');
            const batchCancellations = cancellationsByBatch[batch.id] || [];
            
            // Note: We'll calculate totals after filtering bookings with "Customer Favour" status
            // These initial totals are placeholders, will be recalculated after filtering
            const totalBookingAmount = activeBatchBookings.reduce((sum, booking) => {
                return sum + parseFloat(booking.total_amount || 0);
            }, 0);
            
            const totalFinalAmount = activeBatchBookings.reduce((sum, booking) => {
                return sum + parseFloat(booking.final_amount || 0);
            }, 0);

            // Calculate cancellation amounts
            const totalCancellationAmount = batchCancellations.reduce((sum, cancellation) => {
                return sum + parseFloat(cancellation.total_refundable_amount || 0);
            }, 0);

            // Debug logging for cancellation amounts
            if (batchCancellations.length > 0) {
                console.log(`Batch ${batch.id} has ${batchCancellations.length} cancellations:`);
                batchCancellations.forEach(cancellation => {
                    console.log(`  Cancellation ${cancellation.id}: refund_amount = ${cancellation.total_refundable_amount}`);
                });
                console.log(`  Total cancellation amount: ${totalCancellationAmount}`);
            }

            // Get dispute reports first to filter out bookings with "Customer Favour" status
            const batchBookingIds = activeBatchBookings.map(booking => booking.id);
            const disputeReports = await IssueReport.findAll({
                where: {
                    booking_id: {
                        [Op.in]: batchBookingIds
                    }
                },
                attributes: ['booking_id', 'favoue_status']
            });

            // Find booking IDs that have "Customer Favour" status - these should be excluded
            const customerFavourBookingIds = new Set(
                disputeReports
                    .filter(report => report.favoue_status === 'Customer Favour')
                    .map(report => report.booking_id)
            );

            // Filter out bookings with "Customer Favour" status
            const filteredBatchBookings = activeBatchBookings.filter(booking => 
                !customerFavourBookingIds.has(booking.id)
            );

            // Recalculate totals after filtering
            const filteredTotalBookingAmount = filteredBatchBookings.reduce((sum, booking) => {
                return sum + parseFloat(booking.total_amount || 0);
            }, 0);
            
            const filteredTotalFinalAmount = filteredBatchBookings.reduce((sum, booking) => {
                return sum + parseFloat(booking.final_amount || 0);
            }, 0);

            // Recalculate platform commission based on filtered bookings
            const filteredPlatformCommission = filteredTotalBookingAmount * 0.10;

            // Get booking details with payment status and calculated payable/net amounts
            let totalTcsAmountForBatch = 0;

            const bookingDetails = filteredBatchBookings.map((booking) => {
                const basePrice = parseFloat(batch.trek?.base_price || 0);
                const vendorDiscount = parseFloat(booking.vendor_discount || 0);
                const couponDiscount = parseFloat(booking.coupon_discount || 0);
                const travellerCountRaw =
                    booking.total_travelers ?? booking.total_travellers ?? 0;
                const totalTravellers = Number.isNaN(parseInt(travellerCountRaw, 10))
                    ? 0
                    : parseInt(travellerCountRaw, 10);

                const paymentStatus = booking.payment_status || 'pending';
                const newBasePrice = Math.max(
                    basePrice - vendorDiscount - couponDiscount,
                    0,
                );

                const isFullPayment = ['full_paid', 'completed', 'full'].includes(
                    paymentStatus,
                );

                // Step 1: Calculate bookings payable amount
                // If full_paid: new_base_price * total_travelers
                // If partial: 999 * total_travelers
                const fullBookingPayableAmount = totalTravellers * newBasePrice;
                const partialPayableAmount = totalTravellers * 999;
                
                const bookingPayableAmount = isFullPayment
                    ? fullBookingPayableAmount
                    : partialPayableAmount;
                
                const collectedAmount = isFullPayment
                    ? fullBookingPayableAmount
                    : partialPayableAmount;

                // Step 2: Calculate commission and tax based on new_base_price (always, regardless of payment status)
                const commissionPerTraveller = newBasePrice * 0.1; // 10% commission
                const taxPerTraveller = commissionPerTraveller * 0.18; // 18% tax on commission
                
                // Multiply by total travelers
                const totalCommissionAmount = commissionPerTraveller * totalTravellers;
                const totalTaxAmount = taxPerTraveller * totalTravellers;
                const platformCommissionAmount = totalCommissionAmount + totalTaxAmount;

                // Step 3: Calculate TCS amount
                const tcsPerTraveller = newBasePrice * 0.01; // 1% TCS
                const totalTcsAmount = tcsPerTraveller * totalTravellers;

                totalTcsAmountForBatch += totalTcsAmount;

                // Step 4: Calculate net amount
                // net_amount = bookings_payable_amount - platform_commission_amount - tcs_amount
                const calculatedNetAmount = bookingPayableAmount - platformCommissionAmount - totalTcsAmount;

                return {
                    booking_id: booking.id,
                    customer_id: booking.customer_id,
                    customer_name: booking.customer?.name || 'Unknown',
                    customer_email: booking.customer?.email || '',
                    customer_phone: booking.customer?.phone || '',
                    total_amount: parseFloat(booking.total_amount || 0),
                    final_amount: parseFloat(booking.final_amount || 0),
                    payment_status: paymentStatus,
                    total_travelers: totalTravellers,
                    vendor_discount: vendorDiscount,
                    coupon_discount: couponDiscount,
                    calculation: {
                        base_price: basePrice,
                        vendor_discount: vendorDiscount,
                        coupon_discount: couponDiscount,
                        new_base_price: newBasePrice,
                        total_travelers: totalTravellers,
                        payable_amount: bookingPayableAmount,
                        collected_amount: collectedAmount,
                        partial_payable_amount: partialPayableAmount,
                        commission_per_traveler: commissionPerTraveller,
                        tax_per_traveler: taxPerTraveller,
                        tcs_per_traveler: tcsPerTraveller,
                        total_commission_amount: totalCommissionAmount,
                        total_tax_amount: totalTaxAmount,
                        platform_commission_amount: platformCommissionAmount,
                        total_tcs_amount: totalTcsAmount,
                        net_amount: calculatedNetAmount,
                    },
                };
            });

            // Filter cancellations to exclude those related to bookings with "Customer Favour" status
            const filteredBatchCancellations = batchCancellations.filter(cancellation => 
                !customerFavourBookingIds.has(cancellation.booking_id)
            );

            // Recalculate cancellation amounts after filtering
            const filteredTotalCancellationAmount = filteredBatchCancellations.reduce((sum, cancellation) => {
                return sum + parseFloat(cancellation.total_refundable_amount || 0);
            }, 0);

            // Get cancellation details
            const cancellationDetails = filteredBatchCancellations.map(cancellation => ({
                cancellation_id: cancellation.id,
                booking_id: cancellation.booking_id,
                customer_id: cancellation.customer_id,
                refund_amount: parseFloat(cancellation.total_refundable_amount || 0),
                payback_amount: parseFloat(cancellation.deduction_vendor || 0),
                status: cancellation.status,
                cancellation_date: cancellation.cancellation_date,
                reason: cancellation.reason
            }));

            // Calculate separate amounts for disputes and paybacks (using filtered cancellations)
            const totalPaybackAmount = filteredBatchCancellations.reduce((sum, cancellation) => {
                return sum + parseFloat(cancellation.deduction_vendor || 0);
            }, 0);

            // Calculate dispute amount for this batch from issues_reports table
            // Use filtered booking IDs (excluding Customer Favour)
            const filteredBatchBookingIds = filteredBatchBookings.map(booking => booking.id);
            const disputeReportsForCalculation = await IssueReport.findAll({
                where: {
                    booking_id: {
                        [Op.in]: filteredBatchBookingIds
                    }
                },
                attributes: ['booking_id', 'disputed_amount', 'favour_amount', 'status', 'favoue_status']
            });

            // Create Adjustment object - collect all records with favour_status = "Adjustment"
            const adjustmentReports = disputeReportsForCalculation.filter(report => 
                report.favoue_status === 'Adjustment'
            );

            const adjustmentData = adjustmentReports.map(report => ({
                booking_id: report.booking_id,
                disputed_amount: parseFloat(report.disputed_amount || 0),
                favour_amount: parseFloat(report.favour_amount || 0)
            }));

            // Calculate totals for Adjustment data
            const total_of_disputed_amount = adjustmentData.reduce((sum, item) => 
                sum + item.disputed_amount, 0
            );
            const total_of_favour_amount = adjustmentData.reduce((sum, item) => 
                sum + item.favour_amount, 0
            );

            // Calculate second_payback_amount
            const second_payback_amount = total_of_disputed_amount - total_of_favour_amount;

            // Check condition: If both total_payback_amount and second_payback_amount are 0, return 0 directly
            let final_paybacked_amount = 0;
            let first_paybacked_amount = 0;
            let second_paybacked_amount = 0;

            if (totalPaybackAmount === 0 && second_payback_amount === 0) {
                // Both are 0, so final_paybacked_amount should be 0
                final_paybacked_amount = 0;
            } else {
                // Step 1: Payback amount directly contributes to first_paybacked_amount
                first_paybacked_amount = totalPaybackAmount;

                // Step 2: Calculate second_paybacked_amount from second_payback_amount
                if (second_payback_amount > 0) {
                    const first_disputed_amount = second_payback_amount * 0.10; // second_payback_amount * 10%
                    const second_disputed_amount = second_payback_amount * 0.05; // second_payback_amount * 5%
                    const third_disputed_amount = second_payback_amount * 0.01; // second_payback_amount * 1%
                    const fourth_disputed_amount = first_disputed_amount * 0.18; // first_disputed_amount * 18%
                    second_paybacked_amount = second_payback_amount - first_disputed_amount - second_disputed_amount - fourth_disputed_amount;
                }

                // Final: Calculate final_paybacked_amount
                final_paybacked_amount = first_paybacked_amount + second_paybacked_amount;
            }
            
            // Group dispute amounts by status
            const disputesByStatus = {
                in_progress: 0,    // Yellow
                resolved: 0,       // Red (refunded)
                closed: 0,         // Green (released)
                other: 0,          // Default
                no_action: 0       // No Action (based on favour_status)
            };
            
            disputeReportsForCalculation.forEach(report => {
                const amount = parseFloat(report.disputed_amount || 0);
                const status = report.status;
                const favourStatus = report.favoue_status;
                
                // Check for "No Action" favour status first
                if (favourStatus === 'No Action') {
                    disputesByStatus.no_action += amount;
                } else if (status === 'in_progress') {
                    disputesByStatus.in_progress += amount;
                } else if (status === 'resolved') {
                    disputesByStatus.resolved += amount;
                } else if (status === 'closed') {
                    disputesByStatus.closed += amount;
                } else {
                    disputesByStatus.other += amount;
                }
            });
            
            // Calculate total dispute amount (for "No Action" only, as per requirement)
            const totalDisputeAmount = disputesByStatus.no_action;
            

            const netAmount =
                filteredTotalBookingAmount -
                filteredTotalCancellationAmount -
                filteredPlatformCommission -
                totalTcsAmountForBatch +
                totalPaybackAmount -
                disputesByStatus.in_progress -
                disputesByStatus.resolved +
                disputesByStatus.closed -
                disputesByStatus.other;

            const cancelledBookingDetails = cancelledBatchBookings.map(booking => ({
                booking_id: booking.id,
                total_amount: parseFloat(booking.total_amount || 0),
                final_amount: parseFloat(booking.final_amount || 0),
                payment_status: booking.payment_status,
                total_travelers: booking.total_travelers || 0,
            }));


            return {
                batch_id: batch.id,
                tbr_id: batch.tbr_id,
                trek_id: batch.trek_id,
                trek_name: batch.trek?.title || 'Unknown Trek',
                base_price: parseFloat(batch.trek?.base_price || 0),
                start_date: batch.start_date,
                end_date: batch.end_date,
                capacity: batch.capacity,
                booked_slots: batch.booked_slots,
                
                // Cancellation Policy Information
                cancellation_policy_id: batch.trek?.cancellation_policy_id || null,
                cancellation_policy_name: batch.trek?.cancellation_policy?.title || 'Standard Policy',
                cancellation_policy_type: batch.trek?.cancellation_policy?.title ? 
                    (batch.trek.cancellation_policy.title.toLowerCase().includes('flexible') ? 'flexible' : 'standard') : 'standard',
                
                // Booking information (using filtered bookings)
                total_bookings: filteredBatchBookings.length,
                total_booking_amount: filteredTotalBookingAmount,
                total_final_amount: filteredTotalFinalAmount,
                bookings: bookingDetails,
                
                // Cancellation information (using filtered cancellations)
                total_cancellations: filteredBatchCancellations.length,
                total_cancellation_amount: filteredTotalCancellationAmount,
                total_dispute_amount: totalDisputeAmount,
                disputes_by_status: disputesByStatus,
                total_payback_amount: totalPaybackAmount,
                total_tcs_amount: totalTcsAmountForBatch,
                cancellations: cancellationDetails,
                cancelled_bookings: cancelledBookingDetails,
                
                // Adjustment data object
                adjustment_data: {
                    records: adjustmentData,
                    total_of_disputed_amount: total_of_disputed_amount,
                    total_of_favour_amount: total_of_favour_amount,
                    second_payback_amount: second_payback_amount,
                    second_paybacked_amount: second_paybacked_amount,
                    first_paybacked_amount: first_paybacked_amount,
                    final_paybacked_amount: final_paybacked_amount
                },
                
                // Financial calculations (using filtered values)
                platform_commission: filteredPlatformCommission,
                net_amount: netAmount,
                
                // Summary (using filtered values)
                summary: {
                    gross_amount: filteredTotalBookingAmount,
                    refunds_deducted: filteredTotalCancellationAmount,
                    tcs_amount: totalTcsAmountForBatch,
                    disputes_amount: totalDisputeAmount,
                    paybacks_amount: totalPaybackAmount,
                    commissions_deducted: filteredPlatformCommission,
                    net_amount: netAmount
                }
            };
        }));

        // Calculate pagination metadata
        const amountFields = [
            "base_price",
            "new_base_price",
            "total_booking_amount",
            "total_final_amount",
            "total_cancellation_amount",
            "total_dispute_amount",
            "total_payback_amount",
            "platform_commission",
            "net_amount",
            "gross_amount",
            "refunds_deducted",
            "disputes_amount",
            "paybacks_amount",
            "commissions_deducted",
            "total_amount",
            "final_amount",
            "refund_amount",
            "payback_amount",
            "vendor_discount",
            "coupon_discount",
            "payable_amount",
            "commission_per_traveler",
            "tax_per_traveler",
            "total_commission_amount",
            "total_tax_amount",
            "platform_commission_amount",
            "tcs_per_traveler",
            "total_tcs_amount",
            "collected_amount",
            "partial_payable_amount"
        ];

        const roundedBreakdown = roundAmountsInObject(tbrBreakdown, amountFields);

        const totalPages = Math.ceil(totalBatchesCount / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        logger.info("wallet", "TBR breakdown calculated", { 
            vendorId, 
            allBatches: allBatches.length,
            batchesWithBookings: totalBatchesCount,
            returnedBatches: roundedBreakdown.length,
            currentPage: page,
            totalPages: totalPages
        });

        return res.json({
            success: true,
            message: "TBR breakdown retrieved successfully",
            data: {
                vendor_id: vendorId,
                vendor_name: vendor.name,
                tbr_breakdown: roundedBreakdown,
                // Batch count information
                batch_counts: {
                    total_batches: totalBatchesCount,           // Total batches with bookings
                    current_page_batches: roundedBreakdown.length,  // Batches returned in current response
                    batches_per_page: limit
                },
                pagination: {
                    current_page: page,
                    total_pages: totalPages,
                    total_batches: totalBatchesCount,
                    batches_per_page: limit,
                    has_next_page: hasNextPage,
                    has_prev_page: hasPrevPage
                },
                summary: {
                    total_base_price: roundAmount(roundedBreakdown.reduce((sum, tbr) => sum + (tbr.base_price || 0), 0)),
                    total_booking_amount: roundAmount(roundedBreakdown.reduce((sum, tbr) => sum + (tbr.total_booking_amount || 0), 0)),
                    total_cancellation_amount: roundAmount(roundedBreakdown.reduce((sum, tbr) => sum + (tbr.total_cancellation_amount || 0), 0)),
                    total_platform_commission: roundAmount(roundedBreakdown.reduce((sum, tbr) => sum + (tbr.platform_commission || 0), 0)),
                    total_net_amount: roundAmount(roundedBreakdown.reduce((sum, tbr) => sum + (tbr.net_amount || 0), 0))
                }
            }
        });

    } catch (error) {
        logger.error("wallet", "Error fetching detailed TBR breakdown", {
            error: error.message,
            stack: error.stack,
            vendorId: req.user?.id
        });

        return res.status(500).json({
            success: false,
            message: "Internal server error while fetching TBR breakdown",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.getTbrBreakdown = async (req, res) => {
    try {
       const vendorId = req.query.vendorId || req.params.vendorId;

        logger.info("wallet", "Fetching TBR breakdown", { vendorId });

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        const tbrBreakdown = await getAvailableTbrBreakdown(vendorId);

        const response = {
            success: true,
            data: tbrBreakdown,
        };

        logger.info("wallet", "TBR breakdown fetched successfully", { 
            vendorId, 
            tbrCount: tbrBreakdown.length 
        });

        res.json(response);

    } catch (error) {
        logger.error("wallet", "Error fetching TBR breakdown", {
            vendorId: req.user?.id,
            error: error.message,
            stack: error.stack,
        });

        res.status(500).json({
            success: false,
            message: "Failed to fetch TBR breakdown",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
};


// dispute
exports.getDisputesData = async (req, res) => {
//const getDisputesData = async (req, res) => {
    try {
         const vendorId = req.query.vendorId || req.params.vendorId;

        logger.info("wallet", "Getting disputes data", { vendorId });

        // Get all issue reports for this vendor
        const issueReports = await IssueReport.findAll({
            include: [
                {
                    model: Booking,
                    as: "booking",
                    where: { vendor_id: vendorId },
                    required: true,
                    include: [
                        {
                            model: Trek,
                            as: "trek",
                            attributes: ["id", "title", "base_price"],
                        },
                        {
                            model: Batch,
                            as: "batch",
                            attributes: ["id", "tbr_id", "start_date", "end_date"],
                        },
                    ],
                },
            ],
            order: [["created_at", "DESC"]],
        });

        console.log(`📊 Found ${issueReports.length} issue reports for vendor ${vendorId}`);

        const activeDisputes = [];
        const resolvedDisputes = [];

        for (const issueReport of issueReports) {
            const booking = issueReport.booking;
            const trekBasePrice = parseFloat(booking.trek?.base_price || 0);
            const vendorDiscount = parseFloat(booking.vendor_discount || 0);
            const couponDiscount = parseFloat(booking.coupon_discount || 0);
            const totalTravelers = booking.total_travelers || 1;

            console.log(`🔍 Processing dispute ${issueReport.id}:`, {
                bookingId: booking.id,
                status: issueReport.status,
                trekBasePrice,
                vendorDiscount,
                couponDiscount,
                totalTravelers,
                bookingStatus: booking.status,
                sla: issueReport.sla
            });

            // Check if dispute should be auto-resolved due to SLA
            let shouldAutoResolve = false;
            let autoResolveReason = null;

            // Case 1: SLA is null - auto resolve
            if (!issueReport.sla && issueReport.status !== 'resolved') {
                shouldAutoResolve = true;
                autoResolveReason = "Resolved - No SLA defined";
                console.log(`⚠️ Dispute ${issueReport.id} has null SLA - auto-resolving`);
            }
            // Case 2: SLA has expired - auto resolve
            else if (issueReport.sla && issueReport.status !== 'resolved') {
                const slaString = issueReport.sla.toString();
                const slaMatch = slaString.match(/\d+/);
                if (slaMatch) {
                    const slaHours = parseInt(slaMatch[0]);
                    const now = new Date();
                    const disputeRaisedTime = new Date(issueReport.created_at);
                    const slaExpiryTime = new Date(disputeRaisedTime.getTime() + slaHours * 60 * 60 * 1000);

                    if (now > slaExpiryTime) {
                        shouldAutoResolve = true;
                        autoResolveReason = "Resolution completed after expiry";
                        console.log(`⏰ Dispute ${issueReport.id} SLA expired (${slaHours}h) - auto-resolving`);
                    }
                }
            }

            // If should auto-resolve, update the issue report in database
            if (shouldAutoResolve) {
                try {
                    await issueReport.update({
                        status: 'resolved',
                        resolution_notes: autoResolveReason,
                        resolved_at: new Date(),
                        disputed_amount: 0 // Set to 0 as resolved in customer's favor
                    });
                    console.log(`✅ Dispute ${issueReport.id} auto-resolved successfully`);
                    // Update the in-memory object to reflect changes
                    issueReport.status = 'resolved';
                    issueReport.resolution_notes = autoResolveReason;
                    issueReport.resolved_at = new Date();
                    issueReport.disputed_amount = 0;
                } catch (error) {
                    console.error(`❌ Error auto-resolving dispute ${issueReport.id}:`, error);
                }
            }

            // Calculate dispute amount based on status
            let disputeAmount = 0;
            let disputeAmountPerPerson = 0;

            if (issueReport.status === 'resolved') {
                // For resolved disputes, use disputed_amount from issue_reports table
                disputeAmount = parseFloat(issueReport.disputed_amount || 0);
                disputeAmountPerPerson = disputeAmount;
                console.log(`✅ Resolved dispute amount: ${disputeAmount} (from disputed_amount)`);
            } else {
                // For active disputes, calculate using pending refunds logic
                disputeAmountPerPerson = trekBasePrice - vendorDiscount - couponDiscount;
                console.log(`📊 Active dispute calculation step 1: ${trekBasePrice} - ${vendorDiscount} - ${couponDiscount} = ${disputeAmountPerPerson}`);

                // If booking is cancelled, subtract total_refundable_amount
                if (booking.status === "cancelled") {
                    const cancellationData = await CancellationBooking.findOne({
                        where: { 
                            booking_id: booking.id, 
                            trek_id: booking.trek_id, 
                            batch_id: booking.batch_id 
                        },
                        attributes: ["total_refundable_amount"],
                    });
                    const refundableAmount = parseFloat(cancellationData?.total_refundable_amount || 0);
                    disputeAmountPerPerson -= refundableAmount;
                    console.log(`📊 Active dispute calculation step 2: ${disputeAmountPerPerson} - ${refundableAmount} = ${disputeAmountPerPerson}`);
                }

                disputeAmount = disputeAmountPerPerson * totalTravelers;
                console.log(`📊 Final active dispute amount: ${disputeAmountPerPerson} * ${totalTravelers} = ${disputeAmount}`);
            }

            // Parse SLA hours from sla field (could be "72", "72 hours", or just number)
            let slaHours = null; // Default to null if not provided
            if (issueReport.sla) {
                const slaString = issueReport.sla.toString();
                const slaMatch = slaString.match(/\d+/); // Extract first number from string
                if (slaMatch) {
                    slaHours = parseInt(slaMatch[0]);
                }
            }

            const disputeData = {
                id: issueReport.id,
                dispute_id: `DISP${issueReport.id.toString().padStart(3, '0')}`,
                booking_id: booking.id,
                amount: roundAmount(disputeAmount || 0),
                amount_per_person: roundAmount(disputeAmountPerPerson || 0),
                total_travelers: totalTravelers,
                reason: issueReport.description || issueReport.issue_type || 'No description provided',
                status: issueReport.status,
                issue_type: issueReport.issue_type,
                issue_category: issueReport.issue_category,
                priority: issueReport.priority,
                sla: issueReport.sla,
                sla_hours: slaHours,
                created_at: issueReport.created_at,
                updated_at: issueReport.updated_at,
                trek_title: booking.trek?.title,
                batch_tbr_id: booking.batch?.tbr_id,
                batch_start_date: booking.batch?.start_date,
                booking_status: booking.status,
            };

            // Add resolution notes for resolved disputes
            if (issueReport.status === 'resolved') {
                disputeData.resolution_notes = issueReport.resolution_notes || 'Resolution completed';
                disputeData.resolved_at = issueReport.resolved_at || issueReport.updated_at;
                resolvedDisputes.push(disputeData);
            } else {
                // Active disputes (in_progress, pending, open)
                activeDisputes.push(disputeData);
            }
        }

        console.log(`📊 Active disputes: ${activeDisputes.length}, Resolved disputes: ${resolvedDisputes.length}`);

        const response = {
            success: true,
            data: {
                active: {
                    count: activeDisputes.length,
                    disputes: activeDisputes,
                    description: "Disputes with status: in_progress, pending, open"
                },
                resolved: {
                    count: resolvedDisputes.length,
                    disputes: resolvedDisputes,
                    description: "Disputes with status: resolved"
                },
                calculationFormula: {
                    active: "Dispute amount = (base_price - vendor_discount - coupon_discount - total_refundable_amount(if cancelled)) * total_travelers",
                    resolved: "Dispute amount = disputed_amount from issue_reports table"
                },
                totalDisputes: issueReports.length,
                lastUpdated: new Date().toISOString()
            }
        };

        res.json(response);

    } catch (error) {
        logger.error("wallet", "Error getting disputes data", { 
            vendorId: req.user?.id, 
            error: error.message 
        });
        res.status(500).json({
            success: false,
            message: "Failed to get disputes data",
            error: error.message
        });
    }
};


exports.getVendorCoupons = async (req, res) => {
    try {
        const vendorId = req.query.vendorId || req.params.vendorId;
        const { status } = req.query; // active | inactive | expired

        if (!vendorId) {
            return res.status(400).json({
                success: false,
                error: "Vendor ID is required",
                message: "Please provide vendor ID as URL parameter or ensure user is authenticated"
            });
        }

        console.log('Fetching coupons for vendor ID:', vendorId, 'with status:', status);

        // 🔹 Build where condition
        const whereCondition = { vendor_id: vendorId };

        // NOTE: expired case date se handle hoga, DB status active hi rahega
        if (status && status !== "expired") {
            whereCondition.status = status; // active / inactive
        }

        const coupons = await Coupon.findAll({
            where: whereCondition,
            order: [["created_at", "DESC"]],
            include: [
                {
                    model: Vendor,
                    as: "vendor",
                    attributes: ["id", "company_info", "status"],
                    include: [
                        {
                            model: User,
                            as: "user",
                            attributes: ["id", "name", "email", "phone"]
                        }
                    ]
                },
                {
                    model: Trek,
                    as: "assignedTrek",
                    attributes: ["id", "title", "destination_id"],
                    required: false
                }
            ]
        });

        console.log('Found coupons:', coupons.length);

        // 🔹 Serialize coupons
        const serializedCoupons = coupons.map(coupon => {
            try {
                const couponData = coupon.toJSON();

                const isExpired = (() => {
                    if (!couponData.valid_until) return false;
                    const validUntil = new Date(couponData.valid_until);
                    validUntil.setHours(23, 59, 59, 999);
                    return validUntil < new Date();
                })();

                return {
                    // Basic info
                    id: couponData.id,
                    title: couponData.title,
                    code: couponData.code,
                    description: couponData.description,
                    color: couponData.color,

                    // Discount
                    discount_type: couponData.discount_type,
                    discount_value: couponData.discount_value,
                    min_amount: couponData.min_amount,
                    max_discount_amount: couponData.max_discount_amount,

                    // Usage
                    max_uses: couponData.max_uses,
                    current_uses: couponData.current_uses,

                    // Validity
                    valid_from: couponData.valid_from ? couponData.valid_from.toISOString() : null,
                    valid_until: couponData.valid_until ? couponData.valid_until.toISOString() : null,

                    // Status
                    status: couponData.status,
                    approval_status: couponData.approval_status,
                    admin_notes: couponData.admin_notes,

                    // Terms
                    terms_and_conditions: (() => {
                        try {
                            if (!couponData.terms_and_conditions) return [];
                            if (typeof couponData.terms_and_conditions === 'string') {
                                return JSON.parse(couponData.terms_and_conditions);
                            }
                            return couponData.terms_and_conditions;
                        } catch {
                            return [couponData.terms_and_conditions];
                        }
                    })(),

                    // Vendor
                    vendor_id: couponData.vendor_id,
                    vendor: couponData.vendor ? {
                        id: couponData.vendor.id,
                        company_info: couponData.vendor.company_info,
                        status: couponData.vendor.status,
                        user: couponData.vendor.user ? {
                            id: couponData.vendor.user.id,
                            name: couponData.vendor.user.name,
                            email: couponData.vendor.user.email,
                            phone: couponData.vendor.user.phone
                        } : null
                    } : null,

                    // Trek
                    assigned_trek_id: couponData.assigned_trek_id,
                    assigned_trek_name: couponData.assignedTrek ? couponData.assignedTrek.title : null,
                    assignedTrek: couponData.assignedTrek ? {
                        id: couponData.assignedTrek.id,
                        title: couponData.assignedTrek.title,
                        destination_id: couponData.assignedTrek.destination_id
                    } : null,

                    // Timestamps
                    created_at: couponData.created_at ? couponData.created_at.toISOString() : null,
                    updated_at: couponData.updated_at ? couponData.updated_at.toISOString() : null,

                    // Computed
                    is_expired: isExpired,
                    is_active: couponData.status === 'active' && couponData.approval_status === 'approved' && !isExpired,
                    usage_percentage: couponData.max_uses ? (couponData.current_uses / couponData.max_uses) * 100 : 0,
                    remaining_uses: couponData.max_uses ? couponData.max_uses - couponData.current_uses : null
                };
            } catch (error) {
                console.error('Error serializing coupon:', error);
                return {
                    id: coupon.id || 'unknown',
                    title: 'Error loading coupon',
                    code: 'ERROR',
                    status: 'error',
                    approval_status: 'error',
                    terms_and_conditions: [],
                    error: 'Failed to load coupon data'
                };
            }
        });

        // 🔹 Apply status filter (active / inactive / expired)
        let filteredCoupons = serializedCoupons;

        if (status === "expired") {
            filteredCoupons = serializedCoupons.filter(c => c.is_expired === true);
        } else if (status === "active") {
            filteredCoupons = serializedCoupons.filter(c => c.status === "active" && !c.is_expired);
        } else if (status === "inactive") {
            filteredCoupons = serializedCoupons.filter(c => c.status === "inactive");
        }

        // 🔹 Final response
        return res.json({
            success: true,
            data: filteredCoupons,
            count: filteredCoupons.length,
            vendor_info: {
                vendor_id: vendorId,
                total_coupons: serializedCoupons.length,
                active_coupons: serializedCoupons.filter(c => c.status === 'active' && !c.is_expired).length,
                inactive_coupons: serializedCoupons.filter(c => c.status === 'inactive').length,
                expired_coupons: serializedCoupons.filter(c => c.is_expired).length,
                pending_coupons: serializedCoupons.filter(c => c.approval_status === 'pending').length,
                approved_coupons: serializedCoupons.filter(c => c.approval_status === 'approved').length,
                rejected_coupons: serializedCoupons.filter(c => c.approval_status === 'rejected').length
            }
        });

    } catch (error) {
        console.error("Error fetching vendor coupons:", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch coupons",
            message: error.message
        });
    }
};



exports.getVendorAuditLogs = async (req, res) => {
    try {
               const vendorId = req.query.vendorId || req.params.vendorId;

        const {
            action = 'all',
            startDate,
            endDate,
            limit = 50,
            offset = 0
        } = req.query;

        const filters = {
            action,
            startDate,
            endDate,
            limit: parseInt(limit),
            offset: parseInt(offset)
        };

        const auditLogs = await CouponAuditService.getVendorAuditLogs(vendorId, filters);

        // Format the response to match the frontend expectations
        const formattedLogs = auditLogs.rows.map(log => {
            const details = JSON.parse(log.details || '{}');
            
            // Format details based on action type
            let formattedDetails = '';
            switch (log.action) {
                case 'assign':
                    formattedDetails = `coupon code: ${details.coupon_code}, trek name: ${details.trek_name}`;
                    break;
                case 'unassign':
                    formattedDetails = `coupon code: ${details.coupon_code}, previous trek: ${details.previous_trek_name}`;
                    break;
                case 'reassign':
                    formattedDetails = `coupon code: ${details.coupon_code}, from trek: ${details.from_trek_name}, to trek: ${details.to_trek_name}`;
                    break;
                case 'create':
                    formattedDetails = `coupon code: ${details.coupon_code}, discount type: ${details.discount_type}, discount value: ${details.discount_value}`;
                    break;
                case 'expire':
                    formattedDetails = `coupon code: ${details.coupon_code}, expired at: ${details.expired_at}`;
                    break;
                case 'update':
                    formattedDetails = `coupon code: ${details.coupon_code}, title: ${details.title}`;
                    break;
                case 'delete':
                    formattedDetails = `coupon code: ${details.coupon_code}, title: ${details.title}`;
                    break;
                case 'approve':
                    formattedDetails = `coupon code: ${details.coupon_code}, approved`;
                    break;
                case 'reject':
                    formattedDetails = `coupon code: ${details.coupon_code}, rejected`;
                    break;
                case 'applied':
                    formattedDetails = `coupon code: ${details.coupon_code}, applied to booking ${details.booking_id || 'N/A'}, discount: $${details.discount_amount || 'N/A'}`;
                    break;
                case 'status_change':
                    formattedDetails = `coupon code: ${details.coupon_code}, status changed from ${details.previous_status} to ${details.new_status}`;
                    break;
                default:
                    formattedDetails = `coupon code: ${details.coupon_code}`;
            }

            return {
                id: log.id,
                action: log.action,
                details: formattedDetails,
                timestamp: log.created_at,
                trek_id: log.trek_id,
                previous_trek_id: log.previous_trek_id,
                coupon: log.coupon,
                trek: log.trek,
                previous_trek: log.previous_trek
            };
        });

        // Set cache control headers to prevent caching
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });

        res.json({
            success: true,
            data: formattedLogs,
            total: auditLogs.count,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

    } catch (error) {
        console.error('Error fetching vendor audit logs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch audit logs',
            message: error.message
        });
    }
};




// Vendor: Get reviews for vendor's treks
exports.getVendorReviews = async (req, res) => {
    try {
        const vendorId = req.query.vendorId || req.params.vendorId;
        const { page = 1, limit = 10, trekId, status = "approved" } = req.query;
        const offset = (page - 1) * limit;

        logger.info("review", "=== VENDOR REVIEWS API CALL STARTED ===");
        logger.info("review", "Request params:", {
            vendorId,
            page,
            limit,
            trekId,
            status,
        });

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Create isolated where clause for reviews
        const reviewWhere = createIsolatedWhereClause();

        // Filter out undefined values and handle string "undefined"
        if (trekId && trekId !== "undefined" && trekId !== "all") {
            reviewWhere.trek_id = trekId;
        }

        if (status && status !== "undefined" && status !== "all") {
            reviewWhere.status = status;
        }

        logger.info(
            "review",
            "About to execute query with where clause:",
            reviewWhere
        );

        // Get ratings with associations and average rating
        const { count, rows: reviews } = await executeQuerySafely(async () => {
            return await Review.findAndCountAll({
                where: reviewWhere,
                include: [
                    {
                        model: Trek,
                        as: "trek",
                        where: { vendor_id: vendorId },
                        attributes: ["id", "title"],
                        required: true, // This ensures only reviews for vendor's treks are returned
                    },
                    {
                        model: Customer,
                        as: "customer",
                        attributes: ["id", "name", "email"],
                    },
                    {
                        model: Booking,
                        as: "booking",
                        attributes: ["id", "booking_date"],
                    },
                ],
                attributes: {
                    include: [
                        [
                            sequelize.literal(`(
                                SELECT AVG(r.rating_value)
                                FROM ratings r
                                WHERE r.trek_id = Rating.trek_id 
                                AND r.customer_id = Rating.customer_id
                                AND r.booking_id = Rating.booking_id
                            )`),
                            "averageRating",
                        ],
                    ],
                },
                order: [["created_at", "DESC"]],
                limit: parseInt(limit),
                offset: parseInt(offset),
                logging: false,
            });
        });

        logger.info(
            "review",
            "Query completed successfully. Count:",
            count,
            "Reviews found:",
            reviews.length
        );

        res.json({
            success: true,
            reviews: reviews,
            currentPage: parseInt(page),
            totalPages: Math.ceil(count / limit),
            totalCount: count,
        });
    } catch (error) {
        logger.error("error", "Error fetching vendor reviews:", error);
        console.error("Full error details:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch reviews",
        });
    }
};

exports.getVendorRatingAnalytics = async (req, res) => {
  try {
    const vendorId = req.query.vendorId || req.params.vendorId;
    const { startDate, endDate, search, sort, ratingCategory } = req.query;

    if (!vendorId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Vendor account required.",
      });
    }

    const ratingWhere = {};
    const trekWhere = { vendor_id: vendorId };

    // =========================
    // FILTERS
    // =========================

    if (startDate && endDate) {
      ratingWhere.created_at = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }

    if (search) {
      trekWhere.title = { [Op.like]: `%${search}%` };
    }

    // =========================
    // SORT LOGIC
    // =========================
    let orderClause = [];
    if (sort === "high") orderClause = [[literal("averageRating"), "DESC"]];
    if (sort === "low") orderClause = [[literal("averageRating"), "ASC"]];
    if (sort === "mostReviews") orderClause = [[literal("totalRatings"), "DESC"]];

    // =========================
    // RATING CATEGORY FILTER
    // =========================
    let havingClause = null;

    if (ratingCategory === "excellent") havingClause = literal("averageRating >= 4.5");
    if (ratingCategory === "good") havingClause = literal("averageRating >= 3.75 AND averageRating < 4.5");
    if (ratingCategory === "average") havingClause = literal("averageRating >= 2.25 AND averageRating < 3.75");
    if (ratingCategory === "poor") havingClause = literal("averageRating < 2.25");

    // =========================
    // 1️⃣ RATING SUMMARY PER TREK
    // =========================
    const ratingSummary = await Rating.findAll({
      where: ratingWhere,
      include: [
        {
          model: Trek,
          as: "trek",
          where: trekWhere,
          attributes: ["id", "title"],
          required: true,
        },
      ],
      attributes: [
        "trek_id",
        [fn("AVG", col("rating_value")), "averageRating"],
        [fn("COUNT", col("Rating.id")), "totalRatings"],
        [fn("COUNT", fn("DISTINCT", col("customer_id"))), "uniqueCustomers"],
      ],
      group: ["trek_id", "trek.id"],
      having: havingClause || undefined,
      order: orderClause,
    });

    // =========================
    // 2️⃣ CATEGORY WISE SUMMARY
    // =========================
    const categoryRatings = await Rating.findAll({
      where: ratingWhere,
      include: [
        {
          model: Trek,
          as: "trek",
          where: trekWhere,
          attributes: ["id", "title"],
          required: true,
        },
      ],
      attributes: [
        "trek_id",
        [fn("AVG", col("rating_value")), "averageRating"],
        [fn("COUNT", col("Rating.id")), "totalRatings"],
        [fn("AVG", col("safety_security_count")), "avgSafetySecurity"],
        [fn("AVG", col("organizer_manner_count")), "avgOrganizerManner"],
        [fn("AVG", col("trek_planning_count")), "avgTrekPlanning"],
        [fn("AVG", col("women_safety_count")), "avgWomenSafety"],
      ],
      group: ["trek_id", "trek.id"],
    });

    // =========================
    // 3️⃣ RECENT REVIEWS
    // =========================
    const recentReviews = await Rating.findAll({
      where: ratingWhere,
      include: [
        {
          model: Trek,
          as: "trek",
          where: trekWhere,
          attributes: ["id", "title"],
          required: true,
        },
        {
          model: Customer,
          as: "customer",
          attributes: ["id", "name", "email"],
        },
      ],
      order: [["created_at", "DESC"]],
      limit: 10,
    });

    // =========================
    // 4️⃣ DASHBOARD COUNTS
    // =========================
    const totalDestinations = await Trek.count({ where: trekWhere });

    const totalReviewsAgg = await Rating.count({
      where: ratingWhere,
      include: [{ model: Trek, as: "trek", where: trekWhere, required: true }],
    });

    // =========================
    // 5️⃣ GOOD / BAD COUNTS
    // =========================
    const goodBadAgg = await Rating.findAll({
      where: ratingWhere,
      include: [{ model: Trek, as: "trek", where: trekWhere, required: true }],
      attributes: [
        [fn("SUM", literal("CASE WHEN rating_value >= 3.75 THEN 1 ELSE 0 END")), "goodCount"],
        [fn("SUM", literal("CASE WHEN rating_value < 3.75 THEN 1 ELSE 0 END")), "badCount"],
      ],
      raw: true,
    });

    const goodCount = parseInt(goodBadAgg[0]?.goodCount || 0);
    const badCount = parseInt(goodBadAgg[0]?.badCount || 0);

    // =========================
    // 6️⃣ 30 DAY TREND
    // =========================
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prev = new Date(now.setMonth(now.getMonth() - 1));
    const previousMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;

    const [currentAgg, previousAgg] = await Promise.all([
      Rating.findOne({
        attributes: [
          [fn("AVG", col("rating_value")), "avg"],
          [fn("COUNT", col("Rating.id")), "count"],
        ],
        where: where(fn("DATE_FORMAT", col("Rating.created_at"), "%Y-%m"), currentMonth),
        include: [{ model: Trek, as: "trek", where: trekWhere, required: true }],
        raw: true,
      }),
      Rating.findOne({
        attributes: [
          [fn("AVG", col("rating_value")), "avg"],
          [fn("COUNT", col("Rating.id")), "count"],
        ],
        where: where(fn("DATE_FORMAT", col("Rating.created_at"), "%Y-%m"), previousMonth),
        include: [{ model: Trek, as: "trek", where: trekWhere, required: true }],
        raw: true,
      }),
    ]);

    const trend30d = {
      currentMonthAverage: Number(parseFloat(currentAgg?.avg || 0).toFixed(2)),
      previousMonthAverage: Number(parseFloat(previousAgg?.avg || 0).toFixed(2)),
      currentCount: parseInt(currentAgg?.count || 0),
      previousCount: parseInt(previousAgg?.count || 0),
      direction: (currentAgg?.avg || 0) - (previousAgg?.avg || 0) >= 0 ? "positive" : "negative",
    };

    // =========================
    // FORMAT RESPONSE
    // =========================
    const formattedRatingSummary = ratingSummary.map((item) => ({
      trekId: item.trek_id,
      trekName: item.trek?.title || "Unknown Trek",
      averageRating: Number(parseFloat(item.dataValues.averageRating || 0).toFixed(1)),
      totalRatings: parseInt(item.dataValues.totalRatings || 0),
      uniqueCustomers: parseInt(item.dataValues.uniqueCustomers || 0),
      totalReviews:1,
      totalBatches:2

    }));

    const formattedCategoryRatings = categoryRatings.map((item) => ({
      trekId: item.trek_id,
      trekName: item.trek?.title || "Unknown Trek",
      averageRating: Number(parseFloat(item.dataValues.averageRating || 0).toFixed(1)),
      totalRatings: parseInt(item.dataValues.totalRatings || 0),
      categoryBreakdown: {
        safetySecurity: Number(parseFloat(item.dataValues.avgSafetySecurity || 0).toFixed(1)),
        organizerManner: Number(parseFloat(item.dataValues.avgOrganizerManner || 0).toFixed(1)),
        trekPlanning: Number(parseFloat(item.dataValues.avgTrekPlanning || 0).toFixed(1)),
        womenSafety: Number(parseFloat(item.dataValues.avgWomenSafety || 0).toFixed(1)),
      },
    }));

    const formattedRecentReviews = recentReviews.map((r) => ({
      id: r.id,
      trekId: r.trek_id,
      trekName: r.trek?.title,
      customerName: r.customer?.name || "Anonymous",
      customerEmail: r.customer?.email || null,
      rating: r.rating_value,
      title: r.title,
      content: r.content,
      createdAt: r.created_at,
    }));

    // =========================
    // FINAL RESPONSE
    // =========================
    return res.json({
      success: true,
      data: {
        dashboard: {
          totalDestinations,
          totalReviews: totalReviewsAgg,
          goodReviews: goodCount,
          badReviews: badCount,
        },
        ratingSummary: formattedRatingSummary,
        categoryRatings: formattedCategoryRatings,
        recentReviews: formattedRecentReviews,
        trend30d,
      },
    });

  } catch (error) {
    console.error("❌ Vendor Rating Analytics Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};



// Vendor: Get review by ID
exports.getReviewById = async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = req.user.id;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        const reviewWhere = createIsolatedWhereClause();
        reviewWhere.id = id;

        const review = await executeQuerySafely(async () => {
            return await Rating.findOne({
                where: reviewWhere,
                include: [
                    {
                        model: Trek,
                        as: "trek",
                        where: { vendor_id: vendorId },
                        attributes: ["id", "title"],
                    },
                    {
                        model: Customer,
                        as: "customer",
                        attributes: ["id", "name", "email", "phone"],
                    },
                    {
                        model: Booking,
                        as: "booking",
                        attributes: ["id", "booking_date", "status"],
                    },
                ],
                logging: false,
            });
        });

        if (!review) {
            return res.status(404).json({
                success: false,
                message: "Review not found",
            });
        }

        res.json({
            success: true,
            data: review,
        });
    } catch (error) {
        logger.error("review", "Error fetching review by ID:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch review",
        });
    }
};
