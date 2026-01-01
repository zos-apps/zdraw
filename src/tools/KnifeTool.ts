/**
 * KnifeTool - Slice through paths with freehand cutting
 *
 * Draw a line through one or more paths to cut them.
 * Unlike scissors, knife cuts through entire shapes.
 */

import { BaseTool, ToolEvent } from './BaseTool';
import type { Point, PathElement, ToolType, VectorElement, PathCommand } from '../types';
import { generateId, createTransform } from '../types';
import {
  commandsToAnchorPoints,
  anchorPointsToCommands,
} from '../engine/PathManipulation';

interface CutPoint {
  element: PathElement;
  segmentIndex: number;
  t: number;
  point: Point;
}

export class KnifeTool extends BaseTool {
  readonly id: ToolType = 'select'; // Will be updated when we extend ToolType
  readonly name = 'Knife Tool';
  readonly shortcut = 'K';
  readonly cursor = 'crosshair';

  private isDrawing = false;
  private cutPath: Point[] = [];

  onPointerDown(e: ToolEvent): void {
    this.isDrawing = true;
    this.cutPath = [e.canvasPoint];
  }

  onPointerMove(e: ToolEvent): void {
    if (!this.isDrawing) return;

    const point = e.canvasPoint;
    const last = this.cutPath[this.cutPath.length - 1];

    // Only add point if moved enough
    if (this.distance(point, last) > 3) {
      this.cutPath.push(point);
    }
  }

  onPointerUp(e: ToolEvent): void {
    if (!this.isDrawing || this.cutPath.length < 2) {
      this.isDrawing = false;
      this.cutPath = [];
      return;
    }

    this.performCut();
    this.isDrawing = false;
    this.cutPath = [];
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.isDrawing || this.cutPath.length < 2) return;

    ctx.save();

    // Draw the knife line
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(this.cutPath[0].x, this.cutPath[0].y);

