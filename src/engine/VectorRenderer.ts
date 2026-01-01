/**
 * VectorRenderer - SVG-based vector graphics renderer
 *
 * Renders vector elements to Canvas2D for preview and SVG for export.
 * Supports all path commands, shapes, gradients, and transforms.
 */

import type {
  VectorElement,
  PathElement,
  RectElement,
  EllipseElement,
  PolygonElement,
  StarElement,
  TextElement,
  GroupElement,
  PathCommand,
  Color,
  Fill,
  Stroke,
  Gradient,
  LinearGradient,
  RadialGradient,
  Transform,
  Bounds,
  Point,
  Document,
  Layer,
} from '../types';
import { colorToRgba } from '../types';

// ============================================================================
// Canvas2D Renderer
// ============================================================================

export class VectorRenderer {
  private ctx: CanvasRenderingContext2D;
  private gradientCache: Map<string, CanvasGradient> = new Map();

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  clear(color?: Color): void {
    const { canvas } = this.ctx;
    if (color) {
      this.ctx.fillStyle = colorToRgba(color);
      this.ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  renderDocument(doc: Document, zoom: number, panX: number, panY: number): void {
    const ctx = this.ctx;
    ctx.save();

    // Apply viewport transform
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    // Draw document background
    ctx.fillStyle = colorToRgba(doc.background);
    ctx.fillRect(0, 0, doc.width, doc.height);

    // Draw artboard if present
    // ...

    // Draw layers (bottom to top)
    for (const layer of doc.layers) {
      if (layer.visible) {
        this.renderLayer(layer);
      }
    }

    ctx.restore();
  }

  renderLayer(layer: Layer): void {
    if (!layer.visible || layer.opacity <= 0) return;

    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = layer.opacity;

    for (const element of layer.elements) {
      this.renderElement(element);
    }

    ctx.restore();
  }

  renderElement(element: VectorElement): void {
    if (!element.visible || element.opacity <= 0) return;

    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha *= element.opacity;

    // Apply transform
    this.applyTransform(element.transform);

    switch (element.type) {
      case 'path':
        this.renderPath(element);
        break;
      case 'rect':
        this.renderRect(element);
        break;
      case 'ellipse':
        this.renderEllipse(element);
        break;
      case 'polygon':
        this.renderPolygon(element);
        break;
      case 'star':
        this.renderStar(element);
        break;
      case 'text':
        this.renderText(element);
        break;
      case 'group':
        this.renderGroup(element);
        break;
    }

    ctx.restore();
  }

  private applyTransform(transform: Transform): void {
    const ctx = this.ctx;
    ctx.translate(transform.originX, transform.originY);
    ctx.translate(transform.translateX, transform.translateY);
    ctx.rotate((transform.rotation * Math.PI) / 180);
    ctx.scale(transform.scaleX, transform.scaleY);
    ctx.translate(-transform.originX, -transform.originY);
  }

  private applyFill(fill: Fill): void {
    if (!fill) return;

    if ('type' in fill) {
      this.ctx.fillStyle = this.createGradient(fill);
    } else {
      this.ctx.fillStyle = colorToRgba(fill);
    }
    this.ctx.fill();
  }

  private applyStroke(stroke: Stroke | null): void {
    if (!stroke) return;

    const ctx = this.ctx;
    ctx.strokeStyle = colorToRgba(stroke.color);
    ctx.lineWidth = stroke.width;
    ctx.lineCap = stroke.cap;
    ctx.lineJoin = stroke.join;
    ctx.miterLimit = stroke.miterLimit;

    if (stroke.dashArray.length > 0) {
      ctx.setLineDash(stroke.dashArray);
      ctx.lineDashOffset = stroke.dashOffset;
    }

    ctx.stroke();
  }

  private createGradient(gradient: Gradient): CanvasGradient {
    const ctx = this.ctx;
    let canvasGradient: CanvasGradient;

    if (gradient.type === 'linear') {
      canvasGradient = ctx.createLinearGradient(
        gradient.x1,
        gradient.y1,
        gradient.x2,
        gradient.y2
      );
    } else {
      canvasGradient = ctx.createRadialGradient(
        gradient.fx ?? gradient.cx,
        gradient.fy ?? gradient.cy,
        0,
        gradient.cx,
        gradient.cy,
        gradient.r
      );
    }

    for (const stop of gradient.stops) {
      canvasGradient.addColorStop(stop.offset, colorToRgba(stop.color));
    }

    return canvasGradient;
  }

  private renderPath(element: PathElement): void {
    const ctx = this.ctx;
    ctx.beginPath();
    this.tracePath(element.commands);

    if (element.closed) {
      ctx.closePath();
    }

    this.applyFill(element.fill);
    this.applyStroke(element.stroke);
  }

  private tracePath(commands: PathCommand[]): void {
    const ctx = this.ctx;
    let lastX = 0;
    let lastY = 0;
    let lastControlX = 0;
    let lastControlY = 0;

    for (const cmd of commands) {
      switch (cmd.type) {
        case 'M':
          ctx.moveTo(cmd.x, cmd.y);
          lastX = cmd.x;
          lastY = cmd.y;
          break;

        case 'L':
          ctx.lineTo(cmd.x, cmd.y);
          lastX = cmd.x;
          lastY = cmd.y;
          break;

        case 'H':
          ctx.lineTo(cmd.x, lastY);
          lastX = cmd.x;
          break;

        case 'V':
          ctx.lineTo(lastX, cmd.y);
          lastY = cmd.y;
          break;

        case 'C':
          ctx.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
          lastControlX = cmd.x2;
          lastControlY = cmd.y2;
          lastX = cmd.x;
          lastY = cmd.y;
          break;

        case 'S':
          // Smooth cubic: reflect previous control point
          const cx1 = 2 * lastX - lastControlX;
          const cy1 = 2 * lastY - lastControlY;
          ctx.bezierCurveTo(cx1, cy1, cmd.x2, cmd.y2, cmd.x, cmd.y);
          lastControlX = cmd.x2;
          lastControlY = cmd.y2;
          lastX = cmd.x;
          lastY = cmd.y;
          break;

        case 'Q':
          ctx.quadraticCurveTo(cmd.x1, cmd.y1, cmd.x, cmd.y);
          lastControlX = cmd.x1;
          lastControlY = cmd.y1;
          lastX = cmd.x;
          lastY = cmd.y;
          break;

        case 'T':
          // Smooth quadratic: reflect previous control point
          const qx1 = 2 * lastX - lastControlX;
          const qy1 = 2 * lastY - lastControlY;
          ctx.quadraticCurveTo(qx1, qy1, cmd.x, cmd.y);
          lastControlX = qx1;
          lastControlY = qy1;
          lastX = cmd.x;
          lastY = cmd.y;
          break;

        case 'A':
          this.arcTo(lastX, lastY, cmd);
          lastX = cmd.x;
          lastY = cmd.y;
          break;

        case 'Z':
          ctx.closePath();
          break;
      }
    }
  }

  private arcTo(
    x1: number,
    y1: number,
    cmd: { rx: number; ry: number; angle: number; largeArc: boolean; sweep: boolean; x: number; y: number }
  ): void {
    // Elliptical arc implementation using canvas approximation
    const { rx, ry, angle, largeArc, sweep, x: x2, y: y2 } = cmd;

    if (rx === 0 || ry === 0) {
      this.ctx.lineTo(x2, y2);
      return;
    }

    // Convert to center parameterization
    const dx = (x1 - x2) / 2;
    const dy = (y1 - y2) / 2;
    const angleRad = (angle * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    const x1p = cos * dx + sin * dy;
    const y1p = -sin * dx + cos * dy;

    let rxSq = rx * rx;
    let rySq = ry * ry;
    const x1pSq = x1p * x1p;
    const y1pSq = y1p * y1p;

    // Check if radii are large enough
    const lambda = x1pSq / rxSq + y1pSq / rySq;
    let rxFinal = rx;
    let ryFinal = ry;
    if (lambda > 1) {
      const sqrtLambda = Math.sqrt(lambda);
      rxFinal = sqrtLambda * rx;
      ryFinal = sqrtLambda * ry;
      rxSq = rxFinal * rxFinal;
      rySq = ryFinal * ryFinal;
    }

    // Compute center point
    const sign = largeArc === sweep ? -1 : 1;
    const numerator = Math.max(0, rxSq * rySq - rxSq * y1pSq - rySq * x1pSq);
    const denominator = rxSq * y1pSq + rySq * x1pSq;
    const coef = sign * Math.sqrt(numerator / denominator);

    const cxp = (coef * rxFinal * y1p) / ryFinal;
    const cyp = (-coef * ryFinal * x1p) / rxFinal;

    const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
    const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;

    // Compute angles
    const vectorAngle = (ux: number, uy: number, vx: number, vy: number): number => {
      const n = Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy);
      const c = (ux * vx + uy * vy) / n;
      const s = ux * vy - uy * vx;
      return Math.atan2(s, c);
    };

    const theta1 = vectorAngle(1, 0, (x1p - cxp) / rxFinal, (y1p - cyp) / ryFinal);
    let dtheta = vectorAngle(
      (x1p - cxp) / rxFinal,
      (y1p - cyp) / ryFinal,
      (-x1p - cxp) / rxFinal,
      (-y1p - cyp) / ryFinal
    );

    if (!sweep && dtheta > 0) {
      dtheta -= 2 * Math.PI;
    } else if (sweep && dtheta < 0) {
      dtheta += 2 * Math.PI;
    }

    // Draw arc using ellipse
    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.rotate(angleRad);
    this.ctx.scale(rxFinal, ryFinal);
    this.ctx.arc(0, 0, 1, theta1, theta1 + dtheta, !sweep);
    this.ctx.restore();
  }

  private renderRect(element: RectElement): void {
    const ctx = this.ctx;
    ctx.beginPath();

    if (element.rx > 0 || element.ry > 0) {
      ctx.roundRect(element.x, element.y, element.width, element.height, [
        Math.min(element.rx, element.ry),
      ]);
    } else {
      ctx.rect(element.x, element.y, element.width, element.height);
    }

    this.applyFill(element.fill);
    this.applyStroke(element.stroke);
  }

  private renderEllipse(element: EllipseElement): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.ellipse(element.cx, element.cy, element.rx, element.ry, 0, 0, Math.PI * 2);
    this.applyFill(element.fill);
    this.applyStroke(element.stroke);
  }

  private renderPolygon(element: PolygonElement): void {
    if (element.points.length < 2) return;

    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(element.points[0].x, element.points[0].y);

    for (let i = 1; i < element.points.length; i++) {
      ctx.lineTo(element.points[i].x, element.points[i].y);
    }

    ctx.closePath();
    this.applyFill(element.fill);
    this.applyStroke(element.stroke);
  }

  private renderStar(element: StarElement): void {
    const ctx = this.ctx;
    const { cx, cy, points, outerRadius, innerRadius, rotation } = element;
    const angleStep = Math.PI / points;
    const startAngle = ((rotation - 90) * Math.PI) / 180;

    ctx.beginPath();

    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = startAngle + i * angleStep;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.closePath();
    this.applyFill(element.fill);
    this.applyStroke(element.stroke);
  }

  private renderText(element: TextElement): void {
    const ctx = this.ctx;
    const fontStyle = element.fontStyle === 'italic' ? 'italic ' : '';
    ctx.font = `${fontStyle}${element.fontWeight} ${element.fontSize}px ${element.fontFamily}`;
    ctx.textAlign = element.textAnchor;
    ctx.textBaseline = 'alphabetic';

    if (element.fill) {
      if ('type' in element.fill) {
        ctx.fillStyle = this.createGradient(element.fill);
      } else {
        ctx.fillStyle = colorToRgba(element.fill);
      }
      ctx.fillText(element.text, element.x, element.y);
    }

    if (element.stroke) {
      ctx.strokeStyle = colorToRgba(element.stroke.color);
      ctx.lineWidth = element.stroke.width;
      ctx.strokeText(element.text, element.x, element.y);
    }
  }

  private renderGroup(element: GroupElement): void {
    for (const child of element.children) {
      this.renderElement(child);
    }
  }

  // ============================================================================
  // Selection Rendering
  // ============================================================================

  renderSelection(bounds: Bounds, handles: boolean = true): void {
    const ctx = this.ctx;

    // Selection rectangle
    ctx.strokeStyle = '#0066ff';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 3]);
    ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    ctx.setLineDash([]);

