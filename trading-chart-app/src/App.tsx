import React, { useState, useRef, useEffect, useCallback } from 'react';
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

interface RectangleData {
  id: string;
  points: {
    p1: { time: Time; price: number };
    p2: { time: Time; price: number };
    p3: { time: Time; price: number };
    p4: { time: Time; price: number };
  };
  fillColor: string;
  fillOpacity: number;
  borderColor?: string;
  borderWidth?: number;
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
  
  // Drawing list state for focus-on-drawing controls
  const [drawings, setDrawings] = useState<
    { id: string; type: 'trendline' | 'rectangle' | 'label'; isVisible: boolean }[]
  >([]);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string>('');
  
  const refreshDrawings = useCallback(() => {
    const vp = chartRef.current?.getViewport?.();
    if (!vp) return;
    const list = (vp.drawings || []).map((d: any) => ({
      id: d.id as string,
      type: d.type as 'trendline' | 'rectangle' | 'label',
      isVisible: !!d.isVisible,
    }));
    setDrawings(list);
    if (!selectedDrawingId && list.length) setSelectedDrawingId(list[0].id);
  }, [selectedDrawingId]);
  
  // Initial refresh when data range becomes available
  useEffect(() => {
    refreshDrawings();
  }, [dataRange, refreshDrawings]);

  // Draw realistic rectangle around last 4 bars
  const drawRealisticRectangle = () => {
    if (!dataRange || !chartRef.current) return;
    
    const data = chartRef.current.getData?.() || [];
    if (data.length < 4) return;
    
    // Get last 4 bars
    const last4Bars = data.slice(-4);
    const times = last4Bars.map((bar: any) => bar.time as number);
    const prices = last4Bars.flatMap((bar: any) => [bar.open, bar.high, bar.low, bar.close]);
    
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    
    // Add some padding to make it look nicer
    const timePadding = (maxTime - minTime) * 0.1;
    const pricePadding = (maxPrice - minPrice) * 0.05;
    
    const rect: RectangleData = {
      id: `realistic-rect-${Date.now()}`,
      points: {
        p1: { time: (minTime - timePadding) as Time, price: minPrice - pricePadding },
        p2: { time: (maxTime + timePadding) as Time, price: minPrice - pricePadding },
        p3: { time: (maxTime + timePadding) as Time, price: maxPrice + pricePadding },
        p4: { time: (minTime - timePadding) as Time, price: maxPrice + pricePadding },
      },
      fillColor: '#3b82f6',
      fillOpacity: 0.2,
      borderColor: '#1d4ed8',
      borderWidth: 2,
    };
    
    chartRef.current.addRectangle(rect);
    console.log('Added realistic rectangle around last 4 bars:', rect);
  };



