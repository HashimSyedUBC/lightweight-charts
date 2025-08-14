import React from 'react';
import { CandlestickData, ISeriesApi, LineData, Time, IChartApi } from 'lightweight-charts';

// Helper function to convert Unix timestamp to UTC string
export const unixToUTC = (unixSeconds: number): string => {
  return new Date(unixSeconds * 1000).toISOString();
};

// Compute dominant cadence (seconds) from current data
export const computeCadenceSec = (data: CandlestickData[], defaultCadence: number): number => {
  if (!data || data.length < 2) return defaultCadence;
  const times = data.map(d => d.time as number).sort((a, b) => a - b);
  const diffs: number[] = [];
  for (let i = 1; i < times.length; i++) {
    const delta = times[i] - times[i - 1];
    if (delta > 0) diffs.push(delta);
  }
  if (diffs.length === 0) return defaultCadence;
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
export const updateTimeExtensionSeries = (
  timeExtensionSeriesRef: React.MutableRefObject<ISeriesApi<"Line"> | null>,
  timeExtensionPointsRef: React.MutableRefObject<Map<string, LineData[]>>,
  isUpdatingExtensionRef: React.MutableRefObject<boolean>
) => {
  if (!timeExtensionSeriesRef.current) return;
  
  // Prevent recursive calls
  if (isUpdatingExtensionRef.current) {
    console.warn('updateTimeExtensionSeries: Already updating, skipping to prevent recursion');
    return;
  }

  // Set flag early to prevent recursion
  isUpdatingExtensionRef.current = true;

  // Collect all points from all drawings
  const allPoints: LineData[] = [];
  
  console.log(`updateTimeExtensionSeries: Processing ${timeExtensionPointsRef.current.size} drawings`);
  
  timeExtensionPointsRef.current.forEach((points, drawingId) => {
    console.log(`  Drawing ${drawingId}: ${points.length} points`);
    allPoints.push(...points);
  });

  // Sort by time and remove duplicates
  const uniquePoints = allPoints
    .sort((a, b) => (a.time as number) - (b.time as number))
    .filter((point, index, array) => 
      index === 0 || (point.time as number) !== (array[index - 1].time as number)
    );

  console.log(`updateTimeExtensionSeries: Total ${allPoints.length} points, ${uniquePoints.length} unique points`);
  
  // Update the time extension series
  timeExtensionSeriesRef.current.setData(uniquePoints);
  
  // Reset update flag
  isUpdatingExtensionRef.current = false;
};

// Helper to add time extensions for arbitrary exact times (inside or outside data range)
export const addTimeExtensionsForTimes = (
  drawingId: string,
  times: number[],
  chartDataRef: React.MutableRefObject<CandlestickData[]>,
  timeExtensionPointsRef: React.MutableRefObject<Map<string, LineData[]>>,
  barIntervalSecRef: React.MutableRefObject<number>,
  updateTimeExtensionSeriesCallback: () => void
) => {
  if (chartDataRef.current.length === 0) return;

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
    updateTimeExtensionSeriesCallback();
  }
};

// Helper function to remove time extension for a drawing
export const removeTimeExtensionForDrawing = (
  drawingId: string,
  timeExtensionPointsRef: React.MutableRefObject<Map<string, LineData[]>>,
  updateTimeExtensionSeriesCallback: () => void
) => {
  timeExtensionPointsRef.current.delete(drawingId);
  updateTimeExtensionSeriesCallback();
};

// Helper function to notify data range changes
export const notifyDataRangeChange = (
  onDataRangeChange: ((range: any) => void) | undefined,
  chartDataRef: React.MutableRefObject<CandlestickData[]>
) => {
  if (onDataRangeChange) {
    const data = chartDataRef.current;
    if (data.length === 0) {
      onDataRangeChange(null);
      return;
    }
    
    // Use the actual data range - no guessing or extending
    const times = data.map(d => d.time as number);
    const prices = data.flatMap(d => [d.open, d.high, d.low, d.close]);
    
    const range = {
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices)
    };
    
    onDataRangeChange(range);
  }
};

// Get data range helper
export const getDataRange = (chartDataRef: React.MutableRefObject<CandlestickData[]>) => {
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
};

