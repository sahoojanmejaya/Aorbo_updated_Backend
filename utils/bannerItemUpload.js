const multer = require("multer");
const { uploadToCloudinary, deleteFromCloudinary } = require("./cloudinary");

// File filter — images only
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter,
});

// Upload each field's buffer to Cloudinary after multer
const _uploadToCloud = async (req) => {
    if (!req.files) return;
    const fieldNames = Object.keys(req.files);
    await Promise.all(fieldNames.map(async (fieldName) => {
        await Promise.all(req.files[fieldName].map(async (file) => {
            console.log(`☁️ Uploading banner image to Cloudinary: ${file.originalname}`);
            const result = await uploadToCloudinary(file.buffer, {
                folder: 'aorbo/banner-items',
                resource_type: 'image',
            });
            file.path = result.secure_url;
            file.public_id = result.public_id;
            console.log(`✅ Banner image uploaded: ${result.secure_url}`);
        }));
    }));
};

// Middleware for icon_image + main_image fields
const uploadBannerItemImages = (req, res, next) => {
    upload.fields([
        { name: 'icon_image', maxCount: 1 },
        { name: 'main_image', maxCount: 1 },
    ])(req, res, async (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        try {
            await _uploadToCloud(req);
            next();
        } catch (uploadError) {
            console.error('Cloudinary upload error:', uploadError);
            return res.status(500).json({ success: false, message: 'Image upload failed' });
        }
    });
};

const uploadIconImage = (req, res, next) => {
    upload.single('icon_image')(req, res, async (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        if (!req.file) return next();
        try {
            const result = await uploadToCloudinary(req.file.buffer, { folder: 'aorbo/banner-items' });
            req.file.path = result.secure_url;
            req.file.public_id = result.public_id;
            next();
        } catch (e) {
            return res.status(500).json({ success: false, message: 'Image upload failed' });
        }
    });
};

const uploadMainImage = (req, res, next) => {
    upload.single('main_image')(req, res, async (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        if (!req.file) return next();
        try {
            const result = await uploadToCloudinary(req.file.buffer, { folder: 'aorbo/banner-items' });
            req.file.path = result.secure_url;
            req.file.public_id = result.public_id;
            next();
        } catch (e) {
            return res.status(500).json({ success: false, message: 'Image upload failed' });
        }
    });
};

const deleteFile = async (publicIdOrUrl) => {
    try {
        if (!publicIdOrUrl) return false;
        let publicId = publicIdOrUrl;
        if (publicIdOrUrl.startsWith('http')) {
            const match = publicIdOrUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/i);
            if (match) publicId = match[1];
        }
        await deleteFromCloudinary(publicId);
        return true;
    } catch (error) {
        console.error('Error deleting file:', error);
        return false;
    }
};

// Debug middlewares kept for compatibility (now just pass-through)
const debugUploadMiddleware = (req, res, next) => next();
const debugAfterMulter = (req, res, next) => next();

module.exports = {
    uploadBannerItemImages,
    uploadIconImage,
    uploadMainImage,
    deleteFile,
    debugUploadMiddleware,
    debugAfterMulter,
};
