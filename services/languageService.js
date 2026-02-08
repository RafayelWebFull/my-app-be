const db = require('../config/db');

class LanguageService {
  constructor() {
    this.supportedLanguages = ['en', 'ru', 'hy'];
    this.defaultLanguage = 'en';
    this.translationsCache = new Map(); // Cache translations in memory
    this.lastUpdateTime = 0;
  }

  // Get all supported languages from database
  async getSupportedLanguages() {
    try {
      const [rows] = await db.execute('SELECT code, name, is_active FROM languages WHERE is_active = TRUE ORDER BY name');
      this.supportedLanguages = rows.map(row => row.code);
      return this.supportedLanguages;
    } catch (error) {
      console.error('Error fetching supported languages:', error);
      return ['en', 'ru', 'hy']; // fallback to default
    }
  }

  // Get translations for a specific language from database
  async getTranslationsForLanguage(langCode) {
    try {
      const [languageRows] = await db.execute(
        'SELECT id FROM languages WHERE code = ? AND is_active = TRUE',
        [langCode]
      );

      if (languageRows.length === 0) {
        return {};
      }

      const languageId = languageRows[0].id;

      const [translationRows] = await db.execute(`
        SELECT key_name, translation 
        FROM translations 
        WHERE language_id = ?
      `, [languageId]);

      const translations = {};
      translationRows.forEach(row => {
        translations[row.key_name] = row.translation;
      });

      return translations;
    } catch (error) {
      console.error(`Error fetching translations for ${langCode}:`, error);
      return {};
    }
  }

  // Get a specific translation
  async getTranslation(key, lang = this.defaultLanguage) {
    // Ensure language is supported
    if (!this.supportedLanguages.includes(lang)) {
      lang = this.defaultLanguage;
    }

    // Check cache first
    if (!this.translationsCache.has(lang)) {
      await this.loadTranslationsForLanguage(lang);
    }

    const translations = this.translationsCache.get(lang);
    const translation = translations && translations[key];

    return translation || key; // Return key if translation not found
  }

  // Load translations for a specific language into cache
  async loadTranslationsForLanguage(lang) {
    const translations = await this.getTranslationsForLanguage(lang);
    this.translationsCache.set(lang, translations);
  }

  // Refresh all translations in cache
  async refreshAllTranslations() {
    const languages = await this.getSupportedLanguages();
    for (const lang of languages) {
      await this.loadTranslationsForLanguage(lang);
    }
  }

  // Add or update a translation in the database
  async setTranslation(key, lang, translationText) {
    try {
      // Get language ID
      const [languageRows] = await db.execute(
        'SELECT id FROM languages WHERE code = ?',
        [lang]
      );

      if (languageRows.length === 0) {
        throw new Error(`Language ${lang} not found`);
      }

      const languageId = languageRows[0].id;

      // Insert or update translation
      const [result] = await db.execute(`
        INSERT INTO translations (key_name, language_id, translation) 
        VALUES (?, ?, ?) 
        ON DUPLICATE KEY UPDATE translation = ?
      `, [key, languageId, translationText, translationText]);

      // Clear cache for this language to force refresh
      this.translationsCache.delete(lang);
      
      return result;
    } catch (error) {
      console.error(`Error setting translation for ${key} in ${lang}:`, error);
      throw error;
    }
  }

  // Get all translations for a language as a flat object
  async getAllTranslations(lang) {
    if (!this.translationsCache.has(lang)) {
      await this.loadTranslationsForLanguage(lang);
    }
    return this.translationsCache.get(lang) || {};
  }
}

module.exports = new LanguageService();