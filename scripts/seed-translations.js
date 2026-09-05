#!/usr/bin/env node
/**
 * Re-seed translations after charset fix.
 * Run after migrations/016_fix_utf8mb4_charset.sql
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

const TRANSLATION_MIGRATIONS = [
  '002_insert_armenian_translations.sql',
  '003_insert_russian_translations.sql',
  '007_site_settings_stock_translations.sql',
  '008_insert_content_translations_ru_hy.sql',
  '010_discount_translation.sql',
  '012_banner_translations.sql',
  '025_blog_navigation_translation.sql',
];

async function seedTranslations() {
  console.log('Re-seeding translations with UTF-8...');
  await db.execute("SET NAMES 'utf8mb4'");
  await db.execute("SET CHARACTER SET utf8mb4");

  const migrationsDir = path.join(__dirname, '..', 'migrations');
  for (const file of TRANSLATION_MIGRATIONS) {
    const filePath = path.join(migrationsDir, file);
    if (!fs.existsSync(filePath)) continue;
    console.log('Running:', file);
    const sql = fs.readFileSync(filePath, 'utf8');
    const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      if (stmt) {
        try {
          await db.execute(stmt);
        } catch (e) {
          if (!e.message.includes('Duplicate')) console.error(e.message);
        }
      }
    }
  }
  console.log('Done.');
  process.exit(0);
}
seedTranslations().catch((e) => {
  console.error(e);
  process.exit(1);
});
