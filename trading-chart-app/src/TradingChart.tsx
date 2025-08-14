import React, { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time, LineData, CandlestickSeries, LineSeries } from 'lightweight-charts';
import { TrendLineManager, TrendLineOptions } from './TrendLinePrimitive';
import { RectangleManager, RectangleData } from './RectanglePrimitive';
import { LabelManager, LabelOptions } from './LabelPrimitive';
import { unixToUTC, computeCadenceSec, updateTimeExtensionSeries, addTimeExtensionsForTimes, removeTimeExtensionForDrawing, notifyDataRangeChange, getDataRange, getViewport, centerOnTime, focusOnDrawing, setViewport } from './TradingChartCore';
import { addTrendLine, removeTrendLine, removeAllTrendLines, addRectangle, removeRectangle, addLabel, removeLabel, getData } from './TradingChartDrawings';


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

// Viewport API types
export type ScreenPoint = { x: number; y: number };

export type ViewportDrawing = {
  id: string;
  type: 'trendline' | 'rectangle' | 'label';
  isVisible: boolean;
  // style fields vary by type
  style: any;
  // geometry varies by type
  data: any;
  bounds: { minTime: string; maxTime: string; minPrice: number; maxPrice: number };
  screenPoints?: ScreenPoint[];
};

export interface ViewportState {
  timeRange: { minTime: string; maxTime: string; centerTime: string };
  priceRangeVisible: { minPrice: number; maxPrice: number; centerPrice: number };
  cadenceSec: number;
  barsVisibleEstimate: number;
  drawings: ViewportDrawing[];
}

export interface TradingChartRef {
  addTrendLine: (lineData: TrendLineData) => void;
  removeTrendLine: (id: string) => void;
  removeAllTrendLines: () => void;
  addRectangle: (rectangleData: RectangleData) => void;
  removeRectangle: (id: string) => void;
  addLabel: (labelData: { time: Time; price: number; text: string; id: string }) => void;
  removeLabel: (id: string) => void;
  getData: () => CandlestickData[];
  getDataRange: () => ChartDataRange | null;
  getViewport: () => ViewportState | null;
  centerOnTime: (time: number) => { changed: boolean; before: any; after: any } | null;
  focusOnDrawing: (
    drawingId: string | string[],
    opts?: {
      padding?: { timeFrac?: number; priceFrac?: number };
      minBars?: number;
      minPriceSpanAbs?: number;
      minPriceSpanFracOfVisible?: number;
    }
  ) => { changed: boolean; before: any; after: any } | null;
  setViewport: (
    time1?: number | null,
    time2?: number | null, 
    price1?: number | null,
    price2?: number | null
  ) => { changed: boolean; before: any; after: any } | null;
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
  const timeExtensionPointsRef = useRef(new Map<string, LineData[]>());
  const isUpdatingExtensionRef = useRef(false);
  const barIntervalSecRef = useRef<number>(900);
  const wsRef = useRef<WebSocket | null>(null);
  const firstDataArrivedRef = useRef(false);
  const lastBarTimeSecRef = useRef<number | null>(null);



  // Helper function to notify data range changes
  const notifyDataRangeChangeCallback = useCallback(() => {
    notifyDataRangeChange(onDataRangeChange, chartDataRef);
  }, [onDataRangeChange]);



  // Helper function to update the time extension series
  const updateTimeExtensionSeriesCallback = useCallback(() => {
    updateTimeExtensionSeries(timeExtensionSeriesRef, timeExtensionPointsRef, isUpdatingExtensionRef);
  }, []);


  // Helper to add time extensions for arbitrary exact times (inside or outside data range)
  const addTimeExtensionsForTimesCallback = useCallback((drawingId: string, times: number[]) => {
    addTimeExtensionsForTimes(drawingId, times, chartDataRef, timeExtensionPointsRef, barIntervalSecRef, updateTimeExtensionSeriesCallback);
  }, [updateTimeExtensionSeriesCallback]);

