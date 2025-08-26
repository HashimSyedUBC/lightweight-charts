const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const https = require('https');
require('dotenv').config();

const app = express();
const PORT = 8090;
const POLYGON_API_KEY = "pq5ffTZcNHPaYs0KCjLpuxxGo7ZSbqEE";;

// Market configuration
const MARKET_CONFIG = {
  stocks: { 
    url: 'wss://delayed.polygon.io/stocks',
    channels: { second: 'A.', minute: 'AM.' },
    symbolPrefix: ''
  },
  crypto: { 
    url: 'wss://socket.polygon.io/crypto',
    channels: { second: 'XAS.', minute: 'XA.' },
    symbolPrefix: 'X:'
  },
  forex: { 
    url: 'wss://socket.polygon.io/forex',
    channels: { second: 'CAS.', minute: 'CA.' },
    symbolPrefix: 'C:'
  },
  indices: { 
    url: 'wss://socket.polygon.io/indices',
    channels: { second: 'A.', minute: 'AM.' },
    symbolPrefix: 'I:'
  }
};

app.use(cors());
app.use(express.json());

// Simple request logging middleware
app.use((req, res, next) => {
  next();
});

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
  const { timespan, multiplier, market } = req.query;

  // Validate and normalize time inputs (accept seconds OR milliseconds)
  const fromNum = Number(from);
  const toNum = Number(to);
  if (!ticker || !Number.isFinite(fromNum) || !Number.isFinite(toNum)) {
    return res.status(400).json({ error: 'Invalid params' });
  }

  // If values look like ms (>= 1e12), use as-is; otherwise treat as seconds.
  const MS_THRESHOLD = 1e12;
  const fromMs = fromNum >= MS_THRESHOLD ? fromNum : fromNum * 1000;
  const toMs = toNum >= MS_THRESHOLD ? toNum : toNum * 1000;
  if (toMs <= fromMs) {
    return res.status(400).json({ error: 'Invalid range: to must be greater than from' });
  }
  
  // Use Unix timestamps directly for precise time ranges
  const fromSec = Math.floor(fromMs / 1000);
  const toSec = Math.floor(toMs / 1000);

  // DEBUG: Print timestamp conversion details
  console.log(`[DEBUG] Timestamp conversion for ${ticker}:`);
  console.log(`[DEBUG] Input from: ${from} (${typeof from})`);
  console.log(`[DEBUG] Input to: ${to} (${typeof to})`);
  console.log(`[DEBUG] fromSec: ${fromSec}, toSec: ${toSec}`);
  console.log(`[DEBUG] fromTime: ${new Date(fromMs).toISOString()} (${new Date(fromMs).toLocaleString('en-US', {timeZone: 'America/New_York'})} EST)`);
  console.log(`[DEBUG] toTime: ${new Date(toMs).toISOString()} (${new Date(toMs).toLocaleString('en-US', {timeZone: 'America/New_York'})} EST)`);

  try {
    const m = Math.max(1, parseInt(String(multiplier || '1'), 10));
    const span = String(timespan || 'minute').toLowerCase();
    const valid = new Set(['second', 'minute', 'hour', 'day', 'week', 'month', 'quarter', 'year']);
    const spanFinal = valid.has(span) ? span : 'minute';

    // Infer market from ticker prefix if not explicitly provided
    const rawTicker = String(ticker);
    let marketType = String(market || '').toLowerCase();
    if (!marketType) {
      if (rawTicker.startsWith('X:')) marketType = 'crypto';
      else if (rawTicker.startsWith('C:')) marketType = 'forex';
      else if (rawTicker.startsWith('I:')) marketType = 'indices';
      else marketType = 'stocks';
    }

    const marketConfig = MARKET_CONFIG[marketType] || MARKET_CONFIG.stocks;
    // Only add a prefix if the ticker isn't already prefixed
    const prefixedTicker = rawTicker.includes(':')
      ? rawTicker
      : (marketConfig.symbolPrefix || '') + rawTicker;

    const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(prefixedTicker)}/range/${m}/${spanFinal}/${fromSec}/${toSec}?apiKey=${POLYGON_API_KEY}&sort=asc&limit=50000`;


    const { statusCode, json } = await httpsGetJson(url);
    // DEBUG: Show first and last data points with timestamps
    if (json.results && json.results.length > 0) {
      const first = json.results[0];
      const last = json.results[json.results.length - 1];
      console.log(`[DEBUG] First result timestamp: ${first.t} (${new Date(first.t).toISOString()}) (${new Date(first.t).toLocaleString('en-US', {timeZone: 'America/New_York'})} EST)`);
      console.log(`[DEBUG] Last result timestamp: ${last.t} (${new Date(last.t).toISOString()}) (${new Date(last.t).toLocaleString('en-US', {timeZone: 'America/New_York'})} EST)`);
      console.log(`[DEBUG] Total results: ${json.results.length}`);
    }
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

// WS proxy — multi-user, no frontend changes
const wss = new WebSocket.Server({ server, path: '/ws' });

// Map Polygon event -> subscribe prefix per market
const EVENT_PREFIX = {
  stocks:  { A: 'A.',  AM: 'AM.' },
  indices: { A: 'A.',  AM: 'AM.' },
  crypto:  { XAS: 'XAS.', XA: 'XA.' },
  forex:   { CAS: 'CAS.', CA: 'CA.' }
};

class ClusterHub {
  constructor(marketKey, cfg, apiKey) {
    this.marketKey = marketKey;
    this.cfg = cfg;
    this.apiKey = apiKey;

    this.ws = null;
    this.isAuthed = false;
    this.shouldReconnect = false;
    this.backoffMs = 1000;

    // Routing tables
    this.subs = new Map();       // key -> Set<client>
    this.clientKeys = new Map(); // client -> Set<key>
    this.pendingMsgs = [];       // queue until auth
  }

  _connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
          return;
    }
    this.shouldReconnect = true;
    const url = this.cfg.url;
    const ws = new WebSocket(url);
    this.ws = ws;
    this.isAuthed = false;

    ws.on('open', () => {
      const authMsg = { action: 'auth', params: this.apiKey };
      ws.send(JSON.stringify(authMsg));
    });

    ws.on('message', (raw) => {
      let arr;
      try { arr = JSON.parse(raw); } catch { 
        return; 
      }
      if (!Array.isArray(arr)) {
        return;
      }

      // Handle auth and flush queued messages
      for (const evt of arr) {
        if (evt.ev === 'status' && evt.status === 'auth_success') {
          this.isAuthed = true;
          this.backoffMs = 1000; // reset backoff

          // Re-subscribe all active channels after reconnect
          for (const key of this.subs.keys()) {
            const subMsg = { action: 'subscribe', params: key };
            ws.send(JSON.stringify(subMsg));
          }

          // Flush any queued operations
          for (const m of this.pendingMsgs) {
            ws.send(JSON.stringify(m));
          }
          this.pendingMsgs.length = 0;
        }
      }

      // Route data events to subscribed clients
      for (const evt of arr) {
        const prefix = EVENT_PREFIX[this.marketKey]?.[evt.ev];
        if (!prefix) continue;
        const id = (evt.sym ?? evt.pair);
        if (!id) continue;
        // For crypto, add the X: prefix to match subscription keys
        const finalId = this.marketKey === 'crypto' ? `X:${id}` : id;
        const key = `${prefix}${finalId}`; // e.g., 'AM.AAPL', 'XAS.X:BTC-USD'
        const clients = this.subs.get(key);
        if (!clients || clients.size === 0) continue;
        const payload = JSON.stringify([evt]);
        for (const c of clients) {
          if (c.readyState === WebSocket.OPEN) {
            c.send(payload);
          }
        }
      }
    });

    ws.on('close', (code, reason) => {
      this.isAuthed = false;
      if (this.shouldReconnect) {
        const wait = Math.min(this.backoffMs, 15000);
        setTimeout(() => this._connect(), wait);
        this.backoffMs *= 2;
      }
    });

    ws.on('error', (e) => {
      // close handler manages reconnects
    });
  }

  _sendOrQueue(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isAuthed) {
      this.ws.send(JSON.stringify(msg));
    } else {
      this.pendingMsgs.push(msg);
      this._connect();
    }
  }

  _subscribeUpstream(key) {
    const subMsg = { action: 'subscribe', params: key };
    this._sendOrQueue(subMsg);
  }

  _unsubscribeUpstream(key) {
    this._sendOrQueue({ action: 'unsubscribe', params: key });
  }

  changeClientSubscription(client, newKey) {
    // remove other keys for this client (single-current-channel behavior)
    const oldKeys = this.clientKeys.get(client);
    if (oldKeys) {
      for (const key of oldKeys) {
        if (key !== newKey) this._removeClientFromKey(client, key);
      }
    }

    let set = this.subs.get(newKey);
    if (!set) {
      set = new Set();
      this.subs.set(newKey, set);
      this._subscribeUpstream(newKey); // first subscriber
    }
    if (!set.has(client)) set.add(client);

    if (!this.clientKeys.has(client)) this.clientKeys.set(client, new Set());
    const cset = this.clientKeys.get(client);
    cset.clear();
    cset.add(newKey);

    this._connect();
  }

  _removeClientFromKey(client, key) {
    const set = this.subs.get(key);
    if (set) {
      set.delete(client);
      if (set.size === 0) {
        this.subs.delete(key);
        this._unsubscribeUpstream(key);
      }
    }
    const cset = this.clientKeys.get(client);
    if (cset) {
      cset.delete(key);
      if (cset.size === 0) this.clientKeys.delete(client);
    }

    // If idle (no subs remain), close upstream to free the slot
    if (this.subs.size === 0 && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.shouldReconnect = false; // prevent auto-reconnect on intentional close
      this.ws.close(1000, 'idle');
    }
  }

  dropClient(client) {
    const keys = this.clientKeys.get(client);
    if (!keys) return;
    for (const key of keys) this._removeClientFromKey(client, key);
  }
}

// Build hubs (one per market)
const hubs = {};
console.log('🔑 POLYGON_API_KEY check:', POLYGON_API_KEY ? 'FOUND' : 'MISSING');
for (const [marketKey, cfg] of Object.entries(MARKET_CONFIG)) {
  console.log(`🏗️ Creating hub for ${marketKey} with API key:`, POLYGON_API_KEY ? 'FOUND' : 'MISSING');
  hubs[marketKey] = new ClusterHub(marketKey, cfg, POLYGON_API_KEY);
}

// Admin endpoint to force-close a hub's upstream WS (for testing)
app.post('/admin/hub/:market/force-close', (req, res) => {
  const market = String(req.params.market || '').toLowerCase();
  const reconnectParam = String(req.query.reconnect || 'true').toLowerCase();
  const reconnect = !(reconnectParam === 'false' || reconnectParam === '0');
  const hub = hubs[market];
  if (!hub) return res.status(404).json({ error: 'unknown market' });
  if (hub.ws && (hub.ws.readyState === WebSocket.OPEN || hub.ws.readyState === WebSocket.CONNECTING)) {
    hub.shouldReconnect = reconnect;
    try { hub.ws.close(4000, 'admin'); } catch (_) {}
    return res.json({ ok: true, reconnect });
  }
  return res.json({ ok: false, message: 'no active upstream', reconnect });
});

// Track which hub a client is currently using
const clientActiveHub = new WeakMap();

wss.on('connection', (clientWs) => {
  console.log('🔌 [WS] Client connected');

  clientWs.on('message', (message) => {
    try {
      console.log('📥 [WS] Client message:', message.toString());
      const data = JSON.parse(message);
      console.log('🔍 [WS] Parsed data:', JSON.stringify(data));
      if (!data || !data.ticker) {
        console.log('❌ [WS] Invalid data - missing ticker');
        return;
      }

      const market = String(data.market || 'stocks').toLowerCase();
      const interval = String(data.interval || 'second').toLowerCase();
      console.log(`🎯 [WS] Market: ${market}, Interval: ${interval}`);
      
      const marketCfg = MARKET_CONFIG[market] || MARKET_CONFIG.stocks;
      const prefix = marketCfg.channels[interval] || marketCfg.channels.second;
      console.log(`📋 [WS] Market config:`, marketCfg);
      console.log(`🔑 [WS] Prefix: ${prefix}`);

      const rawTicker = String(data.ticker);
      // Special handling for forex: convert EUR-USD to EUR/USD format
      let finalTicker = rawTicker;
      if (market === 'forex' && rawTicker.includes('-')) {
        finalTicker = rawTicker.replace('-', '/');
      }
      const prefixedTicker = finalTicker.includes(':') ? finalTicker : (marketCfg.symbolPrefix || '') + finalTicker;
      const newKey = `${prefix}${prefixedTicker}`; // e.g., 'AM.AAPL', 'CAS.EUR/USD'
      console.log(`🎯 [WS] Final subscription key: ${newKey}`);

      const oldHub = clientActiveHub.get(clientWs);
      if (oldHub && oldHub !== hubs[market]) {
        console.log(`🔄 [WS] Switching hubs: ${oldHub.marketKey} -> ${market}`);
        oldHub.dropClient(clientWs);
      }
      clientActiveHub.set(clientWs, hubs[market]);

      console.log(`📤 [WS] Calling changeClientSubscription on ${market} hub`);
      hubs[market].changeClientSubscription(clientWs, newKey);
      console.log(`✅ [WS] Client -> ${market} subscribe ${newKey}`);
    } catch (e) {
      console.error('❌ [WS] Bad client JSON:', e.message);
      console.error('❌ [WS] Stack:', e.stack);
    }
  });

  clientWs.on('close', () => {
    console.log('[WS] Client disconnected');
    for (const hub of Object.values(hubs)) hub.dropClient(clientWs);
  });
});
