var express = require('express');
var router = express.Router();
var multer = require('multer');
var path = require('path');
var fs = require('fs');
var { requireAdmin } = require('../middleware/auth');
var { errorPayload } = require('../utils/error');

var uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    var ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'optic-' + Date.now() + '-' + Math.random().toString(36).slice(2) + ext);
  },
});
var upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    var ext = path.extname(file.originalname).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only images allowed'));
    }
  },
});

function getOpticsQuery(where, params) {
  return `SELECT o.*, c.name as category_name, c.slug as category_slug, b.name as brand_name 
    FROM optics o 
    LEFT JOIN categories c ON o.category_id = c.id 
    LEFT JOIN brands b ON o.brand_id = b.id 
    ${where} 
    ORDER BY o.created_at DESC`;
}

router.get('/', async function (req, res, next) {
  try {
    const { category, brand, search } = req.query;
    let where = '';
    const params = [];

    if (category) {
      where += (where ? ' AND ' : ' WHERE ') + '(c.slug = ? OR c.id = ?)';
      params.push(category, isNaN(category) ? 0 : category);
    }
    if (brand) {
      where += (where ? ' AND ' : ' WHERE ') + '(b.name = ? OR b.id = ?)';
      params.push(brand, isNaN(brand) ? '' : brand);
    }
    if (search && search.trim()) {
      where += (where ? ' AND ' : ' WHERE ') + '(o.name LIKE ? OR o.style LIKE ? OR b.name LIKE ?)';
      const like = '%' + search.trim() + '%';
      params.push(like, like, like);
    }

    const sql = getOpticsQuery(where, params);
    const [rows] = await req.db.execute(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching optics:', err);
    res.status(500).json(errorPayload(err, 'Failed to fetch optics'));
  }
});

router.get('/:id', async function (req, res, next) {
  try {
    const [rows] = await req.db.execute(getOpticsQuery('WHERE o.id = ?', []), [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Optic not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching optic:', err);
    res.status(500).json(errorPayload(err, 'Failed to fetch optic'));
  }
});

router.post('/', requireAdmin, upload.single('image'), async function (req, res, next) {
  try {
    const { name, style, category_id, brand_id, price, description, in_stock, discount } = req.body;
    if (!name || !style || !category_id || !brand_id) {
      return res.status(400).json({ error: 'name, style, category_id, brand_id required' });
    }
    let imageUrl = null;
    if (req.file) {
      imageUrl = '/uploads/' + req.file.filename;
    }
    const stock = in_stock === 'false' || in_stock === false ? 0 : 1;
    const discountVal = discount != null && discount !== '' ? Math.min(100, Math.max(0, parseInt(discount, 10) || 0)) : null;
    const [result] = await req.db.execute(
      `INSERT INTO optics (name, style, category_id, brand_id, image_url, price, description, in_stock, discount) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, style, category_id, brand_id, imageUrl, price || null, description || null, stock, discountVal]
    );
    const [rows] = await req.db.execute(getOpticsQuery('WHERE o.id = ?', []), [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error creating optic:', err);
    res.status(500).json(errorPayload(err, 'Failed to create optic'));
  }
});

router.put('/:id', requireAdmin, upload.single('image'), async function (req, res, next) {
  try {
    const { name, style, category_id, brand_id, price, description, image_url, in_stock, discount } = req.body;
    if (!name || !style || !category_id || !brand_id) {
      return res.status(400).json({ error: 'name, style, category_id, brand_id required' });
    }
    let imageUrl = image_url || null;
    if (req.file) {
      imageUrl = '/uploads/' + req.file.filename;
    }
    const stock = in_stock === 'false' || in_stock === false ? 0 : 1;
    const discountVal = discount != null && discount !== '' ? Math.min(100, Math.max(0, parseInt(discount, 10) || 0)) : null;
    const [result] = await req.db.execute(
      `UPDATE optics SET name = ?, style = ?, category_id = ?, brand_id = ?, image_url = COALESCE(?, image_url), price = ?, description = ?, in_stock = ?, discount = ? WHERE id = ?`,
      [name, style, category_id, brand_id, imageUrl, price || null, description || null, stock, discountVal, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Optic not found' });
    }
    const [rows] = await req.db.execute(getOpticsQuery('WHERE o.id = ?', []), [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating optic:', err);
    res.status(500).json(errorPayload(err, 'Failed to update optic'));
  }
});

router.delete('/:id', requireAdmin, async function (req, res, next) {
  try {
    const [result] = await req.db.execute('DELETE FROM optics WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Optic not found' });
    }
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting optic:', err);
    res.status(500).json(errorPayload(err, 'Failed to delete optic'));
  }
});

module.exports = router;
