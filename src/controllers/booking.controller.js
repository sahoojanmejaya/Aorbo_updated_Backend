const service = require("../services/booking.service");
const { sendResponse } = require("../utils/response");

/**
 * Create Booking
 */
async function createBooking(req, res, next) {
  try {
    const booking = await service.createBooking(req.body);

    return sendResponse(res, {
      success: true,
      data: booking,
      message: "Booking created successfully",
      errors: null
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Cancel Booking
 */
async function cancelBooking(req, res, next) {
  try {
    const { tbrId, bookingId } = req.params;
    const payload = req.body;

    const result = await service.cancelBooking(tbrId, bookingId, payload);

    return sendResponse(res, {
      success: true,
      data: result,
      message: "Booking cancelled successfully",
      errors: null
    });
  } catch (e) {
    next(e);
  }
}
async function getPendingBalances(req, res, next) {
  try {
    const data = await service.getPendingBalances(req.query);

    return sendResponse(res, {
      success: true,
      data,
      message: "Pending balances retrieved",
      errors: null
    });
  } catch (e) {
    next(e);
  }
}

async function previewCancellation(req, res, next) {
  try {
    const { tbrId, bookingId } = req.params;

    const preview = await service.previewCancellation(tbrId, bookingId);

    return sendResponse(res, {
      success: true,
      data: preview,
      message: "Cancellation preview calculated successfully",
      errors: null
    });
  } catch (e) {
    next(e);
  }
}

async function getActiveBookings(req, res, next) {
  try {
    const data = await service.getActiveBookings(req.query);

    return sendResponse(res, {
      success: true,
      data,
      message: "Active bookings retrieved",
      errors: null
    });
  } catch (e) {
    next(e);
  }
}

async function getBookingSummary(req, res, next) {
  try {
    const data = await service.getBookingSummary(req.query);

    return sendResponse(res, {
      success: true,
      data,
      message: "Booking summary retrieved",
      errors: null
    });
  } catch (e) {
    next(e);
  }
}

async function getAllBookings(req, res, next) {
  try {
    const data = await service.getAllBookings(req.query);
    return sendResponse(res, {
      success: true,
      data,
      message: "Bookings retrieved",
      errors: null
    });
  } catch (e) {
    next(e);
  }
}

async function getBookingById(req, res, next) {
  try {
    const { bookingId } = req.params;
    const data = await service.getBookingById(bookingId);
    return sendResponse(res, {
      success: true,
      data,
      message: "Booking details retrieved",
      errors: null
    });
  } catch (e) {
    next(e);
  }
}

async function markCollected(req, res, next) {
  try {
    const { bookingId } = req.params;
    // Assume user context is available or mock it for now as per mvp
    const actor = req.user || { id: 1, type: 'vendor' };
    const result = await service.markCollected(bookingId, req.body, actor);
    return sendResponse(res, {
      success: true,
      data: result,
      message: "Payment marked successfully",
      errors: null
    });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  createBooking,
  cancelBooking,
  getPendingBalances,
  getActiveBookings,
  getBookingSummary,
  getAllBookings,
  getBookingById,
  previewCancellation,
  markCollected // ✅ ADDED
};
