import React, { useState, useRef } from 'react';
import { TradingChart, TradingChartRef, ChartDataRange } from './TradingChart';
import { DrawingControls, TrendLineData, LabelData } from './DrawingControls';
import { RectangleData } from './RectanglePrimitive';
import { Time } from 'lightweight-charts';
import './App.css';

function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [trendLines, setTrendLines] = useState<TrendLineData[]>([]);
  const [rectangles, setRectangles] = useState<RectangleData[]>([]);
  const [labels, setLabels] = useState<LabelData[]>([]);
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

  const handleAddTrendLine = (lineData: TrendLineData) => {
    setTrendLines(prev => [...prev, lineData]);
    chartRef.current?.addTrendLine(lineData);
  };

  const handleRemoveTrendLine = (id: string) => {
    setTrendLines(prev => prev.filter(line => line.id !== id));
    chartRef.current?.removeTrendLine(id);
  };

  const handleAddRectangle = (rectangleData: RectangleData) => {
    setRectangles(prev => [...prev, rectangleData]);
    chartRef.current?.addRectangle(rectangleData);
  };

  const handleRemoveRectangle = (id: string) => {
    setRectangles(prev => prev.filter(rect => rect.id !== id));
    chartRef.current?.removeRectangle(id);
  };

  const handleAddLabel = (labelData: LabelData) => {
    setLabels(prev => [...prev, labelData]);
    chartRef.current?.addLabel(labelData);
  };

  const handleRemoveLabel = (id: string) => {
    setLabels(prev => prev.filter(label => label.id !== id));
    chartRef.current?.removeLabel(id);
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
            onClick={() => {
              // TEST: Add two labels at different times
              const label1 = {
                id: Date.now().toString(),
                time: (Date.UTC(2025, 7, 9, 23, 0, 0) / 1000) as Time, // Aug 9, 23:00
                price: 152.50,
                text: 'LABEL AUG 9'
              };
              
              const label2 = {
                id: (Date.now() + 1).toString(),
                time: (Date.UTC(2025, 7, 7, 23, 0, 0) / 1000) as Time, // Aug 7, 23:00
                price: 148.00,
                text: 'LABEL AUG 7'
              };
              
              chartRef.current?.addLabel(label1);
              chartRef.current?.addLabel(label2);
              
              console.log('TEST: Added label at Aug 9 23:00');
              console.log('TEST: Added label at Aug 7 23:00');
            }}
            style={{
              marginLeft: '10px',
              padding: '8px 16px',
              backgroundColor: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Test Label (Red Dot)
          </button>
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
        <DrawingControls
          onAddTrendLine={handleAddTrendLine}
          onRemoveTrendLine={handleRemoveTrendLine}
          trendLines={trendLines}
          onAddRectangle={handleAddRectangle}
          onRemoveRectangle={handleRemoveRectangle}
          rectangles={rectangles}
          onAddLabel={handleAddLabel}
          onRemoveLabel={handleRemoveLabel}
          labels={labels}
          theme={theme}
          dataRange={dataRange}
        />
      </main>
    </div>
  );
}

export default App;
