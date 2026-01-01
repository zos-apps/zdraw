/**
 * SelectTool - Selection and transformation tool
 *
 * Supports selecting, moving, scaling, and rotating elements.
 */

import { BaseTool, ToolEvent } from './BaseTool';
import type { Point, Bounds, VectorElement, ToolType } from '../types';
import { getElementBounds } from '../engine/VectorRenderer';

type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate';
type DragMode = 'none' | 'select' | 'move' | 'resize' | 'rotate' | 'marquee';

interface DragState {
  mode: DragMode;
  startPoint: Point;
  handle?: HandlePosition;
  originalBounds?: Bounds;
  originalElements?: Map<string, { transform: VectorElement['transform'] }>;
}

export class SelectTool extends BaseTool {
  readonly id: ToolType = 'select';
  readonly name = 'Selection Tool';
  readonly shortcut = 'V';
  readonly cursor = 'default';

  private dragState: DragState | null = null;
  private marqueeRect: Bounds | null = null;
  private handleSize = 8;
  private rotateHandleOffset = 20;

  onPointerDown(e: ToolEvent): void {
    if (!this.ctx) return;

    const { state } = this.ctx;
    const point = e.canvasPoint;

    // Check if clicking on a handle
    if (state.selection.elementIds.length > 0 && state.selection.bounds) {
      const handle = this.hitTestHandles(point, state.selection.bounds);

      if (handle) {
        this.startResize(point, handle, state.selection.bounds);
        return;
      }
    }

    // Check if clicking on an element
    const hitElement = this.hitTestElements(point);

    if (hitElement) {
      const isSelected = state.selection.elementIds.includes(hitElement.id);

      if (e.shiftKey) {
        // Toggle selection
        if (isSelected) {
          this.ctx.setSelection(state.selection.elementIds.filter((id) => id !== hitElement.id));
        } else {
          this.ctx.setSelection([...state.selection.elementIds, hitElement.id]);
        }
      } else if (!isSelected) {
        // Select only this element
        this.ctx.setSelection([hitElement.id]);
      }

      // Start moving
      this.startMove(point);
    } else {
      // Start marquee selection
      if (!e.shiftKey) {
        this.ctx.setSelection([]);
      }
      this.startMarquee(point);
    }
  }

  onPointerMove(e: ToolEvent): void {
    if (!this.ctx || !this.dragState) return;

    const point = e.canvasPoint;

    switch (this.dragState.mode) {
      case 'move':
        this.handleMove(point, e.shiftKey);
        break;
      case 'resize':
        this.handleResize(point, e.shiftKey, e.altKey);
        break;
      case 'rotate':
        this.handleRotate(point, e.shiftKey);
        break;
      case 'marquee':
        this.updateMarquee(point);
        break;
    }
  }

  onPointerUp(e: ToolEvent): void {
    if (!this.ctx) return;

    if (this.dragState?.mode === 'marquee' && this.marqueeRect) {
      this.selectInMarquee(e.shiftKey);
    }

    if (this.dragState && this.dragState.mode !== 'none') {
      this.ctx.commitToHistory(`${this.dragState.mode} elements`);
    }

    this.dragState = null;
    this.marqueeRect = null;
  }

