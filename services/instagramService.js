var fs = require('fs');
var path = require('path');

var INSTAGRAM_GRAPH_BASE = 'https://graph.instagram.com';
var GOOGLE_TRANSLATE_API = 'https://translate.googleapis.com/translate_a/single';

function getAccessToken() {
  var token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) {
    throw new Error('INSTAGRAM_ACCESS_TOKEN is not configured');
  }
  return token;
}

function getFileExtension(mediaUrl, mediaType) {
  try {
    var url = new URL(mediaUrl);
    var extFromUrl = path.extname(url.pathname);
    if (extFromUrl) return extFromUrl.toLowerCase();
  } catch (err) {
    // Ignore malformed URL and fallback by media type.
  }

  if (mediaType === 'VIDEO') return '.mp4';
  return '.jpg';
}

async function callInstagram(pathname, params) {
  var token = getAccessToken();
  var url = new URL(pathname.replace(/^\//, ''), INSTAGRAM_GRAPH_BASE + '/');
  Object.keys(params || {}).forEach(function (key) {
    if (params[key] == null) return;
    url.searchParams.set(key, String(params[key]));
  });
  url.searchParams.set('access_token', token);

  var response = await fetch(url.toString());
  if (!response.ok) {
    var errorText = await response.text();
    throw new Error('Instagram API error: ' + response.status + ' ' + errorText);
  }
  return response.json();
}

function normalizePermalink(url) {
  if (!url) return '';
  return String(url).trim().replace(/\?.*$/, '').replace(/\/+$/, '').toLowerCase();
}

function extractShortcode(url) {
  if (!url) return null;
  var match = String(url).match(/instagram\.com\/(?:p|reel|tv)\/([^/?#]+)/i);
  return match ? match[1].toLowerCase() : null;
}

async function fetchMediaByLink(postLink) {
  var normalizedInput = normalizePermalink(postLink);
  if (!normalizedInput) {
    throw new Error('Instagram post link is required');
  }

  var requestedShortcode = extractShortcode(normalizedInput);
  var after = null;
  var pageCount = 0;
  var maxPages = 10;
  while (pageCount < maxPages) {
    pageCount += 1;
    var payload = await callInstagram('/me/media', {
      fields: 'id,caption,media_type,media_url,thumbnail_url,timestamp,permalink',
      limit: 25,
      after: after,
    });

    var data = payload && Array.isArray(payload.data) ? payload.data : [];
    for (var i = 0; i < data.length; i++) {
      var item = data[i];
      var normalizedPermalink = normalizePermalink(item.permalink);
      if (normalizedPermalink === normalizedInput) return item;
      if (requestedShortcode && extractShortcode(normalizedPermalink) === requestedShortcode) {
        return item;
      }
    }

    after = payload && payload.paging && payload.paging.cursors && payload.paging.cursors.after
      ? payload.paging.cursors.after
      : null;
    if (!after) break;
  }

  throw new Error('Post not found in connected Instagram account media');
}

async function buildOrderedMedia(media) {
  if (!media || !media.id) {
    throw new Error('Instagram media payload is invalid');
  }

  if (media.media_type !== 'CAROUSEL_ALBUM') {
    var downloadUrl = media.media_url || media.thumbnail_url || null;
    if (!downloadUrl) throw new Error('Post media does not expose downloadable URL');
    return [
      {
        order: 1,
        id: media.id,
        media_type: media.media_type,
        download_url: downloadUrl,
      },
    ];
  }

  var childrenPayload = await callInstagram('/' + media.id + '/children', {
    fields: 'id,media_type,media_url,thumbnail_url',
    limit: 50,
  });
  var children = childrenPayload && Array.isArray(childrenPayload.data) ? childrenPayload.data : [];
  var ordered = [];
  for (var i = 0; i < children.length; i++) {
    var child = children[i];
    var childDownloadUrl = child.media_url || child.thumbnail_url || null;
    if (!childDownloadUrl) continue;
    ordered.push({
      order: i + 1,
      id: child.id,
      media_type: child.media_type,
      download_url: childDownloadUrl,
    });
  }
  if (!ordered.length) {
    throw new Error('Carousel post has no downloadable child media');
  }
  return ordered;
}

async function translateText(text, targetLang) {
  var trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) return '';
  var url = new URL(GOOGLE_TRANSLATE_API);
  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', 'hy');
  url.searchParams.set('tl', targetLang);
  url.searchParams.set('dt', 't');
  url.searchParams.set('q', trimmed);
  var response = await fetch(url.toString());
  if (!response.ok) {
    var errText = await response.text();
    throw new Error('Translation failed: ' + response.status + ' ' + errText);
  }
  var data = await response.json();
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error('Unexpected translation response');
  }
  var translated = '';
  for (var i = 0; i < data[0].length; i++) {
    if (Array.isArray(data[0][i]) && data[0][i][0]) {
      translated += data[0][i][0];
    }
  }
  return translated.trim();
}

async function translateCaptionFromArmenian(captionHy) {
  var hy = typeof captionHy === 'string' ? captionHy.trim() : '';
  if (!hy) return { hy: '', ru: '', en: '' };

  var ru = hy;
  var en = hy;
  try {
    ru = await translateText(hy, 'ru');
  } catch (err) {
    ru = hy;
  }
  try {
    en = await translateText(hy, 'en');
  } catch (err) {
    en = hy;
  }
  return { hy: hy, ru: ru, en: en };
}

async function previewImportFromLink(postLink) {
  var media = await fetchMediaByLink(postLink);
  var orderedMedia = await buildOrderedMedia(media);
  var caption = media.caption || '';
  var translations = await translateCaptionFromArmenian(caption);

  return {
    post: {
      id: media.id,
      permalink: media.permalink,
      media_type: media.media_type,
      timestamp: media.timestamp || null,
    },
    caption_translations: translations,
    media: orderedMedia,
  };
}

async function downloadMediaInOrder(orderedMedia) {
  var uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'instagram');
  await fs.promises.mkdir(uploadDir, { recursive: true });

  var files = [];
  for (var i = 0; i < orderedMedia.length; i++) {
    var item = orderedMedia[i];
    var response = await fetch(item.download_url);
    if (!response.ok) {
      var downloadErrorText = await response.text();
      throw new Error('Failed to download media #' + item.order + ': ' + response.status + ' ' + downloadErrorText);
    }
    var fileExt = getFileExtension(item.download_url, item.media_type);
    var safeId = String(item.id || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '');
    var filename = 'instagram-' + Date.now() + '-' + String(item.order).padStart(2, '0') + '-' + safeId + fileExt;
    var fullPath = path.join(uploadDir, filename);
    var arrayBuffer = await response.arrayBuffer();
    await fs.promises.writeFile(fullPath, Buffer.from(arrayBuffer));
    files.push({
      order: item.order,
      filename: filename,
      absolute_path: fullPath,
      public_url: '/uploads/instagram/' + filename,
    });
  }

  return files;
}

async function publishImport(payload) {
  var preview = await previewImportFromLink(payload.post_link);
  var mediaFiles = await downloadMediaInOrder(preview.media);
  return {
    preview: preview,
    files: mediaFiles,
  };
}

module.exports = {
  previewImportFromLink: previewImportFromLink,
  publishImport: publishImport,
};
