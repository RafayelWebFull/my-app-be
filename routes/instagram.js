var express = require('express');
var router = express.Router();
var instagramService = require('../services/instagramService');
var aiProductSuggestService = require('../services/aiProductSuggestService');
var requireAdmin = require('../middleware/auth').requireAdmin;

function toNumberOrNull(raw) {
  if (raw == null || raw === '') return null;
  var n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseGender(raw) {
  if (raw === 'male' || raw === 'female' || raw === 'unisex') return raw;
  return 'unisex';
}

router.post('/preview', requireAdmin, async function (req, res) {
  try {
    var postLink = req.body && req.body.post_link ? String(req.body.post_link).trim() : '';
    if (!postLink) {
      return res.status(400).json({ error: 'post_link is required' });
    }
    var preview = await instagramService.previewImportFromLink(postLink);
    res.json(preview);
  } catch (err) {
    console.error('Instagram preview failed:', err);
    res.status(500).json({ error: err.message || 'Failed to preview Instagram post' });
  }
});

router.post('/publish', requireAdmin, async function (req, res) {
  try {
    var body = req.body || {};
    var postLink = body.post_link ? String(body.post_link).trim() : '';
    var name = body.name ? String(body.name).trim() : '';
    var style = body.style ? String(body.style).trim() : '';
    var categoryId = Number.parseInt(body.category_id, 10);
    var brandId = Number.parseInt(body.brand_id, 10);
    var gender = parseGender(body.gender);
    var inStock = body.in_stock === false || body.in_stock === 'false' ? 0 : 1;
    var discount = toNumberOrNull(body.discount);
    var discountValue = discount == null ? null : Math.max(0, Math.min(100, Math.floor(discount)));
    var captionHyOverride = typeof body.description_hy === 'string' ? body.description_hy.trim() : '';
    var captionRuOverride = typeof body.description_ru === 'string' ? body.description_ru.trim() : '';
    var captionEnOverride = typeof body.description_en === 'string' ? body.description_en.trim() : '';

    if (!postLink || !name || !categoryId || !brandId) {
      return res.status(400).json({ error: 'post_link, name, category_id, brand_id are required' });
    }

    var imported = await instagramService.publishImport({ post_link: postLink });
    var imageUrls = imported.files.map(function (file) { return file.public_url; });
    if (!imageUrls.length) {
      return res.status(500).json({ error: 'Instagram import produced no images' });
    }

    var translations = imported.preview.caption_translations || { hy: '', ru: '', en: '' };
    var hy = captionHyOverride || translations.hy || '';
    var ru = captionRuOverride || translations.ru || '';
    var en = captionEnOverride || translations.en || '';
    var legacyDescription = en || ru || hy || null;

    const [insertResult] = await req.db.execute(
      `INSERT INTO optics (name, style, category_id, brand_id, image_url, image_urls, price, description, description_en, description_ru, description_hy, in_stock, discount, gender)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, style, categoryId, brandId, imageUrls[0], JSON.stringify(imageUrls), null, legacyDescription, en || null, ru || null, hy || null, inStock, discountValue, gender]
    );

    const [rows] = await req.db.execute(
      `SELECT o.*, c.name as category_name, c.slug as category_slug, b.name as brand_name
       FROM optics o
       LEFT JOIN categories c ON o.category_id = c.id
       LEFT JOIN brands b ON o.brand_id = b.id
       WHERE o.id = ?`,
      [insertResult.insertId]
    );

    res.status(201).json({
      optic: rows[0],
      imported_media: imported.files,
      instagram_post: imported.preview.post,
    });
  } catch (err) {
    console.error('Instagram publish failed:', err);
    res.status(500).json({ error: err.message || 'Failed to publish imported Instagram post' });
  }
});

router.post('/suggest-fields', requireAdmin, async function (req, res) {
  try {
    var body = req.body || {};
    var postLink = body.post_link ? String(body.post_link).trim() : '';
    if (!postLink) {
      return res.status(400).json({ error: 'post_link is required' });
    }

    var preview = body.preview && body.preview.post && body.preview.caption_translations
      ? body.preview
      : await instagramService.previewImportFromLink(postLink);
    var captions = preview.caption_translations || { hy: '', ru: '', en: '' };

    const [categories] = await req.db.execute('SELECT id, name FROM categories ORDER BY id');
    const [brands] = await req.db.execute('SELECT id, name FROM brands ORDER BY name');

    var suggestion = await aiProductSuggestService.suggestProductFields({
      post: preview.post || null,
      media_count: Array.isArray(preview.media) ? preview.media.length : 0,
      description_hy: typeof body.description_hy === 'string' && body.description_hy.trim()
        ? body.description_hy.trim()
        : (captions.hy || ''),
      description_ru: typeof body.description_ru === 'string' && body.description_ru.trim()
        ? body.description_ru.trim()
        : (captions.ru || ''),
      description_en: typeof body.description_en === 'string' && body.description_en.trim()
        ? body.description_en.trim()
        : (captions.en || ''),
      fallback_name: typeof body.name === 'string' ? body.name.trim() : '',
      categories: categories,
      brands: brands,
    });

    res.json({
      suggestion: suggestion,
      meta: aiProductSuggestService.getAiMeta(),
    });
  } catch (err) {
    console.error('Instagram AI suggestion failed:', err);
    res.status(500).json({
      error: err.message || 'Failed to generate AI field suggestions',
      hint: 'Configure AI_PROVIDER/AI_API_KEY for external API or run local Ollama',
    });
  }
});

module.exports = router;
