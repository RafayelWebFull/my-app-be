var express = require('express');
var router = express.Router();
var multer = require('multer');
var path = require('path');
var fs = require('fs');
var sanitizeHtml = require('sanitize-html');
var { requireAdmin } = require('../middleware/auth');
var { errorPayload } = require('../utils/error');

var uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'blog');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

var storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, uploadDir); },
  filename: function (req, file, cb) {
    var extension = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, 'blog-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9) + extension);
  },
});
var upload = multer({
  storage: storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) return cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
    cb(null, true);
  },
});

var allowedHtml = {
  allowedTags: ['p', 'br', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'blockquote', 'ul', 'ol', 'li', 'a', 'hr'],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  transformTags: {
    a: function (tagName, attribs) {
      var external = attribs.target === '_blank';
      return { tagName: 'a', attribs: { href: attribs.href || '#', target: external ? '_blank' : undefined, rel: external ? 'noopener noreferrer' : undefined } };
    },
  },
};

function cleanSlug(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 190);
}

function cleanPost(body) {
  var values = {};
  ['hy', 'ru', 'en'].forEach(function (lang) {
    values['title_' + lang] = String(body['title_' + lang] || '').trim();
    values['excerpt_' + lang] = String(body['excerpt_' + lang] || '').trim();
    values['content_' + lang] = sanitizeHtml(String(body['content_' + lang] || ''), allowedHtml);
    values['cover_image_alt_' + lang] = String(body['cover_image_alt_' + lang] || '').trim();
  });
  values.slug = cleanSlug(body.slug);
  values.category_id = Number(body.category_id);
  values.status = body.status === 'published' ? 'published' : 'draft';
  values.is_featured = body.is_featured === 'true' || body.is_featured === true || body.is_featured === '1' ? 1 : 0;
  values.published_at = body.published_at ? String(body.published_at).replace('T', ' ').slice(0, 19) : null;
  if (values.status === 'published' && !values.published_at) values.published_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
  return values;
}

function validatePost(values) {
  if (!values.slug || !values.category_id) return 'Slug and category are required';
  for (var lang of ['hy', 'ru', 'en']) {
    if (!values['title_' + lang] || !values['excerpt_' + lang] || !values['content_' + lang]) return 'Title, excerpt, and content are required in all languages';
  }
  return null;
}

var postSelect = `SELECT p.*, c.slug AS category_slug,
  c.name_hy AS category_name_hy, c.name_ru AS category_name_ru, c.name_en AS category_name_en
  FROM blog_posts p JOIN blog_categories c ON c.id = p.category_id`;

router.get('/categories', async function (req, res) {
  try {
    const [rows] = await req.db.execute('SELECT * FROM blog_categories ORDER BY name_en');
    res.json(rows);
  } catch (err) { res.status(500).json(errorPayload(err, 'Failed to fetch blog categories')); }
});

router.get('/admin/posts', requireAdmin, async function (req, res) {
  try {
    const [rows] = await req.db.execute(postSelect + ' ORDER BY p.created_at DESC');
    res.json(rows);
  } catch (err) { res.status(500).json(errorPayload(err, 'Failed to fetch blog posts')); }
});

router.get('/', async function (req, res) {
  try {
    var params = [];
    var where = " WHERE p.status = 'published' AND p.published_at <= NOW()";
    if (req.query.category) { where += ' AND c.slug = ?'; params.push(req.query.category); }
    const [rows] = await req.db.execute(postSelect + where + ' ORDER BY p.is_featured DESC, p.published_at DESC', params);
    res.json(rows);
  } catch (err) { res.status(500).json(errorPayload(err, 'Failed to fetch blog posts')); }
});

