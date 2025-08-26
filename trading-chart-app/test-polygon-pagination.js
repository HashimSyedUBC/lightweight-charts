const https = require('https');

const API_KEY = "pq5ffTZcNHPaYs0KCjLpuxxGo7ZSbqEE";

function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ statusCode: res.statusCode, json });
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function formatTimestamp(ts) {
  const date = new Date(ts);
  return `${date.toISOString()} (${date.toLocaleString('en-US', {timeZone: 'America/New_York'})} EST)`;
}

async function testPolygonPagination() {
  console.log('=== POLYGON CRYPTO SECOND DATA PAGINATION TEST ===\n');
  
  const now = Date.now();
  console.log(`Current time: ${formatTimestamp(now)}\n`);

  // Test 1: First page of today's data
  console.log('TEST 1: First page of crypto second data for today');
  console.log('URL: https://api.polygon.io/v2/aggs/ticker/X:BTC-USD/range/1/second/2025-08-22/2025-08-22');
  
  try {
    const url1 = `https://api.polygon.io/v2/aggs/ticker/X:BTC-USD/range/1/second/2025-08-22/2025-08-22?apiKey=${API_KEY}&sort=asc&limit=50000`;
    const { json: page1 } = await httpsGetJson(url1);
    
    console.log(`Status: ${page1.status}`);
    console.log(`Results count: ${page1.count}`);
    console.log(`Results length: ${page1.results?.length || 0}`);
    
    if (page1.results && page1.results.length > 0) {
      const first = page1.results[0];
      const last = page1.results[page1.results.length - 1];
      console.log(`First timestamp: ${first.t} - ${formatTimestamp(first.t)}`);
      console.log(`Last timestamp: ${last.t} - ${formatTimestamp(last.t)}`);
      console.log(`Time gap from now: ${((now - last.t) / (1000 * 60)).toFixed(2)} minutes`);
    }
    
    console.log(`Has next_url: ${!!page1.next_url}`);
    if (page1.next_url) {
      console.log(`Next URL: ${page1.next_url}`);
    }
    
    // Test 2: Follow pagination if available
    if (page1.next_url) {
      console.log('\n' + '='.repeat(60));
      console.log('TEST 2: Following pagination to get more recent data');
      
      const nextUrl = page1.next_url + `&apiKey=${API_KEY}`;
      console.log(`Pagination URL: ${nextUrl}`);
      
      const { json: page2 } = await httpsGetJson(nextUrl);
      
      console.log(`Status: ${page2.status}`);
      console.log(`Results count: ${page2.count}`);
      console.log(`Results length: ${page2.results?.length || 0}`);
      
      if (page2.results && page2.results.length > 0) {
        const first = page2.results[0];
        const last = page2.results[page2.results.length - 1];
        console.log(`First timestamp: ${first.t} - ${formatTimestamp(first.t)}`);
        console.log(`Last timestamp: ${last.t} - ${formatTimestamp(last.t)}`);
        console.log(`Time gap from now: ${((now - last.t) / (1000 * 60)).toFixed(2)} minutes`);
      }
      
      console.log(`Has next_url: ${!!page2.next_url}`);
      
      // Test 3: Compare with specific time range request
      console.log('\n' + '='.repeat(60));
      console.log('TEST 3: Request specific time range (last 2 hours)');
      
      const twoHoursAgo = Math.floor((now - 2 * 60 * 60 * 1000) / 1000);
      const nowSec = Math.floor(now / 1000);
      
      const url3 = `https://api.polygon.io/v2/aggs/ticker/X:BTC-USD/range/1/second/${twoHoursAgo}/${nowSec}?apiKey=${API_KEY}&sort=asc&limit=50000`;
      console.log(`Time range URL: ${url3}`);
      
      const { json: page3 } = await httpsGetJson(url3);
      
      console.log(`Status: ${page3.status}`);
      console.log(`Results count: ${page3.count}`);
      console.log(`Results length: ${page3.results?.length || 0}`);
      
      if (page3.results && page3.results.length > 0) {
        const first = page3.results[0];
        const last = page3.results[page3.results.length - 1];
        console.log(`First timestamp: ${first.t} - ${formatTimestamp(first.t)}`);
        console.log(`Last timestamp: ${last.t} - ${formatTimestamp(last.t)}`);
        console.log(`Time gap from now: ${((now - last.t) / (1000 * 60)).toFixed(2)} minutes`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('CONCLUSION:');
    console.log('1. Does first page have recent data? ' + (page1.results && page1.results.length > 0 && (now - page1.results[page1.results.length - 1].t) < 60 * 60 * 1000 ? 'YES' : 'NO'));
    console.log('2. Does pagination provide recent data? ' + (page1.next_url ? 'TESTING...' : 'NO PAGINATION'));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testPolygonPagination();
