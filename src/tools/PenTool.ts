/**
 * PenTool - Bezier path drawing tool
 *
 * Creates paths with anchor points and bezier control handles.
 * Supports both corner points and smooth curves.
 */

import { BaseTool, ToolEvent } from './BaseTool';
import type {
  Point,
  PathCommand,
  PathElement,
  ToolType,
  Color,
} from '../types';
import { generateId, createTransform, createStroke, createColor } from '../types';

interface PenPoint {
  anchor: Point;
  handleIn: Point | null;
  handleOut: Point | null;
}

export class PenTool extends BaseTool {
  readonly id: ToolType = 'pen';
  readonly name = 'Pen Tool';
  readonly shortcut = 'P';
  readonly cursor = 'crosshair';

  private points: PenPoint[] = [];
  private currentPoint: Point | null = null;
  private isDragging = false;
  private dragStartPoint: Point | null = null;
  private isClosing = false;

  protected onDeactivate(): void {
    this.finishPath();
  }

  onPointerDown(e: ToolEvent): void {
    if (!this.ctx) return;

    const point = e.canvasPoint;
    this.dragStartPoint = point;
    this.isDragging = true;

    // Check if closing the path
    if (this.points.length >= 2) {
      const firstPoint = this.points[0].anchor;
      if (this.distance(point, firstPoint) < 10) {
        this.isClosing = true;
        return;
      }
    }

    // Add new point
    this.points.push({
      anchor: point,
      handleIn: null,
      handleOut: null,
    });
  }

  onPointerMove(e: ToolEvent): void {
    if (!this.ctx) return;

    const point = e.canvasPoint;
    this.currentPoint = point;

    if (this.isDragging && this.dragStartPoint) {
      const lastPoint = this.points[this.points.length - 1];

      if (lastPoint) {
        // Create symmetric handles while dragging
        const dx = point.x - this.dragStartPoint.x;
        const dy = point.y - this.dragStartPoint.y;

        lastPoint.handleOut = point;
        lastPoint.handleIn = {
          x: this.dragStartPoint.x - dx,
          y: this.dragStartPoint.y - dy,
        };
      }
    }
  }

  onPointerUp(e: ToolEvent): void {
    this.isDragging = false;
    this.dragStartPoint = null;

    if (this.isClosing) {
      this.closePath();
      this.isClosing = false;
    }
  }

  onDoubleClick(e: ToolEvent): void {
    this.finishPath();
  }

  onKeyDown(e: ToolEvent): void {
    const event = e.event as KeyboardEvent;

    switch (event.key) {
      case 'Escape':
        this.cancelPath();
        break;
      case 'Enter':
        this.finishPath();
        break;
      case 'Backspace':
      case 'Delete':
        this.removeLastPoint();
        break;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.points.length === 0) return;

    ctx.save();

    // Draw the path so far
    ctx.strokeStyle = '#0066ff';
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i];