    for (let i = 1; i < this.cutPath.length; i++) {
      ctx.lineTo(this.cutPath[i].x, this.cutPath[i].y);
    }

    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  }

  private performCut(): void {
    if (!this.ctx) return;

    const { state } = this.ctx;
    const cuts: CutPoint[] = [];

    // Find all intersections with path elements
    for (const layer of state.document.layers) {
      if (!layer.visible || layer.locked) continue;

      for (const element of layer.elements) {
        if (!element.visible || element.locked) continue;
        if (element.type !== 'path') continue;

        const pathElement = element as PathElement;
        const elementCuts = this.findCutsForElement(pathElement);
        cuts.push(...elementCuts);
      }
    }

    if (cuts.length === 0) return;

    // Group cuts by element
    const cutsByElement = new Map<string, CutPoint[]>();
    for (const cut of cuts) {
      if (!cutsByElement.has(cut.element.id)) {
        cutsByElement.set(cut.element.id, []);
      }
      cutsByElement.get(cut.element.id)!.push(cut);
    }

    // Process each element
    for (const [elementId, elementCuts] of cutsByElement) {
      this.cutElement(elementCuts);
    }

    this.ctx.commitToHistory('Knife cut');
  }

  private findCutsForElement(element: PathElement): CutPoint[] {
    const cuts: CutPoint[] = [];
    const points = commandsToAnchorPoints(element.commands);

    // Check each cut line segment against each path segment
    for (let i = 0; i < this.cutPath.length - 1; i++) {
      const cutStart = this.cutPath[i];
      const cutEnd = this.cutPath[i + 1];

      const segmentCount = element.closed ? points.length : points.length - 1;

      for (let j = 0; j < segmentCount; j++) {
        const pathStart = points[j].anchor;
        const pathEnd = points[(j + 1) % points.length].anchor;

        const intersection = this.lineIntersection(cutStart, cutEnd, pathStart, pathEnd);

        if (intersection) {
          cuts.push({
            element,
            segmentIndex: j,
            t: intersection.t2, // t on the path segment
            point: intersection.point,
          });
        }
      }
    }

    // Sort cuts by segment index and t
    cuts.sort((a, b) => {
      if (a.segmentIndex !== b.segmentIndex) {
        return a.segmentIndex - b.segmentIndex;
      }
      return a.t - b.t;
    });

    return cuts;
  }

  private lineIntersection(
    p1: Point,
    p2: Point,
    p3: Point,
    p4: Point
  ): { point: Point; t1: number; t2: number } | null {
    const d1x = p2.x - p1.x;
    const d1y = p2.y - p1.y;
    const d2x = p4.x - p3.x;
    const d2y = p4.y - p3.y;

    const cross = d1x * d2y - d1y * d2x;

    if (Math.abs(cross) < 1e-10) {
      return null; // Parallel
    }

    const dx = p3.x - p1.x;
    const dy = p3.y - p1.y;

    const t1 = (dx * d2y - dy * d2x) / cross;
    const t2 = (dx * d1y - dy * d1x) / cross;

    if (t1 >= 0 && t1 <= 1 && t2 >= 0 && t2 <= 1) {
      return {
        point: {
          x: p1.x + t1 * d1x,
          y: p1.y + t1 * d1y,
        },
        t1,
        t2,
      };
    }

    return null;
  }

  private cutElement(cuts: CutPoint[]): void {
    if (!this.ctx || cuts.length === 0) return;

    const element = cuts[0].element;

    if (!element.closed && cuts.length >= 2) {
      // Open path: split into multiple parts
      this.splitOpenPath(element, cuts);
    } else if (element.closed && cuts.length >= 2) {
      // Closed path: need at least 2 cuts to split into parts
      this.splitClosedPath(element, cuts);
    }
  }

  private splitOpenPath(element: PathElement, cuts: CutPoint[]): void {
    if (!this.ctx) return;

    const points = commandsToAnchorPoints(element.commands);
    const newPaths: PathElement[] = [];

    // Add cut points as new anchor points
    const allPoints = [...points];
    let insertOffset = 0;

    for (const cut of cuts) {
      const insertIndex = cut.segmentIndex + 1 + insertOffset;

      // Create new anchor point at cut
      const newPoint = {
        anchor: cut.point,
        handleIn: null,
        handleOut: null,
        type: 'corner' as const,
      };

      allPoints.splice(insertIndex, 0, newPoint);
      insertOffset++;
    }

    // Now split at the cut points
    const cutIndices = cuts.map((c, i) => c.segmentIndex + 1 + i);
    let lastIndex = 0;

    for (const cutIndex of cutIndices) {
      if (cutIndex > lastIndex) {
        const partPoints = allPoints.slice(lastIndex, cutIndex + 1);
        newPaths.push(this.createPathFromPoints(element, partPoints, `${element.name} (Part ${newPaths.length + 1})`));
      }
      lastIndex = cutIndex;
    }

    // Add final segment
    if (lastIndex < allPoints.length - 1) {
      const partPoints = allPoints.slice(lastIndex);
      newPaths.push(this.createPathFromPoints(element, partPoints, `${element.name} (Part ${newPaths.length + 1})`));
    }

    // Remove original and add new paths
    if (newPaths.length > 0) {
      this.ctx.removeElement(element.id);
      for (const path of newPaths) {
        this.ctx.addElement(path);
      }
      this.ctx.setSelection(newPaths.map((p) => p.id));
    }
  }

  private splitClosedPath(element: PathElement, cuts: CutPoint[]): void {
    if (!this.ctx || cuts.length < 2) return;

    // For a closed path, we need to create two new closed paths
    // This is a simplified version - proper implementation would handle multiple cuts
    const points = commandsToAnchorPoints(element.commands);

    // Take first two cuts
    const cut1 = cuts[0];
    const cut2 = cuts[1];

    if (cut1.segmentIndex === cut2.segmentIndex) return;

    // Create two paths by walking from cut1 to cut2 and back
    const path1Points = [];
    const path2Points = [];

    // Add first cut point to both paths
    const cut1Point = { anchor: cut1.point, handleIn: null, handleOut: null, type: 'corner' as const };
    const cut2Point = { anchor: cut2.point, handleIn: null, handleOut: null, type: 'corner' as const };

    // Walk from cut1 to cut2
    path1Points.push(cut1Point);
    for (let i = cut1.segmentIndex + 1; i <= cut2.segmentIndex; i++) {
      path1Points.push(points[i]);
    }
    path1Points.push(cut2Point);

    // Walk from cut2 back to cut1
    path2Points.push(cut2Point);
    for (let i = cut2.segmentIndex + 1; i < points.length; i++) {
      path2Points.push(points[i]);
    }
    for (let i = 0; i <= cut1.segmentIndex; i++) {
      path2Points.push(points[i]);
    }
    path2Points.push(cut1Point);

    const newPath1 = this.createPathFromPoints(element, path1Points, `${element.name} (Part 1)`, true);
    const newPath2 = this.createPathFromPoints(element, path2Points, `${element.name} (Part 2)`, true);

    this.ctx.removeElement(element.id);
    this.ctx.addElement(newPath1);
    this.ctx.addElement(newPath2);
    this.ctx.setSelection([newPath1.id, newPath2.id]);
  }

  private createPathFromPoints(
    original: PathElement,
    points: Array<{ anchor: Point; handleIn: Point | null; handleOut: Point | null; type: 'corner' | 'smooth' | 'symmetric' }>,
    name: string,
    closed: boolean = false
  ): PathElement {
    return {
      id: generateId(),
      type: 'path',
      name,
      visible: true,
      locked: false,
      opacity: original.opacity,
      transform: { ...original.transform },
      fill: original.fill,
      stroke: original.stroke,
      commands: anchorPointsToCommands(points, closed),
      closed,
    };
  }
}
