const WebSocket = require('ws');

console.log('[TEST] Connecting to WebSocket proxy...');
const ws = new WebSocket('ws://localhost:8090/ws');

ws.on('open', () => {
  console.log('[TEST] ✅ WebSocket connected successfully!');
  console.log('[TEST] Sending ticker subscription...');
  ws.send(JSON.stringify({ ticker: 'AAPL' }));
});

ws.on('message', (data) => {
  const s = data.toString();
  console.log('[TEST] 📨 Message received:', s.substring(0, 200));
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) {
      console.log('[TEST] 📊 Array with', parsed.length, 'events');
      parsed.slice(0, 3).forEach((ev, i) => console.log(`[TEST] Event ${i}:`, ev));
    } else {
      console.log('[TEST] 📊 Single event:', parsed);
    }
  } catch {
    console.log('[TEST] Raw message (not JSON):', s);
  }
});

ws.on('error', (err) => console.error('[TEST] ❌ WebSocket error:', err.message));
ws.on('close', (code, reason) => console.log('[TEST] 🔌 WebSocket closed:', code, reason.toString()));

// Give yourself time to see data (per-second bars arrive immediately)
setTimeout(() => {
  console.log('[TEST] 🕐 Test timeout, closing connection...');
  ws.close();
  process.exit(0);
}, 20000);
