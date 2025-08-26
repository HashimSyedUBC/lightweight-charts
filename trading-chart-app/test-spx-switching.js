const WebSocket = require('ws');

const POLYGON_API_KEY = "pq5ffTZcNHPaYs0KCjLpuxxGo7ZSbqEE";

console.log('🚀 Starting SPX Switching WebSocket test...');
console.log('📊 Phase 1: SPX per-second for 10 seconds');
console.log('📈 Phase 2: SPX per-minute for 60 seconds');
console.log('🔑 API Key: Found');

// Data counters
let aCount = 0;  // per-second aggregates
let amCount = 0; // per-minute aggregates
let authSuccess = false;
let currentPhase = 1;

const ws = new WebSocket('wss://socket.polygon.io/indices');

ws.on('open', () => {
    console.log('🔌 WebSocket connected to Polygon Indices (LIVE)');
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
                        console.log('📊 Starting Phase 1: SPX per-second aggregates...');
                        
                        // Phase 1: Subscribe to SPX per-second
                        ws.send(JSON.stringify({ 
                            action: 'subscribe', 
                            params: 'A.I:SPX'
                        }));
                        
                        // Switch to minute aggregates after 10 seconds
                        setTimeout(() => {
                            if (currentPhase === 1) {
                                currentPhase = 2;
                                console.log('\n🔄 Switching to Phase 2: SPX per-minute aggregates...');
                                
                                // Unsubscribe from per-second
                                ws.send(JSON.stringify({ 
                                    action: 'unsubscribe', 
                                    params: 'A.I:SPX'
                                }));
                                
                                // Subscribe to per-minute
                                ws.send(JSON.stringify({ 
                                    action: 'subscribe', 
                                    params: 'AM.I:SPX'
                                }));
                                
                                // Close connection after 60 more seconds (1 minute)
                                setTimeout(() => {
                                    console.log('\n✅ Test completed successfully!');
                                    ws.close();
                                }, 60000); // 60 seconds
                            }
                        }, 10000); // 10 seconds
                        
                    } else if (event.status === 'auth_failed') {
                        console.error('❌ Authentication failed:', event.message);
                        ws.close();
                    } else {
                        console.log('ℹ️  Status:', event.status, event.message || '');
                    }
                }
                
                // Handle per-second aggregates (A)
                else if (event.ev === 'A') {
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
    console.log('\n🔌 WebSocket connection closed');
    console.log(`Code: ${code}, Reason: ${reason || 'No reason provided'}`);
    
    console.log('\n📊 FINAL RESULTS:');
    console.log(`Authentication: ${authSuccess ? '✅ Success' : '❌ Failed'}`);
    console.log(`Phase 1 - A (per-second) messages received: ${aCount}`);
    console.log(`Phase 2 - AM (per-minute) messages received: ${amCount}`);
    console.log(`Current phase when closed: ${currentPhase}`);
    
    if (authSuccess) {
        if (aCount > 0 || amCount > 0) {
            console.log('✅ SPX switching test completed successfully!');
        } else {
            console.log('⚠️  No SPX data received - this could be due to:');
            console.log('   - Market hours (indices only trade during market hours)');
            console.log('   - Low trading activity');
            console.log('   - Weekend/holiday periods');
        }
    }
    
    process.exit(0);
});

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, closing connection...');
    ws.close();
});

console.log('🔄 Connecting to Polygon Indices WebSocket (LIVE)...');
