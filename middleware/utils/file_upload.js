const multer = require('multer');
const path = require('path');
const fs = require('fs');

const createMulterConfig = ({
  allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp', '.svg',

  // Documents
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.rtf', '.odt',

  // Audio (ALL major formats)
  '.mp3', '.wav', '.aac', '.m4a', '.flac', '.alac', 
  '.ogg', '.oga', '.opus', '.wma', '.aiff', '.amr',

  // Video (ALL major formats)
  '.mp4', '.mov', '.avi', '.mkv', '.flv', '.wmv',
  '.webm', '.mpeg', '.mpg', '.3gp', '.m4v', '.ts',

  // Screen recordings / raw recordings
  '.rec', '.m3u8', '.mts', '.rm', '.rmvb',

  // Map / GIS files    
  '.kml', '.kmz', '.gpx', '.geojson','.json',

  // Compressed uploads (optional but common)
  '.zip', '.rar', '.7z', '.tar', '.gz'],
  maxFileSize = 10 * 1024 * 1024, // 10 MB
  maxFileCount = 1,
  uploadPath = '/'
} = {}) => {
  // Define storage configuration
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, `public${uploadPath}`);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      if (!allowedExtensions.includes(ext)) {
        return cb(new Error(`Invalid file type. Allowed extensions: ${allowedExtensions.join(', ')}`), false);
      }
      cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
  });

  // Define file filter and limits
  const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname);
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed extensions: ${allowedExtensions.join(', ')}`), false);
    }
  };

  const limits = {
    fileSize: maxFileSize,
    files: maxFileCount
  };

  return multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: limits
  });
};

// Function to delete a file
const deleteFile = (filePath, callback) => {
  fs.unlink(filePath, (err) => {
    if (err) {
      return callback(err);
    }
    callback(null, 'File deleted successfully');
  });
};

// Function to delete multiple files
const deleteMultipleFiles = (filePaths, callback) => {
  const unlinkFile = (filePath) => {
    return new Promise((resolve, reject) => {
      fs.unlink(filePath, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(`File ${filePath} deleted successfully`);
        }
      });
    });
  };

  // Use Promise.all to delete all files
  Promise.all(filePaths.map(unlinkFile))
    .then((results) => callback(null, results))
    .catch((error) => callback(error));
};

module.exports = { createMulterConfig, deleteFile, deleteMultipleFiles };   
