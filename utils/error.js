function errorPayload(err, fallback) {
  if (process.env.DEBUG_ERRORS === 'true') {
    var message = err && err.message ? err.message : fallback;
    var code = err && err.code ? err.code : undefined;
    return code ? { error: message, code } : { error: message };
  }
  return { error: fallback };
}

module.exports = { errorPayload };
