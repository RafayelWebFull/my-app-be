var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.json({
    message: req.t('welcome'),
    language: req.language,
    supportedLanguages: ['en', 'ru']
  });
});

/* GET available languages */
router.get('/languages', function(req, res, next) {
  res.json({
    supportedLanguages: ['en', 'ru'],
    currentLanguage: req.language,
    translations: {
      welcome: req.t('welcome'),
      home: req.t('home'),
      about: req.t('about'),
      contact: req.t('contact'),
      login: req.t('login'),
      register: req.t('register')
    }
  });
});

module.exports = router;
