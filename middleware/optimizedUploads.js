var fs = require('fs');
var path = require('path');
var sharp = require('sharp');

var supportedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);

module.exports = function optimizedUploads(uploadRoot) {
  return async function (req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();

    var width = Number.parseInt(req.query.w, 10);
    if (!Number.isFinite(width)) return next();
    width = Math.max(64, Math.min(width, 1920));

    var relativePath;
    try {
      var requestedPath = req.query.src || req.path;
      relativePath = decodeURIComponent(requestedPath).replace(/^\/+/, '').replace(/^uploads\//, '');
    } catch (err) {
      return res.status(400).send('Invalid image path');
    }

    var sourcePath = path.resolve(uploadRoot, relativePath);
    var rootPrefix = path.resolve(uploadRoot) + path.sep;
    if (!sourcePath.startsWith(rootPrefix) || !supportedExtensions.has(path.extname(sourcePath).toLowerCase())) {
      return next();
    }

    try {
      await fs.promises.access(sourcePath, fs.constants.R_OK);
      var output = await sharp(sourcePath)
        .rotate()
        .resize({ width: width, withoutEnlargement: true })
        .webp({ quality: 78, effort: 4 })
        .toBuffer();

      res.set('Content-Type', 'image/webp');
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      res.set('Vary', 'Accept');
      return res.send(output);
    } catch (err) {
      if (err && (err.code === 'ENOENT' || err.code === 'EACCES')) return next();
      console.error('Failed to optimize upload:', relativePath, err.message);
      return next();
    }
  };
};
