import React, { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, BarData, Time, LineStyle, DeepPartial, ChartOptions, LineData } from 'lightweight-charts';
import { TrendLineManager, TrendLineOptions } from './TrendLinePrimitive';
import { RectangleManager, RectangleData } from './RectanglePrimitive';
import { LabelManager, LabelOptions } from './LabelPrimitive';


export interface TrendLineData {
  id: string;
  point1: {
    time: Time;
    price: number;
  };
  point2: {
    time: Time;
    price: number;
  };
  color: string;
  lineWidth?: number;
  lineStyle?: number; // 0 = solid, 1 = dotted, 2 = dashed
}

export interface LabelData {
  id: string;
  time: Time;
  price: number;
  text: string;
  color?: string;
}

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
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const timeExtensionSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const chartDataRef = useRef<CandlestickData[]>([]);
  const currentPriceRef = useRef<number>(initialPrice);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const trendLineManagerRef = useRef<TrendLineManager | null>(null);
  const rectangleManagerRef = useRef<RectangleManager | null>(null);
  const labelManagerRef = useRef<LabelManager | null>(null);
  const hasNotifiedDataRangeRef = useRef<boolean>(false);
  const timeExtensionPointsRef = useRef(new Map<string, LineData[]>());
  const lockedVisibleRangeRef = useRef<{ from: Time; to: Time } | null>(null);
  const isUpdatingExtensionRef = useRef(false);
  const barIntervalSecRef = useRef<number>(900);

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

  // Compute dominant cadence (seconds) from current data
  const computeCadenceSec = (data: CandlestickData[]): number => {
    if (!data || data.length < 2) return barIntervalSecRef.current;
    const times = data.map(d => d.time as number).sort((a, b) => a - b);
    const diffs: number[] = [];
    for (let i = 1; i < times.length; i++) {
      const delta = times[i] - times[i - 1];
      if (delta > 0) diffs.push(delta);
    }
    if (diffs.length === 0) return barIntervalSecRef.current;
    const counts: { [delta: number]: number } = {};
    for (const d of diffs) counts[d] = (counts[d] ?? 0) + 1;
    let mode = diffs[0];
    let maxC = 0;
    for (const k in counts) {
      const v = counts[k as any];
      if (v > maxC) { maxC = v; mode = Number(k); }
    }
    return mode;
  };

  // Helper function to update the time extension series
  const updateTimeExtensionSeries = () => {
    if (!timeExtensionSeriesRef.current || !chartRef.current) return;

    // Capture current visible range BEFORE updating extension series
    const currentVisibleRange = chartRef.current.timeScale().getVisibleRange();
    
    // Collect all points from all drawings
    const allPoints: LineData[] = [];
    
    timeExtensionPointsRef.current.forEach((points) => {
      allPoints.push(...points);
    });

    // Sort by time and remove duplicates
    const uniquePoints = allPoints
      .sort((a, b) => (a.time as number) - (b.time as number))
      .filter((point, index, array) => 
        index === 0 || (point.time as number) !== (array[index - 1].time as number)
      );

    
    // Set flag to indicate we're updating extensions
    isUpdatingExtensionRef.current = true;
    
    // Update the time extension series
    timeExtensionSeriesRef.current.setData(uniquePoints);
    // Reset update flag
    isUpdatingExtensionRef.current = false;
  };

  // Helper function to add time extension for a drawing
  const addTimeExtensionForDrawing = (drawingId: string, minTime: number, maxTime: number) => {
    if (!chartRef.current || chartDataRef.current.length === 0) return;
    
    const dataMinTime = Math.min(...chartDataRef.current.map(d => d.time as number));
    const dataMaxTime = Math.max(...chartDataRef.current.map(d => d.time as number));
    
    // Get first and last candle prices to use for extensions
    const sortedData = [...chartDataRef.current].sort((a, b) => (a.time as number) - (b.time as number));
    const firstCandle = sortedData[0];
    const lastCandle = sortedData[sortedData.length - 1];
    
    // Use close prices from the edge candles for extension points
    const firstPrice = firstCandle.close || 100;
    const lastPrice = lastCandle.close || 100;
    
    const extensionPoints: LineData[] = [];
    
    // Generate extension points using detected bar cadence
    const interval = barIntervalSecRef.current;
    
    // Add points BEFORE data range if needed
    if (minTime < dataMinTime) {
      for (let time = minTime; time < dataMinTime; time += interval) {
        extensionPoints.push({ time: time as Time, value: firstPrice });
      }
      // Ensure exact left endpoint exists
      if (extensionPoints.length === 0 || (extensionPoints[0].time as number) !== minTime) {
        extensionPoints.push({ time: minTime as Time, value: firstPrice });
      }
    }
    
    // Add points AFTER data range if needed
    if (maxTime > dataMaxTime) {
      for (let time = dataMaxTime + interval; time <= maxTime; time += interval) {
        extensionPoints.push({ time: time as Time, value: lastPrice });
      }
      // Ensure exact endpoint exists on time scale
      if (extensionPoints.length === 0 || (extensionPoints[extensionPoints.length - 1].time as number) !== maxTime) {
        extensionPoints.push({ time: maxTime as Time, value: lastPrice });
      }
    }
    
    if (extensionPoints.length > 0) {
      timeExtensionPointsRef.current.set(drawingId, extensionPoints);
      updateTimeExtensionSeries();
      
      // Don't auto-zoom - let user control the view
      // This prevents candlesticks from shifting when adding drawings
    }
  };

  // Helper to add time extensions for arbitrary exact times (inside or outside data range)
  const addTimeExtensionsForTimes = (drawingId: string, times: number[]) => {
    if (!chartRef.current || chartDataRef.current.length === 0) return;

    const dataMinTime = Math.min(...chartDataRef.current.map(d => d.time as number));
    const dataMaxTime = Math.max(...chartDataRef.current.map(d => d.time as number));

    // Get first and last candle prices to use for extensions
    const sortedData = [...chartDataRef.current].sort((a, b) => (a.time as number) - (b.time as number));
    const firstCandle = sortedData[0];
    const lastCandle = sortedData[sortedData.length - 1];

    const firstPrice = firstCandle.close || 100;
    const lastPrice = lastCandle.close || 100;

    const interval = barIntervalSecRef.current;

    // Unique sorted times
    const uniqueTimes = Array.from(new Set(times)).sort((a, b) => a - b);

    const leftTimes = uniqueTimes.filter(t => t < dataMinTime);
    const rightTimes = uniqueTimes.filter(t => t > dataMaxTime);
    const insideTimes = uniqueTimes.filter(t => t >= dataMinTime && t <= dataMaxTime);

    const extensionPoints: LineData[] = [];

    // Extend left side with cadence and ensure exact left times exist
    if (leftTimes.length > 0) {
      const leftMin = Math.min(...leftTimes);
      for (let t = leftMin; t < dataMinTime; t += interval) {
        extensionPoints.push({ time: t as Time, value: firstPrice });
      }
      leftTimes.forEach((t) => {
        extensionPoints.push({ time: t as Time, value: firstPrice });
      });
    }

    // Extend right side with cadence and ensure exact right times exist
    if (rightTimes.length > 0) {
      const rightMax = Math.max(...rightTimes);
      for (let t = dataMaxTime + interval; t <= rightMax; t += interval) {
        extensionPoints.push({ time: t as Time, value: lastPrice });
      }
      rightTimes.forEach((t) => {
        extensionPoints.push({ time: t as Time, value: lastPrice });
      });
    }

    // Ensure inside-range exact times exist on the time scale
    insideTimes.forEach((t) => {
      extensionPoints.push({ time: t as Time, value: lastPrice });
    });

    if (extensionPoints.length > 0) {
      timeExtensionPointsRef.current.set(drawingId, extensionPoints);
      updateTimeExtensionSeries();
    }
  };

  // Helper function to remove time extension for a drawing
  const removeTimeExtensionForDrawing = (drawingId: string) => {
    timeExtensionPointsRef.current.delete(drawingId);
    updateTimeExtensionSeries();
  };



  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    addTrendLine: (lineData: TrendLineData) => {
      if (trendLineManagerRef.current && chartRef.current) {
        // Log before adding trend line
        
        // FIRST: Inject exact endpoint times (inside or outside range)
        addTimeExtensionsForTimes(lineData.id, [
          lineData.point1.time as number,
          lineData.point2.time as number,
        ]);
        
        // THEN: Add the trend line
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
        
        // Log after adding trend line
        
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
        removeTimeExtensionForDrawing(id);
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
    removeAllTrendLines: () => {
      if (trendLineManagerRef.current) {
        trendLineManagerRef.current.removeAllTrendLines();
        // Clear all time extensions for trend lines
        const keysToRemove: string[] = [];
        timeExtensionPointsRef.current.forEach((_, key) => {
          if (key.startsWith('trendline-')) {
            keysToRemove.push(key);
          }
        });
        keysToRemove.forEach(key => timeExtensionPointsRef.current.delete(key));
        updateTimeExtensionSeries();
        
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
    addRectangle: (rectangleData: RectangleData) => {
      if (rectangleManagerRef.current && chartRef.current) {
        // FIRST: Extract min/max times from all 4 points
        const times = [
          rectangleData.points.p1.time as number,
          rectangleData.points.p2.time as number,
          rectangleData.points.p3.time as number,
          rectangleData.points.p4.time as number
        ];
        // Inject exact all-corner times (handles tilted/off-cadence rectangles)
        addTimeExtensionsForTimes(rectangleData.id, times);
        
        // THEN: Add the rectangle
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
        removeTimeExtensionForDrawing(id);
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
        // FIRST: Inject exact label time (inside or outside range)
        addTimeExtensionsForTimes(labelData.id, [labelData.time as number]);
        
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
        removeTimeExtensionForDrawing(id);
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
    
    // Create invisible line series for time extension
    const timeExtensionSeries = chart.addLineSeries({
      color: 'transparent',
      lineWidth: 1,
      lineVisible: false,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    
    timeExtensionSeriesRef.current = timeExtensionSeries;
    
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
      
      // Create data points every 5 minutes for 24 hours
      const mockIntervalSec = 5 * 60; // 5-minute cadence for testing
      const bars = Math.floor((24 * 60 * 60) / mockIntervalSec);
      for (let i = 0; i < bars; i++) {
        const utcTime = startTime + (i * mockIntervalSec);
        
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
    // Detect and store bar cadence from data
    barIntervalSecRef.current = computeCadenceSec(sampleData);
    
    // Listen for visible range changes to update data range
    chart.timeScale().subscribeVisibleTimeRangeChange(() => {
      notifyDataRangeChange();
    });
    
    // Fit the chart to show all the data
    chart.timeScale().fitContent();
    
    // Notify parent of data range
    notifyDataRangeChange();
    
    // Start live simulation
    let simulatedTime = sampleData[sampleData.length - 1].time as number;
    
    const startLiveSimulation = () => {
      intervalRef.current = setInterval(() => {
        if (!seriesRef.current || chartDataRef.current.length === 0) return;
        
        const currentData = [...chartDataRef.current];
        const lastCandle = currentData[currentData.length - 1];
        
        // Increment simulated time for next candle
        simulatedTime += barIntervalSecRef.current;
        
        // Don't create candles beyond our simulation window
        
        // Create new candle every update (simulating 15-minute intervals)
        const newCandle: CandlestickData = {
          time: simulatedTime as Time,
          open: lastCandle.close,
          high: lastCandle.close,
          low: lastCandle.close,
          close: lastCandle.close
        };
        currentData.push(newCandle);
        currentPriceRef.current = lastCandle.close;
        
        // Update current candle with price movement
        const currentCandle = currentData[currentData.length - 1];
        
        // Simulate realistic price movement
        const volatility = 0.002; // 0.2% volatility
        const trend = Math.random() > 0.5 ? 1 : -1;
        const priceChange = currentPriceRef.current * volatility * trend * Math.random();
        const newPrice = currentPriceRef.current + priceChange;
        
        // Update candle
        currentCandle.close = newPrice;
        currentCandle.high = Math.max(currentCandle.high, newPrice);
        currentCandle.low = Math.min(currentCandle.low, newPrice);
        
        // Update current price reference
        currentPriceRef.current = newPrice;
        
        // Update chart
        chartDataRef.current = currentData;
        seriesRef.current.setData(currentData);
        
        // Notify parent of data range change
        notifyDataRangeChange();
      }, 500); // Update every 2 seconds
    };
    
    // Start the simulation after initial data is loaded
    startLiveSimulation();
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
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
