const db = require("../config/db");
const bookingRepo = require("../repositories/booking.repo");
const paymentRepo = require("../repositories/payment.repo");

/**
 * ============================================================
 * PAYMENT SERVICE – SCHEMA CORRECT
 * ============================================================
 *
 * SUPPORTED OPERATIONS:
 * - Record app (online) payment
 * - Record manual (offline) payment
 *
 * NOT SUPPORTED (BY DESIGN):
 * - Pending settlement logic
 * - Booking payment status updates
 * ============================================================
 */

/**
 * --------------------------------------------------
 * RECORD APP PAYMENT
 * --------------------------------------------------
 */
async function recordAppPayment(payload) {
  const { bookingId, transactionId, amount } = payload;

  if (!bookingId || !transactionId || !amount) {
    throw {
      statusCode: 400,
      message: "Validation failed",
      errors: {
        fields: "bookingId, transactionId and amount are required"
      }
    };
  }

  // Validate booking exists
  const booking = await bookingRepo.findById(bookingId);
  if (!booking) {
    throw {
      statusCode: 404,
      message: "Booking not found",
      errors: { bookingId }
    };
  }

  // Record payment
  return paymentRepo.createAppPaymentLog({
    bookingId,
    transactionId,
    amount,
    paymentMethod: "online",
    status: "success"
  });
}

/**
 * --------------------------------------------------
 * RECORD MANUAL / OFFLINE PAYMENT
 * --------------------------------------------------
 */
async function recordManualPayment(payload) {
  const { userId, amount, description } = payload;

  if (!userId || !amount) {
    throw {
      statusCode: 400,
      message: "Validation failed",
      errors: {
        fields: "userId and amount are required"
      }
    };
  }

  return paymentRepo.createManualPayment({
    userId,
    amount,
    description
  });
}

/**
 * --------------------------------------------------
 * GET PAYMENT HISTORY FOR BOOKING
 * --------------------------------------------------
 */
async function getPaymentHistory(bookingId) {
  if (!bookingId) {
    throw {
      statusCode: 400,
      message: "bookingId is required"
    };
  }

  return paymentRepo.getPaymentHistory(bookingId);
}

module.exports = {
  recordAppPayment,
  recordManualPayment,
  getPaymentHistory
};
