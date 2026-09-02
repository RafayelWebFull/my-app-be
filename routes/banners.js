var express = require('express');
var router = express.Router();
var multer = require('multer');
var path = require('path');
var fs = require('fs');
var { requireAdmin } = require('../middleware/auth');
var { errorPayload } = require('../utils/error');

var uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

var storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, uploadDir); },
  filename: function (req, file, cb) {
    var ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'banner-' + file.fieldname + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext);
  },
});
var upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Public: get only currently active banners
router.get('/', async function (req, res) {
  try {
    const [rows] = await req.db.execute(
      'SELECT * FROM banners WHERE CURDATE() BETWEEN start_date AND end_date ORDER BY start_date ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json(errorPayload(err, 'Failed to fetch banners'));
  }
});

// Admin: get all banners
router.get('/all', requireAdmin, async function (req, res) {
  try {
    const [rows] = await req.db.execute('SELECT * FROM banners ORDER BY start_date DESC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json(errorPayload(err, 'Failed to fetch banners'));
  }
});

var bannerUploads = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'desktop_image', maxCount: 1 },
  { name: 'mobile_image', maxCount: 1 },
]);

function uploadedUrl(req, field) {
  var files = req.files && req.files[field];
  return files && files[0] ? '/uploads/' + files[0].filename : null;
}

router.post('/', requireAdmin, bannerUploads, async function (req, res) {
  try {
    const { title, description, start_date, end_date, discount_percent, target_type, target_id } = req.body;
    if (!title || !start_date || !end_date) {
      return res.status(400).json({ error: 'title, start_date, end_date required' });
    }
    const targetType = ['all', 'brand', 'optic'].includes(target_type) ? target_type : 'all';
    let targetId = null;
    if (targetType !== 'all') {
      targetId = parseInt(target_id, 10);
      if (!targetId || targetId < 1) {
        return res.status(400).json({ error: 'target_id required for brand/optic targeting' });
      }
    }
    const imageUrl = uploadedUrl(req, 'desktop_image') || uploadedUrl(req, 'image');
    const mobileImageUrl = uploadedUrl(req, 'mobile_image');
    const discount = discount_percent != null && discount_percent !== '' ? Math.min(100, Math.max(0, parseInt(discount_percent, 10) || 0)) : 0;
    const [result] = await req.db.execute(
      'INSERT INTO banners (image_url, mobile_image_url, title, description, start_date, end_date, discount_percent, target_type, target_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [imageUrl, mobileImageUrl, title, description || null, start_date, end_date, discount, targetType, targetId]
    );
    const [rows] = await req.db.execute('SELECT * FROM banners WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json(errorPayload(err, 'Failed to create banner'));
  }
});

router.put('/:id', requireAdmin, bannerUploads, async function (req, res) {
  try {
    const { title, description, start_date, end_date, discount_percent, image_url, mobile_image_url, target_type, target_id } = req.body;
    if (!title || !start_date || !end_date) {
      return res.status(400).json({ error: 'title, start_date, end_date required' });
    }
    const targetType = ['all', 'brand', 'optic'].includes(target_type) ? target_type : 'all';
    let targetId = null;
    if (targetType !== 'all') {
      targetId = parseInt(target_id, 10);
      if (!targetId || targetId < 1) {
        return res.status(400).json({ error: 'target_id required for brand/optic targeting' });
      }
    }
    let imageUrl = image_url || null;
    imageUrl = uploadedUrl(req, 'desktop_image') || uploadedUrl(req, 'image') || imageUrl;
    let mobileImageUrl = mobile_image_url || null;
    mobileImageUrl = uploadedUrl(req, 'mobile_image') || mobileImageUrl;
    const discount = discount_percent != null && discount_percent !== '' ? Math.min(100, Math.max(0, parseInt(discount_percent, 10) || 0)) : 0;
    const [result] = await req.db.execute(
      'UPDATE banners SET image_url = COALESCE(?, image_url), mobile_image_url = COALESCE(?, mobile_image_url), title = ?, description = ?, start_date = ?, end_date = ?, discount_percent = ?, target_type = ?, target_id = ? WHERE id = ?',
      [imageUrl, mobileImageUrl, title, description || null, start_date, end_date, discount, targetType, targetId, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Banner not found' });
    const [rows] = await req.db.execute('SELECT * FROM banners WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json(errorPayload(err, 'Failed to update banner'));
  }
});

router.delete('/:id', requireAdmin, async function (req, res) {
  try {
    const [result] = await req.db.execute('DELETE FROM banners WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Banner not found' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json(errorPayload(err, 'Failed to delete banner'));
  }
});

module.exports = router;
