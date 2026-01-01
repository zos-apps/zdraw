/**
 * TextTool - Text element creation and editing
 */

import { BaseTool, ToolEvent } from './BaseTool';
import type { Point, TextElement, ToolType } from '../types';
import { generateId, createTransform, createColor } from '../types';

export class TextTool extends BaseTool {
  readonly id: ToolType = 'text';
  readonly name = 'Text Tool';
  readonly shortcut = 'T';
  readonly cursor = 'text';

  private clickPoint: Point | null = null;
  private isEditing = false;
  private editingElementId: string | null = null;

  onPointerDown(e: ToolEvent): void {
    if (!this.ctx) return;

    this.clickPoint = e.canvasPoint;

    // Check if clicking on existing text element
    const hitElement = this.hitTestText(e.canvasPoint);

    if (hitElement) {
      this.startEditing(hitElement);
    } else if (!this.isEditing) {
      // Create new text element
      this.createTextElement(e.canvasPoint);
    }
  }

  onDoubleClick(e: ToolEvent): void {
    // Start editing on double-click
    const hitElement = this.hitTestText(e.canvasPoint);
    if (hitElement) {
      this.startEditing(hitElement);
    }
  }

  onKeyDown(e: ToolEvent): void {
    const event = e.event as KeyboardEvent;

    if (event.key === 'Escape') {
      this.stopEditing();
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Show text cursor at click point
    if (this.clickPoint && !this.isEditing) {
      ctx.strokeStyle = '#0066ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.clickPoint.x, this.clickPoint.y - 12);
      ctx.lineTo(this.clickPoint.x, this.clickPoint.y + 12);
      ctx.stroke();
    }
  }

  private createTextElement(point: Point): void {
    if (!this.ctx) return;

    const element: TextElement = {
      id: generateId(),
      type: 'text',
      name: 'Text',
      visible: true,
      locked: false,
      opacity: 1,
      transform: createTransform(),
      fill: createColor(0, 0, 0, 1),
      stroke: null,
      x: point.x,
      y: point.y,
      text: 'Text',
      fontFamily: 'Inter, sans-serif',
      fontSize: 24,
      fontWeight: 400,
      fontStyle: 'normal',
      textAnchor: 'start',
      lineHeight: 1.2,
    };

    this.ctx.addElement(element);
    this.ctx.setSelection([element.id]);
    this.ctx.commitToHistory('create text');

    // Start editing immediately
    this.startEditing(element);
  }

  private startEditing(element: TextElement): void {
    this.isEditing = true;
    this.editingElementId = element.id;
    // In a real implementation, this would show an inline text editor
    // For now, we use a simple prompt
    const newText = window.prompt('Enter text:', element.text);
    if (newText !== null && this.ctx) {
      this.ctx.updateElement(element.id, { text: newText } as Partial<TextElement>);
      this.ctx.commitToHistory('edit text');
    }
    this.stopEditing();
  }

  private stopEditing(): void {
    this.isEditing = false;
    this.editingElementId = null;
    this.clickPoint = null;
  }

  private hitTestText(point: Point): TextElement | null {
    if (!this.ctx) return null;

    const { state } = this.ctx;

    for (const layer of state.document.layers) {
      if (!layer.visible || layer.locked) continue;

      for (const element of layer.elements) {
        if (element.type !== 'text' || !element.visible || element.locked) continue;

        const textElement = element as TextElement;

        // Simple hit test based on text position and estimated bounds
        const width = textElement.text.length * textElement.fontSize * 0.6;
        const height = textElement.fontSize * textElement.lineHeight;

        let x = textElement.x;
        if (textElement.textAnchor === 'middle') {
          x -= width / 2;
        } else if (textElement.textAnchor === 'end') {
          x -= width;
        }

        const y = textElement.y - textElement.fontSize;

        if (point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height) {
          return textElement;
        }
      }
    }

    return null;
  }
}
