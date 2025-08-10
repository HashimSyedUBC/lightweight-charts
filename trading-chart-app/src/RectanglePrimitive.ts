import {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  ISeriesPrimitivePaneView,
  ISeriesPrimitivePaneRenderer,
  PrimitiveHoveredItem,
  Time,
} from 'lightweight-charts';
import { CanvasRenderingTarget2D, BitmapCoordinatesRenderingScope } from 'fancy-canvas';

// Rectangle data structure - now supports 4 points for tilted rectangles
export interface RectangleData {
  id: string;
  points: {
    p1: { time: Time; price: number }; // Top-left
    p2: { time: Time; price: number }; // Top-right
    p3: { time: Time; price: number }; // Bottom-right
    p4: { time: Time; price: number }; // Bottom-left
  };
  fillColor: string;
  fillOpacity: number;
  borderColor?: string;
  borderWidth?: number;
}

export class RectanglePrimitive implements ISeriesPrimitive<Time> {
  private _data: RectangleData;
  private _paneViews: RectanglePaneView[];
  private _series: any;
  private _chart: any;

  constructor(data: RectangleData) {
    this._data = data;
    this._paneViews = [];
  }

  updateData(data: Partial<RectangleData>): void {
    this._data = { ...this._data, ...data };
    if (this._paneViews.length > 0) {
      this._paneViews[0].update();
    }
  }

  paneViews(): readonly ISeriesPrimitivePaneView[] {
    return this._paneViews;
  }

  attached(params: { series: any; chart: any }): void {
    this._series = params.series;
    this._chart = params.chart;
    this._paneViews = [new RectanglePaneView(this)];
  }

  detached(): void {
    this._series = null;
    this._chart = null;
    this._paneViews = [];
  }

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    return null; // No hover interaction for now
  }

  get data(): RectangleData {
    return this._data;
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

class RectanglePaneView implements ISeriesPrimitivePaneView {
  private _source: RectanglePrimitive;
  private _p1: ViewPoint = { x: null, y: null };
  private _p2: ViewPoint = { x: null, y: null };
  private _p3: ViewPoint = { x: null, y: null };
  private _p4: ViewPoint = { x: null, y: null };

  constructor(source: RectanglePrimitive) {
    this._source = source;
  }

  update(): void {
    const series = this._source.series;
    const chart = this._source.chart;
    
    if (!series || !chart) {
      return;
    }

    const timeScale = chart.timeScale();
    const data = this._source.data;

    // Convert time/price to coordinates for all 4 points
    const x1 = timeScale.timeToCoordinate(data.points.p1.time);
    const y1 = series.priceToCoordinate(data.points.p1.price);
    const x2 = timeScale.timeToCoordinate(data.points.p2.time);
    const y2 = series.priceToCoordinate(data.points.p2.price);
    const x3 = timeScale.timeToCoordinate(data.points.p3.time);
    const y3 = series.priceToCoordinate(data.points.p3.price);
    const x4 = timeScale.timeToCoordinate(data.points.p4.time);
    const y4 = series.priceToCoordinate(data.points.p4.price);
    this._p1 = { x: x1, y: y1 };
    this._p2 = { x: x2, y: y2 };
    this._p3 = { x: x3, y: y3 };
    this._p4 = { x: x4, y: y4 };
  }

  renderer(): ISeriesPrimitivePaneRenderer | null {
    if (
      this._p1.x === null || this._p1.y === null ||
      this._p2.x === null || this._p2.y === null ||
      this._p3.x === null || this._p3.y === null ||
      this._p4.x === null || this._p4.y === null
    ) {
      return null;
    }

    return new RectangleRenderer(
      this._p1, this._p2, this._p3, this._p4,
      this._source.data
    );
  }
}

class RectangleRenderer implements ISeriesPrimitivePaneRenderer {
  private _p1: ViewPoint;
  private _p2: ViewPoint;
  private _p3: ViewPoint;
  private _p4: ViewPoint;
  private _data: RectangleData;

  constructor(p1: ViewPoint, p2: ViewPoint, p3: ViewPoint, p4: ViewPoint, data: RectangleData) {
    this._p1 = p1;
    this._p2 = p2;
    this._p3 = p3;
    this._p4 = p4;
    this._data = data;
  }

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope: BitmapCoordinatesRenderingScope) => {
      if (
        this._p1.x === null || this._p1.y === null ||
        this._p2.x === null || this._p2.y === null ||
        this._p3.x === null || this._p3.y === null ||
        this._p4.x === null || this._p4.y === null
      ) {
        return;
      }

      const ctx = scope.context;

      // Scale coordinates for high DPI displays
      const x1 = Math.round(this._p1.x * scope.horizontalPixelRatio);
      const y1 = Math.round(this._p1.y * scope.verticalPixelRatio);
      const x2 = Math.round(this._p2.x * scope.horizontalPixelRatio);
      const y2 = Math.round(this._p2.y * scope.verticalPixelRatio);
      const x3 = Math.round(this._p3.x * scope.horizontalPixelRatio);
      const y3 = Math.round(this._p3.y * scope.verticalPixelRatio);
      const x4 = Math.round(this._p4.x * scope.horizontalPixelRatio);
      const y4 = Math.round(this._p4.y * scope.verticalPixelRatio);


      // Save context state
      ctx.save();

      // Draw filled polygon using path
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.lineTo(x4, y4);
      ctx.closePath();
      
      // Fill the polygon
      ctx.fillStyle = this._data.fillColor;
      ctx.globalAlpha = this._data.fillOpacity;
      ctx.fill();

      // Draw border if specified
      if (this._data.borderColor && this._data.borderWidth) {
        ctx.strokeStyle = this._data.borderColor;
        ctx.lineWidth = this._data.borderWidth * scope.verticalPixelRatio;
        ctx.globalAlpha = 1;
        ctx.stroke();
      }

      // Restore context state
      ctx.restore();
    });
  }
}

// Rectangle Manager for managing multiple rectangles
export class RectangleManager {
  private _chart: any;
  private _series: any;
  private _rectangles: Map<string, RectanglePrimitive>;

  constructor(chart: any, series: any) {
    this._chart = chart;
    this._series = series;
    this._rectangles = new Map();
    
    // Subscribe to chart view changes to update rectangle coordinates
    this._chart.timeScale().subscribeVisibleTimeRangeChange(() => {
      this._rectangles.forEach((primitive, id) => {
        if (primitive.paneViews().length > 0) {
          (primitive.paneViews()[0] as any).update();
        }
      });
    });
  }

  addRectangle(data: RectangleData): void {
    const primitive = new RectanglePrimitive(data);
    this._rectangles.set(data.id, primitive);
    this._series.attachPrimitive(primitive);
    
    // Manually trigger update to calculate coordinates
    if (primitive.paneViews().length > 0) {
      (primitive.paneViews()[0] as any).update();
    }
  }

  removeRectangle(id: string): void {
    const primitive = this._rectangles.get(id);
    if (primitive) {
      this._series.detachPrimitive(primitive);
      this._rectangles.delete(id);
    }
  }

  removeAllRectangles(): void {
    this._rectangles.forEach((primitive) => {
      this._series.detachPrimitive(primitive);
    });
    this._rectangles.clear();
  }

  get rectangles(): RectanglePrimitive[] {
    return Array.from(this._rectangles.values());
  }
}
