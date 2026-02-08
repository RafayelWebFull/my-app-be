var express = require('express');
var router = express.Router();
var crypto = require('crypto');

function generateOrderNumber() {
  return 'OG-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();
}

router.post('/', async function (req, res) {
  try {
    const { customer_name, customer_email, customer_phone, delivery_address, notes, items, total_amount } = req.body;
    if (!customer_name || !customer_email || !customer_phone || !delivery_address || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'name, email, phone, address, and items required' });
    }
    const total = parseFloat(total_amount);
    if (isNaN(total) || total < 0) {
      return res.status(400).json({ error: 'Invalid total amount' });
    }
    const orderNumber = generateOrderNumber();
    const [result] = await req.db.execute(
      'INSERT INTO orders (order_number, customer_name, customer_email, customer_phone, delivery_address, notes, items_json, total_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [orderNumber, customer_name, customer_email, customer_phone, delivery_address, notes || null, JSON.stringify(items), total]
    );
    res.status(201).json({ id: result.insertId, order_number: orderNumber });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

module.exports = router;
