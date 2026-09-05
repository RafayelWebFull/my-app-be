CREATE TABLE IF NOT EXISTS blog_categories (
  id INT NOT NULL AUTO_INCREMENT,
  slug VARCHAR(160) NOT NULL,
  name_hy VARCHAR(255) NOT NULL,
  name_ru VARCHAR(255) NOT NULL,
  name_en VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_blog_categories_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS blog_posts (
  id INT NOT NULL AUTO_INCREMENT,
  category_id INT NOT NULL,
  slug VARCHAR(190) NOT NULL,
  title_hy VARCHAR(255) NOT NULL,
  title_ru VARCHAR(255) NOT NULL,
  title_en VARCHAR(255) NOT NULL,
  excerpt_hy TEXT NOT NULL,
  excerpt_ru TEXT NOT NULL,
  excerpt_en TEXT NOT NULL,
  content_hy LONGTEXT NOT NULL,
  content_ru LONGTEXT NOT NULL,
  content_en LONGTEXT NOT NULL,
  cover_image_url VARCHAR(1000) DEFAULT NULL,
  cover_image_alt_hy VARCHAR(500) DEFAULT NULL,
  cover_image_alt_ru VARCHAR(500) DEFAULT NULL,
  cover_image_alt_en VARCHAR(500) DEFAULT NULL,
  status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
  is_featured TINYINT(1) NOT NULL DEFAULT 0,
  published_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_blog_posts_slug (slug),
  KEY idx_blog_posts_public (status, published_at),
  KEY idx_blog_posts_category (category_id),
  CONSTRAINT fk_blog_posts_category FOREIGN KEY (category_id) REFERENCES blog_categories(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO blog_categories (slug, name_hy, name_ru, name_en) VALUES
('frames', 'Շրջանակներ', 'Оправы', 'Frames'),
('lenses', 'Ոսպնյակներ', 'Линзы', 'Lenses'),
('vision', 'Տեսողություն', 'Зрение', 'Vision'),
('brands', 'Բրենդներ', 'Бренды', 'Brands');
