-- Ensure UTF-8 for multilingual content
SET NAMES utf8mb4;

-- Create languages table
CREATE TABLE IF NOT EXISTS languages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(10) CHARACTER SET utf8mb4 UNIQUE NOT NULL,
  name VARCHAR(50) CHARACTER SET utf8mb4 NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create translations table
CREATE TABLE IF NOT EXISTS translations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  key_name VARCHAR(255) CHARACTER SET utf8mb4 NOT NULL,
  language_id INT NOT NULL,
  translation TEXT CHARACTER SET utf8mb4 NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (language_id) REFERENCES languages(id),
  UNIQUE KEY unique_key_language (key_name, language_id)
);

-- Insert supported languages
INSERT IGNORE INTO languages (code, name) VALUES 
('en', 'English'),
('ru', 'Russian'),
('hy', 'Armenian');

-- Insert English translations
INSERT IGNORE INTO translations (key_name, language_id, translation) VALUES 
('welcome', (SELECT id FROM languages WHERE code='en'), 'Welcome'),
('home', (SELECT id FROM languages WHERE code='en'), 'Home'),
('about', (SELECT id FROM languages WHERE code='en'), 'About'),
('contact', (SELECT id FROM languages WHERE code='en'), 'Contact'),
('login', (SELECT id FROM languages WHERE code='en'), 'Login'),
('register', (SELECT id FROM languages WHERE code='en'), 'Register'),
('logout', (SELECT id FROM languages WHERE code='en'), 'Logout'),
('dashboard', (SELECT id FROM languages WHERE code='en'), 'Dashboard'),
('settings', (SELECT id FROM languages WHERE code='en'), 'Settings'),
('profile', (SELECT id FROM languages WHERE code='en'), 'Profile'),
('username', (SELECT id FROM languages WHERE code='en'), 'Username'),
('password', (SELECT id FROM languages WHERE code='en'), 'Password'),
('email', (SELECT id FROM languages WHERE code='en'), 'Email'),
('submit', (SELECT id FROM languages WHERE code='en'), 'Submit'),
('cancel', (SELECT id FROM languages WHERE code='en'), 'Cancel'),
('save', (SELECT id FROM languages WHERE code='en'), 'Save'),
('delete', (SELECT id FROM languages WHERE code='en'), 'Delete'),
('edit', (SELECT id FROM languages WHERE code='en'), 'Edit'),
('view', (SELECT id FROM languages WHERE code='en'), 'View'),
('search', (SELECT id FROM languages WHERE code='en'), 'Search'),
('results', (SELECT id FROM languages WHERE code='en'), 'Results'),
('no_results', (SELECT id FROM languages WHERE code='en'), 'No results found'),
('loading', (SELECT id FROM languages WHERE code='en'), 'Loading...'),
('error', (SELECT id FROM languages WHERE code='en'), 'Error'),
('success', (SELECT id FROM languages WHERE code='en'), 'Success'),
('please_wait', (SELECT id FROM languages WHERE code='en'), 'Please wait...'),
('confirm_delete', (SELECT id FROM languages WHERE code='en'), 'Are you sure you want to delete?'),
('yes', (SELECT id FROM languages WHERE code='en'), 'Yes'),
('no', (SELECT id FROM languages WHERE code='en'), 'No'),
('close', (SELECT id FROM languages WHERE code='en'), 'Close'),
('open', (SELECT id FROM languages WHERE code='en'), 'Open');