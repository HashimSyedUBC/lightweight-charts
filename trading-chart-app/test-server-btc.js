


const WebSocket = require('ws');

const SERVER_URL = 'ws://localhost:8090/ws';
const TEST_DURATION = 20 * 60 * 1000; // 20 minutes in milliseconds

console.log('🚀 Starting BTC Server WebSocket test...');
console.log('⏱️  Test duration: 20 minutes');
console.log('🌐 Server URL: ws://localhost:8090/ws');

// Data counters
let xasCount = 0; // per-second aggregates
let xaCount = 0;  // per-minute aggregates
let connected = false;

const ws = new WebSocket(SERVER_URL);

// Set timeout to close connection after 20 minutes
const timeout = setTimeout(() => {
    console.log('\n⏰ 20-minute timeout reached, closing connection...');
    ws.close();
}, TEST_DURATION);

ws.on('open', () => {
    console.log('🔌 WebSocket connected to local server');
    connected = true;
    
    // Test both per-second and per-minute BTC aggregates
    console.log('📊 Testing BTC per-second aggregates...');
    ws.send(JSON.stringify({
        ticker: 'BTC-USD',
        market: 'crypto',
        interval: 'second'
    }));
    
    // Wait a bit then test per-minute
    setTimeout(() => {
        console.log('📈 Switching to BTC per-minute aggregates...');
        ws.send(JSON.stringify({
            ticker: 'BTC-USD',
            market: 'crypto',
            interval: 'minute'
        }));
    }, 10000); // Switch after 10 seconds
});

ws.on('message', (raw) => {
    try {
        // Log all raw messages for debugging
        console.log('📥 Raw message:', raw.toString());
        
        const data = JSON.parse(raw);
        
        if (Array.isArray(data)) {
            for (const event of data) {
                console.log('🔍 Event:', JSON.stringify(event, null, 2));
                
                // Handle per-second aggregates (XAS)
                if (event.ev === 'XAS') {
                    xasCount++;
                    const time = new Date(event.s).toLocaleTimeString();
                    console.log(`📊 XAS #${xasCount} [${time}] ${event.pair}: O=${event.o} H=${event.h} L=${event.l} C=${event.c} V=${event.v} VW=${event.vw}`);
                }
                
                // Handle per-minute aggregates (XA)
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
                
                // Handle any other events
                else {
                    console.log('❓ Other event type:', event.ev, event);
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
    console.error('💡 Make sure your server is running: node server-fixed.js');
});

ws.on('close', (code, reason) => {
    clearTimeout(timeout);
    console.log('\n🔌 WebSocket connection closed');
    console.log(`Code: ${code}, Reason: ${reason || 'No reason provided'}`);
    
    console.log('\n📊 FINAL RESULTS:');
    console.log(`Connection: ${connected ? '✅ Success' : '❌ Failed'}`);
    console.log(`XAS (per-second) messages received: ${xasCount}`);
    console.log(`XA (per-minute) messages received: ${xaCount}`);
    
    if (connected) {
        if (xasCount > 0 || xaCount > 0) {
            console.log('✅ BTC data is flowing through your server correctly!');
        } else {
            console.log('⚠️  No BTC data received - this could be due to:');
            console.log('   - Server not properly connected to Polygon');
            console.log('   - Low BTC trading activity');
            console.log('   - Server configuration issues');
            console.log('💡 Check server logs for more details');
        }
    } else {
        console.log('❌ Failed to connect to server');
        console.log('💡 Make sure to run: node server-fixed.js');
    }
    
    process.exit(0);
});

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, closing connection...');
    clearTimeout(timeout);
    ws.close();
});

console.log('🔄 Connecting to local server WebSocket...');
console.log('💡 Make sure your server is running with: node server-fixed.js');