// Rich AI-friendly viewport snapshot
export const getViewport = (
  chartRef: React.MutableRefObject<IChartApi | null>,
  seriesRef: React.MutableRefObject<ISeriesApi<"Candlestick"> | null>,
  chartContainerRef: React.MutableRefObject<HTMLDivElement | null>,
  chartDataRef: React.MutableRefObject<CandlestickData[]>,
  trendLineManagerRef: React.MutableRefObject<any>,
  rectangleManagerRef: React.MutableRefObject<any>,
  labelManagerRef: React.MutableRefObject<any>,
  barIntervalSecRef: React.MutableRefObject<number>
) => {
  const chart = chartRef.current;
  const series = seriesRef.current;
  if (!chart || !series) return null;

  const timeScale = chart.timeScale();
  const visibleTimeRange = timeScale.getVisibleRange();

  // Fallbacks if null
  const data = chartDataRef.current;
  const dataTimes = data.map(d => d.time as number);
  const fallbackMinT = dataTimes.length ? Math.min(...dataTimes) : 0;
  const fallbackMaxT = dataTimes.length ? Math.max(...dataTimes) : 0;

  const minTime = (visibleTimeRange?.from as number) ?? fallbackMinT;
  const maxTime = (visibleTimeRange?.to as number) ?? fallbackMaxT;
  const centerTime = (minTime + maxTime) / 2;

  // Get visible price range from viewport coordinates
  let minPrice: number;
  let maxPrice: number;
  
  const containerHeight = chartContainerRef.current?.clientHeight || 0;
  if (containerHeight > 0) {
    // Y=0 is top (higher price), Y=height is bottom (lower price)
    const topPrice = series.coordinateToPrice(0);
    const bottomPrice = series.coordinateToPrice(containerHeight);
    
    if (topPrice !== null && bottomPrice !== null) {
      maxPrice = topPrice as number;
      minPrice = bottomPrice as number;
    } else {
      // Fallback: use data range
      const allPrices = data.flatMap(d => [d.open, d.high, d.low, d.close]);
      minPrice = allPrices.length ? Math.min(...allPrices) : 0;
      maxPrice = allPrices.length ? Math.max(...allPrices) : 0;
    }
  } else {
    // Fallback: use data range
    const allPrices = data.flatMap(d => [d.open, d.high, d.low, d.close]);
    minPrice = allPrices.length ? Math.min(...allPrices) : 0;
    maxPrice = allPrices.length ? Math.max(...allPrices) : 0;
  }
  
  const centerPrice = (minPrice + maxPrice) / 2;

  // Cadence and bars estimate
  const cadenceSec = computeCadenceSec(chartDataRef.current, barIntervalSecRef.current);
  const barsVisibleEstimate = cadenceSec > 0 ? Math.max(0, Math.round((maxTime - minTime) / cadenceSec)) : 0;

  // Build drawings array from all managers
  const drawings: any[] = [];

  // Trendlines
  const tls = trendLineManagerRef.current ? trendLineManagerRef.current.getAllTrendLines() : [];
  tls.forEach((tl: any) => {
    const opt = (tl as any).options as any;
    const p1t = opt.point1.time as number; const p1p = opt.point1.price as number;
    const p2t = opt.point2.time as number; const p2p = opt.point2.price as number;
    const leftFirst = p1t <= p2t;
    const leftPoint = leftFirst ? { time: p1t, price: p1p } : { time: p2t, price: p2p };
    const rightPoint = leftFirst ? { time: p2t, price: p2p } : { time: p1t, price: p1p };
    const bMinT = Math.min(p1t, p2t); const bMaxT = Math.max(p1t, p2t);
    const bMinP = Math.min(p1p, p2p); const bMaxP = Math.max(p1p, p2p);
    const timeOverlap = bMaxT >= minTime && bMinT <= maxTime;
    const priceOverlap = bMaxP >= minPrice && bMinP <= maxPrice;
    let isVisible = timeOverlap && priceOverlap;
    let screenPoints: any[] | undefined = undefined;
    if (isVisible) {
      const x1 = timeScale.timeToCoordinate(leftPoint.time as Time);
      const y1 = series.priceToCoordinate(leftPoint.price);
      const x2 = timeScale.timeToCoordinate(rightPoint.time as Time);
      const y2 = series.priceToCoordinate(rightPoint.price);
      if (x1 == null || y1 == null || x2 == null || y2 == null) {
        isVisible = false;
      } else {
        screenPoints = [ { x: x1 as number, y: y1 as number }, { x: x2 as number, y: y2 as number } ];
      }
    }
    drawings.push({
      id: opt.id,
      type: 'trendline',
      isVisible,
      style: { color: opt.color, lineWidth: opt.lineWidth, lineStyle: opt.lineStyle },
      data: { 
        leftPoint: { time: unixToUTC(leftPoint.time), price: leftPoint.price }, 
        rightPoint: { time: unixToUTC(rightPoint.time), price: rightPoint.price } 
      },
      bounds: { minTime: unixToUTC(bMinT), maxTime: unixToUTC(bMaxT), minPrice: bMinP, maxPrice: bMaxP },
      screenPoints,
    });
  });

  // Rectangles
  const rects = rectangleManagerRef.current ? (rectangleManagerRef.current as any).rectangles as any[] : [];
  rects.forEach((rp: any) => {
    const data = rp.data as any;
    const p1t = data.points.p1.time as number; const p1p = data.points.p1.price as number;
    const p2t = data.points.p2.time as number; const p2p = data.points.p2.price as number;
    const p3t = data.points.p3.time as number; const p3p = data.points.p3.price as number;
    const p4t = data.points.p4.time as number; const p4p = data.points.p4.price as number;
    const bMinT = Math.min(p1t, p2t, p3t, p4t); const bMaxT = Math.max(p1t, p2t, p3t, p4t);
    const bMinP = Math.min(p1p, p2p, p3p, p4p); const bMaxP = Math.max(p1p, p2p, p3p, p4p);
    const timeOverlap = bMaxT >= minTime && bMinT <= maxTime;
    const priceOverlap = bMaxP >= minPrice && bMinP <= maxPrice;
    let isVisible = timeOverlap && priceOverlap;
    let screenPoints: any[] | undefined = undefined;
    if (isVisible) {
      const x1 = timeScale.timeToCoordinate(data.points.p1.time);
      const y1 = series.priceToCoordinate(data.points.p1.price);
      const x2 = timeScale.timeToCoordinate(data.points.p2.time);
      const y2 = series.priceToCoordinate(data.points.p2.price);
      const x3 = timeScale.timeToCoordinate(data.points.p3.time);
      const y3 = series.priceToCoordinate(data.points.p3.price);
      const x4 = timeScale.timeToCoordinate(data.points.p4.time);
      const y4 = series.priceToCoordinate(data.points.p4.price);
      if (x1 == null || y1 == null || x2 == null || y2 == null || x3 == null || y3 == null || x4 == null || y4 == null) {
        isVisible = false;
      } else {
        screenPoints = [
          { x: x1 as number, y: y1 as number },
          { x: x2 as number, y: y2 as number },
          { x: x3 as number, y: y3 as number },
          { x: x4 as number, y: y4 as number },
        ];
      }
    }
    drawings.push({
      id: data.id,
      type: 'rectangle',
      isVisible,
      style: { fillColor: data.fillColor, fillOpacity: data.fillOpacity, borderColor: data.borderColor, borderWidth: data.borderWidth },
      data: {
        bottomLeftCorner: { time: unixToUTC(p1t), price: p1p },
        bottomRightCorner: { time: unixToUTC(p2t), price: p2p },
        topRightCorner: { time: unixToUTC(p3t), price: p3p },
        topLeftCorner: { time: unixToUTC(p4t), price: p4p },
      },
      bounds: { minTime: unixToUTC(bMinT), maxTime: unixToUTC(bMaxT), minPrice: bMinP, maxPrice: bMaxP },
      screenPoints,
    });
  });

  // Labels
  const labels = labelManagerRef.current ? labelManagerRef.current.getAllLabels() : [];
  labels.forEach((lp: any) => {
    const opt = (lp as any).options as any;
    const t = opt.time as number; const p = opt.price as number;
    const bMinT = t; const bMaxT = t; const bMinP = p; const bMaxP = p;
    const timeOverlap = bMaxT >= minTime && bMinT <= maxTime;
    const priceOverlap = bMaxP >= minPrice && bMinP <= maxPrice;
    let isVisible = timeOverlap && priceOverlap;
    let screenPoints: any[] | undefined = undefined;
    if (isVisible) {
      const x = timeScale.timeToCoordinate(opt.time);
      const y = series.priceToCoordinate(opt.price);
      if (x == null || y == null) {
        isVisible = false;
      } else {
        screenPoints = [{ x: x as number, y: y as number }];
      }
    }
    drawings.push({
      id: opt.id,
      type: 'label',
      isVisible,
      style: { color: opt.color, fontSize: opt.fontSize },
      data: { anchor: { time: unixToUTC(t), price: p }, text: opt.text },
      bounds: { minTime: unixToUTC(bMinT), maxTime: unixToUTC(bMaxT), minPrice: bMinP, maxPrice: bMaxP },
      screenPoints,
    });
  });

  return {
    timeRange: { 
      minTime: unixToUTC(minTime), 
      maxTime: unixToUTC(maxTime), 
      centerTime: unixToUTC(centerTime) 
    },
    priceRangeVisible: { minPrice, maxPrice, centerPrice },
    cadenceSec,
    barsVisibleEstimate,
    drawings,
  };
};

