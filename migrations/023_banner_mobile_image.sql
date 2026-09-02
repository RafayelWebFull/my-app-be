-- Optional mobile-specific banner artwork. Existing image_url remains the desktop image.
SET @has_mobile_image = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'banners'
    AND COLUMN_NAME = 'mobile_image_url'
);
SET @sql_mobile_image = IF(
  @has_mobile_image = 0,
  'ALTER TABLE banners ADD COLUMN mobile_image_url VARCHAR(500) NULL AFTER image_url',
  'SELECT 1'
);
PREPARE stmt_mobile_image FROM @sql_mobile_image;
EXECUTE stmt_mobile_image;
DEALLOCATE PREPARE stmt_mobile_image;
