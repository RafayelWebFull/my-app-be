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

function parseImageUrls(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter(Boolean).map(function (s) { return String(s); });
  }
  if (typeof raw === 'string') {
    try {
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean).map(function (s) { return String(s); });
      }
    } catch (e) {
      return [];
    }
  }
  return [];
}

function normalizeImageUrls(urls) {
  var list = (urls || [])
    .filter(function (u) { return typeof u === 'string' && u.trim().length > 0; })
    .map(function (u) { return u.trim(); });
  var unique = [];
  var seen = new Set();
  for (var i = 0; i < list.length; i++) {
    if (!seen.has(list[i])) {
      seen.add(list[i]);
      unique.push(list[i]);
    }
  }
  return unique;
}

function toOpticResponse(row) {
  var imageUrls = parseImageUrls(row.image_urls);
  if (!imageUrls.length && row.image_url) {
    imageUrls = [row.image_url];
  }
  var ownDiscount = row.discount != null ? Number(row.discount) || 0 : 0;
  var bannerDiscount = row.banner_discount != null ? Number(row.banner_discount) || 0 : 0;
  var effectiveDiscount = Math.max(ownDiscount, bannerDiscount);
  return Object.assign({}, row, {
    image_urls: imageUrls,
    image_url: imageUrls[0] || null,
    discount: effectiveDiscount > 0 ? effectiveDiscount : null,
    own_discount: ownDiscount > 0 ? ownDiscount : null,
    banner_discount: bannerDiscount > 0 ? bannerDiscount : null,
  });
}

function activeBannerDiscountExpr(opticAlias) {
  var o = opticAlias || 'o';
  return `(SELECT MAX(bn.discount_percent)
    FROM banners bn
    WHERE CURDATE() BETWEEN bn.start_date AND bn.end_date
      AND (
        bn.target_type = 'all'
        OR (bn.target_type = 'brand' AND bn.target_id = ${o}.brand_id)
        OR (bn.target_type = 'optic' AND bn.target_id = ${o}.id)
      ))`;
}

function getOpticsQuery(where, params) {
  var bannerDiscountExpr = activeBannerDiscountExpr('o');
  return `SELECT o.*, c.name as category_name, c.slug as category_slug, b.name as brand_name 
    , ${bannerDiscountExpr} AS banner_discount
    FROM optics o 
    LEFT JOIN categories c ON o.category_id = c.id 
    LEFT JOIN brands b ON o.brand_id = b.id 
    ${where} 
    ORDER BY o.created_at DESC`;
}

router.get('/', async function (req, res, next) {
  try {
    const { category, brand, search, gender, stock, discounted, banner } = req.query;
    let where = '';
    const params = [];
    const bannerDiscountExpr = activeBannerDiscountExpr('o');

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
    if (gender && ['male', 'female', 'unisex'].includes(gender)) {
      where += (where ? ' AND ' : ' WHERE ') + 'o.gender = ?';
      params.push(gender);
    }
    if (stock === 'in') {
      where += (where ? ' AND ' : ' WHERE ') + 'o.in_stock = 1';
    } else if (stock === 'out') {
      where += (where ? ' AND ' : ' WHERE ') + 'o.in_stock = 0';
    }
    if (discounted === 'true') {
      where += (where ? ' AND ' : ' WHERE ') + `(GREATEST(COALESCE(o.discount, 0), COALESCE(${bannerDiscountExpr}, 0)) > 0)`;
    } else if (discounted === 'false') {
      where += (where ? ' AND ' : ' WHERE ') + `(GREATEST(COALESCE(o.discount, 0), COALESCE(${bannerDiscountExpr}, 0)) <= 0)`;
    }
    if (banner) {
      const bannerId = parseInt(String(banner), 10);
      if (!Number.isNaN(bannerId) && bannerId > 0) {
        where += (where ? ' AND ' : ' WHERE ') + `EXISTS (
          SELECT 1
          FROM banners bf
          WHERE bf.id = ?
            AND CURDATE() BETWEEN bf.start_date AND bf.end_date
            AND (
              bf.target_type = 'all'
              OR (bf.target_type = 'brand' AND bf.target_id = o.brand_id)
              OR (bf.target_type = 'optic' AND bf.target_id = o.id)
            )
        )`;
        params.push(bannerId);
      }
    }

    const sql = getOpticsQuery(where, params);
    const [rows] = await req.db.execute(sql, params);
    res.json(rows.map(toOpticResponse));
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
    res.json(toOpticResponse(rows[0]));
  } catch (err) {
    console.error('Error fetching optic:', err);
    res.status(500).json(errorPayload(err, 'Failed to fetch optic'));
  }
});

