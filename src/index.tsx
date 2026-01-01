/**
 * zDraw - Professional Vector Graphics Application
 *
 * An Illustrator-inspired vector graphics editor built on Canvas2D with SVG export.
 *
 * Features:
 * - Pen tool with bezier curves
 * - Shape tools (rectangle, ellipse, polygon, star, line)
 * - Text tool with font styling
 * - Layers panel with visibility/lock controls
 * - Properties panel for element editing
 * - SVG import/export
 * - Keyboard shortcuts for all tools
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  Document,
  Layer,
  VectorElement,
  ToolType,
  ViewState,
  Selection,
  Bounds,
  HistoryEntry,
  Color,
} from './types';
import { generateId, createTransform, createColor } from './types';
import { Toolbar } from './components/Toolbar';
import { LayersPanel } from './components/LayersPanel';
import { PropertiesPanel } from './components/PropertiesPanel';
import { Canvas } from './components/Canvas';
import { StatusBar } from './components/StatusBar';
import { SVGExporter, SVGParser } from './engine/SVGExporter';
import { getElementBounds } from './engine/VectorRenderer';

// ============================================================================
// Default Document
// ============================================================================

function createDefaultDocument(): Document {
  return {
    id: generateId(),
    name: 'Untitled',
    width: 800,
    height: 600,
    background: createColor(255, 255, 255, 1),
    layers: [
      {
        id: generateId(),
        name: 'Layer 1',
        visible: true,
        locked: false,
        opacity: 1,
        elements: [],
        collapsed: false,
      },
    ],
    guides: [],
  };
}

function createDefaultViewState(): ViewState {
  return {
    zoom: 1,
    panX: 50,
    panY: 50,
    showGrid: true,
    showGuides: true,
    snapToGrid: false,
    snapToGuides: true,
    gridSize: 10,
  };
}

// ============================================================================
// Main App Component
// ============================================================================

export interface ZDrawAppProps {
  className?: string;
}

export function ZDrawApp({ className = '' }: ZDrawAppProps): React.ReactElement {
  // Document state
  const [document, setDocument] = useState<Document>(createDefaultDocument);
  const [activeLayerId, setActiveLayerId] = useState<string>(() => document.layers[0].id);

  // Selection state
  const [selection, setSelection] = useState<Selection>({
    elementIds: [],
    bounds: null,
  });

  // Tool state
  const [activeTool, setActiveTool] = useState<ToolType>('select');

  // View state
  const [view, setView] = useState<ViewState>(createDefaultViewState);

  // History state
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // UI state
  const [showLayersPanel, setShowLayersPanel] = useState(true);
  const [showPropertiesPanel, setShowPropertiesPanel] = useState(true);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const svgExporterRef = useRef(new SVGExporter());
  const svgParserRef = useRef(new SVGParser());

  // ============================================================================
  // History Management
  // ============================================================================

  const commitToHistory = useCallback((description: string) => {
    const entry: HistoryEntry = {
      id: generateId(),
      description,
      timestamp: Date.now(),
      document: JSON.parse(JSON.stringify(document)),
    };

    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(entry);
      // Limit history size
      if (newHistory.length > 50) {
        newHistory.shift();
      }
      return newHistory;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 49));
  }, [document, historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex < 0) return;

    const entry = history[historyIndex];
    setDocument(JSON.parse(JSON.stringify(entry.document)));
    setHistoryIndex((prev) => prev - 1);
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;

    const entry = history[historyIndex + 1];
    setDocument(JSON.parse(JSON.stringify(entry.document)));
    setHistoryIndex((prev) => prev + 1);
  }, [history, historyIndex]);

  // ============================================================================
  // Document Manipulation
  // ============================================================================

  const handleDocumentChange = useCallback((newDoc: Document) => {
    setDocument(newDoc);
  }, []);

  const handleSelectionChange = useCallback((elementIds: string[]) => {
    // Calculate selection bounds
    let bounds: Bounds | null = null;

    if (elementIds.length > 0) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const layer of document.layers) {
        for (const element of layer.elements) {
          if (elementIds.includes(element.id)) {
            const elBounds = getElementBounds(element);
            minX = Math.min(minX, elBounds.x);
            minY = Math.min(minY, elBounds.y);
            maxX = Math.max(maxX, elBounds.x + elBounds.width);
            maxY = Math.max(maxY, elBounds.y + elBounds.height);
          }
        }
      }

      if (isFinite(minX)) {
        bounds = {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
        };
      }
    }

    setSelection({ elementIds, bounds });
  }, [document.layers]);

  const handleViewChange = useCallback((newView: ViewState) => {
    setView(newView);
  }, []);

  // ============================================================================
  // Layer Operations
  // ============================================================================

  const handleLayerAdd = useCallback(() => {
    const newLayer: Layer = {
      id: generateId(),
      name: `Layer ${document.layers.length + 1}`,
      visible: true,
      locked: false,
      opacity: 1,
      elements: [],
      collapsed: false,
    };

    setDocument((prev) => ({
      ...prev,
      layers: [...prev.layers, newLayer],
    }));
    setActiveLayerId(newLayer.id);
    commitToHistory('Add layer');
  }, [document.layers.length, commitToHistory]);

  const handleLayerRemove = useCallback((layerId: string) => {
    if (document.layers.length <= 1) return;

    setDocument((prev) => ({
      ...prev,
      layers: prev.layers.filter((l) => l.id !== layerId),
    }));

    if (activeLayerId === layerId) {
      setActiveLayerId(document.layers[0].id === layerId ? document.layers[1].id : document.layers[0].id);
    }

    commitToHistory('Remove layer');
  }, [document.layers, activeLayerId, commitToHistory]);

  const handleLayerVisibilityChange = useCallback((layerId: string, visible: boolean) => {
    setDocument((prev) => ({
      ...prev,
      layers: prev.layers.map((l) =>
        l.id === layerId ? { ...l, visible } : l
      ),
    }));
  }, []);

  const handleLayerLockChange = useCallback((layerId: string, locked: boolean) => {
    setDocument((prev) => ({
      ...prev,
      layers: prev.layers.map((l) =>
        l.id === layerId ? { ...l, locked } : l
      ),
    }));
  }, []);

  const handleLayerRename = useCallback((layerId: string, name: string) => {
    setDocument((prev) => ({
      ...prev,
      layers: prev.layers.map((l) =>
        l.id === layerId ? { ...l, name } : l
      ),
    }));
  }, []);

  const handleLayerReorder = useCallback((fromIndex: number, toIndex: number) => {
    setDocument((prev) => {
      const layers = [...prev.layers];
      const [removed] = layers.splice(fromIndex, 1);
      layers.splice(toIndex, 0, removed);
      return { ...prev, layers };
    });
    commitToHistory('Reorder layers');
  }, [commitToHistory]);

  // ============================================================================
  // Element Operations
  // ============================================================================

  const findElement = useCallback((elementId: string): VectorElement | null => {
    for (const layer of document.layers) {
      const element = layer.elements.find((el) => el.id === elementId);
      if (element) return element;
    }
    return null;
  }, [document.layers]);

  const handleElementUpdate = useCallback((elementId: string, updates: Partial<VectorElement>) => {
    setDocument((prev) => ({
      ...prev,
      layers: prev.layers.map((layer) => ({
        ...layer,
        elements: layer.elements.map((el) =>
          el.id === elementId ? { ...el, ...updates } as VectorElement : el
        ),
      })),
    }));
  }, []);

  const handleElementVisibilityChange = useCallback((elementId: string, visible: boolean) => {
    handleElementUpdate(elementId, { visible });
  }, [handleElementUpdate]);

  const handleElementLockChange = useCallback((elementId: string, locked: boolean) => {
    handleElementUpdate(elementId, { locked });
  }, [handleElementUpdate]);

  const handleElementDelete = useCallback((elementId: string) => {
    setDocument((prev) => ({
      ...prev,
      layers: prev.layers.map((layer) => ({
        ...layer,
        elements: layer.elements.filter((el) => el.id !== elementId),
      })),
    }));
    setSelection((prev) => ({
      ...prev,
      elementIds: prev.elementIds.filter((id) => id !== elementId),
    }));
    commitToHistory('Delete element');
  }, [commitToHistory]);

  const handleElementDuplicate = useCallback((elementId: string) => {
    const element = findElement(elementId);
    if (!element) return;

    const duplicate: VectorElement = {
      ...JSON.parse(JSON.stringify(element)),
      id: generateId(),
      name: `${element.name} copy`,
      transform: {
        ...element.transform,
        translateX: element.transform.translateX + 20,
        translateY: element.transform.translateY + 20,
      },
    };

    setDocument((prev) => ({
      ...prev,
      layers: prev.layers.map((layer) => {
        const hasElement = layer.elements.some((el) => el.id === elementId);
        if (hasElement) {
          return { ...layer, elements: [...layer.elements, duplicate] };
        }
        return layer;
      }),
    }));

    setSelection({ elementIds: [duplicate.id], bounds: null });
    commitToHistory('Duplicate element');
  }, [findElement, commitToHistory]);

  // ============================================================================
  // SVG Export/Import
  // ============================================================================

  const handleExportSVG = useCallback(() => {
    const svg = svgExporterRef.current.export(document);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${document.name}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [document]);

  const handleImportSVG = useCallback((svgString: string) => {
    const imported = svgParserRef.current.parse(svgString);
    if (imported) {
      setDocument(imported);
      setActiveLayerId(imported.layers[0].id);
      setSelection({ elementIds: [], bounds: null });
      setHistory([]);
      setHistoryIndex(-1);
    }
  }, []);

  // ============================================================================
  // Zoom Controls
  // ============================================================================

  const handleZoomChange = useCallback((zoom: number) => {
    setView((prev) => ({ ...prev, zoom: Math.max(0.1, Math.min(32, zoom)) }));
  }, []);

  const handleFitToWindow = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const padding = 50;
    const scaleX = (rect.width - padding * 2) / document.width;
    const scaleY = (rect.height - padding * 2) / document.height;
    const zoom = Math.min(scaleX, scaleY, 1);

    setView((prev) => ({
      ...prev,
      zoom,
      panX: (rect.width - document.width * zoom) / 2,
      panY: (rect.height - document.height * zoom) / 2,
    }));
  }, [document.width, document.height]);

  // ============================================================================
  // Keyboard Shortcuts
  // ============================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key.toLowerCase();

      // Tool shortcuts
      const toolShortcuts: Record<string, ToolType> = {
        v: 'select',
        a: 'direct-select',
        p: 'pen',
        r: 'rectangle',
        o: 'ellipse',
        y: 'polygon',
        u: 'star',
        l: 'line',
        t: 'text',
        i: 'eyedropper',
        h: 'hand',
        z: 'zoom',
      };

      // Handle tool shortcuts (without modifiers)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const tool = toolShortcuts[key];
        if (tool) {
          e.preventDefault();
          setActiveTool(tool);
          return;
        }
      }

      // Undo (Cmd/Ctrl+Z)
      if ((e.metaKey || e.ctrlKey) && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Redo (Cmd/Ctrl+Shift+Z)
      if ((e.metaKey || e.ctrlKey) && key === 'z' && e.shiftKey) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Delete selected elements
      if (key === 'delete' || key === 'backspace') {
        if (selection.elementIds.length > 0) {
          e.preventDefault();
          for (const id of selection.elementIds) {
            handleElementDelete(id);
          }
        }
        return;
      }

      // Select all (Cmd/Ctrl+A)
      if ((e.metaKey || e.ctrlKey) && key === 'a') {
        e.preventDefault();
        const allIds: string[] = [];
        for (const layer of document.layers) {
          if (layer.visible && !layer.locked) {
            for (const el of layer.elements) {
              if (el.visible && !el.locked) {
                allIds.push(el.id);
              }
            }
          }
        }
        handleSelectionChange(allIds);
        return;
      }

      // Duplicate (Cmd/Ctrl+D)
      if ((e.metaKey || e.ctrlKey) && key === 'd') {
        e.preventDefault();
        for (const id of selection.elementIds) {
          handleElementDuplicate(id);
        }
        return;
      }

      // Export SVG (Cmd/Ctrl+E)
      if ((e.metaKey || e.ctrlKey) && key === 'e') {
        e.preventDefault();
        handleExportSVG();
        return;
      }

      // Toggle grid (Cmd/Ctrl+')
      if ((e.metaKey || e.ctrlKey) && key === "'") {
        e.preventDefault();
        setView((prev) => ({ ...prev, showGrid: !prev.showGrid }));
        return;
      }

      // Zoom in/out
      if (key === '=' || key === '+') {
        e.preventDefault();
        handleZoomChange(view.zoom * 1.25);
        return;
      }
      if (key === '-') {
        e.preventDefault();
        handleZoomChange(view.zoom / 1.25);
        return;
      }

      // Fit to window (Cmd/Ctrl+0)
      if ((e.metaKey || e.ctrlKey) && key === '0') {
        e.preventDefault();
        handleFitToWindow();
        return;
      }

      // 100% zoom (Cmd/Ctrl+1)
      if ((e.metaKey || e.ctrlKey) && key === '1') {
        e.preventDefault();
        handleZoomChange(1);
        return;
      }

      // Escape - deselect
      if (key === 'escape') {
        handleSelectionChange([]);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selection.elementIds,
    document.layers,
    view.zoom,
    handleUndo,
    handleRedo,
    handleElementDelete,
    handleElementDuplicate,
    handleExportSVG,
    handleZoomChange,
    handleFitToWindow,
    handleSelectionChange,
  ]);

  // ============================================================================
  // Get Selected Elements for Properties Panel
  // ============================================================================

  const selectedElements: VectorElement[] = [];
  for (const layer of document.layers) {
    for (const element of layer.elements) {
      if (selection.elementIds.includes(element.id)) {
        selectedElements.push(element);
      }
    }
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div ref={containerRef} className={`flex flex-col h-full bg-gray-900 text-white ${className}`}>
      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Toolbar (left) */}
        <Toolbar
          activeTool={activeTool}
          onToolChange={setActiveTool}
        />

        {/* Canvas (center) */}
        <Canvas
          document={document}
          activeTool={activeTool}
          activeLayerId={activeLayerId}
          selection={selection}
          view={view}
          onDocumentChange={handleDocumentChange}
          onSelectionChange={handleSelectionChange}
          onViewChange={handleViewChange}
          onCommitHistory={commitToHistory}
        />

        {/* Right panels */}
        <div className="w-64 flex flex-col border-l border-white/10 flex-shrink-0">
          {/* Layers Panel */}
          {showLayersPanel && (
            <div className="flex-1 overflow-hidden border-b border-white/10">
              <LayersPanel
                document={document}
                activeLayerId={activeLayerId}
                selectedElementIds={selection.elementIds}
                onLayerSelect={setActiveLayerId}
                onElementSelect={handleSelectionChange}
                onLayerAdd={handleLayerAdd}
                onLayerRemove={handleLayerRemove}
                onLayerVisibilityChange={handleLayerVisibilityChange}
                onLayerLockChange={handleLayerLockChange}
                onLayerRename={handleLayerRename}
                onLayerReorder={handleLayerReorder}
                onElementVisibilityChange={handleElementVisibilityChange}
                onElementLockChange={handleElementLockChange}
                onElementDelete={handleElementDelete}
                onElementDuplicate={handleElementDuplicate}
              />
            </div>
          )}

          {/* Properties Panel */}
          {showPropertiesPanel && (
            <div className="flex-1 overflow-hidden">
              <PropertiesPanel
                selectedElements={selectedElements}
                onElementUpdate={handleElementUpdate}
              />
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar
        view={view}
        document={document}
        selectedCount={selection.elementIds.length}
        onZoomChange={handleZoomChange}
        onFitToWindow={handleFitToWindow}
      />
    </div>
  );
}

// ============================================================================
// App Icon
// ============================================================================

export function ZDrawIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="zdraw-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#zdraw-grad)" />
      {/* Pen nib icon */}
      <g stroke="white" strokeWidth="2" fill="none" opacity="0.9">
        {/* Pen body */}
        <path d="M20 44 L32 12 L44 44" strokeLinejoin="round" />
        {/* Pen tip */}
        <path d="M32 44 L32 52" strokeLinecap="round" />
        {/* Bezier curve indicator */}
        <path d="M16 32 Q32 16 48 32" strokeDasharray="3 2" opacity="0.6" />
        {/* Control point dots */}
        <circle cx="16" cy="32" r="2" fill="white" stroke="none" />
        <circle cx="48" cy="32" r="2" fill="white" stroke="none" />
        <circle cx="32" cy="16" r="2" fill="white" stroke="none" opacity="0.6" />
      </g>
    </svg>
  );
}

// ============================================================================
// Default export for zOS app loader
// ============================================================================

export default ZDrawApp;