    if (handles) {
      this.renderHandles(bounds);
    }
  }

  private renderHandles(bounds: Bounds): void {
    const ctx = this.ctx;
    const handleSize = 8;
    const half = handleSize / 2;

    const positions = [
      { x: bounds.x, y: bounds.y }, // NW
      { x: bounds.x + bounds.width / 2, y: bounds.y }, // N
      { x: bounds.x + bounds.width, y: bounds.y }, // NE
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 }, // E
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height }, // SE
      { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height }, // S
      { x: bounds.x, y: bounds.y + bounds.height }, // SW
      { x: bounds.x, y: bounds.y + bounds.height / 2 }, // W
    ];

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0066ff';
    ctx.lineWidth = 1;

    for (const pos of positions) {
      ctx.fillRect(pos.x - half, pos.y - half, handleSize, handleSize);
      ctx.strokeRect(pos.x - half, pos.y - half, handleSize, handleSize);
    }
  }

  renderPathHandles(element: PathElement): void {
    const ctx = this.ctx;
    const commands = element.commands;

    // Draw control points and handles
    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];

      if (cmd.type === 'M' || cmd.type === 'L') {
        this.drawAnchorPoint(cmd.x, cmd.y);
      } else if (cmd.type === 'C') {
        // Draw control handles
        const prevCmd = commands[i - 1];
        if (prevCmd && ('x' in prevCmd)) {
          this.drawControlLine(prevCmd.x, prevCmd.y, cmd.x1, cmd.y1);
        }
        this.drawControlLine(cmd.x, cmd.y, cmd.x2, cmd.y2);
        this.drawControlPoint(cmd.x1, cmd.y1);
        this.drawControlPoint(cmd.x2, cmd.y2);
        this.drawAnchorPoint(cmd.x, cmd.y);
      } else if (cmd.type === 'Q') {
        const prevCmd = commands[i - 1];
        if (prevCmd && ('x' in prevCmd)) {
          this.drawControlLine(prevCmd.x, prevCmd.y, cmd.x1, cmd.y1);
        }
        this.drawControlLine(cmd.x, cmd.y, cmd.x1, cmd.y1);
        this.drawControlPoint(cmd.x1, cmd.y1);
        this.drawAnchorPoint(cmd.x, cmd.y);
      }
    }
  }

  private drawAnchorPoint(x: number, y: number): void {
    const ctx = this.ctx;
    const size = 6;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0066ff';
    ctx.lineWidth = 1.5;
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
    ctx.strokeRect(x - size / 2, y - size / 2, size, size);
  }

  private drawControlPoint(x: number, y: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#0066ff';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawControlLine(x1: number, y1: number, x2: number, y2: number): void {
    const ctx = this.ctx;
    ctx.strokeStyle = '#0066ff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // ============================================================================
  // Grid and Guides
  // ============================================================================

  renderGrid(
    width: number,
    height: number,
    gridSize: number,
    zoom: number,
    panX: number,
    panY: number
  ): void {
    const ctx = this.ctx;
    const adjustedSize = gridSize * zoom;

    if (adjustedSize < 5) return; // Don't draw if too small

    ctx.strokeStyle = 'rgba(128, 128, 128, 0.2)';
    ctx.lineWidth = 1;

    const offsetX = panX % adjustedSize;
    const offsetY = panY % adjustedSize;

    ctx.beginPath();

    // Vertical lines
    for (let x = offsetX; x < width; x += adjustedSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }

    // Horizontal lines
    for (let y = offsetY; y < height; y += adjustedSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }

    ctx.stroke();
  }

  renderGuides(guides: { type: 'horizontal' | 'vertical'; position: number }[], zoom: number, panX: number, panY: number): void {
    const ctx = this.ctx;
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 1;

    for (const guide of guides) {
      ctx.beginPath();
      if (guide.type === 'horizontal') {
        const y = guide.position * zoom + panY;
        ctx.moveTo(0, y);
        ctx.lineTo(ctx.canvas.width, y);
      } else {
        const x = guide.position * zoom + panX;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, ctx.canvas.height);
      }
      ctx.stroke();
    }
  }
}

