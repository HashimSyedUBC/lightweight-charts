const WebSocket = require('ws');

const POLYGON_API_KEY = "pq5ffTZcNHPaYs0KCjLpuxxGo7ZSbqEE";
const TEST_DURATION = 20 * 60 * 1000; // 20 minutes in milliseconds

console.log('🚀 Starting BTC WebSocket direct test...');
console.log('⏱️  Test duration: 20 minutes');
console.log('🔑 API Key: Found');

// Data counters
let xasCount = 0; // per-second aggregates
let xaCount = 0;  // per-minute aggregates
let authSuccess = false;

const ws = new WebSocket('wss://socket.polygon.io/crypto');

// Set timeout to close connection after 20 minutes
const timeout = setTimeout(() => {
    console.log('\n⏰ 20-minute timeout reached, closing connection...');
    ws.close();
}, TEST_DURATION);

ws.on('open', () => {
    console.log('🔌 WebSocket connected to Polygon Crypto (LIVE)');
    console.log('🔐 Sending authentication...');
    ws.send(JSON.stringify({ action: 'auth', params: POLYGON_API_KEY }));
});

ws.on('message', (raw) => {
    try {
        // Log all raw messages for debugging
        console.log('📥 Raw message:', raw.toString());
        
        const data = JSON.parse(raw);
        
        if (Array.isArray(data)) {
            for (const event of data) {
                console.log('🔍 Event:', JSON.stringify(event, null, 2));
                
                // Handle authentication
                if (event.ev === 'status') {
                    if (event.status === 'auth_success') {
                        authSuccess = true;
                        console.log('✅ Authentication successful');
                        console.log('📊 Subscribing to BTC data streams...');
                        
                        // Subscribe to BTC aggregates (official format)
                        const subscriptions = [
                            // 'XAS.BTC-USD',   // Per-second aggregates for BTC-USD
                            'XA.BTC-USD'     // Per-minute aggregates for BTC-USD
                        ];
                        
                        for (const sub of subscriptions) {
                            console.log(`🎯 Subscribing to: ${sub}`);
                            ws.send(JSON.stringify({ 
                                action: 'subscribe', 
                                params: sub
                            }));
                        }
                        
                        console.log('📈 Waiting for BTC data...\n');
                    } else if (event.status === 'auth_failed') {
                        console.error('❌ Authentication failed:', event.message);
                        ws.close();
                    } else {
                        console.log('ℹ️  Status:', event.status, event.message || '');
                    }
                }
                
                // Handle per-second aggregates (XAS) - Official format
                else if (event.ev === 'XAS') {
                    xasCount++;
                    const time = new Date(event.s).toLocaleTimeString();
                    console.log(`📊 XAS #${xasCount} [${time}] ${event.pair}: O=${event.o} H=${event.h} L=${event.l} C=${event.c} V=${event.v} VW=${event.vw}`);
                }
                
                // Handle per-minute aggregates (XA) - Official format
                else if (event.ev === 'XA') {
                    xaCount++;
                    const time = new Date(event.s).toLocaleTimeString();
                    console.log(`📈 XA #${xaCount} [${time}] ${event.pair}: O=${event.o} H=${event.h} L=${event.l} C=${event.c} V=${event.v} VW=${event.vw}`);
                }
                
                // Handle crypto trades (XT)
                else if (event.ev === 'XT') {
                    const time = new Date(event.t).toLocaleTimeString();
                    console.log(`💰 Trade [${time}] ${event.pair}: Price=${event.p} Size=${event.s}`);
                }
                
                // Handle subscription confirmations and errors
                else if (event.ev === 'status') {
                    if (event.status === 'connected') {
                        console.log('✅ Subscription confirmed:', event.message);
                    } else if (event.status === 'success') {
                        console.log('✅ Subscription success:', event.message);
                    } else if (event.status === 'error') {
                        console.error('❌ Subscription error:', event.message);
                    } else {
                        console.log('ℹ️  Other status:', event.status, event.message || '');
                    }
                }
                
                // Log any unhandled events
                else {
                    console.log('❓ Unhandled event type:', event.ev, event);
                }
            }
        } else {
            console.log('📄 Non-array message:', data);
        }
    } catch (e) {
        console.error('❌ Error parsing message:', e.message);
        console.log('Raw message:', raw.toString());
        console.error('Stack trace:', e.stack);
    }
});

ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
});

ws.on('close', (code, reason) => {
    clearTimeout(timeout);
    console.log('\n🔌 WebSocket connection closed');
    console.log(`Code: ${code}, Reason: ${reason || 'No reason provided'}`);
    
    console.log('\n📊 FINAL RESULTS:');
    console.log(`Authentication: ${authSuccess ? '✅ Success' : '❌ Failed'}`);
    console.log(`XAS (per-second) messages received: ${xasCount}`);
    console.log(`XA (per-minute) messages received: ${xaCount}`);
    
    if (authSuccess) {
        if (xasCount > 0 || xaCount > 0) {
            console.log('✅ BTC data is flowing correctly!');
        } else {
            console.log('⚠️  No BTC data received - this could be due to:');
            console.log('   - Low BTC trading activity');
            console.log('   - Extended aggregates require premium API access');
            console.log('   - Crypto market volatility');
        }
    }
    
    process.exit(0);
});

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, closing connection...');
    clearTimeout(timeout);
    ws.close();
});

console.log('🔄 Connecting to Polygon Crypto WebSocket (LIVE)...');
