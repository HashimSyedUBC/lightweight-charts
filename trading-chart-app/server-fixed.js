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
app.get('/api/aggregates/:ticker/:from/:to', (req, res) => {
  const { ticker, from, to } = req.params;
  const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/minute/${from}/${to}?apiKey=${POLYGON_API_KEY}&sort=asc&limit=50000`;
  https.get(url, (polygonRes) => {
    let data = '';
    polygonRes.on('data', (chunk) => (data += chunk));
    polygonRes.on('end', () => {
      try {
        const json = JSON.parse(data);
        res.status(polygonRes.statusCode || 200).json(json);
      } catch (err) {
        console.error('[REST] JSON parse error:', err);
        res.status(500).json({ error: 'JSON parse error' });
      }
    });
  }).on('error', (err) => {
    console.error('[REST] HTTPS error:', err);
    res.status(500).json({ error: 'Network error' });
  });
});

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
