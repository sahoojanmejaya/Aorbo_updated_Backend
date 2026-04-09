const crypto = require("crypto");
const razorpay = require("../config/razorpay");

// Check if Razorpay is properly configured
const isRazorpayConfigured = () => {
    return process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET;
};

// Create Razorpay order
const createRazorpayOrder = async (
    amount,
    currency = "INR",
    receipt = null
) => {
    try {
        // Check if Razorpay is configured
        if (!isRazorpayConfigured()) {
            return {
                success: false,
                error: "Razorpay is not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.",
            };
        }

        const options = {
            amount: Math.round(amount * 100), // Convert to paise
            currency: currency,
            receipt: receipt || `receipt_${Date.now()}`,
        };

        const order = await razorpay.orders.create(options);
        return {
            success: true,
            order: order,
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

// Verify Razorpay signature — NEVER bypass in production
const verifyRazorpaySignature = (orderId, paymentId, signature) => {
    try {
        if (!isRazorpayConfigured()) {
            // In development (no keys), allow — but log a clear warning
            if (process.env.NODE_ENV !== 'production') {
                return true;
            }
            // In production, missing keys is a hard failure
            return false;
        }

        const text = `${orderId}|${paymentId}`;
        const generatedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(text)
            .digest("hex");

        // Use timingSafeEqual to prevent timing attacks
        const genBuf = Buffer.from(generatedSignature, 'hex');
        const sigBuf = Buffer.from(signature, 'hex');
        if (genBuf.length !== sigBuf.length) return false;
        return crypto.timingSafeEqual(genBuf, sigBuf);
    } catch (_) {
        return false;
    }
};

// Fetch Razorpay order details (used for server-side amount verification)
const getOrderDetails = async (orderId) => {
    try {
        if (!isRazorpayConfigured()) {
            return { success: false, error: "Razorpay not configured" };
        }
        const order = await razorpay.orders.fetch(orderId);
        return { success: true, order };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

// Get Razorpay payment details
const getPaymentDetails = async (paymentId) => {
    try {
        // Check if Razorpay is configured
        if (!isRazorpayConfigured()) {
            return {
                success: false,
                error: "Razorpay is not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.",
            };
        }

        const payment = await razorpay.payments.fetch(paymentId);
        return {
            success: true,
            payment: payment,
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

module.exports = {
    createRazorpayOrder,
    verifyRazorpaySignature,
    getOrderDetails,
    getPaymentDetails,
    isRazorpayConfigured,
};
