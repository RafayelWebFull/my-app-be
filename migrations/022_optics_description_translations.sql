ALTER TABLE optics
  ADD COLUMN IF NOT EXISTS description_en TEXT NULL AFTER description,
  ADD COLUMN IF NOT EXISTS description_ru TEXT NULL AFTER description_en,
  ADD COLUMN IF NOT EXISTS description_hy TEXT NULL AFTER description_ru;
