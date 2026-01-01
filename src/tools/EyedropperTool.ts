/**
 * EyedropperTool - Color picker from canvas
 */

import { BaseTool, ToolEvent } from './BaseTool';
import type { Point, Color, ToolType } from '../types';

export class EyedropperTool extends BaseTool {
  readonly id: ToolType = 'eyedropper';
  readonly name = 'Eyedropper Tool';
  readonly shortcut = 'I';
  readonly cursor = 'crosshair';

  private pickedColor: Color | null = null;
  private onColorPicked: ((color: Color) => void) | null = null;

  setColorCallback(callback: (color: Color) => void): void {
    this.onColorPicked = callback;
  }

  onPointerDown(e: ToolEvent): void {
    this.pickColor(e.point); // Use screen point for canvas pixel sampling
  }

  onPointerMove(e: ToolEvent): void {
    // Show preview of color under cursor
    this.pickColor(e.point, true);
  }

  onPointerUp(e: ToolEvent): void {
    if (this.pickedColor && this.onColorPicked) {
      this.onColorPicked(this.pickedColor);
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Render eyedropper preview
    if (this.pickedColor) {
      const x = ctx.canvas.width - 50;
      const y = 10;

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, y, 40, 40, 4);
      ctx.fill();
      ctx.stroke();

      // Color swatch
      ctx.fillStyle = `rgba(${this.pickedColor.r}, ${this.pickedColor.g}, ${this.pickedColor.b}, ${this.pickedColor.a})`;
      ctx.beginPath();
      ctx.roundRect(x + 4, y + 4, 32, 32, 2);
      ctx.fill();
    }
  }

  private pickColor(point: Point, preview = false): void {
    if (!this.ctx) return;

    // This would sample from the actual canvas context
    // For now, we'll use a placeholder implementation
    // In production, you'd use ctx.getImageData(x, y, 1, 1)

    // Simulate picking a color (in real implementation, sample from canvas)
    this.pickedColor = {
      r: Math.floor(Math.random() * 256),
      g: Math.floor(Math.random() * 256),
      b: Math.floor(Math.random() * 256),
      a: 1,
    };
  }

  getPickedColor(): Color | null {
    return this.pickedColor;
  }
}
