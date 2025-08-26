const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const SERVER_URL = 'ws://localhost:8090/ws';
const TEST_DURATION = 120000; // 2 minutes
const RESULTS_DIR = './test-results';

console.log('🚀 Starting Multi-Client Hub Test...');
console.log('⏱️  Test duration: 2 minutes');
console.log('🔗 Testing 16 simultaneous WebSocket connections');
console.log('🌐 Server URL: ws://localhost:8090/ws');

// Test configuration - 16 simultaneous connections
const testClients = [
  // Stocks Market (4 connections)
  { id: 'stocks-aapl-sec', market: 'stocks', ticker: 'AAPL', interval: 'second' },
  { id: 'stocks-spy-sec', market: 'stocks', ticker: 'SPY', interval: 'second' },
  { id: 'stocks-aapl-min', market: 'stocks', ticker: 'AAPL', interval: 'minute' },
  { id: 'stocks-spy-min', market: 'stocks', ticker: 'SPY', interval: 'minute' },
  
  // Indices Market (4 connections)
  { id: 'indices-spx-sec', market: 'indices', ticker: 'SPX', interval: 'second' },
  { id: 'indices-ndx-sec', market: 'indices', ticker: 'NDX', interval: 'second' },
  { id: 'indices-spx-min', market: 'indices', ticker: 'SPX', interval: 'minute' },
  { id: 'indices-ndx-min', market: 'indices', ticker: 'NDX', interval: 'minute' },
  
  // Crypto Market (4 connections)
  { id: 'crypto-btc-sec', market: 'crypto', ticker: 'BTC-USD', interval: 'second' },
  { id: 'crypto-eth-sec', market: 'crypto', ticker: 'ETH-USD', interval: 'second' },
  { id: 'crypto-btc-min', market: 'crypto', ticker: 'BTC-USD', interval: 'minute' },
  { id: 'crypto-eth-min', market: 'crypto', ticker: 'ETH-USD', interval: 'minute' },
  
  // Forex Market (4 connections)
  { id: 'forex-eur-sec', market: 'forex', ticker: 'EUR-USD', interval: 'second' },
  { id: 'forex-gbp-sec', market: 'forex', ticker: 'GBP-USD', interval: 'second' },
  { id: 'forex-eur-min', market: 'forex', ticker: 'EUR-USD', interval: 'minute' },
  { id: 'forex-gbp-min', market: 'forex', ticker: 'GBP-USD', interval: 'minute' }
];

// Results tracking
const results = {
  testStart: new Date().toISOString(),
  testDuration: TEST_DURATION,
  totalClients: testClients.length,
  clients: {},
  summary: {
    connected: 0,
    failed: 0,
    totalMessages: 0,
    marketBreakdown: {}
  }
};

// Initialize client results
testClients.forEach(config => {
  results.clients[config.id] = {
    config,
    connected: false,
    connectionTime: null,
    messages: [],
    messageCount: 0,
    errors: [],
    status: 'pending'
  };
});

// Create WebSocket connections
const connections = new Map();
let completedClients = 0;

function createClient(config) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const ws = new WebSocket(SERVER_URL);
    const clientResult = results.clients[config.id];
    
    console.log(`🔌 [${config.id}] Connecting...`);
    
    ws.on('open', () => {
      clientResult.connected = true;
      clientResult.connectionTime = Date.now() - startTime;
      clientResult.status = 'connected';
      results.summary.connected++;
      
      console.log(`✅ [${config.id}] Connected in ${clientResult.connectionTime}ms`);
      
      // Send subscription message
      const subscription = {
        ticker: config.ticker,
        market: config.market,
        interval: config.interval
      };
      
      console.log(`📤 [${config.id}] Subscribing:`, JSON.stringify(subscription));
      ws.send(JSON.stringify(subscription));
      
      resolve(ws);
    });
    
    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw);
        const timestamp = new Date().toISOString();
        
        clientResult.messageCount++;
        results.summary.totalMessages++;
        
        // Store first few messages for analysis
        if (clientResult.messages.length < 5) {
          clientResult.messages.push({
            timestamp,
            data: Array.isArray(data) ? data[0] : data
          });
        }
        
        console.log(`📥 [${config.id}] Message #${clientResult.messageCount}: ${raw.toString().substring(0, 100)}...`);
        
      } catch (e) {
        clientResult.errors.push({
          timestamp: new Date().toISOString(),
          error: 'JSON parse error',
          message: e.message,
          raw: raw.toString()
        });
        console.error(`❌ [${config.id}] Parse error:`, e.message);
      }
    });
    
    ws.on('error', (error) => {
      clientResult.errors.push({
        timestamp: new Date().toISOString(),
        error: 'WebSocket error',
        message: error.message
      });
      console.error(`❌ [${config.id}] WebSocket error:`, error.message);
    });
    
    ws.on('close', (code, reason) => {
      if (!clientResult.connected) {
        clientResult.status = 'failed';
        results.summary.failed++;
      } else {
        clientResult.status = 'closed';
      }
      
      console.log(`🔌 [${config.id}] Closed: ${code} ${reason || ''}`);
      completedClients++;
      
      if (completedClients === testClients.length) {
        finalizeResults();
      }
    });
    
    // Timeout fallback
    setTimeout(() => {
      if (!clientResult.connected) {
        clientResult.status = 'timeout';
        results.summary.failed++;
        ws.close();
        resolve(null);
      }
    }, 10000); // 10 second timeout
  });
}

