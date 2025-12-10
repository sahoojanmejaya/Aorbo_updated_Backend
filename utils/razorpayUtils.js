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
        console.error("Error creating Razorpay order:", error);
        return {
            success: false,
            error: error.message,
        };
    }
};

// Verify Razorpay signature
const verifyRazorpaySignature = (orderId, paymentId, signature) => {
    try {
        // Check if Razorpay is configured
        if (!isRazorpayConfigured()) {
            console.warn(
                "Razorpay not configured - skipping signature verification"
            );
            return true; // Allow in development mode
        }

        const text = `${orderId}|${paymentId}`;
        const generatedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(text)
            .digest("hex");

        return generatedSignature === signature;
    } catch (error) {
        console.error("Error verifying Razorpay signature:", error);
        return false;
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
        console.error("Error fetching payment details:", error);
        return {
            success: false,
            error: error.message,
        };
    }
};

module.exports = {
    createRazorpayOrder,
    verifyRazorpaySignature,
    getPaymentDetails,
    isRazorpayConfigured,
};
