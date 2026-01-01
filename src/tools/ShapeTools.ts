/**
 * ShapeTools - Rectangle, Ellipse, Polygon, Star, and Line tools
 */

import { BaseTool, ToolEvent } from './BaseTool';
import type {
  Point,
  RectElement,
  EllipseElement,
  PolygonElement,
  StarElement,
  PathElement,
  VectorElement,
  ToolType,
} from '../types';
import { generateId, createTransform, createStroke, createColor } from '../types';

// ============================================================================
// Rectangle Tool
// ============================================================================

export class RectangleTool extends BaseTool {
  readonly id: ToolType = 'rectangle';
  readonly name = 'Rectangle Tool';
  readonly shortcut = 'R';
  readonly cursor = 'crosshair';

  private startPoint: Point | null = null;
  private currentPoint: Point | null = null;
  private isDragging = false;

  onPointerDown(e: ToolEvent): void {
    this.startPoint = e.canvasPoint;
    this.isDragging = true;
  }

  onPointerMove(e: ToolEvent): void {
    if (!this.isDragging) return;
    this.currentPoint = e.canvasPoint;

    if (e.shiftKey && this.startPoint) {
      this.currentPoint = this.constrainToSquare(this.startPoint, this.currentPoint);
    }
  }

  onPointerUp(e: ToolEvent): void {
    if (!this.ctx || !this.startPoint || !this.currentPoint) {
      this.reset();
      return;
    }

    const width = Math.abs(this.currentPoint.x - this.startPoint.x);
    const height = Math.abs(this.currentPoint.y - this.startPoint.y);

    if (width < 2 || height < 2) {
      this.reset();
      return;
    }

    const element: RectElement = {
      id: generateId(),
      type: 'rect',
      name: 'Rectangle',
      visible: true,
      locked: false,
      opacity: 1,
      transform: createTransform(),
      fill: createColor(200, 200, 200, 1),
      stroke: createStroke(createColor(0, 0, 0, 1)),
      x: Math.min(this.startPoint.x, this.currentPoint.x),
      y: Math.min(this.startPoint.y, this.currentPoint.y),
      width,
      height,
      rx: 0,
      ry: 0,
    };

    this.ctx.addElement(element);
    this.ctx.setSelection([element.id]);
    this.ctx.commitToHistory('create rectangle');
    this.reset();
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.startPoint || !this.currentPoint) return;

    const x = Math.min(this.startPoint.x, this.currentPoint.x);
    const y = Math.min(this.startPoint.y, this.currentPoint.y);
    const width = Math.abs(this.currentPoint.x - this.startPoint.x);
    const height = Math.abs(this.currentPoint.y - this.startPoint.y);

    ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);
  }

  private reset(): void {
    this.startPoint = null;
    this.currentPoint = null;
    this.isDragging = false;
  }
}

// ============================================================================
// Ellipse Tool
// ============================================================================

export class EllipseTool extends BaseTool {
  readonly id: ToolType = 'ellipse';
  readonly name = 'Ellipse Tool';
  readonly shortcut = 'O';
  readonly cursor = 'crosshair';

  private startPoint: Point | null = null;
  private currentPoint: Point | null = null;
  private isDragging = false;

  onPointerDown(e: ToolEvent): void {
    this.startPoint = e.canvasPoint;
    this.isDragging = true;
  }

  onPointerMove(e: ToolEvent): void {
    if (!this.isDragging) return;
    this.currentPoint = e.canvasPoint;

    if (e.shiftKey && this.startPoint) {
      this.currentPoint = this.constrainToSquare(this.startPoint, this.currentPoint);
    }
  }

