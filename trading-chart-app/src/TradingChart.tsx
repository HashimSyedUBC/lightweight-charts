import React, { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time, LineData, CandlestickSeries, LineSeries } from 'lightweight-charts';
import { TrendLineManager, TrendLineOptions } from './TrendLinePrimitive';
import { RectangleManager, RectangleData } from './RectanglePrimitive';
import { LabelManager, LabelOptions } from './LabelPrimitive';
import { unixToUTC, computeCadenceSec, updateTimeExtensionSeries, addTimeExtensionsForTimes, removeTimeExtensionForDrawing, notifyDataRangeChange, getDataRange, getViewport, centerOnTime, focusOnDrawing, setViewport } from './TradingChartCore';
import { addTrendLine, removeTrendLine, removeAllTrendLines, addRectangle, removeRectangle, addLabel, removeLabel, getData } from './TradingChartDrawings';

// Global WebSocket connection manager to prevent duplicate connections
let globalWS: WebSocket | null = null;
let globalWSSubscribers: Set<(data: string) => void> = new Set();


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
  ({ symbol = 'SPY', initialPrice = 150.00, backgroundColor = '#1e1e1e', textColor = '#d1d4dc', onDataRangeChange }, ref) => {
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
  const backfillCompleteRef = useRef(false);
  const lastBackfillTimestampRef = useRef<number>(0);
  const isBackfillingRef = useRef(false);
  
  // Pagination refs
  const isPaginatingRef = useRef(false);
  const oldestTimestampRef = useRef<number>(0);
  const noMoreDataRef = useRef(false);



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
  }, []); // Remove dependency to prevent circular recursion

  // Helper function to remove time extension for a drawing
  const removeTimeExtensionForDrawingCallback = useCallback((drawingId: string) => {
    removeTimeExtensionForDrawing(drawingId, timeExtensionPointsRef, updateTimeExtensionSeriesCallback);
  }, []); // Remove dependency to prevent circular recursion



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
    // Listen for visible range changes to update data range and trigger pagination
    let scrollDebounceTimer: NodeJS.Timeout | null = null;
    chart.timeScale().subscribeVisibleTimeRangeChange(() => {
      notifyDataRangeChangeCallback();
      
      // Check if we should paginate (debounced)
      if (scrollDebounceTimer) clearTimeout(scrollDebounceTimer);
      
      // Check immediately if we should skip
      const visibleRange = chart.timeScale().getVisibleRange();
      if (!visibleRange || !chartDataRef.current.length || isPaginatingRef.current || noMoreDataRef.current) return;
      
      scrollDebounceTimer = setTimeout(() => {
        // Double-check after debounce
        if (isPaginatingRef.current || noMoreDataRef.current) return;
        
        const currentRange = chart.timeScale().getVisibleRange();
        if (!currentRange) return;
        
        const visibleFrom = currentRange.from as number;
        const oldestTime = oldestTimestampRef.current;
        
        if (!oldestTime) return;
        
        // Calculate how many bars from the left edge
        const barsFromLeft = Math.floor((visibleFrom - oldestTime) / barIntervalSecRef.current);
        
        // Trigger when within 150 bars of the left edge
        if (barsFromLeft < 150 && !isPaginatingRef.current && !noMoreDataRef.current) {
          loadMoreHistory();
        }
      }, 50); // 50ms debounce
    });

    // Helper: fetch backfill (prefer 1-second, fallback to minute)
    // Helper: fetch single time range
    const fetchTimeRange = async (fromSec: number, toSec: number): Promise<CandlestickData[]> => {
      const base = `/api/aggregates/${encodeURIComponent(symbol)}/${fromSec}/${toSec}`;
      const urls = [
        `${base}?timespan=second`, // preferred true 1s backfill
        `${base}` // fallback to minute
      ];
      
      for (const url of urls) {
        try {
          const resp = await fetch(url);
          if (!resp.ok) continue;
          const j = await resp.json();
          const arr = Array.isArray(j?.results) ? j.results : [];
          if (!arr.length) continue;
          
          // Convert to CandlestickData
          const bars: CandlestickData[] = arr.map((r: any) => ({
            time: Math.trunc((r.t ?? r.start) / 1000) as Time,
            open: r.o,
            high: r.h,
            low: r.l,
            close: r.c,
          }));
          
          return bars;
        } catch (e) {
          continue;
        }
      }
      return [];
    };

    // Optimized backfill to get maximum 1300 bars with fewer API calls
    const loadBackfill = async () => {
      console.log('🚀 BACKFILL TRIGGERED - completed:', backfillCompleteRef.current, 'hasData:', chartDataRef.current.length > 0);
      
      // Guard against duplicate backfill calls
      if (backfillCompleteRef.current || chartDataRef.current.length > 0 || isBackfillingRef.current) {
        console.log('⏭️ Backfill skipped - already completed or in progress');
        return;
      }
      
      isBackfillingRef.current = true;
      const nowSec = Math.floor(Date.now() / 1000);
      const TARGET_BARS = 1300;
      const CHUNK_HOURS = 6; // Fetch 6-hour chunks to reduce API calls
      const MAX_CHUNKS = 4; // Max 4 chunks = 24 hours safety limit
      
      let allBars: CandlestickData[] = [];
      let chunksBack = 1;
      
      while (allBars.length < TARGET_BARS && chunksBack <= MAX_CHUNKS) {
        const fromSec = nowSec - (chunksBack * CHUNK_HOURS * 3600);
        const toSec = nowSec - ((chunksBack - 1) * CHUNK_HOURS * 3600);
        
        const newBars = await fetchTimeRange(fromSec, toSec);
        if (newBars.length > 0) {
          // Prepend older data (maintain chronological order)
          allBars = [...newBars, ...allBars];
          
          // Stop immediately if we hit our target
          if (allBars.length >= TARGET_BARS) {
            allBars = allBars.slice(-TARGET_BARS); // Keep only last 1300 bars
            break;
          }
        }
        
        chunksBack++;
      }
      
      if (allBars.length === 0) {
        backfillCompleteRef.current = true;
        return;
      }
      
      // Remove duplicates and ensure sorted
      const uniqueBars = allBars.filter((bar, index, arr) => 
        index === 0 || (bar.time as number) !== (arr[index - 1].time as number)
      );
      uniqueBars.sort((a: any, b: any) => (a.time as number) - (b.time as number));
      
      // Set chart data
      chartDataRef.current = uniqueBars;
      seriesRef.current?.setData(uniqueBars);
      
      // Compute cadence
      if (chartDataRef.current.length >= 2) {
        barIntervalSecRef.current = computeCadenceSec(chartDataRef.current, barIntervalSecRef.current);
      }
      
      // Track last backfill timestamp
      lastBackfillTimestampRef.current = (uniqueBars[uniqueBars.length - 1].time as number) || 0;
      oldestTimestampRef.current = (uniqueBars[0].time as number) || 0;
      
      // Fit chart
      chart.timeScale().fitContent();
      
      firstDataArrivedRef.current = true;
      backfillCompleteRef.current = true;
      isBackfillingRef.current = false;
      notifyDataRangeChangeCallback();
      console.log(`✅ Backfill complete: ${uniqueBars.length} bars loaded`);
    };

    // Load more history when scrolling left
    const loadMoreHistory = async () => {
      console.log('🔄 Pagination check - isPaginating:', isPaginatingRef.current, 'noMoreData:', noMoreDataRef.current);
      if (isPaginatingRef.current || noMoreDataRef.current || !oldestTimestampRef.current) return;
      isPaginatingRef.current = true;
      console.log('⏳ Loading more history...');
      
      const PAGINATION_BARS = 500; // Smaller chunks for pagination
      const CHUNK_HOURS = 6;
      
      // Save current viewport before loading
      const visibleRange = chart.timeScale().getVisibleRange();
      
      let newBars: CandlestickData[] = [];
      let attempts = 0;
      const MAX_ATTEMPTS = 3;
      
      let currentOldest = oldestTimestampRef.current;
      
      while (newBars.length < PAGINATION_BARS && attempts < MAX_ATTEMPTS) {
        const toSec = currentOldest - 1; // Start just before oldest
        const fromSec = toSec - (CHUNK_HOURS * 3600);
        
        const fetchedBars = await fetchTimeRange(fromSec, toSec);
        if (fetchedBars.length > 0) {
          newBars = [...newBars, ...fetchedBars];
          // Update currentOldest for next iteration
          const fetchedOldest = (fetchedBars[0].time as number);
          if (fetchedOldest < currentOldest) {
            currentOldest = fetchedOldest;
          }
        } else {
          // No data in this chunk (market gap/weekend). Step back and continue.
          currentOldest = fromSec;
        }
        attempts++;
      }
      
      if (newBars.length > 0) {
        // Trim to pagination limit
        if (newBars.length > PAGINATION_BARS) {
          newBars = newBars.slice(-PAGINATION_BARS);
        }
        
        // Merge with existing data
        const mergedData = [...newBars, ...chartDataRef.current];
        
        // Deduplicate
        const uniqueData = mergedData.filter((bar, index, arr) => 
          index === 0 || (bar.time as number) !== (arr[index - 1].time as number)
        );
        
        // Update data
        chartDataRef.current = uniqueData;
        seriesRef.current?.setData(uniqueData);
        
        // Update oldest timestamp only if we have older data
        const newOldest = (uniqueData[0].time as number);
        if (newOldest < oldestTimestampRef.current) {
          oldestTimestampRef.current = newOldest;
        }
        
        // Restore viewport to prevent jumping
        if (visibleRange) {
          chart.timeScale().setVisibleRange(visibleRange);
        }
        
        notifyDataRangeChangeCallback();
        console.log(`✅ Loaded ${newBars.length} more historical bars`);
      } else {
        // No bars found across scanned window; move pointer back to skip gap
        if (currentOldest < oldestTimestampRef.current) {
          oldestTimestampRef.current = currentOldest;
        }
        console.log(`⛳ No historical bars found across ${attempts} chunks; advanced oldest pointer to ${currentOldest}`);
      }
      
      isPaginatingRef.current = false;
    };

    // Use global WebSocket connection manager to prevent duplicates
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

        // Dedup against backfill boundary
        if (tSec <= lastBackfillTimestampRef.current) continue;

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

    // Kick off backfill first, then attach WS and subscribe
    console.log('📋 useEffect RUNNING - deps changed, calling loadBackfill');
    loadBackfill().finally(() => {

      // Subscribe to global WebSocket
      globalWSSubscribers.add(handleWsPayload);

      // Create global connection if it doesn't exist
      if (!globalWS || globalWS.readyState === WebSocket.CLOSED) {

        globalWS = new WebSocket('ws://localhost:8090/ws');

        globalWS.onopen = () => {
          console.log('✅ WebSocket connected');
          try {
            if (globalWS && globalWS.readyState === WebSocket.OPEN) {
              globalWS.send(JSON.stringify({ ticker: symbol }));
            }
          } catch (e) {
            console.error('[CHART] send error:', e);
          }
        };

        globalWS.onmessage = (event) => {
          const d: any = (event as MessageEvent).data;
          let dataStr = '';
          if (typeof d === 'string') {
            dataStr = d;
          } else if (d instanceof Blob) {
            d.text().then((text) => {
              globalWSSubscribers.forEach(subscriber => subscriber(text));
            }).catch((e) => console.error('[WS] blob read error:', e));
            return;
          } else {
            try {
              dataStr = String(d);
            } catch (e) {
              console.error('[WS] unknown payload type:', e);
              return;
            }
          }
          globalWSSubscribers.forEach(subscriber => subscriber(dataStr));
        };

        globalWS.onerror = (e) => {
          console.error('[CHART] ❌ Global WebSocket error:', e);
        };

        globalWS.onclose = (e) => {

          globalWS = null;
        };
      } else {
        if (globalWS.readyState === WebSocket.OPEN) {
          try {
            globalWS.send(JSON.stringify({ ticker: symbol }));
          } catch (e) {
            console.error('[CHART] send error:', e);
          }
        }
      }
    });

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      
      // Unsubscribe from global WebSocket
      globalWSSubscribers.delete(handleWsPayload);

      
      // Close global connection if no more subscribers (with delay for React StrictMode)
      if (globalWSSubscribers.size === 0 && globalWS) {

        // Small delay to handle React StrictMode double-mounting
        setTimeout(() => {
          if (globalWSSubscribers.size === 0 && globalWS) {

            globalWS.close();
            globalWS = null;
          } else {

          }
        }, 100);
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
