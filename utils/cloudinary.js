const { v2: cloudinary } = require('cloudinary');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a buffer to Cloudinary with auto compression.
 * @param {Buffer} buffer - File buffer from multer memoryStorage
 * @param {object} options - Cloudinary upload options (folder, resource_type, etc.)
 * @returns {Promise<object>} Cloudinary upload result
 */
const uploadToCloudinary = (buffer, options = {}) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                quality: 'auto',        // auto-compress quality
                fetch_format: 'auto',   // auto best format (webp/avif)
                ...options,
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );
        uploadStream.end(buffer);
    });
};

/**
 * Upload a base64 data URI to Cloudinary with auto compression.
 * @param {string} base64DataUri - Full data URI (data:image/...;base64,...)
 * @param {object} options - Cloudinary upload options
 * @returns {Promise<object>} Cloudinary upload result
 */
const uploadBase64ToCloudinary = (base64DataUri, options = {}) => {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload(
            base64DataUri,
            {
                quality: 'auto',
                fetch_format: 'auto',
                ...options,
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );
    });
};

/**
 * Delete a file from Cloudinary by its public_id.
 * @param {string} publicId - Cloudinary public_id
 * @param {string} resourceType - 'image' | 'raw' (for PDFs/docs)
 */
const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
    try {
        if (!publicId) return;
        await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
        console.log(`🗑️ Deleted from Cloudinary: ${publicId}`);
    } catch (error) {
        console.error('Error deleting from Cloudinary:', error);
    }
};

module.exports = { cloudinary, uploadToCloudinary, uploadBase64ToCloudinary, deleteFromCloudinary };
