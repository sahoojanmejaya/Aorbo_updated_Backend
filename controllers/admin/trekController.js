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
    Booking,
    BookingTraveler,
    Traveler,
    PaymentLog,
    City,
    BatchCancellationRequest,
    Cancellation,
    CancellationBooking,
} = require("../../models");
const { validationResult } = require("express-validator");
const { saveBase64Image, deleteImage } = require("../../utils/fileUpload");
const { Op } = require("sequelize");
const { roundAmount } = require("../../utils/amountUtils");
const logger = require("../../utils/logger");
const sequelize = require("../../models/index"); 
 console.log("req.paramscccxxvcxv")
exports.updateTrek = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Trek ID is required",
      });
    }

    // 🔹 Check if trek exists
    const trek = await Trek.findByPk(id);
    if (!trek) {
      return res.status(404).json({
        success: false,
        message: "Trek not found",
      });
    }

    const {
      title,
      description,
      vendor_id,
      destination_id,
      captain_id,
      city_ids,
      duration,
      duration_days,
      duration_nights,
      base_price,
      max_participants,
      trekking_rules,
      emergency_protocols,
      organizer_notes,
      inclusions,
      exclusions,
      status,
      trek_status,
      discount_value,
      discount_type,
      has_discount,
      cancellation_policy_id,
      activities,
      badge_id,
    } = req.body;

    // 🔹 Discount validation
    if (has_discount) {
      if (!discount_value || discount_value <= 0) {
        return res.status(400).json({
          success: false,
          message: "Valid discount value is required when has_discount is true",
        });
      }

      if (discount_type === "percentage" && discount_value > 100) {
        return res.status(400).json({
          success: false,
          message: "Percentage discount cannot be greater than 100",
        });
      }
    }

    // 🔹 Prepare update object (only update provided fields)
    const updateData = {};

    const allowedFields = [
      "title",
      "description",
      "vendor_id",
      "destination_id",
      "captain_id",
      "duration",
      "duration_days",
      "duration_nights",
      "base_price",
      "max_participants",
      "trekking_rules",
      "emergency_protocols",
      "organizer_notes",
      "status",
      "trek_status",
      "discount_value",
      "discount_type",
      "has_discount",
      "cancellation_policy_id",
      "badge_id",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    // 🔹 Handle JSON fields safely
    if (city_ids !== undefined) {
      updateData.city_ids = Array.isArray(city_ids) ? city_ids : [];
    }

    if (inclusions !== undefined) {
      updateData.inclusions = Array.isArray(inclusions) ? inclusions : [];
    }

    if (exclusions !== undefined) {
      updateData.exclusions = Array.isArray(exclusions) ? exclusions : [];
    }

    if (activities !== undefined) {
      updateData.activities = Array.isArray(activities) ? activities : [];
    }

    // 🔹 Mark as edited
    updateData.has_been_edited = 1;

    // 🔹 Update trek
    await trek.update(updateData);

    return res.status(200).json({
      success: true,
      message: "Trek updated successfully",
      data: trek,
    });
  } catch (error) {
    console.error("Update Trek Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
