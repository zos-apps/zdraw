/**
 * DirectSelectTool - Anchor point and handle manipulation
 *
 * Allows direct editing of path anchor points and bezier handles:
 * - Click anchor point to select
 * - Drag anchor point to move
 * - Drag handles to adjust curves
 * - Shift+click to add/remove from selection
 * - Alt+drag to break handle symmetry
 * - Double-click anchor to toggle smooth/corner
 */

import { BaseTool, ToolEvent } from './BaseTool';
import type { Point, PathElement, PathCommand, ToolType, VectorElement } from '../types';
import { getElementBounds } from '../engine/VectorRenderer';
import {
  commandsToAnchorPoints,
  anchorPointsToCommands,
  convertToSmooth,
  convertToCorner,
} from '../engine/PathManipulation';

type HandleType = 'anchor' | 'handleIn' | 'handleOut';

interface SelectedHandle {
  elementId: string;
  pointIndex: number;
  handleType: HandleType;
}

interface DragState {
  handle: SelectedHandle;
  startPoint: Point;
  originalAnchor: Point;
  originalHandleIn: Point | null;
  originalHandleOut: Point | null;
}

export class DirectSelectTool extends BaseTool {
  readonly id: ToolType = 'direct-select';
  readonly name = 'Direct Selection Tool';
  readonly shortcut = 'A';
  readonly cursor = 'default';

  private selectedHandles: SelectedHandle[] = [];
  private dragState: DragState | null = null;
  private hoveredHandle: SelectedHandle | null = null;
  private tolerance = 8;

  onPointerDown(e: ToolEvent): void {
    if (!this.ctx) return;

    const point = e.canvasPoint;
    const hit = this.hitTestHandles(point);

    if (hit) {
      if (e.shiftKey) {
        // Toggle selection
        const existingIndex = this.selectedHandles.findIndex(
          (h) => h.elementId === hit.elementId && h.pointIndex === hit.pointIndex && h.handleType === hit.handleType
        );

        if (existingIndex >= 0) {
          this.selectedHandles.splice(existingIndex, 1);
        } else {
          this.selectedHandles.push(hit);
        }
      } else {
        // Check if clicking on already selected handle
        const isSelected = this.selectedHandles.some(
          (h) => h.elementId === hit.elementId && h.pointIndex === hit.pointIndex && h.handleType === hit.handleType
        );

        if (!isSelected) {
          this.selectedHandles = [hit];
        }

        // Start dragging
        this.startDrag(hit, point);
      }
    } else {
      // Clicked on nothing - clear selection
      if (!e.shiftKey) {
        this.selectedHandles = [];
        this.ctx.setSelection([]);
      }
    }
  }

  onPointerMove(e: ToolEvent): void {
    if (!this.ctx) return;

    const point = e.canvasPoint;

    if (this.dragState) {
      this.handleDrag(point, e.altKey, e.shiftKey);
    } else {
      // Update hover state
      this.hoveredHandle = this.hitTestHandles(point);
    }
  }

  onPointerUp(e: ToolEvent): void {
    if (this.dragState) {
      this.ctx?.commitToHistory('Move anchor/handle');
      this.dragState = null;
    }
  }

  onDoubleClick(e: ToolEvent): void {
    if (!this.ctx) return;

    const point = e.canvasPoint;
    const hit = this.hitTestHandles(point);

    if (hit && hit.handleType === 'anchor') {
      this.toggleAnchorType(hit);
    }
  }

  onKeyDown(e: ToolEvent): void {
    if (!this.ctx) return;

    const event = e.event as KeyboardEvent;

    switch (event.key) {
      case 'Delete':
      case 'Backspace':
        this.deleteSelectedAnchors();
        break;
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight':
        this.nudgeSelectedAnchors(event.key, e.shiftKey);
        break;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.ctx) return;

    const { state } = this.ctx;

    // Find all path elements with selection or hover
    const pathElements: PathElement[] = [];
    for (const layer of state.document.layers) {
      if (!layer.visible) continue;
      for (const element of layer.elements) {
        if (!element.visible) continue;
        if (element.type === 'path') {
          pathElements.push(element);
        }
      }
    }

    ctx.save();

    // Draw all anchor points and handles for selected elements
    for (const element of pathElements) {
      const isSelected = state.selection.elementIds.includes(element.id);
      const hasSelectedHandles = this.selectedHandles.some((h) => h.elementId === element.id);

      if (isSelected || hasSelectedHandles) {
        this.renderPathHandles(ctx, element);
      }
    }

    // Highlight hovered handle
    if (this.hoveredHandle) {
      this.renderHoveredHandle(ctx, this.hoveredHandle);
    }

    ctx.restore();
  }