// Start all connections simultaneously
async function startTest() {
  console.log('\n🚀 Creating all WebSocket connections simultaneously...\n');
  
  const connectionPromises = testClients.map(config => createClient(config));
  const websockets = await Promise.all(connectionPromises);
  
  // Store successful connections
  websockets.forEach((ws, index) => {
    if (ws) {
      connections.set(testClients[index].id, ws);
    }
  });
  
  console.log(`\n✅ ${results.summary.connected} connections established, ${results.summary.failed} failed`);
  console.log('📊 Collecting data for 2 minutes...\n');
  
  // Let test run for specified duration
  setTimeout(() => {
    console.log('\n⏰ Test duration completed, closing connections...\n');
    
    // Close all connections
    connections.forEach((ws, id) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
  }, TEST_DURATION);
}

function finalizeResults() {
  console.log('\n📊 Finalizing test results...\n');
  
  // Calculate market breakdown
  testClients.forEach(config => {
    const market = config.market;
    if (!results.summary.marketBreakdown[market]) {
      results.summary.marketBreakdown[market] = {
        total: 0,
        connected: 0,
        messages: 0
      };
    }
    
    results.summary.marketBreakdown[market].total++;
    const clientResult = results.clients[config.id];
    if (clientResult.connected) {
      results.summary.marketBreakdown[market].connected++;
    }
    results.summary.marketBreakdown[market].messages += clientResult.messageCount;
  });
  
  results.testEnd = new Date().toISOString();
  results.testDurationActual = Date.now() - new Date(results.testStart).getTime();
  
  // Create results directory
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
  
  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `multi-client-hub-test-${timestamp}.json`;
  const filepath = path.join(RESULTS_DIR, filename);
  
  // Write results to file
  fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
  
  // Print summary
  console.log('📋 TEST SUMMARY:');
  console.log(`Total Clients: ${results.totalClients}`);
  console.log(`Connected: ${results.summary.connected}`);
  console.log(`Failed: ${results.summary.failed}`);
  console.log(`Total Messages: ${results.summary.totalMessages}`);
  console.log('\n📊 Market Breakdown:');
  
  Object.entries(results.summary.marketBreakdown).forEach(([market, stats]) => {
    console.log(`  ${market}: ${stats.connected}/${stats.total} connected, ${stats.messages} messages`);
  });
  
  console.log(`\n📁 Results saved to: ${path.resolve(filepath)}`);
  
  // Test success criteria
  const successRate = (results.summary.connected / results.totalClients) * 100;
  if (successRate >= 80 && results.summary.totalMessages > 0) {
    console.log(`\n✅ TEST PASSED: ${successRate.toFixed(1)}% success rate, hub multiplexing working!`);
  } else {
    console.log(`\n❌ TEST FAILED: ${successRate.toFixed(1)}% success rate, check server logs`);
  }
  
  process.exit(0);
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, closing all connections...');
  connections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  });
  setTimeout(() => process.exit(0), 1000);
});

// Start the test
console.log('💡 Make sure your server is running with: node server-fixed.js\n');
startTest();
