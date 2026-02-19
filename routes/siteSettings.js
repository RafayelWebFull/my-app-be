var express = require('express');
var router = express.Router();
var multer = require('multer');
var path = require('path');
var fs = require('fs');
var { requireAdmin } = require('../middleware/auth');

var uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

var storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, uploadDir); },
  filename: function (req, file, cb) {
    var ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'hero-' + Date.now() + ext);
  },
});
var upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/', async function (req, res) {
  try {
    const [rows] = await req.db.execute('SELECT setting_key, setting_value FROM site_settings');
    const obj = {};
    rows.forEach((r) => { obj[r.setting_key] = r.setting_value || ''; });
    res.json(obj);
  } catch (err) {
    console.error(err);
    res.json({});
  }
});

router.put('/', requireAdmin, upload.fields([
  { name: 'hero_image', maxCount: 1 },
  { name: 'about_images', maxCount: 20 },
  { name: 'repair_images', maxCount: 20 },
]), async function (req, res) {
  try {
    const updates = { ...req.body };
    const files = req.files || {};
    const heroFile = files.hero_image && files.hero_image[0];
    const aboutFiles = files.about_images || [];
    const repairFiles = files.repair_images || [];

    if (heroFile) updates.hero_image = '/uploads/' + heroFile.filename;

    if (aboutFiles.length) {
      let existing = [];
      if (typeof updates.about_images === 'string' && updates.about_images.trim()) {
        try {
          const parsed = JSON.parse(updates.about_images);
          if (Array.isArray(parsed)) existing = parsed.filter(Boolean);
        } catch (_) {}
      }
      const uploaded = aboutFiles.map((f) => '/uploads/' + f.filename);
      updates.about_images = JSON.stringify(existing.concat(uploaded));
    }

    if (repairFiles.length) {
      let existing = [];
      if (typeof updates.repair_images === 'string' && updates.repair_images.trim()) {
        try {
          const parsed = JSON.parse(updates.repair_images);
          if (Array.isArray(parsed)) existing = parsed.filter(Boolean);
        } catch (_) {}
      }
      const uploaded = repairFiles.map((f) => '/uploads/' + f.filename);
      updates.repair_images = JSON.stringify(existing.concat(uploaded));
    }

    for (const [key, value] of Object.entries(updates)) {
      await req.db.execute(
        'INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
        [key, value, value]
      );
    }
    const [rows] = await req.db.execute('SELECT setting_key, setting_value FROM site_settings');
    const obj = {};
    rows.forEach((r) => { obj[r.setting_key] = r.setting_value || ''; });
    res.json(obj);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
