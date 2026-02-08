var express = require('express');
var router = express.Router();
var { requireAdmin } = require('../middleware/auth');
var languageService = require('../services/languageService');

router.get('/keys', async function (req, res) {
  try {
    const [rows] = await req.db.execute(
      'SELECT DISTINCT key_name FROM translations ORDER BY key_name'
    );
    res.json(rows.map((r) => r.key_name));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch keys' });
  }
});

router.get('/:lang', async function (req, res) {
  try {
    const translations = await languageService.getTranslationsForLanguage(req.params.lang);
    res.json(translations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch translations' });
  }
});

router.put('/:key/:lang', requireAdmin, async function (req, res) {
  try {
    const { key, lang } = req.params;
    const { value } = req.body;
    if (!value) return res.status(400).json({ error: 'value required' });
    await languageService.setTranslation(key, lang, value);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update translation' });
  }
});

module.exports = router;