  private renderPathHandles(ctx: CanvasRenderingContext2D, element: PathElement): void {
    const points = commandsToAnchorPoints(element.commands);

    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      const isAnchorSelected = this.selectedHandles.some(
        (h) => h.elementId === element.id && h.pointIndex === i && h.handleType === 'anchor'
      );

      // Draw handle lines and control points
      if (point.handleIn) {
        ctx.strokeStyle = 'rgba(0, 102, 255, 0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(point.anchor.x, point.anchor.y);
        ctx.lineTo(point.handleIn.x, point.handleIn.y);
        ctx.stroke();

        const isHandleSelected = this.selectedHandles.some(
          (h) => h.elementId === element.id && h.pointIndex === i && h.handleType === 'handleIn'
        );
        this.drawControlPoint(ctx, point.handleIn, isHandleSelected);
      }

      if (point.handleOut) {
        ctx.strokeStyle = 'rgba(0, 102, 255, 0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(point.anchor.x, point.anchor.y);
        ctx.lineTo(point.handleOut.x, point.handleOut.y);
        ctx.stroke();

        const isHandleSelected = this.selectedHandles.some(
          (h) => h.elementId === element.id && h.pointIndex === i && h.handleType === 'handleOut'
        );
        this.drawControlPoint(ctx, point.handleOut, isHandleSelected);
      }

      // Draw anchor point
      this.drawAnchorPoint(ctx, point.anchor, isAnchorSelected, point.type);
    }
  }

  private drawAnchorPoint(ctx: CanvasRenderingContext2D, point: Point, selected: boolean, type: string): void {
    const size = 6;
    const half = size / 2;

    ctx.fillStyle = selected ? '#0066ff' : '#ffffff';
    ctx.strokeStyle = '#0066ff';
    ctx.lineWidth = 1.5;

    if (type === 'corner') {
      // Square for corner points
      ctx.fillRect(point.x - half, point.y - half, size, size);
      ctx.strokeRect(point.x - half, point.y - half, size, size);
    } else {
      // Circle for smooth points
      ctx.beginPath();
      ctx.arc(point.x, point.y, half, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  private drawControlPoint(ctx: CanvasRenderingContext2D, point: Point, selected: boolean): void {
    ctx.fillStyle = selected ? '#0066ff' : '#ffffff';
    ctx.strokeStyle = '#0066ff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  private renderHoveredHandle(ctx: CanvasRenderingContext2D, handle: SelectedHandle): void {
    const element = this.findElement(handle.elementId) as PathElement;
    if (!element) return;

    const points = commandsToAnchorPoints(element.commands);
    if (handle.pointIndex >= points.length) return;

    const point = points[handle.pointIndex];
    let position: Point;

    switch (handle.handleType) {
      case 'anchor':
        position = point.anchor;
        break;
      case 'handleIn':
        position = point.handleIn || point.anchor;
        break;
      case 'handleOut':
        position = point.handleOut || point.anchor;
        break;
    }

    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(position.x, position.y, 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  private hitTestHandles(point: Point): SelectedHandle | null {
    if (!this.ctx) return null;

    const { state } = this.ctx;

    // Test selected elements first, then all visible path elements
    const elementsToTest: PathElement[] = [];

    for (const layer of state.document.layers) {
      if (!layer.visible || layer.locked) continue;

      for (const element of layer.elements) {
        if (!element.visible || element.locked) continue;
        if (element.type !== 'path') continue;

        elementsToTest.push(element);
      }
    }

    // Prioritize already selected elements
    elementsToTest.sort((a, b) => {
      const aSelected = state.selection.elementIds.includes(a.id) ? 0 : 1;
      const bSelected = state.selection.elementIds.includes(b.id) ? 0 : 1;
      return aSelected - bSelected;
    });

    for (const element of elementsToTest) {
      const points = commandsToAnchorPoints(element.commands);

      // Test handles first (they should take priority when overlapping)
      for (let i = 0; i < points.length; i++) {
        const p = points[i];

        if (p.handleIn && this.distance(point, p.handleIn) < this.tolerance) {
          return { elementId: element.id, pointIndex: i, handleType: 'handleIn' };
        }

        if (p.handleOut && this.distance(point, p.handleOut) < this.tolerance) {
          return { elementId: element.id, pointIndex: i, handleType: 'handleOut' };
        }
      }

      // Then test anchor points
      for (let i = 0; i < points.length; i++) {
        const p = points[i];

        if (this.distance(point, p.anchor) < this.tolerance) {
          return { elementId: element.id, pointIndex: i, handleType: 'anchor' };
        }
      }
    }

    return null;
  }

  private startDrag(handle: SelectedHandle, startPoint: Point): void {
    const element = this.findElement(handle.elementId) as PathElement;
    if (!element) return;

    const points = commandsToAnchorPoints(element.commands);
    if (handle.pointIndex >= points.length) return;

    const point = points[handle.pointIndex];

    this.dragState = {
      handle,
      startPoint,
      originalAnchor: { ...point.anchor },
      originalHandleIn: point.handleIn ? { ...point.handleIn } : null,
      originalHandleOut: point.handleOut ? { ...point.handleOut } : null,
    };
  }

  private handleDrag(currentPoint: Point, breakSymmetry: boolean, constrain: boolean): void {
    if (!this.ctx || !this.dragState) return;

    const { handle, startPoint, originalAnchor, originalHandleIn, originalHandleOut } = this.dragState;

    const dx = currentPoint.x - startPoint.x;
    const dy = currentPoint.y - startPoint.y;

    const element = this.findElement(handle.elementId) as PathElement;
    if (!element) return;

    const points = commandsToAnchorPoints(element.commands);
    if (handle.pointIndex >= points.length) return;

    const point = points[handle.pointIndex];

    switch (handle.handleType) {
      case 'anchor':
        // Move anchor and handles together
        point.anchor = { x: originalAnchor.x + dx, y: originalAnchor.y + dy };
        if (originalHandleIn) {
          point.handleIn = { x: originalHandleIn.x + dx, y: originalHandleIn.y + dy };
        }
        if (originalHandleOut) {
          point.handleOut = { x: originalHandleOut.x + dx, y: originalHandleOut.y + dy };
        }
        break;

      case 'handleIn':
        if (originalHandleIn) {
          point.handleIn = { x: originalHandleIn.x + dx, y: originalHandleIn.y + dy };

          // Mirror the opposite handle unless Alt is pressed
          if (!breakSymmetry && point.handleOut && point.type === 'smooth') {
            const anchorToHandle = {
              x: point.handleIn.x - point.anchor.x,
              y: point.handleIn.y - point.anchor.y,
            };
            const handleOutDist = originalHandleOut
              ? this.distance(originalHandleOut, originalAnchor)
              : this.distance(point.handleIn, point.anchor);
            const handleInDist = this.distance(point.handleIn, point.anchor);
            const scale = handleOutDist / (handleInDist || 1);

            point.handleOut = {
              x: point.anchor.x - anchorToHandle.x * scale,
              y: point.anchor.y - anchorToHandle.y * scale,
            };
          }
        }
        break;

      case 'handleOut':
        if (originalHandleOut) {
          point.handleOut = { x: originalHandleOut.x + dx, y: originalHandleOut.y + dy };

          // Mirror the opposite handle unless Alt is pressed
          if (!breakSymmetry && point.handleIn && point.type === 'smooth') {
            const anchorToHandle = {
              x: point.handleOut.x - point.anchor.x,
              y: point.handleOut.y - point.anchor.y,
            };
            const handleInDist = originalHandleIn
              ? this.distance(originalHandleIn, originalAnchor)
              : this.distance(point.handleOut, point.anchor);
            const handleOutDist = this.distance(point.handleOut, point.anchor);
            const scale = handleInDist / (handleOutDist || 1);

            point.handleIn = {
              x: point.anchor.x - anchorToHandle.x * scale,
              y: point.anchor.y - anchorToHandle.y * scale,
            };
          }
        }
        break;
    }

    // Update the element
    this.ctx.updateElement(handle.elementId, {
      commands: anchorPointsToCommands(points, element.closed),
    } as Partial<VectorElement>);
  }

  private toggleAnchorType(handle: SelectedHandle): void {
    if (!this.ctx) return;

    const element = this.findElement(handle.elementId) as PathElement;
    if (!element) return;

    const points = commandsToAnchorPoints(element.commands);
    if (handle.pointIndex >= points.length) return;

    const point = points[handle.pointIndex];

    if (point.type === 'corner') {
      // Convert to smooth
      const updated = convertToSmooth(element, handle.pointIndex);
      this.ctx.updateElement(handle.elementId, {
        commands: updated.commands,
      } as Partial<VectorElement>);
    } else {
      // Convert to corner
      const updated = convertToCorner(element, handle.pointIndex);
      this.ctx.updateElement(handle.elementId, {
        commands: updated.commands,
      } as Partial<VectorElement>);
    }

    this.ctx.commitToHistory('Convert anchor point');
  }

  private deleteSelectedAnchors(): void {
    if (!this.ctx || this.selectedHandles.length === 0) return;

    // Group by element
    const byElement = new Map<string, number[]>();
    for (const handle of this.selectedHandles) {
      if (handle.handleType !== 'anchor') continue;

      if (!byElement.has(handle.elementId)) {
        byElement.set(handle.elementId, []);
      }
      byElement.get(handle.elementId)!.push(handle.pointIndex);
    }

    for (const [elementId, indices] of byElement) {
      const element = this.findElement(elementId) as PathElement;
      if (!element) continue;

      const points = commandsToAnchorPoints(element.commands);

      // Sort indices in descending order to avoid index shifting issues
      indices.sort((a, b) => b - a);

      for (const index of indices) {
        if (points.length > 2) {
          points.splice(index, 1);
        }
      }

      this.ctx.updateElement(elementId, {
        commands: anchorPointsToCommands(points, element.closed),
      } as Partial<VectorElement>);
    }

    this.selectedHandles = [];
    this.ctx.commitToHistory('Delete anchor points');
  }

  private nudgeSelectedAnchors(key: string, shift: boolean): void {
    if (!this.ctx || this.selectedHandles.length === 0) return;

    const amount = shift ? 10 : 1;
    let dx = 0;
    let dy = 0;

    switch (key) {
      case 'ArrowUp':
        dy = -amount;
        break;
      case 'ArrowDown':
        dy = amount;
        break;
      case 'ArrowLeft':
        dx = -amount;
        break;
      case 'ArrowRight':
        dx = amount;
        break;
    }

    // Group by element
    const byElement = new Map<string, SelectedHandle[]>();
    for (const handle of this.selectedHandles) {
      if (!byElement.has(handle.elementId)) {
        byElement.set(handle.elementId, []);
      }
      byElement.get(handle.elementId)!.push(handle);
    }

    for (const [elementId, handles] of byElement) {
      const element = this.findElement(elementId) as PathElement;
      if (!element) continue;

      const points = commandsToAnchorPoints(element.commands);

      for (const handle of handles) {
        if (handle.pointIndex >= points.length) continue;

        const point = points[handle.pointIndex];

        switch (handle.handleType) {
          case 'anchor':
            point.anchor.x += dx;
            point.anchor.y += dy;
            if (point.handleIn) {
              point.handleIn.x += dx;
              point.handleIn.y += dy;
            }
            if (point.handleOut) {
              point.handleOut.x += dx;
              point.handleOut.y += dy;
            }
            break;
          case 'handleIn':
            if (point.handleIn) {
              point.handleIn.x += dx;
              point.handleIn.y += dy;
            }
            break;
          case 'handleOut':
            if (point.handleOut) {
              point.handleOut.x += dx;
              point.handleOut.y += dy;
            }
            break;
        }
      }

      this.ctx.updateElement(elementId, {
        commands: anchorPointsToCommands(points, element.closed),
      } as Partial<VectorElement>);
    }

    this.ctx.commitToHistory('Nudge anchor points');
  }

  private findElement(id: string): VectorElement | null {
    if (!this.ctx) return null;

    const { state } = this.ctx;

    for (const layer of state.document.layers) {
      const element = layer.elements.find((el) => el.id === id);
      if (element) return element;
    }

    return null;
  }
}
