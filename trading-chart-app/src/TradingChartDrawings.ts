import React from 'react';
import { CandlestickData, ISeriesApi, LineData, Time, IChartApi } from 'lightweight-charts';

// Add trend line function
export const addTrendLine = (
  lineData: any,
  trendLineManagerRef: React.MutableRefObject<any>,
  chartRef: React.MutableRefObject<IChartApi | null>,
  chartContainerRef: React.MutableRefObject<HTMLDivElement | null>,
  addTimeExtensionsForTimesCallback: (drawingId: string, times: number[]) => void
) => {
  if (trendLineManagerRef.current && chartRef.current) {
    // FIRST: Inject exact endpoint times (inside or outside range)
    addTimeExtensionsForTimesCallback(lineData.id, [
      lineData.point1.time as number,
      lineData.point2.time as number,
    ]);
    
    // THEN: Add the trend line
    const trendLineOptions = {
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
};

// Remove trend line function
export const removeTrendLine = (
  id: string,
  trendLineManagerRef: React.MutableRefObject<any>,
  chartRef: React.MutableRefObject<IChartApi | null>,
  chartContainerRef: React.MutableRefObject<HTMLDivElement | null>,
  removeTimeExtensionForDrawingCallback: (id: string) => void
) => {
  if (trendLineManagerRef.current) {
    trendLineManagerRef.current.removeTrendLine(id);
    removeTimeExtensionForDrawingCallback(id);
    // Auto-refresh after removal
    setTimeout(() => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({ 
          width: chartContainerRef.current.clientWidth 
        });
      }
    }, 10);
  }
};

// Remove all trend lines function
export const removeAllTrendLines = (
  trendLineManagerRef: React.MutableRefObject<any>,
  chartRef: React.MutableRefObject<IChartApi | null>,
  chartContainerRef: React.MutableRefObject<HTMLDivElement | null>,
  timeExtensionPointsRef: React.MutableRefObject<Map<string, LineData[]>>,
  updateTimeExtensionSeriesCallback: () => void
) => {
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
    updateTimeExtensionSeriesCallback();
    
    // Auto-refresh after removal
    setTimeout(() => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({ 
          width: chartContainerRef.current.clientWidth 
        });
      }
    }, 10);
  }
};

// Add rectangle function
export const addRectangle = (
  rectangleData: any,
  rectangleManagerRef: React.MutableRefObject<any>,
  chartRef: React.MutableRefObject<IChartApi | null>,
  chartContainerRef: React.MutableRefObject<HTMLDivElement | null>,
  addTimeExtensionsForTimesCallback: (drawingId: string, times: number[]) => void
) => {
  if (rectangleManagerRef.current && chartRef.current) {
    // FIRST: Extract min/max times from all 4 points
    const times = [
      rectangleData.points.p1.time as number,
      rectangleData.points.p2.time as number,
      rectangleData.points.p3.time as number,
      rectangleData.points.p4.time as number
    ];
    // Inject exact all-corner times (handles tilted/off-cadence rectangles)
    addTimeExtensionsForTimesCallback(rectangleData.id, times);
    
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
};

// Remove rectangle function
export const removeRectangle = (
  id: string,
  rectangleManagerRef: React.MutableRefObject<any>,
  chartRef: React.MutableRefObject<IChartApi | null>,
  chartContainerRef: React.MutableRefObject<HTMLDivElement | null>,
  removeTimeExtensionForDrawingCallback: (id: string) => void
) => {
  if (rectangleManagerRef.current) {
    rectangleManagerRef.current.removeRectangle(id);
    removeTimeExtensionForDrawingCallback(id);
    // Auto-refresh after removal
    setTimeout(() => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({ 
          width: chartContainerRef.current.clientWidth 
        });
      }
    }, 10);
  }
};

// Add label function
export const addLabel = (
  labelData: { time: Time; price: number; text: string; id: string },
  labelManagerRef: React.MutableRefObject<any>,
  chartRef: React.MutableRefObject<IChartApi | null>,
  chartContainerRef: React.MutableRefObject<HTMLDivElement | null>,
  addTimeExtensionsForTimesCallback: (drawingId: string, times: number[]) => void
) => {
  if (labelManagerRef.current && chartRef.current) {
    // FIRST: Inject exact label time (inside or outside range)
    addTimeExtensionsForTimesCallback(labelData.id, [labelData.time as number]);
    
    // THEN: Add the label
    const labelOptions = {
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
};

// Remove label function
export const removeLabel = (
  id: string,
  labelManagerRef: React.MutableRefObject<any>,
  removeTimeExtensionForDrawingCallback: (id: string) => void
) => {
  if (labelManagerRef.current) {
    labelManagerRef.current.removeLabel(id);
    removeTimeExtensionForDrawingCallback(id);
  }
};

// Get data function
export const getData = (
  chartDataRef: React.MutableRefObject<CandlestickData[]>
): CandlestickData[] => {
  return chartDataRef.current;
};
