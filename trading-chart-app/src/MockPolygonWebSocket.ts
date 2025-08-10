// Mock WebSocket that generates data in exact Polygon.io format
export interface PolygonAggregateBar {
  ev: 'A';           // Event type (A = aggregate/bar)
  sym: string;       // Symbol
  o: number;         // Open
  h: number;         // High
  l: number;         // Low
  c: number;         // Close
  v: number;         // Volume
  s: number;         // Start timestamp (milliseconds)
  e: number;         // End timestamp (milliseconds)
}

export class MockPolygonWebSocket {
  private interval: NodeJS.Timeout | null = null;
  private currentPrice: number = 150.00;
  private volatility: number = 0.02; // 2% volatility
  private symbol: string = 'AAPL';
  private onMessageCallback: ((data: PolygonAggregateBar[]) => void) | null = null;
  private trend: number = 0; // Current trend direction
  private trendStrength: number = 0.3; // How strong the trend is
  
  constructor(symbol: string = 'AAPL', initialPrice: number = 150.00) {
    this.symbol = symbol;
    this.currentPrice = initialPrice;
    this.trend = Math.random() > 0.5 ? 1 : -1; // Random initial trend
  }
  
  // Set the message handler
  set onmessage(callback: (event: { data: string }) => void) {
    this.onMessageCallback = (bars: PolygonAggregateBar[]) => {
      // Simulate WebSocket message event
      callback({ data: JSON.stringify(bars) });
    };
  }
  
  // Simulate WebSocket connection
  connect() {
    console.log('Mock WebSocket connected to Polygon.io');
    
    // Generate initial historical bars
    this.generateHistoricalBars();
    
    // Start generating live bars every 1 second (simulating 1-second bars)
    this.interval = setInterval(() => {
      this.generateLiveBar();
    }, 1000);
  }
  
  // Generate historical bars for initial chart display
  private generateHistoricalBars() {
    const bars: PolygonAggregateBar[] = [];
    const now = Date.now();
    const barInterval = 60000; // 1 minute bars
    
    // Generate 100 historical bars
    for (let i = 100; i > 0; i--) {
      const startTime = now - (i * barInterval);
      const endTime = startTime + barInterval;
      
      // Change trend occasionally
      if (Math.random() < 0.1) {
        this.trend = this.trend * -1;
      }
      
      // More realistic price movement with trends
      const open = this.currentPrice;
      const trendComponent = this.trend * this.trendStrength * this.currentPrice * 0.01; // 10x bigger
      const randomComponent = (Math.random() - 0.5) * this.currentPrice * 0.02; // 5x bigger
      const change = trendComponent + randomComponent;
      
      // Create realistic wicks - much bigger for visibility
      const wickSize = Math.random() * this.currentPrice * 0.015; // 5x bigger
      const high = Math.max(open, open + change) + wickSize + Math.random() * wickSize;
      const low = Math.min(open, open + change) - wickSize - Math.random() * wickSize;
      const close = open + change;
      
      bars.push({
        ev: 'A',
        sym: this.symbol,
        o: Number(open.toFixed(2)),
        h: Number(high.toFixed(2)),
        l: Number(low.toFixed(2)),
        c: Number(close.toFixed(2)),
        v: Math.floor(Math.random() * 500000) + 100000,
        s: startTime,
        e: endTime
      });
      
      this.currentPrice = close;
    }
    
    // Send historical bars
    if (this.onMessageCallback) {
      this.onMessageCallback(bars);
    }
  }
  
  // Generate a single live bar
  private generateLiveBar() {
    const now = Date.now();
    
    // Change trend occasionally
    if (Math.random() < 0.02) { // 2% chance to change trend
      this.trend = this.trend * -1;
    }
    
    // Calculate OHLC for this bar with much more movement for visibility
    const open = this.currentPrice;
    
    // Force some movement on every bar to avoid flat lines
    const minMovement = this.currentPrice * 0.01; // At least 0.1% movement
    const trendComponent = this.trend * this.trendStrength * this.currentPrice * 0.002;
    const randomComponent = (Math.random() - 0.5) * this.currentPrice * 0.01;
    let change = trendComponent + randomComponent;
    
    // Ensure minimum movement
    if (Math.abs(change) < minMovement) {
      change = minMovement * (change >= 0 ? 1 : -1);
    }
    
    // Create bigger wicks for 1-second bars
    const wickSize = this.currentPrice * 0.005 + Math.random() * this.currentPrice * 0.005;
    const high = Math.max(open, open + change) + wickSize;
    const low = Math.min(open, open + change) - wickSize;
    const close = open + change;
    
    const bar: PolygonAggregateBar = {
      ev: 'A',
      sym: this.symbol,
      o: Number(open.toFixed(2)),
      h: Number(high.toFixed(2)),
      l: Number(low.toFixed(2)),
      c: Number(close.toFixed(2)),
      v: Math.floor(Math.random() * 50000) + 10000,
      s: now - 1000, // 1 second ago
      e: now
    };
    
    this.currentPrice = close;
    
    // Send the bar in an array (like Polygon does)
    if (this.onMessageCallback) {
      this.onMessageCallback([bar]);
    }
  }
  
  // Simulate WebSocket close
  close() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    console.log('Mock WebSocket closed');
  }
  
  // Simulate sending a message (for auth, subscribe, etc.)
  send(message: string) {
    const parsed = JSON.parse(message);
    console.log('Mock WebSocket received:', parsed);
    
    // In a real implementation, you'd handle auth and subscription here
    if (parsed.action === 'auth') {
      console.log('Mock authentication successful');
    } else if (parsed.action === 'subscribe') {
      console.log('Mock subscribed to:', parsed.params);
    }
  }
}
