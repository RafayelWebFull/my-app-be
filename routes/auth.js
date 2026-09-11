var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');
var rateLimit = require('express-rate-limit');

var loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts. Please try again later.' },
});

router.post('/login', loginLimiter, async function (req, res) {
  try {
    const sessionMaxAgeMs = Number(process.env.SESSION_MAX_AGE_MS || 7 * 24 * 60 * 60 * 1000);
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    const [rows] = await req.db.execute(
      'SELECT id, username, password_hash, role FROM users WHERE username = ?',
      [username]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    req.session.regenerate(function (regenerateErr) {
      if (regenerateErr) {
        console.error('Session regeneration error:', regenerateErr);
        return res.status(500).json({ error: 'Login failed' });
      }
      req.session.user = {
        id: user.id,
        username: user.username,
        role: user.role,
      };
      req.session.cookie.maxAge = sessionMaxAgeMs;
      req.session.save(function (saveErr) {
        if (saveErr) {
          console.error('Session save error:', saveErr);
          return res.status(500).json({ error: 'Login failed' });
        }
        res.json({ user: req.session.user });
      });
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/logout', function (req, res) {
  req.session.destroy(function (err) {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.clearCookie('connect.sid', {
      httpOnly: true,
      sameSite: process.env.COOKIE_SAMESITE || 'lax',
      secure: process.env.NODE_ENV === 'production',
      domain: process.env.COOKIE_DOMAIN || undefined,
    });
    res.json({ ok: true });
  });
});

router.get('/me', function (req, res) {
  if (req.session && req.session.user) {
    return res.json(req.session.user);
  }
  res.status(401).json({ error: 'Not authenticated' });
});

module.exports = router;
