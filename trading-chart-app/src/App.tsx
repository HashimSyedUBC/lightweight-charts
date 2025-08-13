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
                const cadence = 300; // 5 min bars
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
                const cadence = 300; // 5 min bars
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
                const cadence = 300; // 5 min bars
                const barsToShow = 20;
                const timeSpan = cadence * barsToShow;
                const result = chartRef.current?.setViewport(
                  dataRange.maxTime - timeSpan,
                  dataRange.maxTime,
                  null,
                  null
                );
                console.log('Show last 20 bars:', result);
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
                const cadence = 300; // 5 min bars
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
                const cadence = 300; // 5 min bars
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
                const cadence = 300; // 5 min bars
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
                const cadence = 300; // 5 min bars
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
