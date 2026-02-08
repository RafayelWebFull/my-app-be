-- Create optics table for optical products (eyeglasses, sunglasses, lenses)
CREATE TABLE IF NOT EXISTS optics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(255) NOT NULL,
  style VARCHAR(255) NOT NULL,
  category ENUM('eyeglasses', 'sunglasses', 'lenses') NOT NULL DEFAULT 'eyeglasses',
  image_url VARCHAR(500) DEFAULT NULL,
  price DECIMAL(10, 2) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
