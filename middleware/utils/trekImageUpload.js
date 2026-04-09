const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// Create trek images storage directory
const STORAGE_DIR = path.join(__dirname, "../storage");
const TREK_IMAGES_DIR = path.join(STORAGE_DIR, "trek-images");

if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

if (!fs.existsSync(TREK_IMAGES_DIR)) {
    fs.mkdirSync(TREK_IMAGES_DIR, { recursive: true });
}

// Configure multer for trek image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Get vendor ID from auth or request body
        const vendorId = req.user?.id || req.body.vendorId || '1';
        const vendorDir = path.join(TREK_IMAGES_DIR, `vendor_${vendorId}`);
        
        // Create vendor-specific directory
        if (!fs.existsSync(vendorDir)) {
            fs.mkdirSync(vendorDir, { recursive: true });
        }
        
        cb(null, vendorDir);
    },
    filename: (req, file, cb) => {
        // Get vendor ID
        const vendorId = req.user?.id || req.body.vendorId || '1';
        
        // Extract file extension
        const fileExtension = path.extname(file.originalname).toLowerCase();
        
        // Generate unique filename
        const timestamp = Date.now();
        const randomString = crypto.randomBytes(8).toString("hex");
        const filename = `trek_${vendorId}_${timestamp}_${randomString}${fileExtension}`;
        
        console.log(`📸 Trek image upload: ${file.originalname} -> ${filename}`);
        
        cb(null, filename);
    },
});

// File filter - only images
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Invalid file type. Only JPEG, PNG, and WebP are allowed. Got: ${file.mimetype}`), false);
    }
};

// Configure multer
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit per file
        files: 5 // Maximum 5 images
    },
    fileFilter: fileFilter
});

// Middleware for uploading multiple trek images
const uploadTrekImages = upload.array('images', 5); // Max 5 images

// Helper to get relative path for database storage
const getRelativePath = (fullPath) => {
    // Return path relative to storage directory
    return path.relative(STORAGE_DIR, fullPath);
};

// Helper to delete image file
const deleteImage = (relativePath) => {
    try {
        const fullPath = path.join(STORAGE_DIR, relativePath);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            console.log(`🗑️ Deleted image: ${relativePath}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error deleting image:', error);
        return false;
    }
};

module.exports = {
    uploadTrekImages,
    getRelativePath,
    deleteImage,
    TREK_IMAGES_DIR,
    STORAGE_DIR
};

