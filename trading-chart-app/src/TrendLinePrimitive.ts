import {
  ISeriesPrimitive,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  PrimitivePaneViewZOrder,
  Time,
  Coordinate,
  PrimitiveHoveredItem
} from 'lightweight-charts';
import { CanvasRenderingTarget2D, BitmapCoordinatesRenderingScope } from 'fancy-canvas';

interface TrendLinePoint {
  time: Time;
  price: number;
}

export interface TrendLineOptions {
  point1: TrendLinePoint;
  point2: TrendLinePoint;
  color: string;
  lineWidth: number;
  lineStyle: number; // 0 = solid, 1 = dotted, 2 = dashed
  showLabel?: boolean;
  labelText?: string;
  id: string;
}

export class TrendLinePrimitive implements ISeriesPrimitive<Time> {
  private _options: TrendLineOptions;
  private _paneViews: TrendLinePaneView[];
  private _series: any;
  private _chart: any;

  constructor(options: TrendLineOptions) {
    this._options = options;
    this._paneViews = [];
  }

  updateOptions(options: Partial<TrendLineOptions>): void {
    this._options = { ...this._options, ...options };
    if (this._paneViews.length > 0) {
      this._paneViews[0].update();
    }
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return this._paneViews;
  }

  attached(params: { series: any; chart: any }): void {
    this._series = params.series;
    this._chart = params.chart;
    this._paneViews = [new TrendLinePaneView(this)];
  }

  detached(): void {
    this._series = null;
    this._chart = null;
    this._paneViews = [];
  }

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    // For now, return null (no hover interaction)
    // Could implement line hit detection later
    return null;
  }

  get options(): TrendLineOptions {
    return this._options;
  }

  get series(): any {
    return this._series;
  }

  get chart(): any {
    return this._chart;
  }
}

interface ViewPoint {
  x: number | null;
  y: number | null;
}

class TrendLinePaneView implements IPrimitivePaneView {
  private _source: TrendLinePrimitive;
  private _p1: ViewPoint = { x: null, y: null };
  private _p2: ViewPoint = { x: null, y: null };

  constructor(source: TrendLinePrimitive) {
    this._source = source;
  }

  update(): void {
    const series = this._source.series;
    const chart = this._source.chart;
    const options = this._source.options;
    
    if (!series || !chart) {
      return;
    }

    
    const y1 = series.priceToCoordinate(options.point1.price);
    const y2 = series.priceToCoordinate(options.point2.price);
    const timeScale = chart.timeScale();
    const x1 = timeScale.timeToCoordinate(options.point1.time);
    const x2 = timeScale.timeToCoordinate(options.point2.time);

    this._p1 = { x: x1, y: y1 };
    this._p2 = { x: x2, y: y2 };
  }

  renderer(): TrendLineRenderer | null {
    this.update();
    
    if (this._p1.x === null || this._p1.y === null || 
        this._p2.x === null || this._p2.y === null) {
 
      return null;
    }
    

    
    return new TrendLineRenderer(
      this._p1 as { x: number; y: number },
      this._p2 as { x: number; y: number },
      this._source.options
    );
  }

  zOrder(): PrimitivePaneViewZOrder {
    return 'normal';
  }
}

class TrendLineRenderer {
  private _p1: { x: number; y: number };
  private _p2: { x: number; y: number };
  private _options: TrendLineOptions;

  constructor(p1: { x: number; y: number }, p2: { x: number; y: number }, options: TrendLineOptions) {
    this._p1 = p1;
    this._p2 = p2;
    this._options = options;
  }

  draw(target: CanvasRenderingTarget2D): void {
   
    
    target.useBitmapCoordinateSpace((scope: BitmapCoordinatesRenderingScope) => {
      if (
        this._p1.x === null ||
        this._p1.y === null ||
        this._p2.x === null ||
        this._p2.y === null
      ) {
        return;
      }
      
      const ctx = scope.context;
      
      // Scale coordinates for high DPI displays
      const x1Scaled = Math.round(this._p1.x * scope.horizontalPixelRatio);
      const y1Scaled = Math.round(this._p1.y * scope.verticalPixelRatio);
      const x2Scaled = Math.round(this._p2.x * scope.horizontalPixelRatio);
      const y2Scaled = Math.round(this._p2.y * scope.verticalPixelRatio);
      
   
      
      // Set line style
      ctx.strokeStyle = this._options.color;
      ctx.lineWidth = this._options.lineWidth * scope.verticalPixelRatio;
      
      // Handle line style (dotted, dashed, solid)
      if (this._options.lineStyle === 1) {
        ctx.setLineDash([5 * scope.horizontalPixelRatio, 5 * scope.horizontalPixelRatio]); // dotted
      } else if (this._options.lineStyle === 2) {
        ctx.setLineDash([10 * scope.horizontalPixelRatio, 5 * scope.horizontalPixelRatio]); // dashed
      } else {
        ctx.setLineDash([]); // solid
      }
      
      // Draw the line
      ctx.beginPath();
      ctx.moveTo(x1Scaled, y1Scaled);
      ctx.lineTo(x2Scaled, y2Scaled);
      ctx.stroke();
      
      // Draw price labels if enabled
      if (this._options.showLabel) {
        ctx.fillStyle = this._options.color;
        ctx.font = `${12 * scope.verticalPixelRatio}px Arial`;
        const offset = 5 * scope.horizontalPixelRatio;
        ctx.fillText(`$${this._options.point1.price.toFixed(2)}`, x1Scaled + offset, y1Scaled - offset);
        ctx.fillText(`$${this._options.point2.price.toFixed(2)}`, x2Scaled + offset, y2Scaled - offset);
      }
      
    });
  }

  drawBackground(target: any): void {
    // Not needed for trend lines
  }
}

// Helper class to manage trend line primitives on a series
export class TrendLineManager {
  private _series: any;
  private _trendLines: Map<string, TrendLinePrimitive>;

  constructor(series: any) {
    this._series = series;
    this._trendLines = new Map();
  }

  addTrendLine(options: TrendLineOptions): void {
    if (this._trendLines.has(options.id)) {
      // Update existing line
      const existing = this._trendLines.get(options.id)!;
      existing.updateOptions(options);
    } else {
      // Create new line
      const trendLine = new TrendLinePrimitive(options);
      this._series.attachPrimitive(trendLine);
      this._trendLines.set(options.id, trendLine);
    }
  }

  removeTrendLine(id: string): void {
    const trendLine = this._trendLines.get(id);
    if (trendLine) {
      this._series.detachPrimitive(trendLine);
      this._trendLines.delete(id);
    }
  }

  removeAllTrendLines(): void {
    this._trendLines.forEach((trendLine) => {
      this._series.detachPrimitive(trendLine);
    });
    this._trendLines.clear();
  }

  getTrendLine(id: string): TrendLinePrimitive | undefined {
    return this._trendLines.get(id);
  }

  getAllTrendLines(): TrendLinePrimitive[] {
    return Array.from(this._trendLines.values());
  }

  getFurthestTime(): number | null {
    const allTrendLines = this.getAllTrendLines();
    if (allTrendLines.length === 0) return null;

    let maxTime = -Infinity;
    
    allTrendLines.forEach(trendLine => {
      const options = trendLine.options;
      const time1 = options.point1.time as number;
      const time2 = options.point2.time as number;
      maxTime = Math.max(maxTime, time1, time2);
    });

    return maxTime === -Infinity ? null : maxTime;
  }
}