  onPointerUp(e: ToolEvent): void {
    if (!this.ctx || !this.startPoint || !this.currentPoint) {
      this.reset();
      return;
    }

    const rx = Math.abs(this.currentPoint.x - this.startPoint.x) / 2;
    const ry = Math.abs(this.currentPoint.y - this.startPoint.y) / 2;

    if (rx < 2 || ry < 2) {
      this.reset();
      return;
    }

    const element: EllipseElement = {
      id: generateId(),
      type: 'ellipse',
      name: 'Ellipse',
      visible: true,
      locked: false,
      opacity: 1,
      transform: createTransform(),
      fill: createColor(200, 200, 200, 1),
      stroke: createStroke(createColor(0, 0, 0, 1)),
      cx: Math.min(this.startPoint.x, this.currentPoint.x) + rx,
      cy: Math.min(this.startPoint.y, this.currentPoint.y) + ry,
      rx,
      ry,
    };

    this.ctx.addElement(element);
    this.ctx.setSelection([element.id]);
    this.ctx.commitToHistory('create ellipse');
    this.reset();
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.startPoint || !this.currentPoint) return;

    const rx = Math.abs(this.currentPoint.x - this.startPoint.x) / 2;
    const ry = Math.abs(this.currentPoint.y - this.startPoint.y) / 2;
    const cx = Math.min(this.startPoint.x, this.currentPoint.x) + rx;
    const cy = Math.min(this.startPoint.y, this.currentPoint.y) + ry;

    ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  private reset(): void {
    this.startPoint = null;
    this.currentPoint = null;
    this.isDragging = false;
  }
}

// ============================================================================
// Polygon Tool
// ============================================================================

export class PolygonTool extends BaseTool {
  readonly id: ToolType = 'polygon';
  readonly name = 'Polygon Tool';
  readonly shortcut = 'Y';
  readonly cursor = 'crosshair';

  private centerPoint: Point | null = null;
  private currentPoint: Point | null = null;
  private isDragging = false;
  private sides = 6; // Default hexagon

  setSides(sides: number): void {
    this.sides = Math.max(3, Math.min(12, sides));
  }

  onPointerDown(e: ToolEvent): void {
    this.centerPoint = e.canvasPoint;
    this.isDragging = true;
  }

  onPointerMove(e: ToolEvent): void {
    if (!this.isDragging) return;
    this.currentPoint = e.canvasPoint;
  }

  onPointerUp(e: ToolEvent): void {
    if (!this.ctx || !this.centerPoint || !this.currentPoint) {
      this.reset();
      return;
    }

    const radius = this.distance(this.centerPoint, this.currentPoint);

    if (radius < 5) {
      this.reset();
      return;
    }

    const points = this.calculatePolygonPoints(this.centerPoint, radius, this.sides);

    const element: PolygonElement = {
      id: generateId(),
      type: 'polygon',
      name: `${this.sides}-gon`,
      visible: true,
      locked: false,
      opacity: 1,
      transform: createTransform(),
      fill: createColor(200, 200, 200, 1),
      stroke: createStroke(createColor(0, 0, 0, 1)),
      points,
    };

    this.ctx.addElement(element);
    this.ctx.setSelection([element.id]);
    this.ctx.commitToHistory('create polygon');
    this.reset();
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.centerPoint || !this.currentPoint) return;

    const radius = this.distance(this.centerPoint, this.currentPoint);
    const points = this.calculatePolygonPoints(this.centerPoint, radius, this.sides);

    ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let i = 0; i < points.length; i++) {
      if (i === 0) {
        ctx.moveTo(points[i].x, points[i].y);
      } else {
        ctx.lineTo(points[i].x, points[i].y);
      }
    }

    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  private calculatePolygonPoints(center: Point, radius: number, sides: number): Point[] {
    const points: Point[] = [];
    const angleStep = (Math.PI * 2) / sides;
    const startAngle = -Math.PI / 2; // Start at top

    for (let i = 0; i < sides; i++) {
      const angle = startAngle + i * angleStep;
      points.push({
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
      });
    }

    return points;
  }

  private reset(): void {
    this.centerPoint = null;
    this.currentPoint = null;
    this.isDragging = false;
  }
}

// ============================================================================
// Star Tool
// ============================================================================

export class StarTool extends BaseTool {
  readonly id: ToolType = 'star';
  readonly name = 'Star Tool';
  readonly shortcut = 'S';
  readonly cursor = 'crosshair';

  private centerPoint: Point | null = null;
  private currentPoint: Point | null = null;
  private isDragging = false;
  private points = 5; // Default 5-pointed star
  private innerRadiusRatio = 0.4;

  setPoints(points: number): void {
    this.points = Math.max(3, Math.min(12, points));
  }

