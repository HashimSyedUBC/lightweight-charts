const WebSocket = require('ws');

console.log('🚀 Testing server-fixed.js WebSocket...');
console.log('⏱️  Test duration: 2 minutes');

// Data counters
let secondCount = 0;
let minuteCount = 0;
let authSuccess = false;

const ws = new WebSocket('ws://localhost:8090/ws');

// Set timeout to close connection after 2 minutes
const timeout = setTimeout(() => {
    console.log('\n⏰ 2-minute timeout reached, closing connection...');
    ws.close();
}, 2 * 60 * 1000);

ws.on('open', () => {
    console.log('🔌 WebSocket connected to server');
    console.log('📊 Subscribing to SPY data streams...');
    
    // Test both second and minute intervals
    ws.send(JSON.stringify({ 
        ticker: 'SPY',
        market: 'stocks',
        interval: 'second'
    }));
    
    console.log('🎯 Subscribed to SPY second bars (A.SPY)');
    console.log('📈 Waiting for data...\n');
});

ws.on('message', (raw) => {
    try {
        console.log('📥 Raw message:', raw.toString());
        
        const data = JSON.parse(raw);
        
        if (Array.isArray(data)) {
            for (const event of data) {
                console.log('🔍 Event:', JSON.stringify(event, null, 2));
                
                // Handle per-second aggregates (A)
                if (event.ev === 'A') {
                    secondCount++;
                    const time = new Date(event.s).toLocaleTimeString();
                    console.log(`📊 A #${secondCount} [${time}] SPY: O=${event.o} H=${event.h} L=${event.l} C=${event.c} V=${event.v}`);
                }
                
                // Handle per-minute aggregates (AM)
                else if (event.ev === 'AM') {
                    minuteCount++;
                    const time = new Date(event.s).toLocaleTimeString();
                    console.log(`📈 AM #${minuteCount} [${time}] SPY: O=${event.o} H=${event.h} L=${event.l} C=${event.c} V=${event.v}`);
                }
                
                // Handle status messages
                else if (event.ev === 'status') {
                    console.log('ℹ️  Status:', event.status, event.message || '');
                    if (event.status === 'auth_success') {
                        authSuccess = true;
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
    console.log(`A (per-second) messages received: ${secondCount}`);
    console.log(`AM (per-minute) messages received: ${minuteCount}`);
    
    if (secondCount > 0 || minuteCount > 0) {
        console.log('✅ Server is working correctly!');
    } else {
        console.log('⚠️  No data received - check if:');
        console.log('   - Server is running on port 8090');
        console.log('   - Market hours (SPY trades 9:30 AM - 4:00 PM ET)');
        console.log('   - Server has valid POLYGON_API_KEY');
    }
    
    process.exit(0);
});

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, closing connection...');
    clearTimeout(timeout);
    ws.close();
});

console.log('🔄 Connecting to server WebSocket...');
