var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session');
var cors = require('cors');
var optimizedUploads = require('./middleware/optimizedUploads');

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
var exchangeRatesRouter = require('./routes/exchangeRates');
var instagramRouter = require('./routes/instagram');

var app = express();

// Trust the first proxy (needed for secure cookies behind cPanel/NGINX)
app.set('trust proxy', 1);

// CORS for frontend (domain list + localhost for dev)
var allowedOrigins = [
  'https://opticgallery.am',
  'https://www.opticgallery.am',
  'http://opticgallery.am',
  'http://www.opticgallery.am',
];
if (process.env.FRONTEND_ORIGIN) {
  var frontendOrigins = process.env.FRONTEND_ORIGIN.split(',').map(function (s) { return s.trim(); });
  allowedOrigins = allowedOrigins.concat(frontendOrigins);
}
if (process.env.CORS_ORIGINS) {
  var corsOrigins = process.env.CORS_ORIGINS.split(',').map(function (s) { return s.trim(); });
  allowedOrigins = allowedOrigins.concat(corsOrigins);
}
function normalizeOrigin(origin) {
  if (!origin) return '';
  return origin.trim().replace(/\/$/, '').toLowerCase();
}

var allowedOriginsNormalized = allowedOrigins
  .map(function (o) { return normalizeOrigin(o); })
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  var normalized = normalizeOrigin(origin);
  if (allowedOriginsNormalized.indexOf(normalized) !== -1) return true;
  if (/^https?:\/\/([a-z0-9-]+\.)?opticgallery\.am(?::\d+)?$/i.test(normalized)) return true;
  if (/^https?:\/\/([a-z0-9-]+\.)?vercel\.app(?::\d+)?$/i.test(normalized)) return true;
  return false;
}

var corsOptions = {
  origin: function (origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    console.warn('CORS blocked origin:', origin);
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
var hasConfiguredCrossOrigin = Boolean(process.env.FRONTEND_ORIGIN || process.env.CORS_ORIGINS);
var sessionMaxAgeMs = Number(process.env.SESSION_MAX_AGE_MS || 7 * 24 * 60 * 60 * 1000);

// SameSite=None is only for real cross-site HTTPS (e.g. opticgallery.am → api.opticgallery.am).
// Local Vite proxy is same-site HTTP — None without Secure makes browsers drop the cookie,
// so login "works" until reload.
function resolveCookieSameSite() {
  var explicit = (process.env.COOKIE_SAMESITE || '').toLowerCase();
  if (explicit === 'none' || explicit === 'lax' || explicit === 'strict') {
    return explicit;
  }
  if (!hasConfiguredCrossOrigin) return 'lax';
  var configured = []
    .concat((process.env.FRONTEND_ORIGIN || '').split(','))
    .concat((process.env.CORS_ORIGINS || '').split(','))
    .map(function (s) { return s.trim().toLowerCase(); })
    .filter(Boolean);
  var needsCrossSite = configured.some(function (o) {
    return o.indexOf('https://') === 0
      && o.indexOf('localhost') === -1
      && o.indexOf('127.0.0.1') === -1;
  });
  return needsCrossSite ? 'none' : 'lax';
}

var cookieSameSite = resolveCookieSameSite();

app.use(session({
  proxy: true,
  secret: process.env.SESSION_SECRET || 'optice-gallery-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: 'auto',
    httpOnly: true,
    maxAge: sessionMaxAgeMs,
    sameSite: cookieSameSite,
    domain: process.env.COOKIE_DOMAIN || undefined
  }
}));

// Serve responsive WebP variants when `?w=` is requested, while preserving the
// original upload URL as a fallback for old clients and direct links.
var uploadsPath = path.join(__dirname, 'public', 'uploads');
app.get('/api/image', optimizedUploads(uploadsPath));
app.use('/uploads', optimizedUploads(uploadsPath));
app.use('/uploads', express.static(uploadsPath, {
  maxAge: '1y',
  immutable: true,
}));

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
app.use('/api/exchange-rates', exchangeRatesRouter);
app.use('/api/instagram', instagramRouter);
app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler for API routes
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  console.error(err); // important: shows in cPanel logs

  res.status(err.status || 500).json({
    error: true,
    message: err.message || "Internal Server Error"
  });
});

module.exports = app;
