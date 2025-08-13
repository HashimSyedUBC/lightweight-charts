import React, { useState, useRef, useEffect } from 'react';
import { TradingChart, TradingChartRef, ChartDataRange } from './TradingChart';
import { Time } from 'lightweight-charts';
import './App.css';

// Import types directly since we're not using DrawingControls anymore
interface TrendLineData {
  id: string;
  point1: { time: Time; price: number };
  point2: { time: Time; price: number };
  color: string;
  lineWidth: number;
  lineStyle: 0 | 1 | 2;
}

interface LabelData {
  id: string;
  time: Time;
  price: number;
  text: string;
}

function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [dataRange, setDataRange] = useState<ChartDataRange | null>(null);
  const chartRef = useRef<TradingChartRef>(null);
  
  const themes = {
    dark: {
      backgroundColor: '#1e1e1e',
      textColor: '#d1d4dc'
    },
    light: {
      backgroundColor: '#ffffff',
      textColor: '#000000'
    }
  };

  // Expose chart and dataRange to window for console testing
  useEffect(() => {
    (window as any).chart = chartRef.current;
    (window as any).dataRange = dataRange;
  }, [dataRange]);

  // Test function: Draw beyond visible time range
  const testDrawPastVisibleTime = () => {
    if (!dataRange || !chartRef.current) return;
    
    // Create timestamps for Aug 4 and Aug 20, 2025
    const aug4 = Math.floor(Date.UTC(2025, 7, 6, 0, 0, 0) / 1000); // Aug 4, 2025 00:00 UTC
    const aug20 = Math.floor(Date.UTC(2025, 7, 12, 23, 59, 59) / 1000); // Aug 20, 2025 23:59:59 UTC
    
    // Green trend line - upward sloping
    const greenLine: TrendLineData = {
      id: `green-trend-${Date.now()}`,
      point1: { time: aug4 as Time, price: 145 },
      point2: { time: aug20 as Time, price: 142 },
      color: '#00ff00',
      lineWidth: 3,
      lineStyle: 0
    };
    
    // Blue trend line - downward sloping
    const blueLine: TrendLineData = {
      id: `blue-trend-${Date.now() + 1}`,
      point1: { time: aug4 as Time, price: 138 },
      point2: { time: aug20 as Time, price: 138 },
      color: '#0000ff',
      lineWidth: 3,
      lineStyle: 0
    };
    
    chartRef.current.addTrendLine(greenLine);
    chartRef.current.addTrendLine(blueLine);
  };

  // Test function: Draw while data is streaming
  const testDrawWhileStreaming = () => {
    if (!dataRange || !chartRef.current) return;
    
    const rectangle = {
      id: `streaming-rect-${Date.now()}`,
      points: {
        p1: { time: dataRange.minTime as Time, price: dataRange.minPrice },
        p2: { time: (dataRange.minTime + 3600) as Time, price: dataRange.minPrice },
        p3: { time: (dataRange.minTime + 3600) as Time, price: dataRange.minPrice + 2 },
        p4: { time: dataRange.minTime as Time, price: dataRange.minPrice + 2 }
      },
      fillColor: '#00ff00',
      fillOpacity: 0.3,
      borderColor: '#008800',
      borderWidth: 2
    };
    
    chartRef.current.addRectangle(rectangle);
    
    // Also add a label at current time
    const label: LabelData = {
      id: `streaming-label-${Date.now()}`,
      time: dataRange.maxTime as Time,
      price: dataRange.maxPrice,
      text: 'LIVE'
    };
    
    chartRef.current.addLabel(label);
  };

  // Test function: Rectangles outside data range with off-cadence times
  const testRectanglesOutsideRange = () => {
    if (!dataRange || !chartRef.current) return;
    
    // Rectangle LEFT of data - Aug 4 10:03 to Aug 8 14:27
    const leftRect = {
      id: `left-rect-${Date.now()}`,
      points: {
        p1: { time: Math.floor(Date.UTC(2025, 7, 4, 10, 3, 0) / 1000) as Time, price: 148 },
        p2: { time: Math.floor(Date.UTC(2025, 7, 8, 14, 27, 0) / 1000) as Time, price: 148 },
        p3: { time: Math.floor(Date.UTC(2025, 7, 8, 14, 27, 0) / 1000) as Time, price: 152 },
        p4: { time: Math.floor(Date.UTC(2025, 7, 4, 10, 3, 0) / 1000) as Time, price: 152 }
      },
      fillColor: '#ff0000',
      fillOpacity: 0.2,
      borderColor: '#ff0000',
      borderWidth: 2
    };
    
    // Rectangle RIGHT of data - Aug 11 16:33 to Aug 15 23:47
    const rightRect = {
      id: `right-rect-${Date.now() + 1}`,
      points: {
        p1: { time: Math.floor(Date.UTC(2025, 7, 11, 16, 33, 0) / 1000) as Time, price: 143 },
        p2: { time: Math.floor(Date.UTC(2025, 7, 15, 23, 47, 0) / 1000) as Time, price: 143 },
        p3: { time: Math.floor(Date.UTC(2025, 7, 15, 23, 47, 0) / 1000) as Time, price: 147 },
        p4: { time: Math.floor(Date.UTC(2025, 7, 11, 16, 33, 0) / 1000) as Time, price: 147 }
      },
      fillColor: '#0000ff',
      fillOpacity: 0.2,
      borderColor: '#0000ff',
      borderWidth: 2
    };
    
    chartRef.current.addRectangle(leftRect);
    chartRef.current.addRectangle(rightRect);
  };

  // Test function: Labels outside data range with off-cadence times
  const testLabelsOutsideRange = () => {
    if (!dataRange || !chartRef.current) return;
    
    // Label LEFT of data - Aug 3 09:17
    const leftLabel: LabelData = {
      id: `left-label-${Date.now()}`,
      time: Math.floor(Date.UTC(2025, 7, 3, 9, 17, 0) / 1000) as Time,
      price: 149,
      text: 'LEFT 09:17'
    };
    
    // Label RIGHT of data - Aug 16 21:43
    const rightLabel: LabelData = {
      id: `right-label-${Date.now() + 1}`,
      time: Math.floor(Date.UTC(2025, 7, 16, 21, 43, 0) / 1000) as Time,
      price: 145,
      text: 'RIGHT 21:43'
    };
    
    chartRef.current.addLabel(leftLabel);
    chartRef.current.addLabel(rightLabel);
  };

  // Test function: Within range but off-cadence times
  const testWithinRangeOffCadence = () => {
    if (!dataRange || !chartRef.current) return;
    
    // Trend line inside data but off 5-min grid - Aug 9 10:03 to Aug 9 16:27
    const offCadenceLine: TrendLineData = {
      id: `off-cadence-line-${Date.now()}`,
      point1: { time: Math.floor(Date.UTC(2025, 7, 9, 10, 3, 0) / 1000) as Time, price: 149 },
      point2: { time: Math.floor(Date.UTC(2025, 7, 9, 16, 27, 0) / 1000) as Time, price: 151 },
      color: '#ff00ff',
      lineWidth: 3,
      lineStyle: 0
    };
    
    // Rectangle inside data with off-cadence corners - Aug 9 11:17 to Aug 9 13:42
    const offCadenceRect = {
      id: `off-cadence-rect-${Date.now()}`,
      points: {
        p1: { time: Math.floor(Date.UTC(2025, 7, 9, 11, 17, 0) / 1000) as Time, price: 148.5 },
        p2: { time: Math.floor(Date.UTC(2025, 7, 9, 13, 42, 0) / 1000) as Time, price: 148.5 },
        p3: { time: Math.floor(Date.UTC(2025, 7, 9, 13, 42, 0) / 1000) as Time, price: 150.5 },
        p4: { time: Math.floor(Date.UTC(2025, 7, 9, 11, 17, 0) / 1000) as Time, price: 150.5 }
      },
      fillColor: '#00ff00',
      fillOpacity: 0.2,
      borderColor: '#00ff00',
      borderWidth: 2
    };
    
    // Label inside data at off-cadence time - Aug 9 14:52
    const offCadenceLabel: LabelData = {
      id: `off-cadence-label-${Date.now()}`,
      time: Math.floor(Date.UTC(2025, 7, 9, 14, 52, 0) / 1000) as Time,
      price: 150,
      text: 'OFF 14:52'
    };
    
    chartRef.current.addTrendLine(offCadenceLine);
    chartRef.current.addRectangle(offCadenceRect);
    chartRef.current.addLabel(offCadenceLabel);
  };

  // Test function: Multiple overlapping drawings
  const testMultipleDrawings = () => {
    if (!dataRange || !chartRef.current) return;
    
    // Add multiple trend lines
    for (let i = 0; i < 3; i++) {
      const trendLine: TrendLineData = {
        id: `multi-trend-${Date.now()}-${i}`,
        point1: { time: (dataRange.minTime + i * 1800) as Time, price: dataRange.minPrice + i },
        point2: { time: (dataRange.maxTime - i * 1800) as Time, price: dataRange.maxPrice - i },
        color: ['#ff0000', '#00ff00', '#0000ff'][i],
        lineWidth: 2,
        lineStyle: 0
      };
      chartRef.current.addTrendLine(trendLine);
    }
    
    // Add overlapping labels
    for (let i = 0; i < 3; i++) {
      const label: LabelData = {
        id: `multi-label-${Date.now()}-${i}`,
        time: (dataRange.minTime + (dataRange.maxTime - dataRange.minTime) / 2) as Time,
        price: dataRange.minPrice + ((dataRange.maxPrice - dataRange.minPrice) / 2) + i * 0.5,
        text: `L${i + 1}`
      };
      chartRef.current.addLabel(label);
    }
    
  };

  // Test function: Log current viewport
  const testLogViewport = () => {
    const vp = chartRef.current?.getViewport?.();
    console.log('Viewport:', vp);
    (window as any).viewport = vp; // convenience for manual inspection
  };



  return (
    <div className="App" style={{ backgroundColor: theme === 'dark' ? '#0d0d0d' : '#f5f5f5' }}>
      <header className="App-header" style={{ 
        backgroundColor: theme === 'dark' ? '#1a1a1a' : '#ffffff',
        borderBottom: `1px solid ${theme === 'dark' ? '#333' : '#ddd'}`
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ color: theme === 'dark' ? '#fff' : '#000' }}>Trading Chart with Live Data</h1>
            <p style={{ color: theme === 'dark' ? '#888' : '#666' }}>Mock Polygon.io WebSocket Format - AAPL</p>
          </div>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            style={{
              padding: '8px 16px',
              backgroundColor: theme === 'dark' ? '#333' : '#eee',
              color: theme === 'dark' ? '#fff' : '#000',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
          <button
            onClick={testDrawPastVisibleTime}
            disabled={!dataRange}
            style={{
              padding: '8px 16px',
              backgroundColor: dataRange ? '#ff4444' : '#666',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: dataRange ? 'pointer' : 'not-allowed',
              fontSize: '16px'
            }}
          >
            🚀 Test: Draw Past Time
          </button>
          <button
            onClick={testDrawWhileStreaming}
            disabled={!dataRange}
            style={{
              padding: '8px 16px',
              backgroundColor: dataRange ? '#00aa00' : '#666',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: dataRange ? 'pointer' : 'not-allowed',
              fontSize: '14px'
            }}
          >
            📊 Test: Draw While Streaming
          </button>
          <button
            onClick={testMultipleDrawings}
            disabled={!dataRange}
            style={{
              padding: '8px 16px',
              backgroundColor: dataRange ? '#9333ea' : '#666',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: dataRange ? 'pointer' : 'not-allowed',
              fontSize: '14px'
            }}
          >
            🎯 Test: Multiple Overlaps
          </button>
          <button
            onClick={testRectanglesOutsideRange}
            disabled={!dataRange}
            style={{
              padding: '8px 16px',
              backgroundColor: dataRange ? '#ff6b6b' : '#666',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: dataRange ? 'pointer' : 'not-allowed',
              fontSize: '14px'
            }}
          >
            📦 Test: Rects Outside
          </button>
          <button
            onClick={testLabelsOutsideRange}
            disabled={!dataRange}
            style={{
              padding: '8px 16px',
              backgroundColor: dataRange ? '#4ecdc4' : '#666',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: dataRange ? 'pointer' : 'not-allowed',
              fontSize: '14px'
            }}
          >
            🏷️ Test: Labels Outside
          </button>
          <button
            onClick={testWithinRangeOffCadence}
            disabled={!dataRange}
            style={{
              padding: '8px 16px',
              backgroundColor: dataRange ? '#f39c12' : '#666',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: dataRange ? 'pointer' : 'not-allowed',
              fontSize: '14px'
            }}
          >
            ⏱️ Test: Off-Cadence
          </button>
          <button
            onClick={testLogViewport}
            style={{
              padding: '8px 16px',
              backgroundColor: '#2d8cff',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: dataRange ? 'pointer' : 'not-allowed',
              fontSize: '16px'
            }}
          >
           log view port
          </button>
          <button
            onClick={testDrawWhileStreaming}
            disabled={!dataRange}
            style={{
              padding: '8px 16px',
              backgroundColor: dataRange ? '#00aa00' : '#666',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: dataRange ? 'pointer' : 'not-allowed',
              fontSize: '14px'
            }}
          >
            🧭 Log Viewport
          </button>
          <button
            onClick={() => {
              if (chartRef.current && dataRange) {
                // Left edge - 25% into the data range
                const targetTime = dataRange.minTime + (dataRange.maxTime - dataRange.minTime) * 0.25;
                const result = chartRef.current.centerOnTime(targetTime);
                console.log('centerOnTime LEFT EDGE result:', result);
                if (result) {
                  console.log('Target UTC:', new Date(targetTime * 1000).toISOString());
                  console.log('Changed:', result.changed);
                  console.log('Before center:', new Date(result.before.timeRange.centerTime * 1000).toISOString());
                  console.log('After center:', new Date(result.after.timeRange.centerTime * 1000).toISOString());
                }
              }
            }}
            disabled={!dataRange}
            style={{
              padding: '8px 16px',
              backgroundColor: dataRange ? '#4ecdc4' : '#666',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: dataRange ? 'pointer' : 'not-allowed',
              fontSize: '13px',
              marginRight: '4px'
            }}
          >
            ⬅️ Left Edge<br/>
            {dataRange ? new Date((dataRange.minTime + (dataRange.maxTime - dataRange.minTime) * 0.25) * 1000).toISOString().slice(0, 16) + 'Z' : ''}
          </button>
          <button
            onClick={() => {
              if (chartRef.current && dataRange) {
                // Center on middle of data range
                const targetTime = Math.floor((dataRange.minTime + dataRange.maxTime) / 2);
                const result = chartRef.current.centerOnTime(targetTime);
                console.log('centerOnTime MIDDLE result:', result);
                if (result) {
                  console.log('Target UTC:', new Date(targetTime * 1000).toISOString());
                  console.log('Changed:', result.changed);
                  console.log('Before center:', new Date(result.before.timeRange.centerTime * 1000).toISOString());
                  console.log('After center:', new Date(result.after.timeRange.centerTime * 1000).toISOString());
                }
              }
            }}
            disabled={!dataRange}
            style={{
              padding: '8px 16px',
              backgroundColor: dataRange ? '#ff6b6b' : '#666',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: dataRange ? 'pointer' : 'not-allowed',
              fontSize: '13px',
              marginRight: '4px'
            }}
          >
            🎯 Middle<br/>
            {dataRange ? new Date(((dataRange.minTime + dataRange.maxTime) / 2) * 1000).toISOString().slice(0, 16) + 'Z' : ''}
          </button>
          <button
            onClick={() => {
              if (chartRef.current && dataRange) {
                // Right edge - 75% into the data range  
                const targetTime = dataRange.minTime + (dataRange.maxTime - dataRange.minTime) * 0.75;
                const result = chartRef.current.centerOnTime(targetTime);
                console.log('centerOnTime RIGHT EDGE result:', result);
                if (result) {
                  console.log('Target UTC:', new Date(targetTime * 1000).toISOString());
                  console.log('Changed:', result.changed);
                  console.log('Before center:', new Date(result.before.timeRange.centerTime * 1000).toISOString());
                  console.log('After center:', new Date(result.after.timeRange.centerTime * 1000).toISOString());
                }
              }
            }}
            disabled={!dataRange}
            style={{
              padding: '8px 16px',
              backgroundColor: dataRange ? '#f06292' : '#666',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: dataRange ? 'pointer' : 'not-allowed',
              fontSize: '13px'
            }}
          >
            ➡️ Right Edge<br/>
            {dataRange ? new Date((dataRange.minTime + (dataRange.maxTime - dataRange.minTime) * 0.75) * 1000).toISOString().slice(0, 16) + 'Z' : ''}
          </button>
        </div>
        
        <div style={{ 
          marginTop: '10px', 
          fontSize: '12px', 
          color: theme === 'dark' ? '#888' : '#666',
          fontFamily: 'monospace'
        }}>
          💡 Open console and use: <code>window.chart.addTrendLine({'{...}'})</code> | Data range: <code>window.dataRange</code>
        </div>
        
        <div style={{ 
          marginTop: '10px', 
          fontSize: '12px', 
          color: theme === 'dark' ? '#888' : '#666',
          fontFamily: 'monospace'
        }}>
          💡 Open console and use: <code>window.chart.addTrendLine({'{...}'})</code> | Data range: <code>window.dataRange</code>
        </div>
      </header>
      <main className="App-main">
        <TradingChart 
          ref={chartRef}
          symbol="AAPL" 
          initialPrice={150.00}
          backgroundColor={themes[theme].backgroundColor}
          textColor={themes[theme].textColor}
          onDataRangeChange={setDataRange}
        />
      </main>
    </div>
  );
}

export default App;
