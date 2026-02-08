INSERT IGNORE INTO translations (key_name, language_id, translation) VALUES 
('discountOff', (SELECT id FROM languages WHERE code='en'), 'OFF'),
('discountOff', (SELECT id FROM languages WHERE code='ru'), 'СКИДКА'),
('discountOff', (SELECT id FROM languages WHERE code='hy'), 'ԶԻՆՉՈՒՄ');
