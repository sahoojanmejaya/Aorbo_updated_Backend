const multer = require("multer");
const { uploadToCloudinary, deleteFromCloudinary } = require("./cloudinary");

// File filter - only images
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Invalid file type. Only JPEG, PNG, and WebP are allowed. Got: ${file.mimetype}`), false);
    }
};

// Use memory storage — files go to Cloudinary, not disk
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB per file
        files: 5,
    },
    fileFilter,
});

// Middleware: run multer, then upload each file buffer to Cloudinary
const uploadTrekImages = (req, res, next) => {
    upload.array('images', 5)(req, res, async (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        if (!req.files || req.files.length === 0) return next();

        const vendorId = req.user?.id || req.body.vendorId || 'unknown';

        try {
            await Promise.all(req.files.map(async (file) => {
                console.log(`☁️ Uploading trek image to Cloudinary: ${file.originalname}`);
                const result = await uploadToCloudinary(file.buffer, {
                    folder: `aorbo/trek-images/vendor_${vendorId}`,
                    resource_type: 'image',
                });
                // Attach Cloudinary URL so controllers can use file.path as usual
                file.path = result.secure_url;
                file.public_id = result.public_id;
                console.log(`✅ Trek image uploaded: ${result.secure_url}`);
            }));
            next();
        } catch (uploadError) {
            console.error('Cloudinary upload error:', uploadError);
            return res.status(500).json({ success: false, message: 'Image upload failed' });
        }
    });
};

/**
 * Delete a trek image from Cloudinary by its public_id.
 * For backward compatibility, also accepts a Cloudinary URL and extracts public_id.
 */
const deleteImage = async (publicIdOrUrl) => {
    try {
        if (!publicIdOrUrl) return false;
        // If it's a full URL, extract public_id from it
        let publicId = publicIdOrUrl;
        if (publicIdOrUrl.startsWith('http')) {
            // Extract public_id: everything between /upload/v.../  and the file extension
            const match = publicIdOrUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/i);
            if (match) publicId = match[1];
        }
        await deleteFromCloudinary(publicId);
        return true;
    } catch (error) {
        console.error('Error deleting image:', error);
        return false;
    }
};

module.exports = {
    uploadTrekImages,
    deleteImage,
};
