/**
 * HandTool - Canvas panning
 */

import { BaseTool, ToolEvent } from './BaseTool';
import type { Point, ToolType } from '../types';

export class HandTool extends BaseTool {
  readonly id: ToolType = 'hand';
  readonly name = 'Hand Tool';
  readonly shortcut = 'H';
  readonly cursor = 'grab';

  private startPoint: Point | null = null;
  private startPan: { x: number; y: number } | null = null;
  private isDragging = false;

  onPointerDown(e: ToolEvent): void {
    if (!this.ctx) return;

    this.startPoint = e.point;
    this.startPan = {
      x: this.ctx.state.view.panX,
      y: this.ctx.state.view.panY,
    };
    this.isDragging = true;
  }

  onPointerMove(e: ToolEvent): void {
    if (!this.ctx || !this.isDragging || !this.startPoint || !this.startPan) return;

    const dx = e.point.x - this.startPoint.x;
    const dy = e.point.y - this.startPoint.y;

    this.ctx.updateState({
      view: {
        ...this.ctx.state.view,
        panX: this.startPan.x + dx,
        panY: this.startPan.y + dy,
      },
    });
  }

  onPointerUp(e: ToolEvent): void {
    this.isDragging = false;
    this.startPoint = null;
    this.startPan = null;
  }
}

/**
 * ZoomTool - Canvas zoom control
 */
export class ZoomTool extends BaseTool {
  readonly id: ToolType = 'zoom';
  readonly name = 'Zoom Tool';
  readonly shortcut = 'Z';
  readonly cursor = 'zoom-in';

  onPointerDown(e: ToolEvent): void {
    if (!this.ctx) return;

    const { view } = this.ctx.state;
    const zoomFactor = e.altKey ? 0.5 : 2;
    const newZoom = Math.max(0.1, Math.min(32, view.zoom * zoomFactor));

    // Zoom toward click point
    const point = e.canvasPoint;
    const scale = newZoom / view.zoom;

    this.ctx.updateState({
      view: {
        ...view,
        zoom: newZoom,
        panX: point.x - (point.x - view.panX) * scale,
        panY: point.y - (point.y - view.panY) * scale,
      },
    });
  }
}