router.get('/:slug', async function (req, res) {
  try {
    const [rows] = await req.db.execute(postSelect + " WHERE p.slug = ? AND p.status = 'published' AND p.published_at <= NOW() LIMIT 1", [req.params.slug]);
    if (!rows[0]) return res.status(404).json({ error: 'Blog post not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json(errorPayload(err, 'Failed to fetch blog post')); }
});

router.post('/categories', requireAdmin, async function (req, res) {
  try {
    var slug = cleanSlug(req.body.slug);
    var names = ['name_hy', 'name_ru', 'name_en'].map(function (key) { return String(req.body[key] || '').trim(); });
    if (!slug || names.some(function (name) { return !name; })) return res.status(400).json({ error: 'Slug and all translated names are required' });
    const [result] = await req.db.execute('INSERT INTO blog_categories (slug, name_hy, name_ru, name_en) VALUES (?, ?, ?, ?)', [slug].concat(names));
    const [rows] = await req.db.execute('SELECT * FROM blog_categories WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(err && err.code === 'ER_DUP_ENTRY' ? 409 : 500).json(errorPayload(err, 'Failed to create blog category'));
  }
});

router.put('/categories/:id', requireAdmin, async function (req, res) {
  try {
    var slug = cleanSlug(req.body.slug);
    var names = ['name_hy', 'name_ru', 'name_en'].map(function (key) { return String(req.body[key] || '').trim(); });
    if (!slug || names.some(function (name) { return !name; })) return res.status(400).json({ error: 'Slug and all translated names are required' });
    const [result] = await req.db.execute('UPDATE blog_categories SET slug = ?, name_hy = ?, name_ru = ?, name_en = ? WHERE id = ?', [slug].concat(names, [req.params.id]));
    if (!result.affectedRows) return res.status(404).json({ error: 'Blog category not found' });
    const [rows] = await req.db.execute('SELECT * FROM blog_categories WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) { res.status(err && err.code === 'ER_DUP_ENTRY' ? 409 : 500).json(errorPayload(err, 'Failed to update blog category')); }
});

router.delete('/categories/:id', requireAdmin, async function (req, res) {
  try {
    const [result] = await req.db.execute('DELETE FROM blog_categories WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Blog category not found' });
    res.status(204).send();
  } catch (err) {
    var status = err && err.code === 'ER_ROW_IS_REFERENCED_2' ? 409 : 500;
    res.status(status).json(errorPayload(err, status === 409 ? 'Category is used by a blog post' : 'Failed to delete blog category'));
  }
});

router.post('/admin/posts', requireAdmin, upload.single('cover_image'), async function (req, res) {
  try {
    var values = cleanPost(req.body);
    var validation = validatePost(values);
    if (validation) return res.status(400).json({ error: validation });
    var columns = ['category_id', 'slug', 'title_hy', 'title_ru', 'title_en', 'excerpt_hy', 'excerpt_ru', 'excerpt_en', 'content_hy', 'content_ru', 'content_en', 'cover_image_url', 'cover_image_alt_hy', 'cover_image_alt_ru', 'cover_image_alt_en', 'status', 'is_featured', 'published_at'];
    var data = columns.map(function (key) { return key === 'cover_image_url' ? (req.file ? '/uploads/blog/' + req.file.filename : null) : values[key]; });
    const [result] = await req.db.execute('INSERT INTO blog_posts (' + columns.join(', ') + ') VALUES (' + columns.map(function () { return '?'; }).join(', ') + ')', data);
    const [rows] = await req.db.execute(postSelect + ' WHERE p.id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(err && err.code === 'ER_DUP_ENTRY' ? 409 : 500).json(errorPayload(err, 'Failed to create blog post')); }
});

router.put('/admin/posts/:id', requireAdmin, upload.single('cover_image'), async function (req, res) {
  try {
    var values = cleanPost(req.body);
    var validation = validatePost(values);
    if (validation) return res.status(400).json({ error: validation });
    var cover = req.file ? '/uploads/blog/' + req.file.filename : String(req.body.cover_image_url || '').trim() || null;
    var columns = ['category_id', 'slug', 'title_hy', 'title_ru', 'title_en', 'excerpt_hy', 'excerpt_ru', 'excerpt_en', 'content_hy', 'content_ru', 'content_en', 'cover_image_alt_hy', 'cover_image_alt_ru', 'cover_image_alt_en', 'status', 'is_featured', 'published_at'];
    var data = columns.map(function (key) { return values[key]; });
    data.push(cover, req.params.id);
    const [result] = await req.db.execute('UPDATE blog_posts SET ' + columns.map(function (key) { return key + ' = ?'; }).join(', ') + ', cover_image_url = ? WHERE id = ?', data);
    if (!result.affectedRows) return res.status(404).json({ error: 'Blog post not found' });
    const [rows] = await req.db.execute(postSelect + ' WHERE p.id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) { res.status(err && err.code === 'ER_DUP_ENTRY' ? 409 : 500).json(errorPayload(err, 'Failed to update blog post')); }
});

router.delete('/admin/posts/:id', requireAdmin, async function (req, res) {
  try {
    const [result] = await req.db.execute('DELETE FROM blog_posts WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Blog post not found' });
    res.status(204).send();
  } catch (err) { res.status(500).json(errorPayload(err, 'Failed to delete blog post')); }
});

module.exports = router;
