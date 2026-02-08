var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session');

// Database connection
require('dotenv').config();
const dbConnection = require('./config/db');

// Language manager
const languageManager = require('./utils/language');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var opticsRouter = require('./routes/optics');
var authRouter = require('./routes/auth');
var categoriesRouter = require('./routes/categories');
var brandsRouter = require('./routes/brands');
var siteSettingsRouter = require('./routes/siteSettings');
var adminTranslationsRouter = require('./routes/adminTranslations');
var bannersRouter = require('./routes/banners');
var ordersRouter = require('./routes/orders');
var homeCategoryCardsRouter = require('./routes/homeCategoryCards');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'optice-gallery-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

// Serve static files from both public and frontend build directories
app.use(express.static(path.join(__dirname, 'public')));

// Serve built frontend files if they exist
try {
  const frontendDistPath = path.join(__dirname, '..', 'my-app-fe', 'dist');
  if (require('fs').existsSync(frontendDistPath)) {
    app.use(express.static(frontendDistPath));
  }
} catch (err) {
  console.log('Frontend build directory not found, skipping static serving');
}

// Make database connection available to routes
// Make database connection available to routes
app.use((req, res, next) => {
  req.db = dbConnection;
  next();
});

// Language detection middleware
app.use(async (req, res, next) => {
  // Detect language from query param, header, or default to 'en'
  let lang = req.query.lang || req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'en';
  
  // Get supported languages (async)
  const supportedLanguages = await languageManager.getSupportedLanguages();
  
  // Validate language
  if (!supportedLanguages.includes(lang)) {
    lang = languageManager.getDefaultLanguage();
  }
  
  req.language = lang;
  
  // Create async translation function
  req.t = async (key, params = {}) => {
    return await languageManager.getTranslation(key, lang, params);
  };
  
  // Synchronous version for templates that don't support async
  req.t.sync = (key, params = {}) => {
    // This creates a temporary synchronous wrapper - not ideal but works for Jade templates
    let result;
    languageManager.getTranslation(key, lang, params).then(translated => {
      result = translated;
    }).catch(() => {
      result = key;
    });
    return result || key;
  };
  
  // Make language available in views
  res.locals.currentLanguage = lang;
  res.locals.t = req.t.sync;
  
  // Make translations available globally for API
  req.translations = await languageManager.getAllTranslations(lang);
  
  next();
});

app.use('/api/auth', authRouter);
app.use('/api/optics', opticsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/brands', brandsRouter);
app.use('/api/site-settings', siteSettingsRouter);
app.use('/api/admin/translations', adminTranslationsRouter);
app.use('/api/banners', bannersRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/home-category-cards', homeCategoryCardsRouter);
app.use('/', indexRouter);
app.use('/users', usersRouter);

// Serve frontend files for all non-API routes
app.get(/^(?!\/api).*$/, (req, res, next) => {
  try {
    const frontendDistPath = path.join(__dirname, '..', 'my-app-fe', 'dist', 'index.html');
    const fs = require('fs');
    
    if (fs.existsSync(frontendDistPath)) {
      res.sendFile(frontendDistPath);
    } else {
      // If frontend build doesn't exist, continue with normal routing
      next(createError(404));
    }
  } catch (err) {
    next(createError(404));
  }
});

// catch 404 and forward to error handler for API routes
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
