INSERT INTO translations (key_name, language_id, translation) VALUES
('blog', (SELECT id FROM languages WHERE code = 'en'), 'Blog'),
('blog', (SELECT id FROM languages WHERE code = 'ru'), 'Блог'),
('blog', (SELECT id FROM languages WHERE code = 'hy'), 'Բլոգ')
ON DUPLICATE KEY UPDATE translation = VALUES(translation);
