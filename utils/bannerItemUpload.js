const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Create banner items storage directory if it doesn't exist
const STORAGE_DIR = path.join(__dirname, "../storage");
const BANNER_ITEMS_DIR = path.join(STORAGE_DIR, "banner_items");

if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

if (!fs.existsSync(BANNER_ITEMS_DIR)) {
    fs.mkdirSync(BANNER_ITEMS_DIR, { recursive: true });
}

// Configure multer for banner item file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = BANNER_ITEMS_DIR;
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        // Generate unique filename with timestamp and random string
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const fileExtension = path.extname(file.originalname);
        const fileName = `${file.fieldname}-${uniqueSuffix}${fileExtension}`;
        
        console.log(`📁 File upload: ${file.originalname} -> ${fileName}`);
        console.log(`📁 File extension: ${fileExtension}`);
        console.log(`📁 File mimetype: ${file.mimetype}`);
        
        cb(null, fileName);
    },
});

// File filter to allow only image files
const fileFilter = (req, file, cb) => {
    // Check if file is an image
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

// Configure multer
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: fileFilter
});

// Simple multer configuration for testing
const simpleUpload = multer({
    dest: BANNER_ITEMS_DIR,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    }
});

// Middleware for uploading banner item images
const uploadBannerItemImages = upload.fields([
    { name: 'icon_image', maxCount: 1 },
    { name: 'main_image', maxCount: 1 }
]);

// Simple middleware for testing
const simpleUploadMiddleware = simpleUpload.fields([
    { name: 'icon_image', maxCount: 1 },
    { name: 'main_image', maxCount: 1 }
]);

// Add debugging middleware
const debugUploadMiddleware = (req, res, next) => {
    console.log('=== Multer Debug Middleware ===');
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Body before multer:', req.body);
    console.log('Files before multer:', req.files);
    
    next();
};

// Add debugging middleware after multer
const debugAfterMulter = (req, res, next) => {
    console.log('=== After Multer ===');
    console.log('Body after multer:', req.body);
    console.log('Files after multer:', req.files);
    console.log('Body keys:', Object.keys(req.body));
    console.log('Files keys:', req.files ? Object.keys(req.files) : 'No files');
    
    next();
};

// Middleware for uploading single icon image
const uploadIconImage = upload.single('icon_image');

// Middleware for uploading single main image
const uploadMainImage = upload.single('main_image');

// Helper function to get full file path
const getFullPath = (relativePath) => {
    return path.join(STORAGE_DIR, relativePath);
};

// Helper function to delete file
const deleteFile = (relativePath) => {
    try {
        const fullPath = getFullPath(relativePath);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error deleting file:', error);
        return false;
    }
};

// Helper function to get relative path from storage root
const getRelativePath = (fullPath) => {
    return path.relative(STORAGE_DIR, fullPath);
};

module.exports = {
    uploadBannerItemImages,
    uploadIconImage,
    uploadMainImage,
    simpleUploadMiddleware,
    debugUploadMiddleware,
    debugAfterMulter,
    getFullPath,
    getRelativePath,
    deleteFile,
    BANNER_ITEMS_DIR,
    STORAGE_DIR
};
