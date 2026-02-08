var express = require('express');
var router = express.Router();
var languageManager = require('../utils/language');

/* GET home page. */
router.get('/', async function(req, res, next) {
  // Note: For Jade templates, we use the sync version of the translation function
  // which was prepared in the middleware
  const supportedLanguages = await languageManager.getSupportedLanguages();
  
  res.render('index', { 
    title: req.t.sync('welcome'),
    currentLanguage: req.language,
    supportedLanguages: supportedLanguages,
    t: req.t.sync
  });
});

/* GET language switch */
router.get('/lang/:lang', async function(req, res, next) {
  const lang = req.params.lang;
  const supportedLanguages = await languageManager.getSupportedLanguages();
  
  if (supportedLanguages.includes(lang)) {
    // In a real app, you might set this in session or cookie
    res.cookie('language', lang, { maxAge: 900000, httpOnly: true });
    res.redirect('back');
  } else {
    res.status(400).send('Invalid language');
  }
});

/* GET translations API */
router.get('/api/translations/:lang?', async function(req, res, next) {
  const lang = req.params.lang || req.query.lang || req.language || 'en';
  const supportedLanguages = await languageManager.getSupportedLanguages();
  
  if (!supportedLanguages.includes(lang)) {
    return res.status(400).json({ error: 'Invalid language' });
  }
  
  const translations = await languageManager.getAllTranslations(lang);
  
  res.json({
    language: lang,
    translations: translations || {}
  });
});

module.exports = router;