// Center on time function
export const centerOnTime = (
  time: number,
  chartRef: React.MutableRefObject<IChartApi | null>,
  seriesRef: React.MutableRefObject<ISeriesApi<"Candlestick"> | null>,
  chartContainerRef: React.MutableRefObject<HTMLDivElement | null>,
  chartDataRef: React.MutableRefObject<CandlestickData[]>
) => {
  const chart = chartRef.current;
  if (!chart || !seriesRef.current) return null;

  // Get before state
  const before = (() => {
    const vp = chartRef.current?.timeScale().getVisibleRange();
    if (!vp) return null;
    const minT = vp.from as number;
    const maxT = vp.to as number;
    const centerT = (minT + maxT) / 2;
    
    // Get price range using coordinate conversion
    const containerHeight = chartContainerRef.current?.clientHeight || 0;
    let minP = 0, maxP = 0;
    if (containerHeight > 0) {
      const topPrice = seriesRef.current?.coordinateToPrice(0);
      const bottomPrice = seriesRef.current?.coordinateToPrice(containerHeight);
      if (topPrice !== null && bottomPrice !== null) {
        maxP = topPrice as number;
        minP = bottomPrice as number;
      }
    }
    const centerP = (minP + maxP) / 2;
    
    const cadence = computeCadenceSec(chartDataRef.current, 900);
    const bars = cadence > 0 ? Math.floor((maxT - minT) / cadence) : 0;
    
    return {
      timeRange: { minTime: minT, maxTime: maxT, centerTime: centerT },
      priceRangeVisible: { minPrice: minP, maxPrice: maxP, centerPrice: centerP },
      barsVisibleEstimate: bars
    };
  })();

  if (!before) return null;

  // Calculate new range maintaining same span
  const currentSpan = before.timeRange.maxTime - before.timeRange.minTime;
  const newFrom = time - currentSpan / 2;
  const newTo = time + currentSpan / 2;

  // Apply new range
  chart.timeScale().setVisibleRange({ 
    from: newFrom as Time, 
    to: newTo as Time 
  });

  // Get after state
  const after = (() => {
    const vp = chart.timeScale().getVisibleRange();
    if (!vp) return null;
    const minT = vp.from as number;
    const maxT = vp.to as number;
    const centerT = (minT + maxT) / 2;
    
    // Get price range using coordinate conversion
    const containerHeight = chartContainerRef.current?.clientHeight || 0;
    let minP = 0, maxP = 0;
    if (containerHeight > 0) {
      const topPrice = seriesRef.current?.coordinateToPrice(0);
      const bottomPrice = seriesRef.current?.coordinateToPrice(containerHeight);
      if (topPrice !== null && bottomPrice !== null) {
        maxP = topPrice as number;
        minP = bottomPrice as number;
      }
    }
    const centerP = (minP + maxP) / 2;
    
    const cadence = computeCadenceSec(chartDataRef.current, 900);
    const bars = cadence > 0 ? Math.floor((maxT - minT) / cadence) : 0;
    
    return {
      timeRange: { minTime: minT, maxTime: maxT, centerTime: centerT },
      priceRangeVisible: { minPrice: minP, maxPrice: maxP, centerPrice: centerP },
      barsVisibleEstimate: bars
    };
  })();

  if (!after) return null;

  // Check if actually changed
  const changed = Math.abs(after.timeRange.centerTime - before.timeRange.centerTime) > 0.1;

  return { changed, before, after };
};