      if (i === 0) {
        ctx.moveTo(p.anchor.x, p.anchor.y);
      } else {
        const prev = this.points[i - 1];

        if (prev.handleOut && p.handleIn) {
          ctx.bezierCurveTo(
            prev.handleOut.x,
            prev.handleOut.y,
            p.handleIn.x,
            p.handleIn.y,
            p.anchor.x,
            p.anchor.y
          );
        } else if (prev.handleOut) {
          ctx.quadraticCurveTo(prev.handleOut.x, prev.handleOut.y, p.anchor.x, p.anchor.y);
        } else if (p.handleIn) {
          ctx.quadraticCurveTo(p.handleIn.x, p.handleIn.y, p.anchor.x, p.anchor.y);
        } else {
          ctx.lineTo(p.anchor.x, p.anchor.y);
        }
      }
    }

    // Draw line to current mouse position
    if (this.currentPoint && !this.isDragging) {
      const last = this.points[this.points.length - 1];
      if (last.handleOut) {
        ctx.quadraticCurveTo(last.handleOut.x, last.handleOut.y, this.currentPoint.x, this.currentPoint.y);
      } else {
        ctx.lineTo(this.currentPoint.x, this.currentPoint.y);
      }
    }

    ctx.stroke();

    // Draw control handles
    for (const p of this.points) {
      // Handle lines
      ctx.strokeStyle = '#0066ff';
      ctx.lineWidth = 1;

      if (p.handleIn) {
        ctx.beginPath();
        ctx.moveTo(p.anchor.x, p.anchor.y);
        ctx.lineTo(p.handleIn.x, p.handleIn.y);
        ctx.stroke();
      }

      if (p.handleOut) {
        ctx.beginPath();
        ctx.moveTo(p.anchor.x, p.anchor.y);
        ctx.lineTo(p.handleOut.x, p.handleOut.y);
        ctx.stroke();
      }

      // Anchor point
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#0066ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.rect(p.anchor.x - 4, p.anchor.y - 4, 8, 8);
      ctx.fill();
      ctx.stroke();

      // Control handles
      if (p.handleIn) {
        ctx.fillStyle = '#0066ff';
        ctx.beginPath();
        ctx.arc(p.handleIn.x, p.handleIn.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      if (p.handleOut) {
        ctx.fillStyle = '#0066ff';
        ctx.beginPath();
        ctx.arc(p.handleOut.x, p.handleOut.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Highlight first point if close to closing
    if (this.points.length >= 2 && this.currentPoint) {
      const firstPoint = this.points[0].anchor;
      if (this.distance(this.currentPoint, firstPoint) < 10) {
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(firstPoint.x, firstPoint.y, 8, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // ============================================================================
  // Path Operations
  // ============================================================================

  private finishPath(): void {
    if (this.points.length < 2) {
      this.cancelPath();
      return;
    }

    this.createPathElement(false);
    this.points = [];
    this.currentPoint = null;
  }

  private closePath(): void {
    if (this.points.length < 2) {
      this.cancelPath();
      return;
    }

    this.createPathElement(true);
    this.points = [];
    this.currentPoint = null;
  }

  private cancelPath(): void {
    this.points = [];
    this.currentPoint = null;
    this.isDragging = false;
    this.dragStartPoint = null;
  }

  private removeLastPoint(): void {
    if (this.points.length > 0) {
      this.points.pop();
    }
  }

  private createPathElement(closed: boolean): void {
    if (!this.ctx) return;

    const commands = this.pointsToCommands(this.points, closed);

    const element: PathElement = {
      id: generateId(),
      type: 'path',
      name: 'Path',
      visible: true,
      locked: false,
      opacity: 1,
      transform: createTransform(),
      fill: closed ? createColor(200, 200, 200, 0.5) : null,
      stroke: createStroke(createColor(0, 0, 0, 1)),
      commands,
      closed,
    };

    this.ctx.addElement(element);
    this.ctx.setSelection([element.id]);
    this.ctx.commitToHistory('create path');
  }

  private pointsToCommands(points: PenPoint[], closed: boolean): PathCommand[] {
    if (points.length === 0) return [];

    const commands: PathCommand[] = [];

    // Start with moveTo
    commands.push({
      type: 'M',
      x: points[0].anchor.x,
      y: points[0].anchor.y,
    });

    // Add segments
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];

      if (prev.handleOut && curr.handleIn) {
        // Cubic bezier
        commands.push({
          type: 'C',
          x1: prev.handleOut.x,
          y1: prev.handleOut.y,
          x2: curr.handleIn.x,
          y2: curr.handleIn.y,
          x: curr.anchor.x,
          y: curr.anchor.y,
        });
      } else if (prev.handleOut) {
        // Quadratic with handleOut
        commands.push({
          type: 'Q',
          x1: prev.handleOut.x,
          y1: prev.handleOut.y,
          x: curr.anchor.x,
          y: curr.anchor.y,
        });
      } else if (curr.handleIn) {
        // Quadratic with handleIn
        commands.push({
          type: 'Q',
          x1: curr.handleIn.x,
          y1: curr.handleIn.y,
          x: curr.anchor.x,
          y: curr.anchor.y,
        });
      } else {
        // Straight line
        commands.push({
          type: 'L',
          x: curr.anchor.x,
          y: curr.anchor.y,
        });
      }
    }

    // Close if needed
    if (closed) {
      const last = points[points.length - 1];
      const first = points[0];

      if (last.handleOut || first.handleIn) {
        if (last.handleOut && first.handleIn) {
          commands.push({
            type: 'C',
            x1: last.handleOut.x,
            y1: last.handleOut.y,
            x2: first.handleIn.x,
            y2: first.handleIn.y,
            x: first.anchor.x,
            y: first.anchor.y,
          });
        } else if (last.handleOut) {
          commands.push({
            type: 'Q',
            x1: last.handleOut.x,
            y1: last.handleOut.y,
            x: first.anchor.x,
            y: first.anchor.y,
          });
        } else if (first.handleIn) {
          commands.push({
            type: 'Q',
            x1: first.handleIn.x,
            y1: first.handleIn.y,
            x: first.anchor.x,
            y: first.anchor.y,
          });
        }
      }

      commands.push({ type: 'Z' });
    }

    return commands;
  }
}
