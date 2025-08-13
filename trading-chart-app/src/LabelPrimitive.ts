import {
  ISeriesPrimitive,
  IPrimitivePaneView,
  PrimitivePaneViewZOrder,
  Time,
  PrimitiveHoveredItem
} from 'lightweight-charts';
import { CanvasRenderingTarget2D, BitmapCoordinatesRenderingScope } from 'fancy-canvas';

export interface LabelOptions {
  time: Time;
  price: number;
  text: string;
  color: string;
  fontSize: number;
  id: string;
}

export class LabelPrimitive implements ISeriesPrimitive<Time> {
  private _options: LabelOptions;
  private _paneViews: LabelPaneView[];
  private _series: any;
  private _chart: any;

  constructor(options: LabelOptions) {
    this._options = options;
    this._paneViews = [];
  }

  updateOptions(options: Partial<LabelOptions>): void {
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
    this._paneViews = [new LabelPaneView(this)];
  }

  detached(): void {
    this._series = null;
    this._chart = null;
    this._paneViews = [];
  }

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    return null;
  }

  get options(): LabelOptions {
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

class LabelPaneView implements IPrimitivePaneView {
  private _source: LabelPrimitive;
  private _point: ViewPoint = { x: null, y: null };

  constructor(source: LabelPrimitive) {
    this._source = source;
  }

  update(): void {
    const series = this._source.series;
    const chart = this._source.chart;
    const options = this._source.options;
    
    if (!series || !chart) {
      return;
    }

    const y = series.priceToCoordinate(options.price);
    const timeScale = chart.timeScale();
    const x = timeScale.timeToCoordinate(options.time);

    this._point = { x, y };
  }

  renderer(): LabelRenderer | null {
    this.update();
    
    if (this._point.x === null || this._point.y === null) {
      return null;
    }
    
    return new LabelRenderer(
      this._point as { x: number; y: number },
      this._source.options
    );
  }

  zOrder(): PrimitivePaneViewZOrder {
    return 'normal';
  }
}

class LabelRenderer {
  private _point: { x: number; y: number };
  private _options: LabelOptions;

  constructor(point: { x: number; y: number }, options: LabelOptions) {
    this._point = point;
    this._options = options;
  }

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope: BitmapCoordinatesRenderingScope) => {
      const ctx = scope.context;
      
      // Scale coordinates for high DPI displays
      const xScaled = Math.round(this._point.x * scope.horizontalPixelRatio);
      const yScaled = Math.round(this._point.y * scope.verticalPixelRatio);
      
      // Arrow dimensions
      const arrowHeight = 20 * scope.verticalPixelRatio;
      const arrowWidth = 10 * scope.horizontalPixelRatio;
      
      // Draw arrow pointing up (tip at exact coordinate)
      ctx.strokeStyle = this._options.color;
      ctx.fillStyle = this._options.color;
      ctx.lineWidth = 2 * scope.horizontalPixelRatio;
      
      // Arrow shaft (vertical line going down from tip)
      ctx.beginPath();
      ctx.moveTo(xScaled, yScaled);
      ctx.lineTo(xScaled, yScaled + arrowHeight);
      ctx.stroke();
      
      // Arrow tip (triangle pointing up)
      ctx.beginPath();
      ctx.moveTo(xScaled, yScaled); // tip
      ctx.lineTo(xScaled - arrowWidth/2, yScaled + arrowWidth); // left
      ctx.lineTo(xScaled + arrowWidth/2, yScaled + arrowWidth); // right
      ctx.closePath();
      ctx.fill();
      
      // Draw text below arrow
      ctx.font = `${this._options.fontSize * scope.verticalPixelRatio}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      
      const textY = yScaled + arrowHeight + (5 * scope.verticalPixelRatio);
      ctx.fillText(this._options.text, xScaled, textY);
      
    });
  }

  drawBackground(target: any): void {
    // Not needed for labels
  }
}

// Helper class to manage label primitives on a series
export class LabelManager {
  private _series: any;
  private _labels: Map<string, LabelPrimitive>;

  constructor(series: any) {
    this._series = series;
    this._labels = new Map();
  }

  addLabel(options: LabelOptions): void {
    if (this._labels.has(options.id)) {
      const existing = this._labels.get(options.id)!;
      existing.updateOptions(options);
    } else {
      const label = new LabelPrimitive(options);
      this._series.attachPrimitive(label);
      this._labels.set(options.id, label);
    }
  }

  removeLabel(id: string): void {
    const label = this._labels.get(id);
    if (label) {
      this._series.detachPrimitive(label);
      this._labels.delete(id);
    }
  }

  removeAllLabels(): void {
    this._labels.forEach((label) => {
      this._series.detachPrimitive(label);
    });
    this._labels.clear();
  }

  getLabel(id: string): LabelPrimitive | undefined {
    return this._labels.get(id);
  }

  getAllLabels(): LabelPrimitive[] {
    return Array.from(this._labels.values());
  }
}