router.post('/', requireAdmin, upload.fields([{ name: 'images', maxCount: 4 }, { name: 'image', maxCount: 1 }]), async function (req, res, next) {
  try {
    const { name, style, category_id, brand_id, price, description, in_stock, discount, gender } = req.body;
    if (!name || !style || !category_id || !brand_id) {
      return res.status(400).json({ error: 'name, style, category_id, brand_id required' });
    }
    const genderValue = ['male', 'female', 'unisex'].includes(gender) ? gender : 'unisex';
    var uploadedImages = [];
    if (req.files && Array.isArray(req.files.images)) {
      uploadedImages = uploadedImages.concat(req.files.images);
    }
    if (req.files && Array.isArray(req.files.image)) {
      uploadedImages = uploadedImages.concat(req.files.image);
    }
    var imageUrls = normalizeImageUrls(uploadedImages.map(function (f) { return '/uploads/' + f.filename; }));
    if (imageUrls.length < 1 || imageUrls.length > 4) {
      return res.status(400).json({ error: 'Each product must have from 1 to 4 images' });
    }
    const stock = in_stock === 'false' || in_stock === false ? 0 : 1;
    const discountVal = discount != null && discount !== '' ? Math.min(100, Math.max(0, parseInt(discount, 10) || 0)) : null;
    const [result] = await req.db.execute(
      `INSERT INTO optics (name, style, category_id, brand_id, image_url, image_urls, price, description, in_stock, discount, gender) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, style, category_id, brand_id, imageUrls[0], JSON.stringify(imageUrls), price || null, description || null, stock, discountVal, genderValue]
    );
    const [rows] = await req.db.execute(getOpticsQuery('WHERE o.id = ?', []), [result.insertId]);
    res.status(201).json(toOpticResponse(rows[0]));
  } catch (err) {
    console.error('Error creating optic:', err);
    res.status(500).json(errorPayload(err, 'Failed to create optic'));
  }
});

router.put('/:id', requireAdmin, upload.fields([{ name: 'images', maxCount: 4 }, { name: 'image', maxCount: 1 }]), async function (req, res, next) {
  try {
    const { name, style, category_id, brand_id, price, description, in_stock, discount, gender } = req.body;
    if (!name || !style || !category_id || !brand_id) {
      return res.status(400).json({ error: 'name, style, category_id, brand_id required' });
    }
    const genderValue = ['male', 'female', 'unisex'].includes(gender) ? gender : 'unisex';
    const [existingRows] = await req.db.execute('SELECT image_url, image_urls FROM optics WHERE id = ?', [req.params.id]);
    if (existingRows.length === 0) {
      return res.status(404).json({ error: 'Optic not found' });
    }

    var existing = parseImageUrls(existingRows[0].image_urls);
    if (!existing.length && existingRows[0].image_url) {
      existing = [existingRows[0].image_url];
    }

    var hasImageUrlsField = Object.prototype.hasOwnProperty.call(req.body, 'image_urls');
    var fromBody = parseImageUrls(req.body.image_urls);
    var uploadedImages = [];
    if (req.files && Array.isArray(req.files.images)) {
      uploadedImages = uploadedImages.concat(req.files.images);
    }
    if (req.files && Array.isArray(req.files.image)) {
      uploadedImages = uploadedImages.concat(req.files.image);
    }
    var uploadedUrls = uploadedImages.map(function (f) { return '/uploads/' + f.filename; });

    var baseImageUrls = hasImageUrlsField ? fromBody : existing;
    var finalImageUrls = normalizeImageUrls(baseImageUrls.concat(uploadedUrls));

    if (finalImageUrls.length < 1 || finalImageUrls.length > 4) {
      return res.status(400).json({ error: 'Each product must have from 1 to 4 images' });
    }
    const stock = in_stock === 'false' || in_stock === false ? 0 : 1;
    const discountVal = discount != null && discount !== '' ? Math.min(100, Math.max(0, parseInt(discount, 10) || 0)) : null;
    const [result] = await req.db.execute(
      `UPDATE optics SET name = ?, style = ?, category_id = ?, brand_id = ?, image_url = ?, image_urls = ?, price = ?, description = ?, in_stock = ?, discount = ?, gender = ? WHERE id = ?`,
      [name, style, category_id, brand_id, finalImageUrls[0], JSON.stringify(finalImageUrls), price || null, description || null, stock, discountVal, genderValue, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Optic not found' });
    }
    const [rows] = await req.db.execute(getOpticsQuery('WHERE o.id = ?', []), [req.params.id]);
    res.json(toOpticResponse(rows[0]));
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
