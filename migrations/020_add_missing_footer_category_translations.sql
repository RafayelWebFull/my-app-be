INSERT IGNORE INTO translations (key_name, language_id, translation) VALUES
('eyeglasses', (SELECT id FROM languages WHERE code='en'), 'Eyeglasses'),
('eyeglasses', (SELECT id FROM languages WHERE code='ru'), 'Очки'),
('eyeglasses', (SELECT id FROM languages WHERE code='hy'), 'Ակնոցներ'),
('sunglasses', (SELECT id FROM languages WHERE code='en'), 'Sunglasses'),
('sunglasses', (SELECT id FROM languages WHERE code='ru'), 'Солнцезащитные очки'),
('sunglasses', (SELECT id FROM languages WHERE code='hy'), 'Արևային ակնոցներ'),
('lenses', (SELECT id FROM languages WHERE code='en'), 'Contact Lenses'),
('lenses', (SELECT id FROM languages WHERE code='ru'), 'Контактные линзы'),
('lenses', (SELECT id FROM languages WHERE code='hy'), 'Կոնտակտային լինզաներ');