  // Helper function to remove time extension for a drawing
  const removeTimeExtensionForDrawingCallback = useCallback((drawingId: string) => {
    removeTimeExtensionForDrawing(drawingId, timeExtensionPointsRef, updateTimeExtensionSeriesCallback);
  }, [updateTimeExtensionSeriesCallback]);



  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    getData: () => {
      return getData(chartDataRef);
    },
    addTrendLine: (lineData: TrendLineData) => {
      addTrendLine(lineData, trendLineManagerRef, chartRef, chartContainerRef, addTimeExtensionsForTimesCallback);
    },
    removeTrendLine: (id: string) => {
      removeTrendLine(id, trendLineManagerRef, chartRef, chartContainerRef, removeTimeExtensionForDrawingCallback);
    },
    removeAllTrendLines: () => {
      removeAllTrendLines(trendLineManagerRef, chartRef, chartContainerRef, timeExtensionPointsRef, updateTimeExtensionSeriesCallback);
    },
    addRectangle: (rectangleData: RectangleData) => {
      addRectangle(rectangleData, rectangleManagerRef, chartRef, chartContainerRef, addTimeExtensionsForTimesCallback);
    },
    removeRectangle: (id: string) => {
      removeRectangle(id, rectangleManagerRef, chartRef, chartContainerRef, removeTimeExtensionForDrawingCallback);
    },
    addLabel: (labelData: { time: Time; price: number; text: string; id: string }) => {
      addLabel(labelData, labelManagerRef, chartRef, chartContainerRef, addTimeExtensionsForTimesCallback);
    },
    removeLabel: (id: string) => {
      removeLabel(id, labelManagerRef, removeTimeExtensionForDrawingCallback);
    },
    getDataRange: () => {
      return getDataRange(chartDataRef);
    },

    // Rich AI-friendly viewport snapshot
    getViewport: () => {
      return getViewport(chartRef, seriesRef, chartContainerRef, chartDataRef, trendLineManagerRef, rectangleManagerRef, labelManagerRef, barIntervalSecRef);
    },

    centerOnTime: (time: number) => {
      return centerOnTime(time, chartRef, seriesRef, chartContainerRef, chartDataRef);
    },

    focusOnDrawing: (
      drawingId: string | string[],
      opts?: {
        padding?: { timeFrac?: number; priceFrac?: number };
        minBars?: number;
        minPriceSpanAbs?: number;
        minPriceSpanFracOfVisible?: number;
      }
    ) => {
      return focusOnDrawing(drawingId, opts, chartRef, seriesRef, chartContainerRef, chartDataRef, trendLineManagerRef, rectangleManagerRef, labelManagerRef, barIntervalSecRef);
    },

