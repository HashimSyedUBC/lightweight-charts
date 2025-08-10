import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  Time,
  CandlestickSeriesOptions,
  DeepPartial
} from 'lightweight-charts';
import { MockPolygonWebSocket, PolygonAggregateBar } from './MockPolygonWebSocket';
import { TrendLineManager, TrendLineOptions } from './TrendLinePrimitive';
import { TrendLineData } from './DrawingControls';

interface TradingChartProps {
  symbol?: string;
  initialPrice?: number;
  backgroundColor?: string;
  textColor?: string;
  onDataRangeChange?: (range: ChartDataRange | null) => void;
}

export interface ChartDataRange {
  minTime: number;
  maxTime: number;
  minPrice: number;
  maxPrice: number;
}

export interface TradingChartRef {
  addTrendLine: (lineData: TrendLineData) => void;
  removeTrendLine: (id: string) => void;
  removeAllTrendLines: () => void;
  getDataRange: () => ChartDataRange | null;
}

export const TradingChart = forwardRef<TradingChartRef, TradingChartProps>(
  ({ symbol = 'AAPL', initialPrice = 150.00, backgroundColor = '#1e1e1e', textColor = '#d1d4dc', onDataRangeChange }, ref) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const wsRef = useRef<MockPolygonWebSocket | null>(null);
  const trendLineManagerRef = useRef<TrendLineManager | null>(null);
  const chartDataRef = useRef<CandlestickData[]>([]);

  // Helper function to notify data range changes
  const notifyDataRangeChange = () => {
    if (onDataRangeChange && chartRef.current) {
      const data = chartDataRef.current;
      if (data.length === 0) {
        onDataRangeChange(null);
        return;
      }
      
      // Use the actual data range - no guessing or extending
      const times = data.map(d => d.time as number);
      const prices = data.flatMap(d => [d.open, d.high, d.low, d.close]);
      
      const range: ChartDataRange = {
        minTime: Math.min(...times),
        maxTime: Math.max(...times),
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices)
      };
      
      console.log(`📊 Data range timestamps: ${range.minTime} to ${range.maxTime}`);
      console.log(`📅 Chart time display: ${new Date(range.minTime * 1000).getUTCHours()}:00 to ${new Date(range.maxTime * 1000).getUTCHours()}:${new Date(range.maxTime * 1000).getUTCMinutes().toString().padStart(2, '0')}`);
      
      onDataRangeChange(range);
    }
  };

  // Helper function to extend time scale for trend lines
  const extendTimeScaleForTrendLines = () => {
    if (!chartRef.current || !trendLineManagerRef.current) return;
    
    const furthestTime = trendLineManagerRef.current.getFurthestTime();
    if (!furthestTime) {
      // No trend lines, just fit to data
      chartRef.current.timeScale().fitContent();
      return;
    }
    
    // Get current data range
    const data = chartDataRef.current;
    if (data.length === 0) return;
    
    const dataMinTime = Math.min(...data.map(d => d.time as number));
    const dataMaxTime = Math.max(...data.map(d => d.time as number));
    
    // Calculate extended range (use furthest trend line time or data max, whichever is later)
    const extendedMaxTime = Math.max(dataMaxTime, furthestTime);
    
    // Set visible range with some padding
    const padding = (extendedMaxTime - dataMinTime) * 0.05; // 5% padding
    chartRef.current.timeScale().setVisibleRange({
      from: (dataMinTime - padding) as Time,
      to: (extendedMaxTime + padding) as Time
    });
  };

  // Helper function to extend time scale for a specific new trend line before adding it
  const extendTimeScaleForNewLine = (lineData: TrendLineData) => {
    console.log('🔍 extendTimeScaleForNewLine called');
    
    if (!chartRef.current || chartDataRef.current.length === 0) {
      console.log('❌ No chart or data available, returning');
      return;
    }
    
    // Get current data range
    const dataMinTime = Math.min(...chartDataRef.current.map(d => d.time as number));
    const dataMaxTime = Math.max(...chartDataRef.current.map(d => d.time as number));
    console.log('📊 Data range:', { 
      min: dataMinTime, 
      max: dataMaxTime,
      minDate: new Date(dataMinTime * 1000).toUTCString(),
      maxDate: new Date(dataMaxTime * 1000).toUTCString()
    });
    
    // Check if new line extends beyond current data
    const lineMaxTime = Math.max(lineData.point1.time as number, lineData.point2.time as number);
    const lineMinTime = Math.min(lineData.point1.time as number, lineData.point2.time as number);
    console.log('📐 Line range:', { 
      min: lineMinTime, 
      max: lineMaxTime,
      minDate: new Date(lineMinTime * 1000).toUTCString(),
      maxDate: new Date(lineMaxTime * 1000).toUTCString()
    });
    
    // If line extends beyond data, update visible range
    if (lineMaxTime > dataMaxTime || lineMinTime < dataMinTime) {
      console.log('⚡ Line extends beyond data! Extending time scale...');
      const newMinTime = Math.min(dataMinTime, lineMinTime);
      const newMaxTime = Math.max(dataMaxTime, lineMaxTime);
      const padding = (newMaxTime - newMinTime) * 0.05; // 5% padding
      
      console.log('📏 Setting new visible range:', {
        from: newMinTime - padding,
        to: newMaxTime + padding,
        fromDate: new Date((newMinTime - padding) * 1000).toUTCString(),
        toDate: new Date((newMaxTime + padding) * 1000).toUTCString()
      });
      
      chartRef.current.timeScale().setVisibleRange({
        from: (newMinTime - padding) as Time,
        to: (newMaxTime + padding) as Time
      });
      console.log('✅ Time scale extended');
    } else {
      console.log('📌 Line is within data range, no extension needed');
    }
  };

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    addTrendLine: (lineData: TrendLineData) => {
      console.log('🎯 addTrendLine called with:', {
        point1: { time: lineData.point1.time, price: lineData.point1.price },
        point2: { time: lineData.point2.time, price: lineData.point2.price },
        id: lineData.id
      });
      
      if (trendLineManagerRef.current && chartRef.current) {
        console.log('📊 Chart and manager exist, proceeding...');
        
        // Log current visible range before extension
        const currentRange = chartRef.current.timeScale().getVisibleRange();
        console.log('📍 Current visible range:', currentRange);
        
        // FIRST: Extend time scale if needed (before adding the trend line)
        extendTimeScaleForNewLine(lineData);
        
        // Log visible range after extension
        const newRange = chartRef.current.timeScale().getVisibleRange();
        console.log('📍 New visible range after extension:', newRange);
        
        // THEN: Add the trend line (it will now have valid coordinates)
        const trendLineOptions: TrendLineOptions = {
          point1: lineData.point1,
          point2: lineData.point2,
          color: lineData.color,
          lineWidth: lineData.lineWidth || 2,
          lineStyle: lineData.lineStyle || 0,
          id: lineData.id,
          showLabel: true
        };
        console.log('➕ Adding trend line with options:', trendLineOptions);
        trendLineManagerRef.current.addTrendLine(trendLineOptions);
        
        // Simple refresh to ensure visibility
        console.log('🔄 Triggering refresh...');
        setTimeout(() => {
          if (chartRef.current && chartContainerRef.current) {
            chartRef.current.applyOptions({ 
              width: chartContainerRef.current.clientWidth 
            });
            console.log('✅ Refresh complete');
          }
        }, 10);
      } else {
        console.log('❌ Chart or manager not available');
      }
    },
    removeTrendLine: (id: string) => {
      if (trendLineManagerRef.current) {
        trendLineManagerRef.current.removeTrendLine(id);
        // Auto-refresh after removal and recalculate time scale
        if (chartRef.current) {
          extendTimeScaleForTrendLines();
          setTimeout(() => {
            if (chartRef.current && chartContainerRef.current) {
              chartRef.current.applyOptions({ 
                width: chartContainerRef.current.clientWidth 
              });
            }
          }, 10);
        }
      }
    },
    removeAllTrendLines: () => {
      if (trendLineManagerRef.current) {
        trendLineManagerRef.current.removeAllTrendLines();
        // Auto-refresh after removal and reset time scale to data only
        if (chartRef.current) {
          chartRef.current.timeScale().fitContent(); // Back to data-only view
          setTimeout(() => {
            if (chartRef.current && chartContainerRef.current) {
              chartRef.current.applyOptions({ 
                width: chartContainerRef.current.clientWidth 
              });
            }
          }, 10);
        }
      }
    },
    getDataRange: (): ChartDataRange | null => {
      const data = chartDataRef.current;
      if (data.length === 0) return null;
      
      const times = data.map(d => d.time as number);
      const prices = data.flatMap(d => [d.open, d.high, d.low, d.close]);
      
      return {
        minTime: Math.min(...times),
        maxTime: Math.max(...times),
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices)
      };
    }
  }), []);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 600,
      layout: {
        background: { color: backgroundColor },
        textColor: textColor,
      },
      grid: {
        vertLines: { color: backgroundColor === '#1e1e1e' ? '#2a2a2a' : '#e0e0e0' },
        horzLines: { color: backgroundColor === '#1e1e1e' ? '#2a2a2a' : '#e0e0e0' },
      },
      crosshair: {
        mode: 0,
      },
      rightPriceScale: {
        borderColor: backgroundColor === '#1e1e1e' ? '#2a2a2a' : '#e0e0e0',
      },
      timeScale: {
        borderColor: backgroundColor === '#1e1e1e' ? '#2a2a2a' : '#e0e0e0',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5, // Keep some space on the right for live updates
      },
    });

    chartRef.current = chart;
    
    // Create candlestick series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });
    
    seriesRef.current = candlestickSeries;
    
    // Initialize trend line manager
    trendLineManagerRef.current = new TrendLineManager(candlestickSeries);

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ 
          width: chartContainerRef.current.clientWidth 
        });
      }
    };
    window.addEventListener('resize', handleResize);

    // STATIC MODE - Generate UTC data then convert for EST display
    const generateSampleData = () => {
      const data: CandlestickData[] = [];
      
      // Create UTC timestamps for August 9, 2025
      // Start at 00:00 UTC (which is 8:00 PM EST on Aug 8)
      const startTime = Math.floor(Date.UTC(2025, 7, 9, 0, 0, 0) / 1000); // Aug 9, 2025 00:00 UTC
      
      console.log(`📅 Raw UTC data start: ${startTime} (${new Date(startTime * 1000).toUTCString()})`);
      
      let price = initialPrice;
      
      // Create data points every 15 minutes for 24 hours
      for (let i = 0; i < 96; i++) {
        const utcTime = startTime + (i * 15 * 60); // 15 minute intervals in UTC
        
        // Convert UTC to "fake UTC" that displays as EST
        // Subtract 4 hours (14400 seconds) for EDT offset
        const displayTime = (utcTime - 14400) as Time;
        
        const open = price;
        const close = price + (i % 8 === 0 ? 1 : -0.3);
        const high = Math.max(open, close) + 0.5;
        const low = Math.min(open, close) - 0.5;
        
        data.push({ 
          time: displayTime,  // Use converted time for display
          open, 
          high, 
          low, 
          close 
        });
        price = close;
      }
      
      // Show what the chart actually displays (in UTC format but representing EST times)
      const startHour = new Date((data[0].time as number) * 1000).getUTCHours();
      const endHour = new Date((data[data.length - 1].time as number) * 1000).getUTCHours();
      const endMinute = new Date((data[data.length - 1].time as number) * 1000).getUTCMinutes();
      
      console.log(`📅 Chart displays: ${startHour}:00 to ${endHour}:${endMinute.toString().padStart(2, '0')} (24-hour format)`);
      console.log(`📊 These times represent EST/EDT (UTC-4)`);
      console.log(`📍 Actual display timestamps: ${data[0].time} to ${data[data.length - 1].time}`);
      
      return data;
    };
    
    // Add sample data to the chart
    const sampleData = generateSampleData();
    
    // Store data for range calculation
    chartDataRef.current = sampleData;
    candlestickSeries.setData(sampleData);
    
    // Listen for visible range changes to update data range
    chart.timeScale().subscribeVisibleTimeRangeChange(() => {
      notifyDataRangeChange();
    });
    
    // Fit the chart to show all the data
    chart.timeScale().fitContent();
    
    // Notify parent of data range
    notifyDataRangeChange();
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [symbol, initialPrice]);

  // Update chart colors when theme changes
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.applyOptions({
        layout: {
          background: { color: backgroundColor },
          textColor: textColor,
        },
        grid: {
          vertLines: { color: backgroundColor === '#1e1e1e' ? '#2a2a2a' : '#e0e0e0' },
          horzLines: { color: backgroundColor === '#1e1e1e' ? '#2a2a2a' : '#e0e0e0' },
        },
        rightPriceScale: {
          borderColor: backgroundColor === '#1e1e1e' ? '#2a2a2a' : '#e0e0e0',
        },
        timeScale: {
          borderColor: backgroundColor === '#1e1e1e' ? '#2a2a2a' : '#e0e0e0',
        },
      });
    }
  }, [backgroundColor, textColor]);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div 
        ref={chartContainerRef} 
        style={{ 
          width: '100%', 
          height: '600px'
        }} 
      />
      <button
        onClick={() => chartRef.current?.timeScale().scrollToRealTime()}
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          padding: '10px 20px',
          backgroundColor: backgroundColor === '#1e1e1e' ? '#333' : '#eee',
          color: backgroundColor === '#1e1e1e' ? '#fff' : '#000',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '600',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          zIndex: 1000
        }}
      >
        Go to Realtime
      </button>
    </div>
  );
});
