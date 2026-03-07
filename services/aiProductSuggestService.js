var AI_PROVIDER = (process.env.AI_PROVIDER || '').trim().toLowerCase();
var AI_API_BASE_URL = process.env.AI_API_BASE_URL || 'https://openrouter.ai/api/v1';
var AI_API_KEY = process.env.AI_API_KEY || '';
var AI_MODEL = process.env.AI_MODEL || '';
var OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
var OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';

function getProvider() {
  if (AI_PROVIDER) return AI_PROVIDER;
  if (AI_API_KEY) return 'openrouter';
  return 'ollama';
}

function getModel(provider) {
  if (AI_MODEL) return AI_MODEL;
  return provider === 'ollama' ? OLLAMA_MODEL : 'openai/gpt-4o-mini';
}

function stripCodeFences(text) {
  if (!text) return '';
  var trimmed = String(text).trim();
  if (!trimmed.startsWith('```')) return trimmed;
  return trimmed
    .replace(/^```[a-zA-Z]*\s*/, '')
    .replace(/\s*```$/, '')
    .trim();
}

function extractJsonObject(text) {
  var cleaned = stripCodeFences(text);
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // fall through and try bracket extraction
  }
  var start = cleaned.indexOf('{');
  var end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI response does not contain JSON object');
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

function toValidGender(value) {
  if (value === 'female' || value === 'male' || value === 'unisex') return value;
  return 'unisex';
}

function firstNonEmpty() {
  for (var i = 0; i < arguments.length; i++) {
    var v = arguments[i];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function normalizeId(value) {
  var n = Number(value);
  if (!Number.isFinite(n)) return null;
  var id = Math.floor(n);
  return id > 0 ? id : null;
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>{}\[\]\\\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickIdByNameHint(list, hint) {
  var target = normalizeText(hint);
  if (!target) return null;
  for (var i = 0; i < list.length; i++) {
    var itemName = normalizeText(list[i].name);
    if (!itemName) continue;
    if (itemName === target) return list[i].id;
  }
  for (var j = 0; j < list.length; j++) {
    var itemName2 = normalizeText(list[j].name);
    if (!itemName2) continue;
    if (itemName2.indexOf(target) !== -1 || target.indexOf(itemName2) !== -1) return list[j].id;
  }
  return null;
}

function pickIdFromTextMention(list, text) {
  var haystack = ' ' + normalizeText(text) + ' ';
  if (!haystack.trim()) return null;
  var best = null;
  for (var i = 0; i < list.length; i++) {
    var name = normalizeText(list[i].name);
    if (!name || name.length < 3) continue;
    if (haystack.indexOf(' ' + name + ' ') !== -1) {
      if (!best || name.length > best.nameLength) {
        best = { id: list[i].id, nameLength: name.length };
      }
    }
  }
  return best ? best.id : null;
}

function buildPrompt(payload) {
  var categories = (payload.categories || []).map(function (c) {
    return { id: c.id, name: c.name };
  });
  var brands = (payload.brands || []).map(function (b) {
    return { id: b.id, name: b.name };
  });

  return [
    'You are a product catalog assistant for an optical store.',
    'Return ONLY valid JSON and no other text.',
    'Task: Suggest product fields from Instagram post content.',
    'Rules:',
    '- Choose category_id only from given categories.',
    '- Choose brand_id only from given brands.',
    '- Also provide category_name and brand_name when possible.',
    '- If unsure brand/category, use null.',
    '- gender must be one of: female, male, unisex.',
    '- Keep descriptions concise and commercial.',
    '',
    'Output JSON schema:',
    '{',
    '  "name": "string",',
    '  "style": "string",',
    '  "gender": "female|male|unisex",',
    '  "category_id": number|null,',
    '  "brand_id": number|null,',
    '  "category_name": "string",',
    '  "brand_name": "string",',
    '  "description_hy": "string",',
    '  "description_ru": "string",',
    '  "description_en": "string"',
    '}',
    '',
    'Post context JSON:',
    JSON.stringify({
      post: payload.post || null,
      media_count: payload.media_count || 0,
      caption_hy: payload.description_hy || '',
      caption_ru: payload.description_ru || '',
      caption_en: payload.description_en || '',
      categories: categories,
      brands: brands,
    }),
  ].join('\n');
}

function buildRepairPrompt(rawText) {
  return [
    'Convert the following text into a valid JSON object only.',
    'Do not add explanations.',
    'Required keys:',
    'name, style, gender, category_id, brand_id, description_hy, description_ru, description_en',
    '',
    'Text:',
    String(rawText || ''),
  ].join('\n');
}

async function callOllama(prompt) {
  var endpoint = OLLAMA_BASE_URL.replace(/\/$/, '') + '/api/generate';
  var response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: prompt,
      stream: false,
    }),
  });
  if (!response.ok) {
    var text = await response.text();
    throw new Error('Ollama error: ' + response.status + ' ' + text);
  }
  var data = await response.json();
  if (!data || typeof data.response !== 'string') {
    throw new Error('Invalid Ollama response');
  }
  return data.response;
}

