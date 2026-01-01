/**
 * ScissorsTool - Cut paths at anchor points or segments
 *
 * Click on a path to split it at that location.
 * Works on anchor points or anywhere along a segment.
 */

import { BaseTool, ToolEvent } from './BaseTool';
import type { Point, PathElement, ToolType, VectorElement } from '../types';
import { getElementBounds } from '../engine/VectorRenderer';
import { splitPathAtParameter, splitPathAtPoint, commandsToAnchorPoints } from '../engine/PathManipulation';

export class ScissorsTool extends BaseTool {
  readonly id: ToolType = 'select'; // Will be updated when we extend ToolType
  readonly name = 'Scissors Tool';
  readonly shortcut = 'C';
  readonly cursor = 'crosshair';

  private hoveredElement: PathElement | null = null;
  private hoveredSegment: number = -1;
  private hoveredParameter: number = 0;
  private hoveredAnchor: number = -1;
  private tolerance = 8;

  onPointerMove(e: ToolEvent): void {
    if (!this.ctx) return;

    const point = e.canvasPoint;
    this.findHoveredPath(point);
  }

  onPointerDown(e: ToolEvent): void {
    if (!this.ctx) return;

    const point = e.canvasPoint;
    this.findHoveredPath(point);

    if (this.hoveredElement) {
      this.cutPath();
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.hoveredElement) return;

    const { state } = this.ctx!;
    const { zoom } = state.view;

    // Draw highlight on hovered element
    ctx.save();

    if (this.hoveredAnchor >= 0) {
      // Highlight anchor point
      const points = commandsToAnchorPoints(this.hoveredElement.commands);
      if (this.hoveredAnchor < points.length) {
        const anchor = points[this.hoveredAnchor].anchor;
        ctx.strokeStyle = '#ff6600';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(anchor.x, anchor.y, 8, 0, Math.PI * 2);
        ctx.stroke();

        // Scissors icon indicator
        ctx.fillStyle = '#ff6600';
        ctx.beginPath();
        ctx.moveTo(anchor.x - 6, anchor.y - 2);
        ctx.lineTo(anchor.x + 6, anchor.y - 2);
        ctx.moveTo(anchor.x - 6, anchor.y + 2);
        ctx.lineTo(anchor.x + 6, anchor.y + 2);
        ctx.stroke();
      }
    } else if (this.hoveredSegment >= 0) {
      // Highlight segment split point
      const splitPoint = this.getSegmentPoint();
      if (splitPoint) {
        ctx.strokeStyle = '#ff6600';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(splitPoint.x, splitPoint.y, 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 102, 0, 0.3)';
        ctx.fill();

        // Cut line indicator
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(splitPoint.x - 10, splitPoint.y - 10);
        ctx.lineTo(splitPoint.x + 10, splitPoint.y + 10);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    ctx.restore();
  }

  private findHoveredPath(point: Point): void {
    if (!this.ctx) return;

    const { state } = this.ctx;
    this.hoveredElement = null;
    this.hoveredSegment = -1;
    this.hoveredAnchor = -1;

    // Search all path elements
    for (const layer of state.document.layers) {
      if (!layer.visible || layer.locked) continue;

      for (const element of layer.elements) {
        if (!element.visible || element.locked) continue;
        if (element.type !== 'path') continue;

        const pathElement = element as PathElement;
        const points = commandsToAnchorPoints(pathElement.commands);

        // Check anchor points first
        for (let i = 0; i < points.length; i++) {
          const anchor = points[i].anchor;
          if (this.distance(point, anchor) < this.tolerance) {
            this.hoveredElement = pathElement;
            this.hoveredAnchor = i;
            return;
          }
        }

        // Check segments
        for (let i = 0; i < points.length - 1; i++) {
          const result = this.pointOnSegment(point, points[i], points[i + 1]);
          if (result && result.distance < this.tolerance) {
            this.hoveredElement = pathElement;
            this.hoveredSegment = i;
            this.hoveredParameter = result.t;
            return;
          }
        }

        // Check closing segment if closed path
        if (pathElement.closed && points.length > 1) {
          const result = this.pointOnSegment(point, points[points.length - 1], points[0]);
          if (result && result.distance < this.tolerance) {
            this.hoveredElement = pathElement;
            this.hoveredSegment = points.length - 1;
            this.hoveredParameter = result.t;
            return;
          }
        }
      }
    }
  }

  private pointOnSegment(
    point: Point,
    start: { anchor: Point; handleOut?: Point | null },
    end: { anchor: Point; handleIn?: Point | null }
  ): { distance: number; t: number } | null {
    // For now, approximate with line segment
    // TODO: Handle bezier curves properly
    const p1 = start.anchor;
    const p2 = end.anchor;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq === 0) {
      return { distance: this.distance(point, p1), t: 0.5 };
    }

    let t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));

    const nearestX = p1.x + t * dx;
    const nearestY = p1.y + t * dy;
    const distance = Math.sqrt((point.x - nearestX) ** 2 + (point.y - nearestY) ** 2);

    return { distance, t };
  }

  private getSegmentPoint(): Point | null {
    if (!this.hoveredElement || this.hoveredSegment < 0) return null;

    const points = commandsToAnchorPoints(this.hoveredElement.commands);
    const segmentCount = this.hoveredElement.closed ? points.length : points.length - 1;

    if (this.hoveredSegment >= segmentCount) return null;

    const start = points[this.hoveredSegment];
    const endIndex = (this.hoveredSegment + 1) % points.length;
    const end = points[endIndex];

    // Linear interpolation for now
    // TODO: Handle bezier curves properly
    return {
      x: start.anchor.x + (end.anchor.x - start.anchor.x) * this.hoveredParameter,
      y: start.anchor.y + (end.anchor.y - start.anchor.y) * this.hoveredParameter,
    };
  }

  private cutPath(): void {
    if (!this.ctx || !this.hoveredElement) return;

    let result: [PathElement, PathElement] | null = null;

    if (this.hoveredAnchor >= 0) {
      // Cut at anchor point
      result = splitPathAtPoint(this.hoveredElement, this.hoveredAnchor);
    } else if (this.hoveredSegment >= 0) {
      // Cut at segment
      result = splitPathAtParameter(this.hoveredElement, this.hoveredSegment, this.hoveredParameter);
    }

    if (result) {
      const [part1, part2] = result;

      // Remove original element
      this.ctx.removeElement(this.hoveredElement.id);

      // Add split parts
      this.ctx.addElement(part1);
      this.ctx.addElement(part2);

      // Select the new parts
      this.ctx.setSelection([part1.id, part2.id]);
      this.ctx.commitToHistory('Scissors cut');
    }

    this.hoveredElement = null;
    this.hoveredSegment = -1;
    this.hoveredAnchor = -1;
  }
}
