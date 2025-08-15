const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const https = require('https');
require('dotenv').config();

const app = express();
const PORT = 8090;
const POLYGON_API_KEY = process.env.POLYGON_API_KEY;

app.use(cors());
app.use(express.json());

// REST proxy for aggregates
// Helper to perform HTTPS GET returning parsed JSON
function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (r) => {
        let data = '';
        r.on('data', (chunk) => (data += chunk));
        r.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve({ statusCode: r.statusCode || 200, json });
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', (e) => reject(e));
  });
}

// REST proxy for aggregates (dynamic interval via timespan/multiplier)
// Handler function for aggregates endpoint
const handleAggregates = async (req, res) => {
  const { ticker, from, to } = req.params;
  const { timespan, multiplier } = req.query;

  // Validate inputs
  const fromSec = parseInt(from, 10);
  const toSec = parseInt(to, 10);
  if (!ticker || !Number.isFinite(fromSec) || !Number.isFinite(toSec) || toSec <= fromSec) {
    return res.status(400).json({ error: 'Invalid params' });
  }

  try {
    const m = Math.max(1, parseInt(String(multiplier || '1'), 10));
    const span = String(timespan || 'minute').toLowerCase();
    const valid = new Set(['second', 'minute', 'hour', 'day', 'week', 'month', 'quarter', 'year']);
    const spanFinal = valid.has(span) ? span : 'minute';
    const fromMs = fromSec * 1000;
    const toMs = toSec * 1000;
    
    console.log(`[REST] Fetching ${ticker} data: ${spanFinal} bars from ${new Date(fromMs).toISOString()} to ${new Date(toMs).toISOString()}`);
    
    const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(
      ticker
    )}/range/${m}/${spanFinal}/${fromMs}/${toMs}?apiKey=${POLYGON_API_KEY}&sort=asc&limit=50000`;
    const { statusCode, json } = await httpsGetJson(url);
    
    const resultCount = json?.results?.length || 0;
    console.log(`[REST] Returning ${resultCount} data points for ${ticker} (${spanFinal} bars)`);
    
    return res.status(statusCode).json(json);
  } catch (err) {
    console.error('[REST] Aggregates error:', err.message || err);
    return res.status(502).json({ error: 'Upstream error', detail: String(err.message || err) });
  }
};

// Route with /api prefix (for direct calls)
app.get('/api/aggregates/:ticker/:from/:to', handleAggregates);

// Route without /api prefix (for proxied calls from React dev server)
app.get('/aggregates/:ticker/:from/:to', handleAggregates);

const server = app.listen(PORT, () => {
  console.log(`[REST] Proxy server running on http://localhost:${PORT}`);
});

// WS proxy
const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', (clientWs) => {

  const polygonWs = new WebSocket('wss://delayed.polygon.io/stocks');

  let isAuthed = false;
  const pendingSubs = new Set(); // queue subs until auth completes

  const sendSub = (channel) => {
    if (isAuthed && polygonWs.readyState === WebSocket.OPEN) {
      const msg = { action: 'subscribe', params: channel };
      polygonWs.send(JSON.stringify(msg));
    } else {
      pendingSubs.add(channel);
    }
  };

  polygonWs.on('open', () => {
    polygonWs.send(JSON.stringify({ action: 'auth', params: POLYGON_API_KEY }));
  });

  polygonWs.on('message', (raw) => {
    // forward everything to client
    if (clientWs.readyState === WebSocket.OPEN) clientWs.send(raw);

    // detect auth_success to flush queued subs
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        for (const evt of arr) {
          if (evt.ev === 'status' && evt.status === 'auth_success') {
            isAuthed = true;
            // flush
            for (const ch of pendingSubs) {
              const msg = { action: 'subscribe', params: ch };
              polygonWs.send(JSON.stringify(msg));
            }
            pendingSubs.clear();
          }
        }
      }
    } catch {}
  });

  polygonWs.on('error', (e) => console.error('[WS] Polygon error:', e.message));
  polygonWs.on('close', () => clientWs.close());

  clientWs.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.ticker) {
        // pick what you want to see:
        // Minute bars (slower): `AM.${ticker}`
        // Per-second bars: `A.${ticker}`
        // Trades (fastest): `T.${ticker}`
        sendSub(`A.${data.ticker}`);   // or `AM.${data.ticker}` / `T.${data.ticker}`
      }
    } catch (e) {
      console.error('[WS] Bad client JSON:', e.message);
    }
  });

  clientWs.on('close', () => {
    if (polygonWs.readyState === WebSocket.OPEN) polygonWs.close();
  });
});
