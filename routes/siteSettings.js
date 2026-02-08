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

router.put('/', requireAdmin, upload.single('hero_image'), async function (req, res) {
  try {
    const updates = { ...req.body };
    if (req.file) updates.hero_image = '/uploads/' + req.file.filename;
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
