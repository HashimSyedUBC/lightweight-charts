import React, { useState, useRef } from 'react';
import { TradingChart, TradingChartRef, ChartDataRange } from './TradingChart';
import { DrawingControls, TrendLineData } from './DrawingControls';
import './App.css';

function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [trendLines, setTrendLines] = useState<TrendLineData[]>([]);
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
          theme={theme}
          dataRange={dataRange}
        />
      </main>
    </div>
  );
}

export default App;
