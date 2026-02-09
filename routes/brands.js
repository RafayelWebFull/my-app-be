var express = require('express');
var router = express.Router();
var { requireAdmin } = require('../middleware/auth');
var { errorPayload } = require('../utils/error');

router.get('/', async function (req, res) {
  try {
    const [rows] = await req.db.execute('SELECT * FROM brands ORDER BY name');
    res.json(rows);
  } catch (err) {
    console.error('Error fetching brands:', err);
    res.status(500).json(errorPayload(err, 'Failed to fetch brands'));
  }
});

router.post('/', requireAdmin, async function (req, res) {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name required' });
    }
    const [result] = await req.db.execute('INSERT INTO brands (name) VALUES (?)', [name.trim()]);
    const [rows] = await req.db.execute('SELECT * FROM brands WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Brand already exists' });
    }
    console.error('Error creating brand:', err);
    res.status(500).json(errorPayload(err, 'Failed to create brand'));
  }
});

router.put('/:id', requireAdmin, async function (req, res) {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name required' });
    }
    const [result] = await req.db.execute('UPDATE brands SET name = ? WHERE id = ?', [
      name.trim(),
      req.params.id,
    ]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Brand not found' });
    }
    const [rows] = await req.db.execute('SELECT * FROM brands WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Brand already exists' });
    }
    console.error('Error updating brand:', err);
    res.status(500).json(errorPayload(err, 'Failed to update brand'));
  }
});

router.delete('/:id', requireAdmin, async function (req, res) {
  try {
    const [result] = await req.db.execute('DELETE FROM brands WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Brand not found' });
    }
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting brand:', err);
    res.status(500).json(errorPayload(err, 'Failed to delete brand'));
  }
});

module.exports = router;
