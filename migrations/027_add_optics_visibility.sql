ALTER TABLE optics ADD COLUMN is_visible TINYINT(1) NOT NULL DEFAULT 1 AFTER in_stock;
ALTER TABLE optics ADD INDEX idx_optics_visibility (is_visible);
