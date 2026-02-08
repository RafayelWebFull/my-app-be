INSERT IGNORE INTO translations (key_name, language_id, translation) VALUES 
('bannerValidFrom', (SELECT id FROM languages WHERE code='en'), 'Valid from'),
('bannerValidTo', (SELECT id FROM languages WHERE code='en'), 'to'),
('bannerValidFrom', (SELECT id FROM languages WHERE code='ru'), 'Действует с'),
('bannerValidTo', (SELECT id FROM languages WHERE code='ru'), 'по'),
('bannerValidFrom', (SELECT id FROM languages WHERE code='hy'), 'Գործում է'),
('bannerValidTo', (SELECT id FROM languages WHERE code='hy'), 'մինչև');