// ============================================================================
// Bounds Calculation
// ============================================================================

export function getElementBounds(element: VectorElement): Bounds {
  switch (element.type) {
    case 'rect':
      return { x: element.x, y: element.y, width: element.width, height: element.height };

    case 'ellipse':
      return {
        x: element.cx - element.rx,
        y: element.cy - element.ry,
        width: element.rx * 2,
        height: element.ry * 2,
      };

    case 'polygon':
      return getPolygonBounds(element.points);

    case 'star':
      return {
        x: element.cx - element.outerRadius,
        y: element.cy - element.outerRadius,
        width: element.outerRadius * 2,
        height: element.outerRadius * 2,
      };

    case 'path':
      return getPathBounds(element.commands);

    case 'text':
      // Approximate - would need actual text measurement
      return { x: element.x, y: element.y - element.fontSize, width: element.text.length * element.fontSize * 0.6, height: element.fontSize * element.lineHeight };

    case 'group':
      return getGroupBounds(element.children);

    default:
      return { x: 0, y: 0, width: 0, height: 0 };
  }
}

function getPolygonBounds(points: Point[]): Bounds {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;

  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function getPathBounds(commands: PathCommand[]): Bounds {
  if (commands.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const updateBounds = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  for (const cmd of commands) {
    if ('x' in cmd) updateBounds(cmd.x, 'y' in cmd ? cmd.y : 0);
    if ('x1' in cmd) updateBounds(cmd.x1, cmd.y1);
    if ('x2' in cmd) updateBounds(cmd.x2, cmd.y2);
  }

  if (!isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function getGroupBounds(children: VectorElement[]): Bounds {
  if (children.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const child of children) {
    const bounds = getElementBounds(child);
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
