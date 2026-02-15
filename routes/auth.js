var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');

router.post('/login', async function (req, res) {
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
    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role,
    };
    req.session.cookie.maxAge = sessionMaxAgeMs;
    res.json({ user: req.session.user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/logout', function (req, res) {
  req.session.destroy();
  res.json({ ok: true });
});

router.get('/me', function (req, res) {
  if (req.session && req.session.user) {
    return res.json(req.session.user);
  }
  res.status(401).json({ error: 'Not authenticated' });
});

module.exports = router;
