const WebSocket = require('ws');
require('dotenv').config();

const POLYGON_API_KEY = "pq5ffTZcNHPaYs0KCjLpuxxGo7ZSbqEE";
const TEST_DURATION = 20 * 60 * 1000; // 20 minutes in milliseconds

console.log('🚀 Starting SPY WebSocket direct test...');
console.log(`⏱️  Test duration: 20 minutes`);
console.log(`🔑 API Key: ${POLYGON_API_KEY ? 'Found' : 'MISSING!'}`);

if (!POLYGON_API_KEY) {
    console.error('❌ POLYGON_API_KEY not found in environment variables');
    process.exit(1);
}

// Data counters
let xasCount = 0; // per-second aggregates
let xaCount = 0;  // per-minute aggregates
let authSuccess = false;

const ws = new WebSocket('wss://delayed.polygon.io/stocks');

// Set timeout to close connection after 20 minutes
const timeout = setTimeout(() => {
    console.log('\n⏰ 20-minute timeout reached, closing connection...');
    ws.close();
}, TEST_DURATION);

ws.on('open', () => {
    console.log('🔌 WebSocket connected to Polygon');
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
                        console.log('📊 Subscribing to SPY data streams...');
                        
                        // Try multiple subscription formats
                        const subscriptions = [
                            'XAS.SPY',  // per-second aggregates
                            'XA.SPY',   // per-minute aggregates
                            'A.SPY',    // second bars (alternative format)
                            'AM.SPY',   // minute bars (alternative format)
                            'T.SPY'     // trades (for comparison)
                        ];
                        
                        for (const sub of subscriptions) {
                            console.log(`🎯 Subscribing to: ${sub}`);
                            ws.send(JSON.stringify({ 
                                action: 'subscribe', 
                                params: sub
                            }));
                        }
                        
                        console.log('📈 Waiting for data...\n');
                    } else if (event.status === 'auth_failed') {
                        console.error('❌ Authentication failed:', event.message);
                        ws.close();
                    } else {
                        console.log('ℹ️  Status:', event.status, event.message || '');
                    }
                }
                
                // Handle per-second aggregates (XAS)
                else if (event.ev === 'XAS') {
                    xasCount++;
                    const time = new Date(event.s).toLocaleTimeString();
                    console.log(`📊 XAS #${xasCount} [${time}] SPY: O=${event.o} H=${event.h} L=${event.l} C=${event.c} V=${event.v}`);
                }
                
                // Handle per-minute aggregates (XA)
                else if (event.ev === 'XA') {
                    xaCount++;
                    const time = new Date(event.s).toLocaleTimeString();
                    console.log(`📈 XA  #${xaCount} [${time}] SPY: O=${event.o} H=${event.h} L=${event.l} C=${event.c} V=${event.v}`);
                }
                
                // Handle alternative formats
                else if (event.ev === 'A') {
                    xasCount++;
                    const time = new Date(event.s).toLocaleTimeString();
                    console.log(`📊 A #${xasCount} [${time}] SPY: O=${event.o} H=${event.h} L=${event.l} C=${event.c} V=${event.v}`);
                }
                
                else if (event.ev === 'AM') {
                    xaCount++;
                    const time = new Date(event.s).toLocaleTimeString();
                    console.log(`📈 AM #${xaCount} [${time}] SPY: O=${event.o} H=${event.h} L=${event.l} C=${event.c} V=${event.v}`);
                }
                
                // Handle trades for reference
                else if (event.ev === 'T') {
                    console.log(`💰 Trade: ${event.p} at ${new Date(event.t).toLocaleTimeString()}`);
                }
                
                // Handle subscription confirmations and errors
                else if (event.ev === 'status') {
                    if (event.status === 'connected') {
                        console.log('✅ Subscription confirmed:', event.message);
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
            console.log('✅ Data is flowing correctly!');
        } else {
            console.log('⚠️  No data received - this could be due to:');
            console.log('   - Market hours (SPY trades 9:30 AM - 4:00 PM ET)');
            console.log('   - Low trading activity');
            console.log('   - Delayed data feed latency');
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

console.log('🔄 Connecting to Polygon WebSocket...');
