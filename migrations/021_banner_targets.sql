-- Add optional target for banner discounts: all products, a brand, or a specific optic.

SET @has_target_type = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'banners'
    AND COLUMN_NAME = 'target_type'
);
SET @sql_target_type = IF(
  @has_target_type = 0,
  "ALTER TABLE banners ADD COLUMN target_type ENUM('all','brand','optic') NOT NULL DEFAULT 'all'",
  'SELECT 1'
);
PREPARE stmt_target_type FROM @sql_target_type;
EXECUTE stmt_target_type;
DEALLOCATE PREPARE stmt_target_type;

SET @has_target_id = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'banners'
    AND COLUMN_NAME = 'target_id'
);
SET @sql_target_id = IF(
  @has_target_id = 0,
  'ALTER TABLE banners ADD COLUMN target_id INT NULL',
  'SELECT 1'
);
PREPARE stmt_target_id FROM @sql_target_id;
EXECUTE stmt_target_id;
DEALLOCATE PREPARE stmt_target_id;

SET @has_target_idx = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'banners'
    AND INDEX_NAME = 'idx_banner_target'
);
SET @sql_target_idx = IF(
  @has_target_idx = 0,
  'ALTER TABLE banners ADD INDEX idx_banner_target (target_type, target_id)',
  'SELECT 1'
);
PREPARE stmt_target_idx FROM @sql_target_idx;
EXECUTE stmt_target_idx;
DEALLOCATE PREPARE stmt_target_idx;