async function callOpenAICompatible(prompt) {
  if (!AI_API_KEY) {
    throw new Error('AI_API_KEY is not configured');
  }
  var endpoint = AI_API_BASE_URL.replace(/\/$/, '') + '/chat/completions';
  var provider = getProvider();
  var model = getModel(provider);
  var headers = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + AI_API_KEY,
  };
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = process.env.AI_SITE_URL || 'https://opticgallery.am';
    headers['X-Title'] = process.env.AI_APP_NAME || 'opticgallery-admin';
  }

  var response = await fetch(endpoint, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      model: model,
      temperature: 0.2,
      max_tokens: 900,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) {
    var text = await response.text();
    throw new Error('AI API error: ' + response.status + ' ' + text);
  }
  var data = await response.json();
  var content = data
    && data.choices
    && data.choices[0]
    && data.choices[0].message
    && data.choices[0].message.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Invalid AI API response');
  }
  return content;
}

async function callAI(prompt) {
  var provider = getProvider();
  if (provider === 'ollama') {
    return callOllama(prompt);
  }
  return callOpenAICompatible(prompt);
}

async function parseOrRepairJson(raw) {
  try {
    return extractJsonObject(raw);
  } catch (firstErr) {
    var repairedRaw = await callAI(buildRepairPrompt(raw));
    return extractJsonObject(repairedRaw);
  }
}

async function suggestProductFields(payload) {
  if (!payload || !Array.isArray(payload.categories) || !Array.isArray(payload.brands)) {
    throw new Error('Invalid suggestion payload');
  }
  var prompt = buildPrompt(payload);
  var raw = await callAI(prompt);
  var parsed = await parseOrRepairJson(raw);

  var categoryId = normalizeId(parsed.category_id);
  var brandId = normalizeId(parsed.brand_id);
  var categoryNameHint = firstNonEmpty(parsed.category_name, parsed.category, parsed.categoryTitle);
  var brandNameHint = firstNonEmpty(parsed.brand_name, parsed.brand, parsed.brandTitle);
  var sourceText = [
    payload.fallback_name || '',
    payload.description_hy || '',
    payload.description_ru || '',
    payload.description_en || '',
    parsed.name || '',
    parsed.style || '',
    brandNameHint,
    categoryNameHint,
  ].join(' ');

  var allowedCategory = payload.categories.some(function (c) { return c.id === categoryId; });
  var allowedBrand = payload.brands.some(function (b) { return b.id === brandId; });
  if (!allowedCategory) {
    var byCategoryHint = pickIdByNameHint(payload.categories, categoryNameHint);
    if (byCategoryHint) {
      categoryId = byCategoryHint;
      allowedCategory = true;
    }
  }
  if (!allowedBrand) {
    var byBrandHint = pickIdByNameHint(payload.brands, brandNameHint);
    if (byBrandHint) {
      brandId = byBrandHint;
      allowedBrand = true;
    }
  }
  if (!allowedCategory) {
    var categoryMention = pickIdFromTextMention(payload.categories, sourceText);
    if (categoryMention) {
      categoryId = categoryMention;
      allowedCategory = true;
    }
  }
  if (!allowedBrand) {
    var brandMention = pickIdFromTextMention(payload.brands, sourceText);
    if (brandMention) {
      brandId = brandMention;
      allowedBrand = true;
    }
  }

  return {
    name: firstNonEmpty(parsed.name, payload.fallback_name),
    style: firstNonEmpty(parsed.style),
    gender: toValidGender(parsed.gender),
    category_id: allowedCategory ? categoryId : null,
    brand_id: allowedBrand ? brandId : null,
    description_hy: firstNonEmpty(parsed.description_hy, payload.description_hy),
    description_ru: firstNonEmpty(parsed.description_ru, payload.description_ru),
    description_en: firstNonEmpty(parsed.description_en, payload.description_en),
  };
}

function getAiMeta() {
  var provider = getProvider();
  var model = getModel(provider);
  return {
    provider: provider,
    model: model,
    base_url: provider === 'ollama' ? OLLAMA_BASE_URL : AI_API_BASE_URL,
  };
}

module.exports = {
  suggestProductFields: suggestProductFields,
  getAiMeta: getAiMeta,
};
