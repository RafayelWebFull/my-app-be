CREATE TABLE IF NOT EXISTS site_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

ALTER TABLE optics ADD COLUMN in_stock BOOLEAN DEFAULT TRUE;

INSERT IGNORE INTO site_settings (setting_key, setting_value) VALUES 
('hero_image', ''),
('hero_title', 'Discover Premium Eyewear'),
('hero_subtitle', 'Quality glasses and expert service in the heart of the city'),
('contact_phone', '+374 XX XXX XXX'),
('contact_instagram', '@opticgallery.am'),
('contact_map_embed', 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d97459.36117797645!2d44.43373!3d40.17712!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x406abd2ad0420d43%3A0x5c7825e2d8e72100!2sYerevan%2C%20Armenia!5e0!3m2!1sen!2s!4v1704067200000!5m2!1sen!2s');

INSERT IGNORE INTO translations (key_name, language_id, translation) VALUES 
('premiumBrands', (SELECT id FROM languages WHERE code='en'), 'Premium Brands'),
('qualityDesc', (SELECT id FROM languages WHERE code='en'), 'We offer only the finest optical brands trusted worldwide'),
('expertService', (SELECT id FROM languages WHERE code='en'), 'Expert Service'),
('serviceDesc', (SELECT id FROM languages WHERE code='en'), 'Our specialists help you find the perfect fit'),
('modernDesign', (SELECT id FROM languages WHERE code='en'), 'Modern Design'),
('styleDesc', (SELECT id FROM languages WHERE code='en'), 'Trendy frames and timeless classics'),
('heroTitle', (SELECT id FROM languages WHERE code='en'), 'Discover Premium Eyewear'),
('heroSubtitle', (SELECT id FROM languages WHERE code='en'), 'Quality glasses and expert service in the heart of the city'),
('visitStore', (SELECT id FROM languages WHERE code='en'), 'Visit Our Store'),
('contactUs', (SELECT id FROM languages WHERE code='en'), 'Contact Us'),
('addressValue', (SELECT id FROM languages WHERE code='en'), 'Yerevan, Armenia'),
('aboutTitle', (SELECT id FROM languages WHERE code='en'), 'About Optic Gallery'),
('aboutText1', (SELECT id FROM languages WHERE code='en'), 'We are a premium optical store offering the finest eyewear and expert service.'),
('aboutText2', (SELECT id FROM languages WHERE code='en'), 'Our team of specialists is dedicated to helping you find the perfect fit for your lifestyle.'),
('contactTitle', (SELECT id FROM languages WHERE code='en'), 'Visit Us'),
('workingHours', (SELECT id FROM languages WHERE code='en'), 'Working Hours'),
('workingHoursValue', (SELECT id FROM languages WHERE code='en'), 'Mon-Sat: 10:00 - 20:00'),
('sunday', (SELECT id FROM languages WHERE code='en'), 'Sunday: Closed'),
('address', (SELECT id FROM languages WHERE code='en'), 'Address'),
('phone', (SELECT id FROM languages WHERE code='en'), 'Phone'),
('quality', (SELECT id FROM languages WHERE code='en'), 'Quality'),
('service', (SELECT id FROM languages WHERE code='en'), 'Service'),
('style', (SELECT id FROM languages WHERE code='en'), 'Style'),
('ourProducts', (SELECT id FROM languages WHERE code='en'), 'Our Products'),
('productsSubtitle', (SELECT id FROM languages WHERE code='en'), 'Explore our collection of premium eyewear'),
('viewCollection', (SELECT id FROM languages WHERE code='en'), 'View Collection'),
('inStock', (SELECT id FROM languages WHERE code='en'), 'In Stock'),
('outOfStock', (SELECT id FROM languages WHERE code='en'), 'Out of Stock');
