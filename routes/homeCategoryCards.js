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
    cb(null, 'homecard-' + Date.now() + ext);
  },
});
var upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Public: get cards for home page
router.get('/', async function (req, res) {
  try {
    const [rows] = await req.db.execute(
      'SELECT id, title, slug, background, image_url, icon, sort_order FROM home_category_cards ORDER BY sort_order ASC, id ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch home category cards' });
  }
});

// Admin: get all
router.get('/all', requireAdmin, async function (req, res) {
  try {
    const [rows] = await req.db.execute(
      'SELECT * FROM home_category_cards ORDER BY sort_order ASC, id ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch' });
  }
});

router.post('/', requireAdmin, upload.single('image'), async function (req, res) {
  try {
    const { title, slug, background, icon, sort_order } = req.body;
    if (!title || !slug) {
      return res.status(400).json({ error: 'title and slug required' });
    }
    const imageUrl = req.file ? '/uploads/' + req.file.filename : null;
    const bg = background || null;
    const ic = icon || 'glasses';
    const order = sort_order != null ? parseInt(sort_order, 10) : 0;
    const [result] = await req.db.execute(
      'INSERT INTO home_category_cards (title, slug, background, image_url, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [title, slug, bg, imageUrl, ic, order]
    );
    const [rows] = await req.db.execute('SELECT * FROM home_category_cards WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create' });
  }
});

router.put('/:id', requireAdmin, upload.single('image'), async function (req, res) {
  try {
    const { title, slug, background, icon, sort_order, image_url } = req.body;
    if (!title || !slug) {
      return res.status(400).json({ error: 'title and slug required' });
    }
    let imageUrl = image_url || null;
    if (req.file) imageUrl = '/uploads/' + req.file.filename;
    const bg = background || null;
    const ic = icon || 'glasses';
    const order = sort_order != null ? parseInt(sort_order, 10) : 0;
    const [result] = await req.db.execute(
      'UPDATE home_category_cards SET title = ?, slug = ?, background = ?, image_url = COALESCE(?, image_url), icon = ?, sort_order = ? WHERE id = ?',
      [title, slug, bg, imageUrl, ic, order, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    const [rows] = await req.db.execute('SELECT * FROM home_category_cards WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update' });
  }
});

router.delete('/:id', requireAdmin, async function (req, res) {
  try {
    const [result] = await req.db.execute('DELETE FROM home_category_cards WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

module.exports = router;
