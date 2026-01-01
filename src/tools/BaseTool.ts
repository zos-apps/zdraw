/**
 * BaseTool - Abstract base class for drawing tools
 *
 * Provides a consistent interface for all tools in the editor.
 */

import type { Point, VectorElement, EditorState, ToolType } from '../types';

export interface ToolEvent {
  point: Point;
  canvasPoint: Point; // Transformed to document coordinates
  event: PointerEvent | KeyboardEvent;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

export interface ToolContext {
  state: EditorState;
  updateState: (updates: Partial<EditorState>) => void;
  updateElement: (id: string, updates: Partial<VectorElement>) => void;
  addElement: (element: VectorElement, layerId?: string) => void;
  removeElement: (id: string) => void;
  setSelection: (elementIds: string[]) => void;
  commitToHistory: (description: string) => void;
  canvasToDocument: (point: Point) => Point;
  documentToCanvas: (point: Point) => Point;
}

export abstract class BaseTool {
  abstract readonly id: ToolType;
  abstract readonly name: string;
  abstract readonly shortcut: string;
  abstract readonly cursor: string;

  protected ctx: ToolContext | null = null;
  protected isActive = false;
  protected startPoint: Point | null = null;

  setContext(ctx: ToolContext): void {
    this.ctx = ctx;
  }

  activate(): void {
    this.isActive = true;
    this.onActivate();
  }

  deactivate(): void {
    this.isActive = false;
    this.onDeactivate();
  }

  // Lifecycle hooks
  protected onActivate(): void {}
  protected onDeactivate(): void {}

  // Event handlers - override in subclasses
  onPointerDown(e: ToolEvent): void {}
  onPointerMove(e: ToolEvent): void {}
  onPointerUp(e: ToolEvent): void {}
  onDoubleClick(e: ToolEvent): void {}
  onKeyDown(e: ToolEvent): void {}
  onKeyUp(e: ToolEvent): void {}

  // Render tool-specific overlays (e.g., in-progress shapes)
  render(ctx: CanvasRenderingContext2D): void {}

  // Utility methods
  protected distance(p1: Point, p2: Point): number {
    return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  }

  protected midpoint(p1: Point, p2: Point): Point {
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
    };
  }

  protected snapToGrid(point: Point, gridSize: number): Point {
    return {
      x: Math.round(point.x / gridSize) * gridSize,
      y: Math.round(point.y / gridSize) * gridSize,
    };
  }

  protected constrainToSquare(start: Point, end: Point): Point {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const size = Math.max(Math.abs(dx), Math.abs(dy));
    return {
      x: start.x + size * Math.sign(dx),
      y: start.y + size * Math.sign(dy),
    };
  }

  protected constrainTo45(start: Point, end: Point): Point {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const angle = Math.atan2(dy, dx);
    const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
    const dist = Math.sqrt(dx * dx + dy * dy);
    return {
      x: start.x + Math.cos(snappedAngle) * dist,
      y: start.y + Math.sin(snappedAngle) * dist,
    };
  }
}
