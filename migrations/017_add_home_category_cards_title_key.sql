-- Add translation key for home category card titles
ALTER TABLE home_category_cards
  ADD COLUMN title_key VARCHAR(255) NULL AFTER title;
