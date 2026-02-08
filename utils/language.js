const languageService = require('../services/languageService');

class LanguageManager {
  constructor() {
    this.defaultLanguage = 'en';
  }

  async getTranslation(key, lang = this.defaultLanguage, params = {}) {
    // Fallback to default language if requested language doesn't exist
    const translation = await languageService.getTranslation(key, lang);
    
    if (!translation) {
      return key; // Return the key itself if translation not found
    }

    // Simple parameter substitution
    let result = translation;
    Object.keys(params).forEach(param => {
      result = result.replace(new RegExp(`{{${param}}}`, 'g'), params[param]);
    });

    return result;
  }

  async getSupportedLanguages() {
    return await languageService.getSupportedLanguages();
  }

  getDefaultLanguage() {
    return this.defaultLanguage;
  }

  async getAllTranslations(lang) {
    return await languageService.getAllTranslations(lang);
  }
}

module.exports = new LanguageManager();