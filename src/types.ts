/**
 * zDraw Vector Graphics Types
 *
 * Core type definitions for vector graphics primitives, paths, shapes,
 * and document structure.
 */

// ============================================================================
// Primitives
// ============================================================================

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Transform {
  translateX: number;
  translateY: number;
  rotation: number; // degrees
  scaleX: number;
  scaleY: number;
  originX: number;
  originY: number;
}

// ============================================================================
// Colors and Gradients
// ============================================================================

export interface Color {
  r: number; // 0-255
  g: number;
  b: number;
  a: number; // 0-1
}

export interface GradientStop {
  offset: number; // 0-1
  color: Color;
}

export interface LinearGradient {
  type: 'linear';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stops: GradientStop[];
}

export interface RadialGradient {
  type: 'radial';
  cx: number;
  cy: number;
  r: number;
  fx?: number;
  fy?: number;
  stops: GradientStop[];
}

export type Gradient = LinearGradient | RadialGradient;

export type Fill = Color | Gradient | null;

// ============================================================================
// Stroke
// ============================================================================

export type LineCap = 'butt' | 'round' | 'square';
export type LineJoin = 'miter' | 'round' | 'bevel';

export interface Stroke {
  color: Color;
  width: number;
  cap: LineCap;
  join: LineJoin;
  dashArray: number[];
  dashOffset: number;
  miterLimit: number;
}

// ============================================================================
// Path Commands (SVG-compatible)
// ============================================================================

export interface MoveToCommand {
  type: 'M';
  x: number;
  y: number;
}

export interface LineToCommand {
  type: 'L';
  x: number;
  y: number;
}

export interface HorizontalLineCommand {
  type: 'H';
  x: number;
}

export interface VerticalLineCommand {
  type: 'V';
  y: number;
}

export interface CubicBezierCommand {
  type: 'C';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x: number;
  y: number;
}

export interface SmoothCubicCommand {
  type: 'S';
  x2: number;
  y2: number;
  x: number;
  y: number;
}

export interface QuadraticBezierCommand {
  type: 'Q';
  x1: number;
  y1: number;
  x: number;
  y: number;
}

export interface SmoothQuadraticCommand {
  type: 'T';
  x: number;
  y: number;
}

export interface ArcCommand {
  type: 'A';
  rx: number;
  ry: number;
  angle: number;
  largeArc: boolean;
  sweep: boolean;
  x: number;
  y: number;
}

export interface ClosePathCommand {
  type: 'Z';
}

export type PathCommand =
  | MoveToCommand
  | LineToCommand
  | HorizontalLineCommand
  | VerticalLineCommand
  | CubicBezierCommand
  | SmoothCubicCommand
  | QuadraticBezierCommand
  | SmoothQuadraticCommand
  | ArcCommand
  | ClosePathCommand;

// ============================================================================
// Vector Elements
// ============================================================================

export type ElementType = 'path' | 'rect' | 'ellipse' | 'polygon' | 'star' | 'text' | 'group';

export interface BaseElement {
  id: string;
  type: ElementType;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  transform: Transform;
  fill: Fill;
  stroke: Stroke | null;
}

export interface PathElement extends BaseElement {
  type: 'path';
  commands: PathCommand[];
  closed: boolean;
}

export interface RectElement extends BaseElement {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
  ry: number;
}

export interface EllipseElement extends BaseElement {
  type: 'ellipse';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface PolygonElement extends BaseElement {
  type: 'polygon';
  points: Point[];
}

export interface StarElement extends BaseElement {
  type: 'star';
  cx: number;
  cy: number;
  points: number;
  outerRadius: number;
  innerRadius: number;
  rotation: number;
}

export interface TextElement extends BaseElement {
  type: 'text';
  x: number;
  y: number;
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  textAnchor: 'start' | 'middle' | 'end';
  lineHeight: number;
}

export interface GroupElement extends Omit<BaseElement, 'fill' | 'stroke'> {
  type: 'group';
  fill: null;
  stroke: null;
  children: VectorElement[];
}

export type VectorElement =
  | PathElement
  | RectElement
  | EllipseElement
  | PolygonElement
  | StarElement
  | TextElement
  | GroupElement;

// ============================================================================
// Layers
// ============================================================================

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  elements: VectorElement[];
  collapsed: boolean;
}

// ============================================================================
// Document
// ============================================================================

export interface Document {
  id: string;
  name: string;
  width: number;
  height: number;
  background: Color;
  layers: Layer[];
  guides: Guide[];
  artboards?: Artboard[];
}

export interface Guide {
  id: string;
  type: 'horizontal' | 'vertical';
  position: number;
}

export interface Artboard {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  background: Color;
}

// ============================================================================
// Tools
// ============================================================================

export type ToolType =
  | 'select'
  | 'direct-select'
  | 'pen'
  | 'pencil'
  | 'rectangle'
  | 'ellipse'
  | 'polygon'
  | 'star'
  | 'line'
  | 'text'
  | 'eyedropper'
  | 'hand'
  | 'zoom'
  | 'scissors'
  | 'knife'
  | 'add-anchor'
  | 'delete-anchor';

export interface Tool {
  id: ToolType;
  name: string;
  shortcut: string;
  cursor: string;
}

// ============================================================================
// Selection
// ============================================================================

export interface Selection {
  elementIds: string[];
  bounds: Bounds | null;
}

export interface HandleType {
  type: 'corner' | 'edge' | 'rotation' | 'anchor' | 'control';
  position: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate';
}

// ============================================================================
// History (Undo/Redo)
// ============================================================================

export interface HistoryEntry {
  id: string;
  description: string;
  timestamp: number;
  document: Document;
}

// ============================================================================
// Application State
// ============================================================================

export interface ViewState {
  zoom: number;
  panX: number;
  panY: number;
  showGrid: boolean;
  showGuides: boolean;
  snapToGrid: boolean;
  snapToGuides: boolean;
  gridSize: number;
}

export interface EditorState {
  document: Document;
  selection: Selection;
  activeLayerId: string;
  activeTool: ToolType;
  view: ViewState;
  history: HistoryEntry[];
  historyIndex: number;
  clipboardElements: VectorElement[];
}

// ============================================================================
// Path Operations
// ============================================================================

export type PathOperation = 'union' | 'subtract' | 'intersect' | 'exclude';

// ============================================================================
// Utility Functions
// ============================================================================

export function createColor(r: number, g: number, b: number, a = 1): Color {
  return { r, g, b, a };
}

export function colorToHex(color: Color): string {
  const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${hex(color.r)}${hex(color.g)}${hex(color.b)}`;
}

export function colorToRgba(color: Color): string {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
}

export function hexToColor(hex: string): Color {
  const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!match) return { r: 0, g: 0, b: 0, a: 1 };
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
    a: 1,
  };
}

export function createTransform(): Transform {
  return {
    translateX: 0,
    translateY: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    originX: 0,
    originY: 0,
  };
}

export function createStroke(color: Color = { r: 0, g: 0, b: 0, a: 1 }): Stroke {
  return {
    color,
    width: 1,
    cap: 'round',
    join: 'round',
    dashArray: [],
    dashOffset: 0,
    miterLimit: 10,
  };
}

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}
