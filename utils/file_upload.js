const multer = require('multer');
const path = require('path');
const { uploadToCloudinary, deleteFromCloudinary } = require('./cloudinary');

/**
 * Creates a multer middleware that stores files in memory and uploads to Cloudinary.
 * @param {object} options
 * @param {string[]} options.allowedExtensions - e.g. ['.jpg', '.pdf']
 * @param {number}  options.maxFileSize - bytes, default 10MB
 * @param {number}  options.maxFileCount - default 1
 * @param {string}  options.folder - Cloudinary folder, default 'aorbo/uploads'
 * @param {string}  options.resourceType - 'image' | 'raw' | 'auto', default 'auto'
 */
const createMulterConfig = ({
  allowedExtensions = [
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp', '.svg',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.txt', '.rtf', '.odt',
    '.mp3', '.wav', '.aac', '.m4a', '.flac', '.alac',
    '.ogg', '.oga', '.opus', '.wma', '.aiff', '.amr',
    '.mp4', '.mov', '.avi', '.mkv', '.flv', '.wmv',
    '.webm', '.mpeg', '.mpg', '.3gp', '.m4v', '.ts',
    '.rec', '.m3u8', '.mts', '.rm', '.rmvb',
    '.kml', '.kmz', '.gpx', '.geojson', '.json',
    '.zip', '.rar', '.7z', '.tar', '.gz',
  ],
  maxFileSize = 10 * 1024 * 1024,
  maxFileCount = 1,
  folder = 'aorbo/uploads',
  resourceType = 'auto',
} = {}) => {
  const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed: ${allowedExtensions.join(', ')}`), false);
    }
  };

  const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter,
    limits: { fileSize: maxFileSize, files: maxFileCount },
  });

  // Return a wrapper that runs multer then uploads to Cloudinary
  const middleware = (fieldConfig) => (req, res, next) => {
    const multerHandler =
      typeof fieldConfig === 'string'
        ? upload.single(fieldConfig)
        : Array.isArray(fieldConfig)
        ? upload.array(fieldConfig[0], fieldConfig[1] || maxFileCount)
        : upload.fields(fieldConfig);

    multerHandler(req, res, async (err) => {
      if (err) return res.status(400).json({ success: false, message: err.message });

      try {
        // Upload single file
        if (req.file) {
          const result = await uploadToCloudinary(req.file.buffer, {
            folder,
            resource_type: resourceType,
          });
          req.file.path = result.secure_url;
          req.file.public_id = result.public_id;
        }
        // Upload array of files
        if (req.files && Array.isArray(req.files)) {
          await Promise.all(req.files.map(async (file) => {
            const result = await uploadToCloudinary(file.buffer, {
              folder,
              resource_type: resourceType,
            });
            file.path = result.secure_url;
            file.public_id = result.public_id;
          }));
        }
        // Upload fields object
        if (req.files && !Array.isArray(req.files)) {
          await Promise.all(Object.keys(req.files).map(async (fieldName) => {
            await Promise.all(req.files[fieldName].map(async (file) => {
              const result = await uploadToCloudinary(file.buffer, {
                folder,
                resource_type: resourceType,
              });
              file.path = result.secure_url;
              file.public_id = result.public_id;
            }));
          }));
        }
        next();
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        return res.status(500).json({ success: false, message: 'File upload failed' });
      }
    });
  };

  return middleware;
};

// Delete a file from Cloudinary by public_id or URL
const deleteFile = async (publicIdOrUrl, resourceType = 'image', callback) => {
  try {
    let publicId = publicIdOrUrl;
    if (typeof publicIdOrUrl === 'string' && publicIdOrUrl.startsWith('http')) {
      const match = publicIdOrUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/i);
      if (match) publicId = match[1];
    }
    await deleteFromCloudinary(publicId, resourceType);
    if (callback) callback(null, 'File deleted successfully');
  } catch (err) {
    if (callback) callback(err);
  }
};

const deleteMultipleFiles = async (publicIds, callback) => {
  try {
    await Promise.all(publicIds.map((id) => deleteFromCloudinary(id)));
    if (callback) callback(null, 'Files deleted successfully');
  } catch (err) {
    if (callback) callback(err);
  }
};

module.exports = { createMulterConfig, deleteFile, deleteMultipleFiles };
