/**
 * Canvas - Main drawing canvas component
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import type { Document, ToolType, Point, Bounds, VectorElement } from '../types';
import { VectorRenderer, getElementBounds } from '../engine/VectorRenderer';
import {
  BaseTool,
  ToolContext,
  SelectTool,
  PenTool,
  RectangleTool,
  EllipseTool,
  PolygonTool,
  StarTool,
  LineTool,
  TextTool,
  EyedropperTool,
  HandTool,
  ZoomTool,
} from '../tools';

interface CanvasProps {
  document: Document;
  activeTool: ToolType;
  activeLayerId: string;
  selection: { elementIds: string[]; bounds: Bounds | null };
  view: { zoom: number; panX: number; panY: number; showGrid: boolean; gridSize: number };
  onDocumentChange: (doc: Document) => void;
  onSelectionChange: (elementIds: string[]) => void;
  onViewChange: (view: CanvasProps['view']) => void;
  onCommitHistory: (description: string) => void;
}

// Create tool instances
const toolInstances: Record<ToolType, BaseTool> = {
  select: new SelectTool(),
  'direct-select': new SelectTool(), // Use same for now
  pen: new PenTool(),
  pencil: new PenTool(), // Use pen for now
  rectangle: new RectangleTool(),
  ellipse: new EllipseTool(),
  polygon: new PolygonTool(),
  star: new StarTool(),
  line: new LineTool(),
  text: new TextTool(),
  eyedropper: new EyedropperTool(),
  hand: new HandTool(),
  zoom: new ZoomTool(),
};

export const Canvas: React.FC<CanvasProps> = ({
  document,
  activeTool,
  activeLayerId,
  selection,
  view,
  onDocumentChange,
  onSelectionChange,
  onViewChange,
  onCommitHistory,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<VectorRenderer | null>(null);
  const animationRef = useRef<number | null>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });

  // Get current tool
  const currentTool = toolInstances[activeTool];

  // Create tool context
  const createToolContext = useCallback((): ToolContext => {
    return {
      state: {
        document,
        selection,
        activeLayerId,
        activeTool,
        view,
        history: [],
        historyIndex: -1,
        clipboardElements: [],
      },
      updateState: (updates) => {
        if (updates.view) {
          onViewChange({ ...view, ...updates.view });
        }
      },
      updateElement: (id, updates) => {
        const newDoc = { ...document };
        for (const layer of newDoc.layers) {
          const index = layer.elements.findIndex((el) => el.id === id);
          if (index !== -1) {
            layer.elements[index] = { ...layer.elements[index], ...updates } as VectorElement;
            break;
          }
        }
        onDocumentChange(newDoc);
      },
      addElement: (element, layerId) => {
        const newDoc = { ...document };
        const targetLayerId = layerId || activeLayerId;
        const layer = newDoc.layers.find((l) => l.id === targetLayerId);
        if (layer) {
          layer.elements.push(element);
        }
        onDocumentChange(newDoc);
      },
      removeElement: (id) => {
        const newDoc = { ...document };
        for (const layer of newDoc.layers) {
          const index = layer.elements.findIndex((el) => el.id === id);
          if (index !== -1) {
            layer.elements.splice(index, 1);
            break;
          }
        }
        onDocumentChange(newDoc);
      },
      setSelection: onSelectionChange,
      commitToHistory: onCommitHistory,
      canvasToDocument: (point) => ({
        x: (point.x - view.panX) / view.zoom,
        y: (point.y - view.panY) / view.zoom,
      }),
      documentToCanvas: (point) => ({
        x: point.x * view.zoom + view.panX,
        y: point.y * view.zoom + view.panY,
      }),
    };
  }, [document, selection, activeLayerId, activeTool, view, onDocumentChange, onSelectionChange, onViewChange, onCommitHistory]);

  // Set up tool context
  useEffect(() => {
    const ctx = createToolContext();
    currentTool.setContext(ctx);
    currentTool.activate();

    return () => {
      currentTool.deactivate();
    };
  }, [currentTool, createToolContext]);

  // Set up canvas and renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    rendererRef.current = new VectorRenderer(ctx);
  }, []);

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({ width: Math.floor(width), height: Math.floor(height) });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    ctx.scale(dpr, dpr);

    const render = () => {
      // Clear canvas
      ctx.clearRect(0, 0, size.width, size.height);

      // Draw background
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(0, 0, size.width, size.height);

      // Draw grid
      if (view.showGrid) {
        renderer.renderGrid(size.width, size.height, view.gridSize, view.zoom, view.panX, view.panY);
      }

      // Draw document
      ctx.save();
      ctx.translate(view.panX, view.panY);
      ctx.scale(view.zoom, view.zoom);

      // Document background (artboard)
      ctx.fillStyle = `rgba(${document.background.r}, ${document.background.g}, ${document.background.b}, ${document.background.a})`;
      ctx.fillRect(0, 0, document.width, document.height);

      // Render layers
      for (const layer of document.layers) {
        if (layer.visible) {
          renderer.renderLayer(layer);
        }
      }

      // Render selection
      if (selection.bounds) {
        renderer.renderSelection(selection.bounds);
      }

      ctx.restore();

      // Render tool overlays
      currentTool.render(ctx);

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [document, selection, view, size, currentTool]);

  // Calculate selection bounds
  useEffect(() => {
    if (selection.elementIds.length === 0) {
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const layer of document.layers) {
      for (const element of layer.elements) {
        if (selection.elementIds.includes(element.id)) {
          const bounds = getElementBounds(element);
          minX = Math.min(minX, bounds.x);
          minY = Math.min(minY, bounds.y);
          maxX = Math.max(maxX, bounds.x + bounds.width);
          maxY = Math.max(maxY, bounds.y + bounds.height);
        }
      }
    }

    // Selection bounds are handled internally
  }, [document, selection.elementIds]);

  // Event handlers
  const createToolEvent = useCallback(
    (e: React.PointerEvent | PointerEvent): Parameters<BaseTool['onPointerDown']>[0] => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return {
          point: { x: 0, y: 0 },
          canvasPoint: { x: 0, y: 0 },
          event: e as PointerEvent,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
        };
      }

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      return {
        point: { x, y },
        canvasPoint: {
          x: (x - view.panX) / view.zoom,
          y: (y - view.panY) / view.zoom,
        },
        event: e as PointerEvent,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
      };
    },
    [view]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      canvasRef.current?.setPointerCapture(e.pointerId);
      currentTool.onPointerDown(createToolEvent(e));
    },
    [currentTool, createToolEvent]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      currentTool.onPointerMove(createToolEvent(e));
    },
    [currentTool, createToolEvent]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      canvasRef.current?.releasePointerCapture(e.pointerId);
      currentTool.onPointerUp(createToolEvent(e));
    },
    [currentTool, createToolEvent]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      currentTool.onDoubleClick({
        point: { x, y },
        canvasPoint: {
          x: (x - view.panX) / view.zoom,
          y: (y - view.panY) / view.zoom,
        },
        event: e as unknown as PointerEvent,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
      });
    },
    [currentTool, view]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();

      if (e.ctrlKey || e.metaKey) {
        // Zoom
        const delta = -e.deltaY * 0.001;
        const newZoom = Math.max(0.1, Math.min(32, view.zoom * (1 + delta)));

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const scale = newZoom / view.zoom;
        onViewChange({
          ...view,
          zoom: newZoom,
          panX: x - (x - view.panX) * scale,
          panY: y - (y - view.panY) * scale,
        });
      } else {
        // Pan
        onViewChange({
          ...view,
          panX: view.panX - e.deltaX,
          panY: view.panY - e.deltaY,
        });
      }
    },
    [view, onViewChange]
  );

  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Tool shortcuts
      const shortcuts: Record<string, ToolType> = {
        v: 'select',
        p: 'pen',
        r: 'rectangle',
        o: 'ellipse',
        y: 'polygon',
        t: 'text',
        i: 'eyedropper',
        h: 'hand',
        z: 'zoom',
      };

      const tool = shortcuts[e.key.toLowerCase()];
      if (tool && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // Handle tool switching through parent
        return;
      }

      currentTool.onKeyDown({
        point: { x: 0, y: 0 },
        canvasPoint: { x: 0, y: 0 },
        event: e,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
      });
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      currentTool.onKeyUp({
        point: { x: 0, y: 0 },
        canvasPoint: { x: 0, y: 0 },
        event: e,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [currentTool]);

  return (
    <div ref={containerRef} className="flex-1 overflow-hidden">
      <canvas
        ref={canvasRef}
        className="block"
        style={{ cursor: currentTool.cursor }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
      />
    </div>
  );
};
