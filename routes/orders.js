var express = require('express');
var router = express.Router();
var crypto = require('crypto');
var rateLimit = require('express-rate-limit');

var orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many orders from this address. Please try again later.' },
});

function generateOrderNumber() {
  return 'OG-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();
}

router.post('/', orderLimiter, async function (req, res) {
  try {
    const { customer_name, customer_email, customer_phone, delivery_address, notes, items } = req.body;
    if (
      typeof customer_name !== 'string' || !customer_name.trim() ||
      typeof customer_email !== 'string' || !customer_email.trim() ||
      typeof customer_phone !== 'string' || !customer_phone.trim() ||
      typeof delivery_address !== 'string' || !delivery_address.trim() ||
      !Array.isArray(items) || items.length === 0 || items.length > 100
    ) {
      return res.status(400).json({ error: 'name, email, phone, address, and items required' });
    }
    const cleanName = customer_name.trim();
    const cleanEmail = customer_email.trim().toLowerCase();
    const cleanPhone = customer_phone.trim();
    const cleanAddress = delivery_address.trim();
    const cleanNotes = notes == null ? null : String(notes).trim();
    if (cleanName.length > 120 || cleanEmail.length > 254 || cleanPhone.length > 50 || cleanAddress.length > 500 || (cleanNotes && cleanNotes.length > 2000)) {
      return res.status(400).json({ error: 'One or more customer fields are too long' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    const quantities = new Map();
    for (const item of items) {
      const id = Number(item && item.id);
      const quantity = Number(item && item.quantity);
      if (!Number.isInteger(id) || id < 1 || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
        return res.status(400).json({ error: 'Invalid order item' });
      }
      quantities.set(id, (quantities.get(id) || 0) + quantity);
      if (quantities.get(id) > 99) {
        return res.status(400).json({ error: 'Maximum quantity per product is 99' });
      }
    }
    const ids = Array.from(quantities.keys());
    const placeholders = ids.map(function () { return '?'; }).join(',');
    const [products] = await req.db.execute(
      `SELECT o.id, o.name, o.style, o.image_url, o.price, o.discount, o.in_stock, o.is_visible,
        b.name AS brand_name,
        (SELECT MAX(bn.discount_percent) FROM banners bn
          WHERE CURDATE() BETWEEN bn.start_date AND bn.end_date
            AND (bn.target_type = 'all'
              OR (bn.target_type = 'brand' AND bn.target_id = o.brand_id)
              OR (bn.target_type = 'optic' AND bn.target_id = o.id))) AS banner_discount
       FROM optics o LEFT JOIN brands b ON b.id = o.brand_id
       WHERE o.id IN (${placeholders})`,
      ids
    );
    if (products.length !== ids.length) {
      return res.status(400).json({ error: 'One or more products are unavailable' });
    }
    const orderItems = [];
    let total = 0;
    for (const product of products) {
      if (!product.is_visible || !product.in_stock) {
        return res.status(400).json({ error: `${product.name} is unavailable` });
      }
      const price = Number(product.price);
      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({ error: `${product.name} has no valid price` });
      }
      const discount = Math.min(100, Math.max(0, Number(product.discount) || 0, Number(product.banner_discount) || 0));
      const quantity = quantities.get(Number(product.id));
      const lineTotal = Math.round(price * (1 - discount / 100) * quantity * 100) / 100;
      total += lineTotal;
      orderItems.push({
        id: product.id,
        name: product.name,
        brand_name: product.brand_name,
        style: product.style,
        image_url: product.image_url,
        quantity,
        price,
        discount: discount || null,
        total: lineTotal,
      });
    }
    total = Math.round(total * 100) / 100;
    const orderNumber = generateOrderNumber();
    const [result] = await req.db.execute(
      'INSERT INTO orders (order_number, customer_name, customer_email, customer_phone, delivery_address, notes, items_json, total_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [orderNumber, cleanName, cleanEmail, cleanPhone, cleanAddress, cleanNotes || null, JSON.stringify(orderItems), total]
    );
    res.status(201).json({ id: result.insertId, order_number: orderNumber });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

module.exports = router;
