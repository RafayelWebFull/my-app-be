CREATE TABLE IF NOT EXISTS home_category_cards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  background VARCHAR(500) NULL,
  icon VARCHAR(20) NOT NULL DEFAULT 'glasses',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sort (sort_order)
);

INSERT IGNORE INTO home_category_cards (title, slug, background, icon, sort_order) VALUES
('Sunglasses', 'sunglasses', 'linear-gradient(135deg, rgb(29, 153, 165) 0%, rgb(51, 178, 204) 100%)', 'sun', 0),
('Optic / Eyeglasses', 'optic', 'linear-gradient(135deg, rgb(29, 54, 88) 0%, rgb(49, 103, 129) 100%)', 'glasses', 1),
('Contact Lenses', 'lenses', 'linear-gradient(135deg, rgb(42, 88, 111) 0%, rgb(34, 182, 195) 100%)', 'eye', 2);
