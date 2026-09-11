var multer = require('multer');
var path = require('path');
var fs = require('fs');

var imageExtensions = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

function createImageUpload(options) {
  var uploadDir = options.directory;
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  var storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, uploadDir); },
    filename: function (req, file, cb) {
      var extension = imageExtensions[file.mimetype];
      var field = String(file.fieldname || 'image').replace(/[^a-z0-9_-]/gi, '-');
      cb(null, options.prefix + '-' + field + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9) + extension);
    },
  });

  return multer({
    storage: storage,
    limits: {
      fileSize: options.fileSize || 5 * 1024 * 1024,
      files: options.maxFiles || 25,
      fields: options.maxFields || 100,
    },
    fileFilter: function (req, file, cb) {
      if (!imageExtensions[file.mimetype]) {
        return cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
      }
      cb(null, true);
    },
  });
}

module.exports = { createImageUpload };