  setInnerRadiusRatio(ratio: number): void {
    this.innerRadiusRatio = Math.max(0.1, Math.min(0.9, ratio));
  }

  onPointerDown(e: ToolEvent): void {
    this.centerPoint = e.canvasPoint;
    this.isDragging = true;
  }

  onPointerMove(e: ToolEvent): void {
    if (!this.isDragging) return;
    this.currentPoint = e.canvasPoint;
  }

  onPointerUp(e: ToolEvent): void {
    if (!this.ctx || !this.centerPoint || !this.currentPoint) {
      this.reset();
      return;
    }

    const outerRadius = this.distance(this.centerPoint, this.currentPoint);

    if (outerRadius < 5) {
      this.reset();
      return;
    }

    const element: StarElement = {
      id: generateId(),
      type: 'star',
      name: `${this.points}-Point Star`,
      visible: true,
      locked: false,
      opacity: 1,
      transform: createTransform(),
      fill: createColor(255, 215, 0, 1), // Gold
      stroke: createStroke(createColor(0, 0, 0, 1)),
      cx: this.centerPoint.x,
      cy: this.centerPoint.y,
      points: this.points,
      outerRadius,
      innerRadius: outerRadius * this.innerRadiusRatio,
      rotation: 0,
    };

    this.ctx.addElement(element);
    this.ctx.setSelection([element.id]);
    this.ctx.commitToHistory('create star');
    this.reset();
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.centerPoint || !this.currentPoint) return;

    const outerRadius = this.distance(this.centerPoint, this.currentPoint);
    const innerRadius = outerRadius * this.innerRadiusRatio;

    ctx.fillStyle = 'rgba(255, 215, 0, 0.5)';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.beginPath();

    const angleStep = Math.PI / this.points;
    const startAngle = -Math.PI / 2;

    for (let i = 0; i < this.points * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = startAngle + i * angleStep;
      const x = this.centerPoint.x + Math.cos(angle) * radius;
      const y = this.centerPoint.y + Math.sin(angle) * radius;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  private reset(): void {
    this.centerPoint = null;
    this.currentPoint = null;
    this.isDragging = false;
  }
}

// ============================================================================
// Line Tool
// ============================================================================

export class LineTool extends BaseTool {
  readonly id: ToolType = 'line';
  readonly name = 'Line Tool';
  readonly shortcut = 'L';
  readonly cursor = 'crosshair';

  private startPoint: Point | null = null;
  private currentPoint: Point | null = null;
  private isDragging = false;

  onPointerDown(e: ToolEvent): void {
    this.startPoint = e.canvasPoint;
    this.isDragging = true;
  }

  onPointerMove(e: ToolEvent): void {
    if (!this.isDragging || !this.startPoint) return;

    this.currentPoint = e.canvasPoint;

    if (e.shiftKey) {
      this.currentPoint = this.constrainTo45(this.startPoint, this.currentPoint);
    }
  }

  onPointerUp(e: ToolEvent): void {
    if (!this.ctx || !this.startPoint || !this.currentPoint) {
      this.reset();
      return;
    }

    const length = this.distance(this.startPoint, this.currentPoint);

    if (length < 2) {
      this.reset();
      return;
    }

    const element: PathElement = {
      id: generateId(),
      type: 'path',
      name: 'Line',
      visible: true,
      locked: false,
      opacity: 1,
      transform: createTransform(),
      fill: null,
      stroke: createStroke(createColor(0, 0, 0, 1)),
      commands: [
        { type: 'M', x: this.startPoint.x, y: this.startPoint.y },
        { type: 'L', x: this.currentPoint.x, y: this.currentPoint.y },
      ],
      closed: false,
    };

    this.ctx.addElement(element);
    this.ctx.setSelection([element.id]);
    this.ctx.commitToHistory('create line');
    this.reset();
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.startPoint || !this.currentPoint) return;

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.startPoint.x, this.startPoint.y);
    ctx.lineTo(this.currentPoint.x, this.currentPoint.y);
    ctx.stroke();
  }

  private reset(): void {
    this.startPoint = null;
    this.currentPoint = null;
    this.isDragging = false;
  }
}
