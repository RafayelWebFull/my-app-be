#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function seedFrontendTranslations() {
  console.log('Seeding frontend translations from JSON...');
  await db.execute("SET NAMES 'utf8mb4'");
  await db.execute("SET CHARACTER SET utf8mb4");

  const jsonPath = path.join(__dirname, '..', 'seed-data', 'frontend-translations.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Missing file: ${jsonPath}`);
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  const [langRows] = await db.execute('SELECT id, code FROM languages WHERE is_active = TRUE');
  const langMap = new Map(langRows.map((r) => [r.code, r.id]));

  const supported = ['en', 'ru', 'hy'].filter((l) => langMap.has(l));
  if (supported.length === 0) {
    throw new Error('No active languages found in DB');
  }

  for (const [key, values] of Object.entries(data)) {
    for (const lang of supported) {
      const value = values[lang];
      if (!value) continue;
      const languageId = langMap.get(lang);
      await db.execute(
        'INSERT INTO translations (key_name, language_id, translation) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE translation = VALUES(translation)',
        [key, languageId, value]
      );
    }
  }

  console.log('Done.');
  process.exit(0);
}

seedFrontendTranslations().catch((e) => {
  console.error(e);
  process.exit(1);
});
