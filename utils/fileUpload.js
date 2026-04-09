const { uploadBase64ToCloudinary, deleteFromCloudinary } = require("./cloudinary");

/**
 * Upload a base64 image to Cloudinary with auto compression.
 * @param {string} base64Data - Full data URI (data:image/...;base64,...) or raw base64
 * @param {string} vendorId - Vendor ID used for folder organisation
 * @returns {Promise<string>} Cloudinary secure URL
 */
const saveBase64Image = async (base64Data, vendorId) => {
    if (!base64Data || typeof base64Data !== 'string') {
        throw new Error("Base64 data is required and must be a string");
    }
    if (!vendorId) {
        throw new Error("Vendor ID is required");
    }

    // Normalise: ensure it has the data URI prefix
    let dataUri = base64Data;
    if (!base64Data.startsWith('data:image/')) {
        dataUri = `data:image/jpeg;base64,${base64Data}`;
    }

    // Validate format
    const matches = dataUri.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
    if (!matches) {
        throw new Error(`Invalid base64 image format. Got: ${base64Data.substring(0, 50)}...`);
    }

    const imageType = matches[1].toLowerCase();
    if (!['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(imageType)) {
        throw new Error(`Unsupported image type: ${imageType}`);
    }

    console.log(`☁️ Uploading base64 trek image to Cloudinary (vendor ${vendorId})`);
    const result = await uploadBase64ToCloudinary(dataUri, {
        folder: `aorbo/trek-images/vendor_${vendorId}`,
    });

    console.log(`✅ Base64 image uploaded: ${result.secure_url}`);
    return result.secure_url; // Return Cloudinary URL instead of local path
};

/**
 * Delete an image from Cloudinary.
 * Accepts either a Cloudinary public_id or a full Cloudinary URL.
 */
const deleteImage = async (publicIdOrUrl) => {
    try {
        if (!publicIdOrUrl) return;
        let publicId = publicIdOrUrl;
        if (publicIdOrUrl.startsWith('http')) {
            const match = publicIdOrUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/i);
            if (match) publicId = match[1];
        }
        await deleteFromCloudinary(publicId);
    } catch (error) {
        console.error("Error deleting image:", error);
    }
};

module.exports = {
    saveBase64Image,
    deleteImage,
};
