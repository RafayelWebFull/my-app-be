require('dotenv').config();
const db = require('../config/db');

const BRANDS = ['Ray-Ban', 'Oakley', 'Gucci', 'Prada', 'Tom Ford', 'Persol', 'Maui Jim', 'Carrera', 'Dolce & Gabbana', 'Armani'];

const STYLES = {
  sunglasses: ['Aviator', 'Wayfarer', 'Clubmaster', 'Round', 'Cat-Eye', 'Oversized', 'Sport', 'Pilot', 'Retro', 'Polarized', 'Metal Frame', 'Acetate', 'Wrap', 'Shield', 'Square'],
  optic: ['Round', 'Rectangle', 'Oval', 'Cat-Eye', 'Aviator', 'Clubmaster', 'Wayfarer', 'Square', 'Geometric', 'Rimless', 'Half-Rim', 'Browline', 'Pilot', 'Classic', 'Modern'],
  lenses: ['Daily Disposable', 'Monthly', 'Two-Week', 'Toric', 'Multifocal', 'Colored', 'UV Protection', 'Moisture', 'Comfort', 'Breathable', 'Thin', 'HydraGel', 'Air Optix', 'Biofinity', 'Proclear'],
};

const OPTIC_NAMES = ['RB3025', 'RB5154', 'RB5228', 'RX5228', 'RX6330', 'RX6448', 'Clubmaster', 'Round Metal', 'Aviator Classic', 'Wayfarer II', 'Hexagonal', 'Hex Flat', 'Cateye Premium', 'Pilot Metal', 'Browline Ace'];
const SUNGLASSES_NAMES = ['Aviator Gold', 'Wayfarer Black', 'Clubmaster Tortoise', 'Flak 2.0', 'Holbrook', 'Frogskins', 'Pit Boss', 'Crossrange', 'Jawbreaker', 'Radar EV', 'Prizm Polarized', 'Batwolf', 'M Frame', 'Half Jacket', 'Fuel Cell'];
const LENSES_NAMES = ['Air Optix Aqua', 'Biofinity', 'Proclear 1 Day', 'Dailies AquaComfort', 'Acuvue Oasys', 'Biotrue ONEday', 'MyDay', 'Clariti 1 Day', 'Avaira Vitality', 'Biotrue', 'Proclear Multifocal', 'Air Optix Multifocal', 'Acuvue Vita', 'Biofinity Toric', 'Ultra'];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPrice(min, max) {
  return (Math.random() * (max - min) + min).toFixed(2);
}

async function seed() {
  console.log('Seeding fake data...');
  try {
    // Get category IDs
    const [cats] = await db.execute('SELECT id, slug FROM categories');
    const catMap = {};
    cats.forEach((c) => { catMap[c.slug] = c.id; });
    const opticId = catMap.optic || 2;
    const sunglassesId = catMap.sunglasses || 1;
    const lensesId = catMap.lenses || 3;

    // Ensure brands exist
    for (const b of BRANDS) {
      await db.execute('INSERT IGNORE INTO brands (name) VALUES (?)', [b]);
    }
    const [brandRows] = await db.execute('SELECT id FROM brands');
    const brandIds = brandRows.map((r) => r.id);

    // Products per category
    const productsPerCategory = 52;

    // Sunglasses
    for (let i = 0; i < productsPerCategory; i++) {
      const brandId = pick(brandIds);
      const name = pick(SUNGLASSES_NAMES) + ' ' + (i % 10 === 0 ? 'Limited' : '');
      const style = pick(STYLES.sunglasses);
      const price = randomPrice(80, 350);
      const discount = Math.random() < 0.25 ? Math.floor(Math.random() * 40) + 10 : null;
      const inStock = Math.random() < 0.9 ? 1 : 0;
      await db.execute(
        'INSERT INTO optics (name, style, category_id, brand_id, image_url, price, description, in_stock, discount) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)',
        [name, style, sunglassesId, brandId, price, 'Premium quality sunglasses. UV protection. Polarized lens available.', inStock, discount]
      );
    }

    // Optic / Eyeglasses
    for (let i = 0; i < productsPerCategory; i++) {
      const brandId = pick(brandIds);
      const name = pick(OPTIC_NAMES) + ' ' + (i % 8 === 0 ? 'Pro' : '');
      const style = pick(STYLES.optic);
      const price = randomPrice(120, 450);
      const discount = Math.random() < 0.2 ? Math.floor(Math.random() * 35) + 10 : null;
      const inStock = Math.random() < 0.92 ? 1 : 0;
      await db.execute(
        'INSERT INTO optics (name, style, category_id, brand_id, image_url, price, description, in_stock, discount) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)',
        [name, style, opticId, brandId, price, 'Classic eyeglasses. Anti-reflective coating. Lightweight frame.', inStock, discount]
      );
    }

    // Lenses
    for (let i = 0; i < productsPerCategory; i++) {
      const brandId = pick(brandIds);
      const name = pick(LENSES_NAMES) + ' ' + (i % 6 === 0 ? 'Plus' : '');
      const style = pick(STYLES.lenses);
      const price = randomPrice(25, 120);
      const discount = Math.random() < 0.3 ? Math.floor(Math.random() * 30) + 5 : null;
      const inStock = Math.random() < 0.95 ? 1 : 0;
      await db.execute(
        'INSERT INTO optics (name, style, category_id, brand_id, image_url, price, description, in_stock, discount) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)',
        [name, style, lensesId, brandId, price, 'Comfortable contact lenses. Breathable material. Long-lasting.', inStock, discount]
      );
    }

    console.log(`Inserted ${productsPerCategory * 3} products`);

    // Banners
    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const banners = [
      { title: '50% Off Sunglasses', description: 'Summer sale on selected sunglasses. Limited time offer!', discount: 50, daysOffset: 0 },
      { title: 'March 8 Special', description: 'Celebrate Women\'s Day with 30% off on eyewear. Valid until March 10.', discount: 30, daysOffset: 5 },
      { title: 'New Collection 2025', description: 'Discover our latest optical frames and lenses. Free shipping on orders over $100.', discount: 20, daysOffset: 10 },
    ];

    for (let i = 0; i < banners.length; i++) {
      const b = banners[i];
      const start = new Date(today);
      start.setDate(start.getDate() + b.daysOffset);
      const end = new Date(start);
      end.setDate(end.getDate() + 14);
      const startStr = start.toISOString().slice(0, 10);
      const endStr = end.toISOString().slice(0, 10);
      await db.execute(
        'INSERT INTO banners (title, description, start_date, end_date, discount_percent) VALUES (?, ?, ?, ?, ?)',
        [b.title, b.description, startStr, endStr, b.discount]
      );
    }

    console.log('Inserted 3 banners');
    console.log('Done!');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

seed();