  // Test fu  // Test function: Rectangles outside data range with off-cadence times (DYNAMIC)
  const testRectanglesOutsideRange = () => {
    if (!dataRange || !chartRef.current) return;
    
    // Get current viewport to determine cadence and reasonable sizing
    const viewport = chartRef.current.getViewport?.();
    if (!viewport) return;
    
    const cadenceSec = viewport.cadenceSec || 1; // fallback to 5min
    const barsForRect = 20; // Rectangle spans ~20 bars
    const rectTimeSpan = cadenceSec * barsForRect;
    
    // Calculate positions relative to data range
    const dataSpan = dataRange.maxTime - dataRange.minTime;
    const priceSpan = dataRange.maxPrice - dataRange.minPrice;
    const priceCenter = (dataRange.minPrice + dataRange.maxPrice) / 2;
    
    // Rectangle LEFT of data - starts 10% before data, spans 20 bars
    const leftStartTime = dataRange.minTime - (dataSpan * 0.1);
    const leftEndTime = leftStartTime + rectTimeSpan;
    // Add off-cadence offset (3 seconds and 17 seconds)
    const leftRect = {
      id: `left-rect-${Date.now()}`,
      points: {
        p1: { time: (leftStartTime + 3) as Time, price: priceCenter - priceSpan * 0.1 },
        p2: { time: (leftEndTime + 17) as Time, price: priceCenter - priceSpan * 0.1 },
        p3: { time: (leftEndTime + 17) as Time, price: priceCenter + priceSpan * 0.1 },
        p4: { time: (leftStartTime + 3) as Time, price: priceCenter + priceSpan * 0.1 }
      },
      fillColor: '#ff0000',
      fillOpacity: 0.2,
      borderColor: '#ff0000',
      borderWidth: 2
    };
    
    // Rectangle RIGHT of data - starts 10% after data, spans 20 bars  
    const rightStartTime = dataRange.maxTime + (dataSpan * 0.1);
    const rightEndTime = rightStartTime + rectTimeSpan;
    // Add different off-cadence offsets (33 seconds and 47 seconds)
    const rightRect = {
      id: `right-rect-${Date.now() + 1}`,
      points: {
        p1: { time: (rightStartTime + 33) as Time, price: priceCenter - priceSpan * 0.15 },
        p2: { time: (rightEndTime + 47) as Time, price: priceCenter - priceSpan * 0.15 },
        p3: { time: (rightEndTime + 47) as Time, price: priceCenter + priceSpan * 0.15 },
        p4: { time: (rightStartTime + 33) as Time, price: priceCenter + priceSpan * 0.15 }
      },
      fillColor: '#0000ff',
      fillOpacity: 0.2,
      borderColor: '#0000ff',
      borderWidth: 2
    };
    
    console.log(`Creating dynamic rectangles outside range:
      - Cadence: ${cadenceSec}s, Rectangle span: ${barsForRect} bars (${rectTimeSpan}s)
      - Left rect: ${new Date(leftStartTime * 1000).toISOString()} to ${new Date(leftEndTime * 1000).toISOString()}
      - Right rect: ${new Date(rightStartTime * 1000).toISOString()} to ${new Date(rightEndTime * 1000).toISOString()}`);
    
    chartRef.current.addRectangle(leftRect);
    chartRef.current.addRectangle(rightRect);
  };


  // Test function: Labels outside data range with off-cadence times (DYNAMIC)
  const testLabelsOutsideRange = () => {
    if (!dataRange || !chartRef.current) return;
    
    // Get current viewport to determine cadence and reasonable sizing
    const viewport = chartRef.current.getViewport?.();
    if (!viewport) return;
    
    const cadenceSec = viewport.cadenceSec || 1; // fallback to 5min
    const dataSpan = dataRange.maxTime - dataRange.minTime;
    const priceSpan = dataRange.maxPrice - dataRange.minPrice;
    const priceCenter = (dataRange.minPrice + dataRange.maxPrice) / 2;
    
    // Label LEFT of data - positioned just a few bars before data starts
    const leftLabelTime = dataRange.minTime - (cadenceSec * 3); // 3 bars before data
    const leftLabel: LabelData = {
      id: `left-label-${Date.now()}`,
      time: (leftLabelTime + 17) as Time, // +17 sec off-cadence
      price: priceCenter + priceSpan * 0.1,
      text: 'LEFT +17s'
    };
    
    // Label RIGHT of data - positioned just a few bars after data ends
    const rightLabelTime = dataRange.maxTime + (cadenceSec * 3); // 3 bars after data
    const rightLabel: LabelData = {
      id: `right-label-${Date.now() + 1}`,
      time: (rightLabelTime + 43) as Time, // +43 sec off-cadence
      price: priceCenter - priceSpan * 0.1,
      text: 'RIGHT +43s'
    };
    
    console.log(`Creating dynamic labels outside range:
      - Cadence: ${cadenceSec}s
      - Left label: ${new Date(leftLabelTime * 1000).toISOString()} (${cadenceSec * 3}s before data)
      - Right label: ${new Date(rightLabelTime * 1000).toISOString()} (${cadenceSec * 3}s after data)`);
    
    chartRef.current.addLabel(leftLabel);
    chartRef.current.addLabel(rightLabel);
  };