  onKeyDown(e: ToolEvent): void {
    if (!this.ctx) return;

    const { state } = this.ctx;
    const event = e.event as KeyboardEvent;

    if (state.selection.elementIds.length === 0) return;

    const moveAmount = e.shiftKey ? 10 : 1;

    switch (event.key) {
      case 'ArrowUp':
        this.nudgeSelection(0, -moveAmount);
        break;
      case 'ArrowDown':
        this.nudgeSelection(0, moveAmount);
        break;
      case 'ArrowLeft':
        this.nudgeSelection(-moveAmount, 0);
        break;
      case 'ArrowRight':
        this.nudgeSelection(moveAmount, 0);
        break;
      case 'Delete':
      case 'Backspace':
        this.deleteSelection();
        break;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Render marquee selection rectangle
    if (this.marqueeRect) {
      ctx.strokeStyle = '#0066ff';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(this.marqueeRect.x, this.marqueeRect.y, this.marqueeRect.width, this.marqueeRect.height);
      ctx.fillStyle = 'rgba(0, 102, 255, 0.1)';
      ctx.fillRect(this.marqueeRect.x, this.marqueeRect.y, this.marqueeRect.width, this.marqueeRect.height);
      ctx.setLineDash([]);
    }
  }

  // ============================================================================
  // Drag Handlers
  // ============================================================================

  private startMove(point: Point): void {
    if (!this.ctx) return;

    const { state } = this.ctx;
    const originalElements = new Map<string, { transform: VectorElement['transform'] }>();

    for (const id of state.selection.elementIds) {
      const element = this.findElement(id);
      if (element) {
        originalElements.set(id, { transform: { ...element.transform } });
      }
    }

    this.dragState = {
      mode: 'move',
      startPoint: point,
      originalElements,
    };
  }

  private handleMove(point: Point, constrain: boolean): void {
    if (!this.ctx || !this.dragState?.originalElements) return;

    let dx = point.x - this.dragState.startPoint.x;
    let dy = point.y - this.dragState.startPoint.y;

    if (constrain) {
      if (Math.abs(dx) > Math.abs(dy)) {
        dy = 0;
      } else {
        dx = 0;
      }
    }

    for (const [id, original] of this.dragState.originalElements) {
      this.ctx.updateElement(id, {
        transform: {
          ...original.transform,
          translateX: original.transform.translateX + dx,
          translateY: original.transform.translateY + dy,
        },
      } as Partial<VectorElement>);
    }
  }

  private startResize(point: Point, handle: HandlePosition, bounds: Bounds): void {
    if (!this.ctx) return;

    const { state } = this.ctx;
    const originalElements = new Map<string, { transform: VectorElement['transform'] }>();

    for (const id of state.selection.elementIds) {
      const element = this.findElement(id);
      if (element) {
        originalElements.set(id, { transform: { ...element.transform } });
      }
    }

    this.dragState = {
      mode: handle === 'rotate' ? 'rotate' : 'resize',
      startPoint: point,
      handle,
      originalBounds: { ...bounds },
      originalElements,
    };
  }

  private handleResize(point: Point, constrain: boolean, fromCenter: boolean): void {
    if (!this.ctx || !this.dragState?.originalBounds || !this.dragState.handle) return;

    const { originalBounds, handle, startPoint, originalElements } = this.dragState;

    let dx = point.x - startPoint.x;
    let dy = point.y - startPoint.y;

    // Calculate scale factors based on handle
    let scaleX = 1;
    let scaleY = 1;

    switch (handle) {
      case 'e':
        scaleX = (originalBounds.width + dx) / originalBounds.width;
        break;
      case 'w':
        scaleX = (originalBounds.width - dx) / originalBounds.width;
        break;
      case 's':
        scaleY = (originalBounds.height + dy) / originalBounds.height;
        break;
      case 'n':
        scaleY = (originalBounds.height - dy) / originalBounds.height;
        break;
      case 'se':
        scaleX = (originalBounds.width + dx) / originalBounds.width;
        scaleY = (originalBounds.height + dy) / originalBounds.height;
        break;
      case 'sw':
        scaleX = (originalBounds.width - dx) / originalBounds.width;
        scaleY = (originalBounds.height + dy) / originalBounds.height;
        break;
      case 'ne':
        scaleX = (originalBounds.width + dx) / originalBounds.width;
        scaleY = (originalBounds.height - dy) / originalBounds.height;
        break;
      case 'nw':
        scaleX = (originalBounds.width - dx) / originalBounds.width;
        scaleY = (originalBounds.height - dy) / originalBounds.height;
        break;
    }

    // Constrain to maintain aspect ratio
    if (constrain) {
      const scale = Math.max(Math.abs(scaleX), Math.abs(scaleY));
      scaleX = scale * Math.sign(scaleX || 1);
      scaleY = scale * Math.sign(scaleY || 1);
    }

    // Apply scale to elements
    if (originalElements) {
      for (const [id, original] of originalElements) {
        this.ctx.updateElement(id, {
          transform: {
            ...original.transform,
            scaleX: original.transform.scaleX * scaleX,
            scaleY: original.transform.scaleY * scaleY,
          },
        } as Partial<VectorElement>);
      }
    }
  }

  private handleRotate(point: Point, constrain: boolean): void {
    if (!this.ctx || !this.dragState?.originalBounds || !this.dragState.originalElements) return;

    const { originalBounds, startPoint, originalElements } = this.dragState;

    const centerX = originalBounds.x + originalBounds.width / 2;
    const centerY = originalBounds.y + originalBounds.height / 2;

    const startAngle = Math.atan2(startPoint.y - centerY, startPoint.x - centerX);
    const currentAngle = Math.atan2(point.y - centerY, point.x - centerX);
    let rotation = ((currentAngle - startAngle) * 180) / Math.PI;

    if (constrain) {
      rotation = Math.round(rotation / 15) * 15;
    }

    for (const [id, original] of originalElements) {
      this.ctx.updateElement(id, {
        transform: {
          ...original.transform,
          rotation: original.transform.rotation + rotation,
        },
      } as Partial<VectorElement>);
    }
  }

  private startMarquee(point: Point): void {
    this.dragState = {
      mode: 'marquee',
      startPoint: point,
    };
    this.marqueeRect = { x: point.x, y: point.y, width: 0, height: 0 };
  }

  private updateMarquee(point: Point): void {
    if (!this.dragState) return;

    const { startPoint } = this.dragState;
    this.marqueeRect = {
      x: Math.min(startPoint.x, point.x),
      y: Math.min(startPoint.y, point.y),
      width: Math.abs(point.x - startPoint.x),
      height: Math.abs(point.y - startPoint.y),
    };
  }

  private selectInMarquee(addToSelection: boolean): void {
    if (!this.ctx || !this.marqueeRect) return;

    const { state } = this.ctx;
    const selectedIds: string[] = addToSelection ? [...state.selection.elementIds] : [];

    for (const layer of state.document.layers) {
      if (!layer.visible || layer.locked) continue;

      for (const element of layer.elements) {
        if (element.locked) continue;

        const bounds = getElementBounds(element);
        if (this.boundsIntersect(bounds, this.marqueeRect)) {
          if (!selectedIds.includes(element.id)) {
            selectedIds.push(element.id);
          }
        }
      }
    }

    this.ctx.setSelection(selectedIds);
  }

  // ============================================================================
  // Hit Testing
  // ============================================================================

  private hitTestHandles(point: Point, bounds: Bounds): HandlePosition | null {
    const handles = this.getHandlePositions(bounds);

    for (const [position, handlePos] of Object.entries(handles)) {
      if (this.pointInHandle(point, handlePos)) {
        return position as HandlePosition;
      }
    }

    return null;
  }

  private getHandlePositions(bounds: Bounds): Record<HandlePosition, Point> {
    const { x, y, width, height } = bounds;
    const cx = x + width / 2;
    const cy = y + height / 2;

    return {
      nw: { x, y },
      n: { x: cx, y },
      ne: { x: x + width, y },
      e: { x: x + width, y: cy },
      se: { x: x + width, y: y + height },
      s: { x: cx, y: y + height },
      sw: { x, y: y + height },
      w: { x, y: cy },
      rotate: { x: cx, y: y - this.rotateHandleOffset },
    };
  }

  private pointInHandle(point: Point, handlePos: Point): boolean {
    const half = this.handleSize / 2;
    return (
      point.x >= handlePos.x - half &&
      point.x <= handlePos.x + half &&
      point.y >= handlePos.y - half &&
      point.y <= handlePos.y + half
    );
  }

  private hitTestElements(point: Point): VectorElement | null {
    if (!this.ctx) return null;

    const { state } = this.ctx;

    // Test in reverse order (top to bottom)
    for (let i = state.document.layers.length - 1; i >= 0; i--) {
      const layer = state.document.layers[i];
      if (!layer.visible || layer.locked) continue;

      for (let j = layer.elements.length - 1; j >= 0; j--) {
        const element = layer.elements[j];
        if (!element.visible || element.locked) continue;

        const bounds = getElementBounds(element);
        if (this.pointInBounds(point, bounds)) {
          return element;
        }
      }
    }

    return null;
  }

  private pointInBounds(point: Point, bounds: Bounds): boolean {
    return (
      point.x >= bounds.x &&
      point.x <= bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y <= bounds.y + bounds.height
    );
  }

  private boundsIntersect(a: Bounds, b: Bounds): boolean {
    return !(a.x + a.width < b.x || b.x + b.width < a.x || a.y + a.height < b.y || b.y + b.height < a.y);
  }

  // ============================================================================
  // Actions
  // ============================================================================

  private nudgeSelection(dx: number, dy: number): void {
    if (!this.ctx) return;

    const { state } = this.ctx;

    for (const id of state.selection.elementIds) {
      const element = this.findElement(id);
      if (element) {
        this.ctx.updateElement(id, {
          transform: {
            ...element.transform,
            translateX: element.transform.translateX + dx,
            translateY: element.transform.translateY + dy,
          },
        } as Partial<VectorElement>);
      }
    }

    this.ctx.commitToHistory('nudge elements');
  }

  private deleteSelection(): void {
    if (!this.ctx) return;

    const { state } = this.ctx;

    for (const id of state.selection.elementIds) {
      this.ctx.removeElement(id);
    }

    this.ctx.setSelection([]);
    this.ctx.commitToHistory('delete elements');
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
