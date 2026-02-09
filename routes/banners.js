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
    cb(null, 'banner-' + Date.now() + ext);
  },
});
var upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Public: get banners that are active or upcoming (end_date >= today)
router.get('/', async function (req, res) {
  try {
    const [rows] = await req.db.execute(
      'SELECT * FROM banners WHERE end_date >= CURDATE() ORDER BY start_date ASC'
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

router.post('/', requireAdmin, upload.single('image'), async function (req, res) {
  try {
    const { title, description, start_date, end_date, discount_percent } = req.body;
    if (!title || !start_date || !end_date) {
      return res.status(400).json({ error: 'title, start_date, end_date required' });
    }
    const imageUrl = req.file ? '/uploads/' + req.file.filename : null;
    const discount = discount_percent != null && discount_percent !== '' ? Math.min(100, Math.max(0, parseInt(discount_percent, 10) || 0)) : 0;
    const [result] = await req.db.execute(
      'INSERT INTO banners (image_url, title, description, start_date, end_date, discount_percent) VALUES (?, ?, ?, ?, ?, ?)',
      [imageUrl, title, description || null, start_date, end_date, discount]
    );
    const [rows] = await req.db.execute('SELECT * FROM banners WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json(errorPayload(err, 'Failed to create banner'));
  }
});

router.put('/:id', requireAdmin, upload.single('image'), async function (req, res) {
  try {
    const { title, description, start_date, end_date, discount_percent, image_url } = req.body;
    if (!title || !start_date || !end_date) {
      return res.status(400).json({ error: 'title, start_date, end_date required' });
    }
    let imageUrl = image_url || null;
    if (req.file) imageUrl = '/uploads/' + req.file.filename;
    const discount = discount_percent != null && discount_percent !== '' ? Math.min(100, Math.max(0, parseInt(discount_percent, 10) || 0)) : 0;
    const [result] = await req.db.execute(
      'UPDATE banners SET image_url = COALESCE(?, image_url), title = ?, description = ?, start_date = ?, end_date = ?, discount_percent = ? WHERE id = ?',
      [imageUrl, title, description || null, start_date, end_date, discount, req.params.id]
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
