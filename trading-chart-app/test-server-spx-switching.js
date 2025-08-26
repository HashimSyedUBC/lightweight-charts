const WebSocket = require('ws');

const SERVER_URL = 'ws://localhost:8090/ws';

console.log('🚀 Starting SPX Server Switching test...');
console.log('📊 Phase 1: SPX per-second for 10 seconds');
console.log('📈 Phase 2: SPX per-minute for 60 seconds');
console.log('🌐 Server URL: ws://localhost:8090/ws');

// Data counters
let aCount = 0;  // per-second aggregates
let amCount = 0; // per-minute aggregates
let connected = false;
let currentPhase = 1;

const ws = new WebSocket(SERVER_URL);

ws.on('open', () => {
    console.log('🔌 WebSocket connected to local server');
    connected = true;
    
    console.log('📊 Starting Phase 1: SPX per-second aggregates...');
    ws.send(JSON.stringify({
        ticker: 'SPX',
        market: 'indices',
        interval: 'second'
    }));
    
    // Switch to minute aggregates after 10 seconds
    setTimeout(() => {
        if (currentPhase === 1) {
            currentPhase = 2;
            console.log('\n🔄 Switching to Phase 2: SPX per-minute aggregates...');
            
            ws.send(JSON.stringify({
                ticker: 'SPX',
                market: 'indices',
                interval: 'minute'
            }));
            
            // Close connection after 60 more seconds (1 minute)
            setTimeout(() => {
                console.log('\n✅ Test completed successfully!');
                ws.close();
            }, 60000); // 60 seconds
        }
    }, 10000); // 10 seconds
});

ws.on('message', (raw) => {
    try {
        // Log all raw messages for debugging
        console.log('📥 Raw message:', raw.toString());
        
        const data = JSON.parse(raw);
        
        if (Array.isArray(data)) {
            for (const event of data) {
                console.log('🔍 Event:', JSON.stringify(event, null, 2));
                
                // Handle per-second aggregates (A)
                if (event.ev === 'A') {
                    aCount++;
                    const time = new Date(event.s).toLocaleTimeString();
                    console.log(`📊 A #${aCount} [${time}] ${event.sym}: O=${event.o} H=${event.h} L=${event.l} C=${event.c} V=${event.v}`);
                }
                
                // Handle per-minute aggregates (AM)
                else if (event.ev === 'AM') {
                    amCount++;
                    const time = new Date(event.s).toLocaleTimeString();
                    console.log(`📈 AM #${amCount} [${time}] ${event.sym}: O=${event.o} H=${event.h} L=${event.l} C=${event.c} V=${event.v}`);
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
    console.log('\n🔌 WebSocket connection closed');
    console.log(`Code: ${code}, Reason: ${reason || 'No reason provided'}`);
    
    console.log('\n📊 FINAL RESULTS:');
    console.log(`Connection: ${connected ? '✅ Success' : '❌ Failed'}`);
    console.log(`Phase 1 - A (per-second) messages received: ${aCount}`);
    console.log(`Phase 2 - AM (per-minute) messages received: ${amCount}`);
    console.log(`Current phase when closed: ${currentPhase}`);
    
    if (connected) {
        if (aCount > 0 || amCount > 0) {
            console.log('✅ SPX server switching test completed successfully!');
        } else {
            console.log('⚠️  No SPX data received - this could be due to:');
            console.log('   - Server not properly connected to Polygon');
            console.log('   - Market hours (indices only trade during market hours)');
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
    ws.close();
});

console.log('🔄 Connecting to local server WebSocket...');
console.log('💡 Make sure your server is running with: node server-fixed.js');
