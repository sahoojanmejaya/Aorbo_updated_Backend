const Razorpay = require("razorpay");

// Check if environment variables are set
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.warn("⚠️  Razorpay environment variables not set!");
    console.warn("Please add the following to your .env file:");
    console.warn("RAZORPAY_KEY_ID=rzp_test_YOUR_KEY_ID");
    console.warn("RAZORPAY_KEY_SECRET=YOUR_KEY_SECRET");
    console.warn("Using test keys for development...");
}

// Initialize Razorpay instance with fallback test keys
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder",
    key_secret: process.env.RAZORPAY_KEY_SECRET || "placeholder_secret",
});

module.exports = razorpay;