// Focus on drawing function
export const focusOnDrawing = (
  drawingId: string | string[],
  opts: { padding?: { timeFrac?: number; priceFrac?: number }; minBars?: number; minPriceSpanAbs?: number; minPriceSpanFracOfVisible?: number } | undefined,
  chartRef: React.MutableRefObject<IChartApi | null>,
  seriesRef: React.MutableRefObject<ISeriesApi<"Candlestick"> | null>,
  chartContainerRef: React.MutableRefObject<HTMLDivElement | null>,
  chartDataRef: React.MutableRefObject<CandlestickData[]>,
  trendLineManagerRef: React.MutableRefObject<any>,
  rectangleManagerRef: React.MutableRefObject<any>,
  labelManagerRef: React.MutableRefObject<any>,
  barIntervalSecRef: React.MutableRefObject<number>
) => {
  const chart = chartRef.current;
  const series = seriesRef.current;
  if (!chart || !series) return null;

  const timeScale = chart.timeScale();
  const priceScale = series.priceScale();

  // Local snapshot helper (numeric values)
  const getViewportSnapshot = () => {
    const visibleTimeRange = timeScale.getVisibleRange();
    const data = chartDataRef.current;
    const dataTimes = data.map(d => d.time as number);
    const fallbackMinT = dataTimes.length ? Math.min(...dataTimes) : 0;
    const fallbackMaxT = dataTimes.length ? Math.max(...dataTimes) : 0;
    const minTime = (visibleTimeRange?.from as number) ?? fallbackMinT;
    const maxTime = (visibleTimeRange?.to as number) ?? fallbackMaxT;
    const centerTime = (minTime + maxTime) / 2;

    const containerHeight = chartContainerRef.current?.clientHeight || 0;
    let minPrice = 0, maxPrice = 0;
    if (containerHeight > 0) {
      const topPrice = series.coordinateToPrice(0);
      const bottomPrice = series.coordinateToPrice(containerHeight);
      if (topPrice !== null && bottomPrice !== null) {
        maxPrice = topPrice as number;
        minPrice = bottomPrice as number;
      } else {
        const allPrices = data.flatMap(d => [d.open, d.high, d.low, d.close]);
        minPrice = allPrices.length ? Math.min(...allPrices) : 0;
        maxPrice = allPrices.length ? Math.max(...allPrices) : 0;
      }
    } else {
      const allPrices = data.flatMap(d => [d.open, d.high, d.low, d.close]);
      minPrice = allPrices.length ? Math.min(...allPrices) : 0;
      maxPrice = allPrices.length ? Math.max(...allPrices) : 0;
    }
    const centerPrice = (minPrice + maxPrice) / 2;
    const cadence = computeCadenceSec(data, barIntervalSecRef.current);
    const bars = cadence > 0 ? Math.floor((maxTime - minTime) / cadence) : 0;
    return { timeRange: { minTime, maxTime, centerTime }, priceRangeVisible: { minPrice, maxPrice, centerPrice }, barsVisibleEstimate: bars };
  };

  const before = getViewportSnapshot();
  if (!before) return null;

  const ids = Array.isArray(drawingId) ? drawingId : [drawingId];

  // Find drawings by id across managers and compute union bounds
  let found = false;
  let bMinT = Number.POSITIVE_INFINITY;
  let bMaxT = Number.NEGATIVE_INFINITY;
  let bMinP = Number.POSITIVE_INFINITY;
  let bMaxP = Number.NEGATIVE_INFINITY;

  // Trendlines
  const tls = trendLineManagerRef.current ? trendLineManagerRef.current.getAllTrendLines() : [];
  tls.forEach((tl: any) => {
    const opt = (tl as any).options as any;
    if (!ids.includes(opt.id)) return;
    found = true;
    const p1t = opt.point1.time as number; const p1p = opt.point1.price as number;
    const p2t = opt.point2.time as number; const p2p = opt.point2.price as number;
    bMinT = Math.min(bMinT, Math.min(p1t, p2t));
    bMaxT = Math.max(bMaxT, Math.max(p1t, p2t));
    bMinP = Math.min(bMinP, Math.min(p1p, p2p));
    bMaxP = Math.max(bMaxP, Math.max(p1p, p2p));
  });

  // Rectangles
  const rects = rectangleManagerRef.current ? (rectangleManagerRef.current as any).rectangles as any[] : [];
  rects.forEach((rp: any) => {
    const data = rp.data as any;
    if (!ids.includes(data.id)) return;
    found = true;
    const p1t = data.points.p1.time as number; const p1p = data.points.p1.price as number;
    const p2t = data.points.p2.time as number; const p2p = data.points.p2.price as number;
    const p3t = data.points.p3.time as number; const p3p = data.points.p3.price as number;
    const p4t = data.points.p4.time as number; const p4p = data.points.p4.price as number;
    bMinT = Math.min(bMinT, p1t, p2t, p3t, p4t);
    bMaxT = Math.max(bMaxT, p1t, p2t, p3t, p4t);
    bMinP = Math.min(bMinP, p1p, p2p, p3p, p4p);
    bMaxP = Math.max(bMaxP, p1p, p2p, p3p, p4p);
  });

  // Labels
  const labels = labelManagerRef.current ? labelManagerRef.current.getAllLabels() : [];
  labels.forEach((lp: any) => {
    const opt = (lp as any).options as any;
    if (!ids.includes(opt.id)) return;
    found = true;
    // Convert ISO string time to Unix timestamp in seconds
    const t = typeof opt.time === 'string' ? new Date(opt.time).getTime() / 1000 : opt.time as number;
    const p = opt.price as number;
    bMinT = Math.min(bMinT, t);
    bMaxT = Math.max(bMaxT, t);
    bMinP = Math.min(bMinP, p);
    bMaxP = Math.max(bMaxP, p);
  });

  if (!found || !isFinite(bMinT) || !isFinite(bMaxT) || !isFinite(bMinP) || !isFinite(bMaxP)) {
    // Nothing to focus
    return { changed: false, before: before, after: before };
  }

  const timePad = Math.max(0, opts?.padding?.timeFrac ?? 2);
  const pricePad = Math.max(0, opts?.padding?.priceFrac ?? 2);
  const cadence = computeCadenceSec(chartDataRef.current, barIntervalSecRef.current);
  const minBars = Math.max(1, opts?.minBars ?? 20);
  const fallbackTimeSpan = (cadence > 0 ? cadence : (barIntervalSecRef.current || 900)) * minBars;

  const currVisPriceSpan = Math.max(0, (before.priceRangeVisible.maxPrice - before.priceRangeVisible.minPrice));
  // Dynamic minimum based on current price level - use 1% of center price as reasonable minimum
  const currentPriceCenter = (before.priceRangeVisible.minPrice + before.priceRangeVisible.maxPrice) / 2;
  const dynamicMinPriceAbs = Math.max(0.01, currentPriceCenter * 0.01); // 1% of current price level
  const minPriceAbs = opts?.minPriceSpanAbs ?? dynamicMinPriceAbs;
  const minPriceFracVis = opts?.minPriceSpanFracOfVisible ?? 0.2; // 20% of current visible
  const fallbackPriceSpan = Math.max(minPriceAbs, currVisPriceSpan * minPriceFracVis);

  const shapeTimeSpan = Math.max(0, bMaxT - bMinT);
  const shapePriceSpan = Math.max(0, bMaxP - bMinP);

  // Base spans with sensible minimums
  const baseTimeSpan = Math.max(shapeTimeSpan, fallbackTimeSpan);
  const basePriceSpan = Math.max(shapePriceSpan, fallbackPriceSpan);

  const shapeCenterTime = (bMinT + bMaxT) / 2;
  const shapeCenterPrice = (bMinP + bMaxP) / 2;

  const paddedTimeSpan = baseTimeSpan * (1 + 2 * timePad);
  const paddedPriceSpan = basePriceSpan * (1 + 2 * pricePad);

  const fromT = (shapeCenterTime - paddedTimeSpan / 2) as Time;
  const toT = (shapeCenterTime + paddedTimeSpan / 2) as Time;
  const minP = shapeCenterPrice - paddedPriceSpan / 2;
  const maxP = shapeCenterPrice + paddedPriceSpan / 2;

  // Apply ranges
  timeScale.setVisibleRange({ from: fromT, to: toT });
  priceScale.setAutoScale(false);
  priceScale.setVisibleRange({ from: minP, to: maxP });

  // Re-enable auto-scale after a short delay to restore normal zoom behavior
  priceScale.setAutoScale(true);

  const after = getViewportSnapshot();
  return { changed: true, before, after };
};

