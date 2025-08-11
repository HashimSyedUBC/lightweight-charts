import React, { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  Time,
  ColorType,
  CandlestickSeriesOptions,
  DeepPartial
} from 'lightweight-charts';
import { MockPolygonWebSocket, PolygonAggregateBar } from './MockPolygonWebSocket';
import { TrendLineManager, TrendLineOptions } from './TrendLinePrimitive';
import { RectangleManager, RectangleData } from './RectanglePrimitive';
import { LabelManager, LabelOptions } from './LabelPrimitive';
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
  addRectangle: (rectangleData: RectangleData) => void;
  removeRectangle: (id: string) => void;
  addLabel: (labelData: { time: Time; price: number; text: string; id: string }) => void;
  removeLabel: (id: string) => void;
  getDataRange: () => ChartDataRange | null;
}

export const TradingChart = forwardRef<TradingChartRef, TradingChartProps>(
  ({ symbol = 'AAPL', initialPrice = 150.00, backgroundColor = '#1e1e1e', textColor = '#d1d4dc', onDataRangeChange }, ref) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const wsRef = useRef<MockPolygonWebSocket | null>(null);
  const trendLineManagerRef = useRef<TrendLineManager | null>(null);
  const rectangleManagerRef = useRef<RectangleManager | null>(null);
  const labelManagerRef = useRef<LabelManager | null>(null);
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

  // Helper function to extend time scale for any shape before adding it
  const extendTimeScaleForShape = (shapeMinTime: number, shapeMaxTime: number) => {
    if (!chartRef.current || !seriesRef.current || chartDataRef.current.length === 0) {
      return;
    }
    
    // Get current data range
    const dataMinTime = Math.min(...chartDataRef.current.map(d => d.time as number));
    const dataMaxTime = Math.max(...chartDataRef.current.map(d => d.time as number));

    
    // If shape extends beyond data, add whitespace data points
    if (shapeMaxTime > dataMaxTime || shapeMinTime < dataMinTime) {

      
      // Get current data
      const currentData = [...chartDataRef.current];
      const whitespaceData: any[] = []; // Using any[] for whitespace data
      
      // Add whitespace data at 15-minute intervals beyond current range
      if (shapeMaxTime > dataMaxTime) {

        let time = dataMaxTime + 900; // Start 15 minutes after last data
        while (time <= shapeMaxTime + 900) { // Add one extra point beyond line
          whitespaceData.push({ time: time as Time });

          time += 900; // 15 minute intervals
        }
      }
      
      if (shapeMinTime < dataMinTime) {

        let time = dataMinTime - 900; // Start 15 minutes before first data
        while (time >= shapeMinTime - 900) { // Add one extra point before line
          whitespaceData.unshift({ time: time as Time });

          time -= 900; // 15 minute intervals
        }
      }
      
      // Combine whitespace with existing data and sort by time
      const combinedData = [...whitespaceData, ...currentData].sort((a, b) => 
        (a.time as number) - (b.time as number)
      );
      

      
      // Update chart data reference
      chartDataRef.current = combinedData;
      
      // Update series with new data
      seriesRef.current.setData(combinedData);
      
      // Now set visible range to show the trend line
      const padding = (shapeMaxTime - shapeMinTime) * 0.05; // 5% padding
      chartRef.current.timeScale().setVisibleRange({
        from: (shapeMinTime - padding) as Time,
        to: (shapeMaxTime + padding) as Time
      });
      
    }
  };

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    addTrendLine: (lineData: TrendLineData) => {
      if (trendLineManagerRef.current && chartRef.current) {
        // FIRST: Extend time scale if needed (before adding the trend line)
        const minTime = Math.min(lineData.point1.time as number, lineData.point2.time as number);
        const maxTime = Math.max(lineData.point1.time as number, lineData.point2.time as number);
        extendTimeScaleForShape(minTime, maxTime);
        
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
        trendLineManagerRef.current.addTrendLine(trendLineOptions);
        
        // Simple refresh to ensure visibility
        setTimeout(() => {
          if (chartRef.current && chartContainerRef.current) {
            chartRef.current.applyOptions({ 
              width: chartContainerRef.current.clientWidth 
            });
          }
        }, 10);
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
    addRectangle: (rectangleData: RectangleData) => {
      if (rectangleManagerRef.current && chartRef.current) {
        // FIRST: Extract min/max times from all 4 points
        const times = [
          rectangleData.points.p1.time as number,
          rectangleData.points.p2.time as number,
          rectangleData.points.p3.time as number,
          rectangleData.points.p4.time as number
        ];
        const minTime = Math.min(...times);
        const maxTime = Math.max(...times);
        
        // Extend time scale if needed
        extendTimeScaleForShape(minTime, maxTime);
        
        // THEN: Add the rectangle (it will now have valid coordinates)
        rectangleManagerRef.current.addRectangle(rectangleData);
        
        // Simple refresh to ensure visibility
        setTimeout(() => {
          if (chartRef.current && chartContainerRef.current) {
            chartRef.current.applyOptions({ 
              width: chartContainerRef.current.clientWidth 
            });
          }
        }, 10);
      }
    },
    removeRectangle: (id: string) => {
      if (rectangleManagerRef.current) {
        rectangleManagerRef.current.removeRectangle(id);
        // Auto-refresh after removal
        setTimeout(() => {
          if (chartRef.current && chartContainerRef.current) {
            chartRef.current.applyOptions({ 
              width: chartContainerRef.current.clientWidth 
            });
          }
        }, 10);
      }
    },
    addLabel: (labelData: { time: Time; price: number; text: string; id: string }) => {
      if (labelManagerRef.current && chartRef.current) {
        // FIRST: Extend time scale if needed (before adding the label)
        extendTimeScaleForShape(labelData.time as number, labelData.time as number);
        
        // THEN: Add the label
        const labelOptions: LabelOptions = {
          time: labelData.time,
          price: labelData.price,
          text: labelData.text,
          color: '#ef4444', // red
          fontSize: 25,
          id: labelData.id
        };
        labelManagerRef.current.addLabel(labelOptions);
        console.log('[TradingChart] Label added via ref:', labelData.id);
        
        // Simple refresh to ensure visibility (same as trend lines and rectangles)
        setTimeout(() => {
          if (chartRef.current && chartContainerRef.current) {
            chartRef.current.applyOptions({ 
              width: chartContainerRef.current.clientWidth 
            });
          }
        }, 10);
      }
    },
    removeLabel: (id: string) => {
      if (labelManagerRef.current) {
        labelManagerRef.current.removeLabel(id);
        console.log('[TradingChart] Label removed:', id);
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
    },

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
    
    // Initialize rectangle manager
    rectangleManagerRef.current = new RectangleManager(chart, candlestickSeries);
    
    // Initialize label manager
    labelManagerRef.current = new LabelManager(candlestickSeries);
    
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