  // Test function: Within range but off-cadence times (DYNAMIC)
  const testWithinRangeOffCadence = () => {
    if (!dataRange || !chartRef.current) return;
    
    // Get current viewport to determine cadence and reasonable sizing
    const viewport = chartRef.current.getViewport?.();
    if (!viewport) return;
    
    const cadenceSec = viewport.cadenceSec || 1; // fallback to 5min
    const dataSpan = dataRange.maxTime - dataRange.minTime;
    const priceSpan = dataRange.maxPrice - dataRange.minPrice;
    const priceCenter = (dataRange.minPrice + dataRange.maxPrice) / 2;
    
    // Trend line inside data but off-cadence - spans ~30 bars in middle of data
    const midTime = (dataRange.minTime + dataRange.maxTime) / 2;
    const trendSpan = cadenceSec * 30; // 30 bars worth
    const trendStart = midTime - trendSpan / 2;
    const trendEnd = midTime + trendSpan / 2;
    
    const offCadenceLine: TrendLineData = {
      id: `off-cadence-line-${Date.now()}`,
      point1: { time: (trendStart + 3) as Time, price: priceCenter - priceSpan * 0.1 }, // +3 sec off-cadence
      point2: { time: (trendEnd + 27) as Time, price: priceCenter + priceSpan * 0.1 }, // +27 sec off-cadence
      color: '#ff00ff',
      lineWidth: 3,
      lineStyle: 0
    };
    
    // Rectangle inside data with off-cadence corners - spans ~15 bars
    const rectSpan = cadenceSec * 15; // 15 bars worth
    const rectStart = midTime - rectSpan / 2;
    const rectEnd = midTime + rectSpan / 2;
    
    const offCadenceRect = {
      id: `off-cadence-rect-${Date.now()}`,
      points: {
        p1: { time: (rectStart + 17) as Time, price: priceCenter - priceSpan * 0.05 }, // +17 sec off-cadence
        p2: { time: (rectEnd + 42) as Time, price: priceCenter - priceSpan * 0.05 }, // +42 sec off-cadence
        p3: { time: (rectEnd + 42) as Time, price: priceCenter + priceSpan * 0.05 },
        p4: { time: (rectStart + 17) as Time, price: priceCenter + priceSpan * 0.05 }
      },
      fillColor: '#00ff00',
      fillOpacity: 0.2,
      borderColor: '#00ff00',
      borderWidth: 2
    };
    
    // Label inside data at off-cadence time
    const offCadenceLabel: LabelData = {
      id: `off-cadence-label-${Date.now()}`,
      time: (midTime + 52) as Time, // +52 sec off-cadence
      price: priceCenter,
      text: 'OFF +52s'
    };
    
    console.log(`Creating dynamic off-cadence drawings:
      - Cadence: ${cadenceSec}s
      - Trend line: ${new Date(trendStart * 1000).toISOString()} to ${new Date(trendEnd * 1000).toISOString()}
      - Rectangle: ${new Date(rectStart * 1000).toISOString()} to ${new Date(rectEnd * 1000).toISOString()}
      - Label: ${new Date((midTime + 52) * 1000).toISOString()}`);
    
    chartRef.current.addTrendLine(offCadenceLine);
    chartRef.current.addRectangle(offCadenceRect);
    chartRef.current.addLabel(offCadenceLabel);
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
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
           🔍 Log Viewport
          </button>
          <button
            onClick={drawRealisticRectangle}
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
            draw realistic
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
          marginTop: '20px', 
          padding: '10px', 
          backgroundColor: theme === 'dark' ? '#2a2a2a' : '#f0f0f0', 
          borderRadius: '4px' 
        }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: theme === 'dark' ? '#bbb' : '#333' }}>
            Test setViewport:
          </div>
          <button 
            onClick={() => {
              const result = chartRef.current?.setViewport(
                dataRange?.minTime || 0,
                dataRange?.maxTime || 0,
                null,
                null
              );
              console.log('setViewport (full time range, auto price):', result);
            }}
            style={{ 
              margin: '2px', 
              padding: '4px 8px', 
              backgroundColor: theme === 'dark' ? '#3a3a3a' : '#e0e0e0',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            📊 Full Time Range
          </button>
          <button 
            onClick={() => {
              if (dataRange) {
                const midTime = (dataRange.minTime + dataRange.maxTime) / 2;
                const quarterSpan = (dataRange.maxTime - dataRange.minTime) / 4;
                const result = chartRef.current?.setViewport(
                  midTime - quarterSpan,
                  midTime + quarterSpan,
                  null,
                  null
                );
                console.log('setViewport (middle 50% of time):', result);
              }
            }}
            style={{ 
              margin: '2px', 
              padding: '4px 8px', 
              backgroundColor: theme === 'dark' ? '#3a3a3a' : '#e0e0e0',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            ⏱️ Middle 50%
          </button>
          <button 
            onClick={() => {
              const viewport = chartRef.current?.getViewport();
              if (viewport && dataRange) {
                const result = chartRef.current?.setViewport(
                  new Date(viewport.timeRange.minTime).getTime() / 1000,
                  new Date(viewport.timeRange.maxTime).getTime() / 1000,
                  dataRange.minPrice,
                  dataRange.maxPrice
                );
                console.log('setViewport (current time, full price range):', result);
              }
            }}
            style={{ 
              margin: '2px', 
              padding: '4px 8px', 
              backgroundColor: theme === 'dark' ? '#3a3a3a' : '#e0e0e0',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            📈 Full Price Range
          </button>
          <button 
            onClick={() => {
              const viewport = chartRef.current?.getViewport();
              if (viewport) {
                const priceSpan = viewport.priceRangeVisible.maxPrice - viewport.priceRangeVisible.minPrice;
                const newMinPrice = viewport.priceRangeVisible.centerPrice - priceSpan * 0.25;
                const newMaxPrice = viewport.priceRangeVisible.centerPrice + priceSpan * 0.25;
                const result = chartRef.current?.setViewport(
                  null,
                  null,
                  newMinPrice,
                  newMaxPrice
                );
                console.log('setViewport (zoom in price 2x):', result);
              }
            }}
            style={{ 
              margin: '2px', 
              padding: '4px 8px', 
              backgroundColor: theme === 'dark' ? '#3a3a3a' : '#e0e0e0',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            🔍 Zoom Price 2x
          </button>
          <button 
            onClick={() => {
              const viewport = chartRef.current?.getViewport();
              const result = chartRef.current?.setViewport(
                viewport ? new Date(viewport.timeRange.minTime).getTime() / 1000 : undefined,
                viewport ? new Date(viewport.timeRange.maxTime).getTime() / 1000 : undefined,
                null,
                null
              );
              console.log('setViewport (reset to auto-scale):', result);
            }}
            style={{ 
              margin: '2px', 
              padding: '4px 8px', 
              backgroundColor: theme === 'dark' ? '#3a3a3a' : '#e0e0e0',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            🔄 Auto-Scale
          </button>
        </div>

        {/* Navigation Buttons */}
        <div style={{ 
          marginTop: '20px', 
          padding: '10px', 
          backgroundColor: theme === 'dark' ? '#2a2a2a' : '#f0f0f0', 
          borderRadius: '4px' 
        }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: theme === 'dark' ? '#bbb' : '#333' }}>
            Navigation:
          </div>
          <button 
            onClick={() => {
              if (dataRange) {
                const viewport = chartRef.current?.getViewport?.();
                const cadence = viewport?.cadenceSec || 1; // dynamic cadence
                const barsToShow = 50;
                const timeSpan = cadence * barsToShow;
                const result = chartRef.current?.setViewport(
                  dataRange.minTime,
                  dataRange.minTime + timeSpan,
                  null,
                  null
                );
                console.log('Navigate to left edge (first 50 bars):', result);
              }
            }}
            style={{ 
              margin: '2px', 
              padding: '4px 8px', 
              backgroundColor: theme === 'dark' ? '#3a3a3a' : '#e0e0e0',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            ⏮️ Left Edge
          </button>
          <button 
            onClick={() => {
              if (dataRange) {
                const viewport = chartRef.current?.getViewport?.();
                const cadence = viewport?.cadenceSec || 1; // dynamic cadence
                const barsToShow = 50;
                const timeSpan = cadence * barsToShow;
                const result = chartRef.current?.setViewport(
                  dataRange.maxTime - timeSpan,
                  dataRange.maxTime,
                  null,
                  null
                );
                console.log('Navigate to right edge (last 50 bars):', result);
              }
            }}
            style={{ 
              margin: '2px', 
              padding: '4px 8px', 
              backgroundColor: theme === 'dark' ? '#3a3a3a' : '#e0e0e0',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            ⏭️ Right Edge
          </button>
          <button 
            onClick={() => {
              const viewport = chartRef.current?.getViewport();
              if (viewport) {
                const timeSpan = new Date(viewport.timeRange.maxTime).getTime() / 1000 - new Date(viewport.timeRange.minTime).getTime() / 1000;
                const shift = timeSpan * 0.5;
                const result = chartRef.current?.setViewport(
                  new Date(viewport.timeRange.minTime).getTime() / 1000 - shift,
                  new Date(viewport.timeRange.maxTime).getTime() / 1000 - shift,
                  null,
                  null
                );
                console.log('Pan left 50%:', result);
              }
            }}
            style={{ 
              margin: '2px', 
              padding: '4px 8px', 
              backgroundColor: theme === 'dark' ? '#3a3a3a' : '#e0e0e0',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            ⬅️ Pan Left 50%
          </button>
          <button 
            onClick={() => {
              const viewport = chartRef.current?.getViewport();
              if (viewport) {
                const timeSpan = new Date(viewport.timeRange.maxTime).getTime() / 1000 - new Date(viewport.timeRange.minTime).getTime() / 1000;
                const shift = timeSpan * 0.5;
                const result = chartRef.current?.setViewport(
                  new Date(viewport.timeRange.minTime).getTime() / 1000 + shift,
                  new Date(viewport.timeRange.maxTime).getTime() / 1000 + shift,
                  null,
                  null
                );
                console.log('Pan right 50%:', result);
              }
            }}
            style={{ 
              margin: '2px', 
              padding: '4px 8px', 
              backgroundColor: theme === 'dark' ? '#3a3a3a' : '#e0e0e0',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            ➡️ Pan Right 50%
          </button>
        </div>

        {/* Zoom Buttons (Combined Time + Price) */}
        <div style={{ 
          marginTop: '20px', 
          padding: '10px', 
          backgroundColor: theme === 'dark' ? '#2a2a2a' : '#f0f0f0', 
          borderRadius: '4px' 
        }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: theme === 'dark' ? '#bbb' : '#333' }}>
            Combined Zoom (Time + Price):
          </div>
          <button 
            onClick={() => {
              const viewport = chartRef.current?.getViewport();
              if (viewport) {
                const timeMin = new Date(viewport.timeRange.minTime).getTime() / 1000;
                const timeMax = new Date(viewport.timeRange.maxTime).getTime() / 1000;
                const timeCenter = (timeMin + timeMax) / 2;
                const timeSpan = (timeMax - timeMin) / 2; // Half the span
                
                const priceCenter = viewport.priceRangeVisible.centerPrice;
                const priceSpan = (viewport.priceRangeVisible.maxPrice - viewport.priceRangeVisible.minPrice) / 2;
                
                const result = chartRef.current?.setViewport(
                  timeCenter - timeSpan / 2,
                  timeCenter + timeSpan / 2,
                  priceCenter - priceSpan / 2,
                  priceCenter + priceSpan / 2
                );
                console.log('Zoom in 2x (time + price):', result);
              }
            }}
            style={{ 
              margin: '2px', 
              padding: '4px 8px', 
              backgroundColor: theme === 'dark' ? '#3a3a3a' : '#e0e0e0',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            🔍 Zoom In 2x
          </button>
          <button 
            onClick={() => {
              const viewport = chartRef.current?.getViewport();
              if (viewport) {
                const timeMin = new Date(viewport.timeRange.minTime).getTime() / 1000;
                const timeMax = new Date(viewport.timeRange.maxTime).getTime() / 1000;
                const timeCenter = (timeMin + timeMax) / 2;
                const timeSpan = (timeMax - timeMin) / 4; // Quarter the span
                
                const priceCenter = viewport.priceRangeVisible.centerPrice;
                const priceSpan = (viewport.priceRangeVisible.maxPrice - viewport.priceRangeVisible.minPrice) / 4;
                
                const result = chartRef.current?.setViewport(
                  timeCenter - timeSpan / 2,
                  timeCenter + timeSpan / 2,
                  priceCenter - priceSpan / 2,
                  priceCenter + priceSpan / 2
                );
                console.log('Zoom in 4x (time + price):', result);
              }
            }}
            style={{ 
              margin: '2px', 
              padding: '4px 8px', 
              backgroundColor: theme === 'dark' ? '#3a3a3a' : '#e0e0e0',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            🔍 Zoom In 4x
          </button>
          <button 
            onClick={() => {
              const viewport = chartRef.current?.getViewport();
              if (viewport) {
                const timeMin = new Date(viewport.timeRange.minTime).getTime() / 1000;
                const timeMax = new Date(viewport.timeRange.maxTime).getTime() / 1000;
                const timeCenter = (timeMin + timeMax) / 2;
                const timeSpan = (timeMax - timeMin) * 2; // Double the span
                
                const priceCenter = viewport.priceRangeVisible.centerPrice;
                const priceSpan = (viewport.priceRangeVisible.maxPrice - viewport.priceRangeVisible.minPrice) * 2;
                
                const result = chartRef.current?.setViewport(
                  timeCenter - timeSpan / 2,
                  timeCenter + timeSpan / 2,
                  priceCenter - priceSpan / 2,
                  priceCenter + priceSpan / 2
                );
                console.log('Zoom out 2x (time + price):', result);
              }
            }}
            style={{ 
              margin: '2px', 
              padding: '4px 8px', 
              backgroundColor: theme === 'dark' ? '#3a3a3a' : '#e0e0e0',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            🔎 Zoom Out 2x
          </button>
        </div>

        {/* Specific Bar Counts */}
        <div style={{ 
          marginTop: '20px', 
          padding: '10px', 
          backgroundColor: theme === 'dark' ? '#2a2a2a' : '#f0f0f0', 
          borderRadius: '4px' 
        }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: theme === 'dark' ? '#bbb' : '#333' }}>
            Specific Bar Counts:
          </div>
          <button 
            onClick={() => {
              if (dataRange) {
                const viewport = chartRef.current?.getViewport?.();
                const cadence = viewport?.cadenceSec || 1; // dynamic cadence
                const barsToShow = 20;
                const timeSpan = cadence * barsToShow;
                const result = chartRef.current?.setViewport(
                  dataRange.minTime,
                  dataRange.minTime + timeSpan,
                  null,
                  null
                );
                console.log('Show first 20 bars:', result);
              }
            }}
            style={{ 
              margin: '2px', 
              padding: '4px 8px', 
              backgroundColor: theme === 'dark' ? '#3a3a3a' : '#e0e0e0',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            📊 Last 20 Bars
          </button>
          <button 
            onClick={() => {
              if (dataRange) {
                const viewport = chartRef.current?.getViewport?.();
                const cadence = viewport?.cadenceSec || 1; // dynamic cadence
                const barsToShow = 50;
                const timeSpan = cadence * barsToShow;
                const result = chartRef.current?.setViewport(
                  dataRange.maxTime - timeSpan,
                  dataRange.maxTime,
                  null,
                  null
                );
                console.log('Show last 50 bars:', result);
              }
            }}
            style={{ 
              margin: '2px', 
              padding: '4px 8px', 
              backgroundColor: theme === 'dark' ? '#3a3a3a' : '#e0e0e0',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            📊 Last 50 Bars
          </button>
          <button 
            onClick={() => {
              if (dataRange) {
                const viewport = chartRef.current?.getViewport?.();
                const cadence = viewport?.cadenceSec || 1; // dynamic cadence
                const barsToShow = 100;
                const timeSpan = cadence * barsToShow;
                const result = chartRef.current?.setViewport(
                  dataRange.maxTime - timeSpan,
                  dataRange.maxTime,
                  null,
                  null
                );
                console.log('Show last 100 bars:', result);
              }
            }}
            style={{ 
              margin: '2px', 
              padding: '4px 8px', 
              backgroundColor: theme === 'dark' ? '#3a3a3a' : '#e0e0e0',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            📊 Last 100 Bars
          </button>
          <button 
            onClick={() => {
              if (dataRange) {
                const viewport = chartRef.current?.getViewport?.();
                const cadence = viewport?.cadenceSec || 1; // dynamic cadence
                const barsToShow = 100;
                const timeSpan = cadence * barsToShow;
                const result = chartRef.current?.setViewport(
                  dataRange.minTime,
                  dataRange.minTime + timeSpan,
                  null,
                  null
                );
                console.log('Show first 100 bars:', result);
              }
            }}
            style={{ 
              margin: '2px', 
              padding: '4px 8px', 
              backgroundColor: theme === 'dark' ? '#3a3a3a' : '#e0e0e0',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            📊 First 100 Bars
          </button>
        </div>

        {/* Price-Specific Tests */}
        <div style={{ 
          marginTop: '20px', 
          padding: '10px', 
          backgroundColor: theme === 'dark' ? '#2a2a2a' : '#f0f0f0', 
          borderRadius: '4px' 
        }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: theme === 'dark' ? '#bbb' : '#333' }}>
            Price Ranges:
          </div>
          <button 
            onClick={() => {
              const viewport = chartRef.current?.getViewport();
              if (viewport) {
                const priceCenter = viewport.priceRangeVisible.centerPrice;
                const priceRange = priceCenter * 0.05; // ±5%
                const result = chartRef.current?.setViewport(
                  null,
                  null,
                  priceCenter - priceRange,
                  priceCenter + priceRange
                );
                console.log('Price ±5%:', result);
              }
            }}
            style={{ 
              margin: '2px', 
              padding: '4px 8px', 
              backgroundColor: theme === 'dark' ? '#3a3a3a' : '#e0e0e0',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            📈 Price ±5%
          </button>
          <button 
            onClick={() => {
              const viewport = chartRef.current?.getViewport();
              if (viewport) {
                const priceCenter = viewport.priceRangeVisible.centerPrice;
                const priceRange = priceCenter * 0.10; // ±10%
                const result = chartRef.current?.setViewport(
                  null,
                  null,
                  priceCenter - priceRange,
                  priceCenter + priceRange
                );
                console.log('Price ±10%:', result);
              }
            }}
            style={{ 
              margin: '2px', 
              padding: '4px 8px', 
              backgroundColor: theme === 'dark' ? '#3a3a3a' : '#e0e0e0',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            📈 Price ±10%
          </button>
          <button 
            onClick={() => {
              const viewport = chartRef.current?.getViewport();
              if (viewport) {
                const priceCenter = viewport.priceRangeVisible.centerPrice;
                const priceRange = priceCenter * 0.20; // ±20%
                const result = chartRef.current?.setViewport(
                  null,
                  null,
                  priceCenter - priceRange,
                  priceCenter + priceRange
                );
                console.log('Price ±20%:', result);
              }
            }}
            style={{ 
              margin: '2px', 
              padding: '4px 8px', 
              backgroundColor: theme === 'dark' ? '#3a3a3a' : '#e0e0e0',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            📈 Price ±20%
          </button>
        </div>

        {/* Edge Cases & Stress Tests */}
        <div style={{ 
          marginTop: '20px', 
          padding: '10px', 
          backgroundColor: theme === 'dark' ? '#2a2a2a' : '#f0f0f0', 
          borderRadius: '4px' 
        }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: theme === 'dark' ? '#bbb' : '#333' }}>
            Edge Cases:
          </div>
          <button 
            onClick={() => {
              if (dataRange) {
                const viewport = chartRef.current?.getViewport?.();
                const cadence = viewport?.cadenceSec || 1; // dynamic cadence
                const barsToShow = 5;
                const timeSpan = cadence * barsToShow;
                const midTime = (dataRange.minTime + dataRange.maxTime) / 2;
                const result = chartRef.current?.setViewport(
                  midTime - timeSpan / 2,
                  midTime + timeSpan / 2,
                  null,
                  null
                );
                console.log('Tiny range (5 bars):', result);
              }
            }}
            style={{ 
              margin: '2px', 
              padding: '4px 8px', 
              backgroundColor: theme === 'dark' ? '#3a3a3a' : '#e0e0e0',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            🧪 Tiny Range
          </button>
          <button 
            onClick={() => {
              if (dataRange) {
                // Try to set range beyond data bounds
                const result = chartRef.current?.setViewport(
                  dataRange.minTime - 86400, // 1 day before
                  dataRange.maxTime + 86400, // 1 day after
                  dataRange.minPrice - 50,
                  dataRange.maxPrice + 50
                );
                console.log('Huge range (beyond bounds):', result);
              }
            }}
            style={{ 
              margin: '2px', 
              padding: '4px 8px', 
              backgroundColor: theme === 'dark' ? '#3a3a3a' : '#e0e0e0',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            🧪 Huge Range
          </button>
          <button 
            onClick={() => {
              if (dataRange) {
                const midTime = (dataRange.minTime + dataRange.maxTime) / 2;
                // Pass time2 < time1 to test auto-correction
                const result = chartRef.current?.setViewport(
                  midTime + 1000,
                  midTime - 1000,
                  150,
                  140
                );
                console.log('Invalid range (time2 < time1, price2 < price1):', result);
              }
            }}
            style={{ 
              margin: '2px', 
              padding: '4px 8px', 
              backgroundColor: theme === 'dark' ? '#3a3a3a' : '#e0e0e0',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            🧪 Invalid Range
          </button>
        </div>
        {/* Focus on Drawing(s) */}
        <div style={{ 
          marginTop: '20px', 
          padding: '10px', 
          backgroundColor: theme === 'dark' ? '#2a2a2a' : '#f0f0f0', 
          borderRadius: '4px' 
        }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: theme === 'dark' ? '#bbb' : '#333' }}>
            Focus on Drawing(s):
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={refreshDrawings}
              style={{ 
                margin: '2px', 
                padding: '4px 8px', 
                backgroundColor: theme === 'dark' ? '#3a3a3a' : '#e0e0e0',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              🔄 Refresh Drawings
            </button>
            <select
              value={selectedDrawingId}
              onChange={(e) => setSelectedDrawingId(e.target.value)}
              style={{
                padding: '6px 8px',
                backgroundColor: theme === 'dark' ? '#1f2937' : '#fff',
                color: theme === 'dark' ? '#fff' : '#000',
                border: `1px solid ${theme === 'dark' ? '#374151' : '#ccc'}`,
                borderRadius: '4px',
                minWidth: '260px'
              }}
            >
              {drawings.length === 0 && <option value="">No drawings found</option>}
              {drawings.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.type} • {d.id} {d.isVisible ? '' : '(hidden)'}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                if (!selectedDrawingId) return;
                const res = chartRef.current?.focusOnDrawing(selectedDrawingId);
                console.log('focusOnDrawing(selected):', selectedDrawingId, res);
              }}
              disabled={!selectedDrawingId}
              style={{ 
                margin: '2px', 
                padding: '4px 8px', 
                backgroundColor: selectedDrawingId ? '#2563eb' : '#666',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: selectedDrawingId ? 'pointer' : 'not-allowed',
                fontSize: '12px'
              }}
            >
              🎯 Focus Selected
            </button>
            <button
              onClick={() => {
                if (drawings.length === 0) return;
                const ids = drawings.map(d => d.id);
                const res = chartRef.current?.focusOnDrawing(ids);
                console.log('focusOnDrawing(all):', ids, res);
              }}
              disabled={drawings.length === 0}
              style={{ 
                margin: '2px', 
                padding: '4px 8px', 
                backgroundColor: drawings.length ? '#10b981' : '#666',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: drawings.length ? 'pointer' : 'not-allowed',
                fontSize: '12px'
              }}
            >
              🧿 Focus All
            </button>
            <button
              onClick={() => {
                const t = drawings.filter(d => d.type === 'trendline').at(-1);
                if (!t) return;
                const res = chartRef.current?.focusOnDrawing(t.id);
                console.log('focusOnDrawing(last trendline):', t.id, res);
              }}
              disabled={!drawings.some(d => d.type === 'trendline')}
              style={{ 
                margin: '2px', 
                padding: '4px 8px', 
                backgroundColor: drawings.some(d => d.type === 'trendline') ? '#9333ea' : '#666',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: drawings.some(d => d.type === 'trendline') ? 'pointer' : 'not-allowed',
                fontSize: '12px'
              }}
            >
              📐 Last Trendline
            </button>
            <button
              onClick={() => {
                const r = drawings.filter(d => d.type === 'rectangle').at(-1);
                if (!r) return;
                const res = chartRef.current?.focusOnDrawing(r.id);
                console.log('focusOnDrawing(last rectangle):', r.id, res);
              }}
              disabled={!drawings.some(d => d.type === 'rectangle')}
              style={{ 
                margin: '2px', 
                padding: '4px 8px', 
                backgroundColor: drawings.some(d => d.type === 'rectangle') ? '#f59e0b' : '#666',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: drawings.some(d => d.type === 'rectangle') ? 'pointer' : 'not-allowed',
                fontSize: '12px'
              }}
            >
              ▭ Last Rectangle
            </button>
            <button
              onClick={() => {
                const l = drawings.filter(d => d.type === 'label').at(-1);
                if (!l) return;
                const res = chartRef.current?.focusOnDrawing(l.id);
                console.log('focusOnDrawing(last label):', l.id, res);
              }}
              disabled={!drawings.some(d => d.type === 'label')}
              style={{ 
                margin: '2px', 
                padding: '4px 8px', 
                backgroundColor: drawings.some(d => d.type === 'label') ? '#ef4444' : '#666',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: drawings.some(d => d.type === 'label') ? 'pointer' : 'not-allowed',
                fontSize: '12px'
              }}
            >
              🏷️ Last Label
            </button>
          </div>
          <div style={{ marginTop: '6px', fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#555' }}>
            {drawings.length} drawing(s) detected
          </div>
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
          symbol="SPY" 
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