// Set viewport function
export const setViewport = (
  time1: number | null | undefined,
  time2: number | null | undefined,
  price1: number | null | undefined,
  price2: number | null | undefined,
  chartRef: React.MutableRefObject<IChartApi | null>,
  seriesRef: React.MutableRefObject<ISeriesApi<"Candlestick"> | null>,
  chartContainerRef: React.MutableRefObject<HTMLDivElement | null>,
  chartDataRef: React.MutableRefObject<CandlestickData[]>
) => {
  const chart = chartRef.current;
  const series = seriesRef.current;
  if (!chart || !series) return null;

  // Helper to get current viewport state
  const getViewportSnapshot = () => {
    const timeScale = chart.timeScale();
    const visibleTimeRange = timeScale.getVisibleRange();
    
    // Get time range
    const data = chartDataRef.current;
    const dataTimes = data.map(d => d.time as number);
    const fallbackMinT = dataTimes.length ? Math.min(...dataTimes) : 0;
    const fallbackMaxT = dataTimes.length ? Math.max(...dataTimes) : 0;
    
    const minTime = (visibleTimeRange?.from as number) ?? fallbackMinT;
    const maxTime = (visibleTimeRange?.to as number) ?? fallbackMaxT;
    const centerTime = (minTime + maxTime) / 2;
    
    // Get price range
    const containerHeight = chartContainerRef.current?.clientHeight || 0;
    let minPrice = 0, maxPrice = 0;
    
    if (containerHeight > 0) {
      const topPrice = series.coordinateToPrice(0);
      const bottomPrice = series.coordinateToPrice(containerHeight);
      
      if (topPrice !== null && bottomPrice !== null) {
        maxPrice = topPrice as number;
        minPrice = bottomPrice as number;
      } else {
        const allPrices = data.flatMap(d => [d.open, d.high, d.low, d.close]);
        minPrice = allPrices.length ? Math.min(...allPrices) : 0;
        maxPrice = allPrices.length ? Math.max(...allPrices) : 0;
      }
    }
    
    const centerPrice = (minPrice + maxPrice) / 2;
    const cadence = computeCadenceSec(data, 900);
    const bars = cadence > 0 ? Math.floor((maxTime - minTime) / cadence) : 0;
    
    return {
      timeRange: { minTime, maxTime, centerTime },
      priceRangeVisible: { minPrice, maxPrice, centerPrice },
      barsVisibleEstimate: bars
    };
  };

  // Capture state before changes
  const before = getViewportSnapshot();
  if (!before) return null;

  let changed = false;

  // Handle time range if provided
  if (time1 !== null && time1 !== undefined && time2 !== null && time2 !== undefined) {
    // Ensure time1 <= time2
    const minT = Math.min(time1, time2);
    const maxT = Math.max(time1, time2);
    
    chart.timeScale().setVisibleRange({
      from: minT as Time,
      to: maxT as Time
    });
    
    changed = true;
  }

  // Handle price range if provided
  const priceScale = series.priceScale();
  if (price1 !== null && price1 !== undefined && price2 !== null && price2 !== undefined) {
    // Ensure price1 <= price2
    const minP = Math.min(price1, price2);
    const maxP = Math.max(price1, price2);
    
    // Disable auto-scale and set the range
    priceScale.setAutoScale(false);
    priceScale.setVisibleRange({
      from: minP,
      to: maxP
    });
    
    priceScale.setAutoScale(true);
    changed = true;
  } else if (time1 !== null && time1 !== undefined && time2 !== null && time2 !== undefined) {
    // If only time was set, re-enable auto-scale for price
    priceScale.setAutoScale(true);
  }

  // Capture state after changes
  const after = getViewportSnapshot();
  if (!after) return null;

  return { changed, before, after };
};
