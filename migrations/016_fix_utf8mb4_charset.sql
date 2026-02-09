-- Fix UTF-8 charset for existing databases with corrupted Cyrillic/Armenian (???)
-- Run this if Russian/Armenian text displays as ???
-- After running migrations, run: node scripts/seed-translations.js

SET NAMES utf8mb4;

-- Convert tables to utf8mb4
ALTER TABLE languages CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE translations CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Clear corrupted data for re-seed
TRUNCATE TABLE translations;
