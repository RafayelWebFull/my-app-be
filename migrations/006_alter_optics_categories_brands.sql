ALTER TABLE optics ADD COLUMN IF NOT EXISTS category_id INT NULL AFTER style;
ALTER TABLE optics ADD COLUMN IF NOT EXISTS brand_id INT NULL AFTER category_id;

-- NOTE: Legacy data migration from old columns (category, brand) is intentionally skipped here
-- because this migration runs on every deploy. If you still have legacy columns, migrate once manually.

UPDATE optics SET category_id = 2 WHERE category_id IS NULL;
UPDATE optics SET brand_id = (SELECT id FROM brands LIMIT 1) WHERE brand_id IS NULL AND (SELECT COUNT(*) FROM brands) > 0;

ALTER TABLE optics DROP COLUMN IF EXISTS category;
ALTER TABLE optics DROP COLUMN IF EXISTS brand;
ALTER TABLE optics MODIFY category_id INT NOT NULL;
ALTER TABLE optics MODIFY brand_id INT NOT NULL;
ALTER TABLE optics ADD CONSTRAINT fk_optics_category FOREIGN KEY (category_id) REFERENCES categories(id);
ALTER TABLE optics ADD CONSTRAINT fk_optics_brand FOREIGN KEY (brand_id) REFERENCES brands(id);
