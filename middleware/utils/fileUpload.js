const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Create storage directory if it doesn't exist
const STORAGE_DIR = path.join(__dirname, "../storage");
const TREK_IMAGES_DIR = path.join(STORAGE_DIR, "trek-images");

if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

if (!fs.existsSync(TREK_IMAGES_DIR)) {
    fs.mkdirSync(TREK_IMAGES_DIR, { recursive: true });
}

/**
 * Save base64 image to file system
 * @param {string} base64Data - Base64 encoded image data
 * @param {string} vendorId - Vendor ID for folder organization
 * @returns {Promise<string>} - Relative file path
 */
const saveBase64Image = async (base64Data, vendorId) => {
    try {
        // Validate inputs
        if (!base64Data || typeof base64Data !== 'string') {
            throw new Error("Base64 data is required and must be a string");
        }

        if (!vendorId) {
            throw new Error("Vendor ID is required");
        }

        // Convert vendorId to string if it's a number
        const vendorIdStr = typeof vendorId === 'string' ? vendorId : String(vendorId);

        // Extract file type from base64 data
        const matches = base64Data.match(
            /^data:image\/([a-zA-Z]*);base64,(.+)$/
        );
        if (!matches || matches.length !== 3) {
            throw new Error(`Invalid base64 image data format. Expected format: data:image/type;base64,data. Got: ${base64Data.substring(0, 50)}...`);
        }

        const imageType = matches[1]; // png, jpg, jpeg, etc.
        const base64Content = matches[2];

        // Validate image type
        if (!imageType || !['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(imageType.toLowerCase())) {
            throw new Error(`Unsupported image type: ${imageType}`);
        }

        // Validate base64 content
        if (!base64Content || base64Content.length === 0) {
            throw new Error("Empty base64 content");
        }

        const imageBuffer = Buffer.from(base64Content, "base64");

        // Validate buffer
        if (imageBuffer.length === 0) {
            throw new Error("Failed to decode base64 data");
        }

        // Generate unique filename
        const timestamp = Date.now();
        const randomString = crypto.randomBytes(8).toString("hex");
        const filename = `trek_${vendorIdStr}_${timestamp}_${randomString}.${imageType}`;

        // Create vendor-specific directory
        const vendorDir = path.join(TREK_IMAGES_DIR, `vendor_${vendorIdStr}`);
        if (!fs.existsSync(vendorDir)) {
            fs.mkdirSync(vendorDir, { recursive: true });
        }

        // Save file
        const filePath = path.join(vendorDir, filename);
        fs.writeFileSync(filePath, imageBuffer);

        // Return relative path from storage root
        const relativePath = `trek-images/vendor_${vendorIdStr}/${filename}`;
        
        console.log(`Image saved successfully: ${filePath} -> ${relativePath}`);
        
        return relativePath;
    } catch (error) {
        console.error("Error saving image:", error);
        throw new Error(`Failed to save image: ${error.message}`);
    }
};

/**
 * Delete image file
 * @param {string} relativePath - Relative path from storage root
 */
const deleteImage = async (relativePath) => {
    try {
        if (!relativePath) return;

        const fullPath = path.join(STORAGE_DIR, relativePath);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }
    } catch (error) {
        console.error("Error deleting image:", error);
        // Don't throw error, just log it
    }
};

/**
 * Get full file path from relative path
 * @param {string} relativePath - Relative path from storage root
 * @returns {string} - Full file system path
 */
const getFullPath = (relativePath) => {
    return path.join(STORAGE_DIR, relativePath);
};

module.exports = {
    saveBase64Image,
    deleteImage,
    getFullPath,
    STORAGE_DIR,
    TREK_IMAGES_DIR,
};
