var express = require('express');
var router = express.Router();

var cache = null;
var lastFetchMs = 0;
var CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchFromPrimary() {
  var res = await fetch('https://open.er-api.com/v6/latest/AMD');
  if (!res.ok) throw new Error('Primary source failed');
  var data = await res.json();
  if (!data || data.result !== 'success' || !data.rates) {
    throw new Error('Primary source invalid response');
  }
  if (typeof data.rates.USD !== 'number' || typeof data.rates.RUB !== 'number') {
    throw new Error('Primary source missing USD/RUB');
  }
  return {
    usd: data.rates.USD,
    rub: data.rates.RUB,
    updated_at: new Date().toISOString(),
    source: 'open.er-api.com',
  };
}

async function refreshRatesIfNeeded(force) {
  var now = Date.now();
  if (!force && now - lastFetchMs < CACHE_TTL_MS && cache) {
    return cache;
  }

  try {
    cache = await fetchFromPrimary();
    lastFetchMs = now;
    return cache;
  } catch (primaryErr) {
    if (cache) {
      return cache;
    }
    throw primaryErr;
  }
}

router.get('/', async function (req, res) {
  try {
    var rates = await refreshRatesIfNeeded(false);
    res.json(rates);
  } catch (err) {
    console.error('Failed to fetch exchange rates:', err);
    res.status(500).json({ error: 'Failed to fetch exchange rates' });
  }
});

module.exports = router;