    setViewport: (
      time1?: number | null,
      time2?: number | null, 
      price1?: number | null,
      price2?: number | null
    ) => {
      return setViewport(time1, time2, price1, price2, chartRef, seriesRef, chartContainerRef, chartDataRef);
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
      localization: {
        locale: 'en-US',
        timeFormatter: (t: Time) => {
          // Format both UTCTimestamp (seconds) and BusinessDay in Eastern Time
          const dtf = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false,
          });
          if (typeof t === 'number') {
            return dtf.format(new Date(t * 1000));
          }
          const { year, month, day } = t as { year: number; month: number; day: number };
          return dtf.format(new Date(Date.UTC(year, (month - 1), day)));
        },
      },
      rightPriceScale: {
        borderColor: backgroundColor === '#1e1e1e' ? '#2a2a2a' : '#e0e0e0',
      },
      timeScale: {
        borderColor: backgroundColor === '#1e1e1e' ? '#2a2a2a' : '#e0e0e0',
        timeVisible: true,
        secondsVisible: true,
        rightOffset: 5, // Keep some space on the right for live updates
        tickMarkFormatter: (time: any) => {
          // Axis labels in Eastern Time; handle both UTCTimestamp (number) and BusinessDay (object)
          if (typeof time === 'number') {
            const dtf = new Intl.DateTimeFormat('en-US', {
              timeZone: 'America/New_York',
              hour: '2-digit', minute: '2-digit', second: '2-digit',
              hour12: false,
            });
            return dtf.format(new Date(time * 1000));
          } else if (time && typeof time === 'object') {
            const { year, month, day } = time as { year: number; month: number; day: number };
            const dtf = new Intl.DateTimeFormat('en-US', {
              timeZone: 'America/New_York',
              month: 'short', day: '2-digit',
            });
            return dtf.format(new Date(Date.UTC(year, (month - 1), day)));
          }
          return '';
        },
      },
    });

    chartRef.current = chart;
    
    // Create candlestick series
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });
    
    seriesRef.current = candlestickSeries;
    
    // Create invisible line series for time extension
    const timeExtensionSeries = chart.addSeries(LineSeries, {
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
    // Listen for visible range changes to update data range
    chart.timeScale().subscribeVisibleTimeRangeChange(() => {
      notifyDataRangeChangeCallback();
    });

    // Connect to local WebSocket proxy and stream live aggregates
    const ws = new WebSocket('ws://localhost:8090/ws');
    wsRef.current = ws;

    ws.onopen = () => {
      try {
        ws.send(JSON.stringify({ ticker: symbol })); // per-second bars (A.symbol) via proxy
      } catch (e) {
        console.error('[WS] send error:', e);
      }
    };

    const handleWsPayload = (s: string) => {
      let arr: any[] = [];
      try {
        const parsed = JSON.parse(s);
        arr = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return; // ignore non-JSON
      }

      let anyChanged = false;

      for (const ev of arr) {
        const evType = ev?.ev;
        if (evType !== 'A' && evType !== 'AM') continue; // only aggregates

        const ms: number | undefined = (ev?.s ?? ev?.t);
        if (typeof ms !== 'number') continue;
        const tSec = Math.trunc(ms / 1000);

        const o = ev?.o, h = ev?.h, l = ev?.l, c = ev?.c;
        if (
          typeof o !== 'number' ||
          typeof h !== 'number' ||
          typeof l !== 'number' ||
          typeof c !== 'number'
        ) continue;

        const candle: CandlestickData = {
          time: tSec as Time,
          open: o,
          high: h,
          low: l,
          close: c,
        };

        const data = chartDataRef.current;
        const last = data.length ? data[data.length - 1] : undefined;
        const lastTime = (last?.time as number) ?? null;

        if (lastTime === tSec) {
          // Update in-place
          data[data.length - 1] = candle;
          seriesRef.current?.update(candle);
          anyChanged = true;
        } else if (lastTime == null || tSec > lastTime) {
          // Append new bar
          chartDataRef.current = [...data, candle];
          seriesRef.current?.update(candle);
          if (chartDataRef.current.length >= 2) {
            barIntervalSecRef.current = computeCadenceSec(chartDataRef.current, barIntervalSecRef.current);
          }
          anyChanged = true;
        } else {
          // Out-of-order: ignore
        }

        currentPriceRef.current = c;
        lastBarTimeSecRef.current = tSec;
      }

      if (anyChanged) {
        if (!firstDataArrivedRef.current) {
          chart.timeScale().fitContent();
          firstDataArrivedRef.current = true;
        }
        notifyDataRangeChangeCallback();
      }
    };

    ws.onmessage = (event) => {
      const d: any = (event as MessageEvent).data;
      if (typeof d === 'string') {
        handleWsPayload(d);
      } else if (d instanceof Blob) {
        d.text().then(handleWsPayload).catch((e) => console.error('[WS] blob read error:', e));
      } else {
        try {
          handleWsPayload(String(d));
        } catch (e) {
          console.error('[WS] unknown payload type:', e);
        }
      }
    };

    ws.onerror = (e) => {
      console.error('[WS] error:', e);
    };

    ws.onclose = () => {
      // minimal implementation: no reconnect
    };

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      chart.remove();
    };
  }, [symbol, initialPrice, notifyDataRangeChange]);

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
    </div>
  );
});
