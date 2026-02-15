ALTER TABLE optics
ADD COLUMN gender ENUM('male', 'female', 'unisex') NOT NULL DEFAULT 'unisex';

