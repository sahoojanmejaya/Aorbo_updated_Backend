const jwt = require("jsonwebtoken");
const { Vendor } = require("./models");

const generateVendorToken = async () => {
    try {
        // Find the vendor we created
        const vendor = await Vendor.findOne({ where: { id: 1 } });

        if (!vendor) {
            console.log("No vendor found with ID 1");
            return;
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                id: vendor.id,
                role: "vendor",
                email: vendor.user?.email || "vendor@adventuretreks.com",
            },
            process.env.JWT_SECRET || "your-secret-key",
            { expiresIn: "24h" }
        );

        console.log("Vendor Token Generated:");
        console.log("======================");
        console.log(token);
        console.log("======================");
        console.log("\nTo use this token:");
        console.log("1. Copy the token above");
        console.log(
            "2. In your browser's developer tools, go to Application/Local Storage"
        );
        console.log("3. Set: token = 'Bearer " + token + "'");
        console.log("4. Refresh the vendor dashboard");
    } catch (error) {
        console.error("Error generating token:", error);
    }
};

// Run if called directly
if (require.main === module) {
    generateVendorToken()
        .then(() => {
            console.log("\nToken generation completed");
            process.exit(0);
        })
        .catch((error) => {
            console.error("Token generation failed:", error);
            process.exit(1);
        });
}

module.exports = { generateVendorToken };
