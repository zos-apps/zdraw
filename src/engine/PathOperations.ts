/**
 * PathOperations - Boolean operations on paths
 *
 * Implements union, subtract, intersect, and exclude operations.
 * Uses a simplified polygon-based algorithm.
 */

import type { Point, PathCommand, PathElement, VectorElement, Bounds } from '../types';
import { generateId, createTransform, createColor } from '../types';

// ============================================================================
// Path to Points Conversion
// ============================================================================

/**
 * Flatten path commands to a series of points
 * Bezier curves are approximated with line segments
 */
export function pathToPoints(commands: PathCommand[], resolution = 10): Point[] {
  const points: Point[] = [];
  let currentX = 0;
  let currentY = 0;
  let startX = 0;
  let startY = 0;

  for (const cmd of commands) {
    switch (cmd.type) {
      case 'M':
        currentX = cmd.x;
        currentY = cmd.y;
        startX = currentX;
        startY = currentY;
        points.push({ x: currentX, y: currentY });
        break;

      case 'L':
        points.push({ x: cmd.x, y: cmd.y });
        currentX = cmd.x;
        currentY = cmd.y;
        break;

      case 'H':
        points.push({ x: cmd.x, y: currentY });
        currentX = cmd.x;
        break;

      case 'V':
        points.push({ x: currentX, y: cmd.y });
        currentY = cmd.y;
        break;

      case 'C':
        // Cubic bezier - approximate with line segments
        for (let t = 1; t <= resolution; t++) {
          const tNorm = t / resolution;
          const point = cubicBezierPoint(
            { x: currentX, y: currentY },
            { x: cmd.x1, y: cmd.y1 },
            { x: cmd.x2, y: cmd.y2 },
            { x: cmd.x, y: cmd.y },
            tNorm
          );
          points.push(point);
        }
        currentX = cmd.x;
        currentY = cmd.y;
        break;

      case 'Q':
        // Quadratic bezier - approximate with line segments
        for (let t = 1; t <= resolution; t++) {
          const tNorm = t / resolution;
          const point = quadraticBezierPoint(
            { x: currentX, y: currentY },
            { x: cmd.x1, y: cmd.y1 },
            { x: cmd.x, y: cmd.y },
            tNorm
          );
          points.push(point);
        }
        currentX = cmd.x;
        currentY = cmd.y;
        break;

      case 'Z':
        if (currentX !== startX || currentY !== startY) {
          points.push({ x: startX, y: startY });
        }
        currentX = startX;
        currentY = startY;
        break;

      // For simplicity, handle other commands as line-to
      case 'S':
      case 'T':
        points.push({ x: cmd.x, y: cmd.y });
        currentX = cmd.x;
        currentY = cmd.y;
        break;

      case 'A':
        // Arc - simplified as line to endpoint
        points.push({ x: cmd.x, y: cmd.y });
        currentX = cmd.x;
        currentY = cmd.y;
        break;
    }
  }

  return points;
}

/**
 * Convert points back to path commands
 */
export function pointsToPath(points: Point[], closed = true): PathCommand[] {
  if (points.length === 0) return [];

  const commands: PathCommand[] = [{ type: 'M', x: points[0].x, y: points[0].y }];

  for (let i = 1; i < points.length; i++) {
    commands.push({ type: 'L', x: points[i].x, y: points[i].y });
  }

  if (closed) {
    commands.push({ type: 'Z' });
  }

  return commands;
}

// ============================================================================
// Bezier Curve Utilities
// ============================================================================

function cubicBezierPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const t2 = t * t;
  const t3 = t2 * t;
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;

  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
  };
}

function quadraticBezierPoint(p0: Point, p1: Point, p2: Point, t: number): Point {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;

  return {
    x: mt2 * p0.x + 2 * mt * t * p1.x + t2 * p2.x,
    y: mt2 * p0.y + 2 * mt * t * p1.y + t2 * p2.y,
  };
}

// ============================================================================
// Polygon Operations
// ============================================================================

/**
 * Check if a point is inside a polygon using ray casting
 */
export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    if (yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Get polygon area (positive = clockwise, negative = counter-clockwise)
 */
export function polygonArea(polygon: Point[]): number {
  let area = 0;
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i].x * polygon[j].y;
    area -= polygon[j].x * polygon[i].y;
  }

  return area / 2;
}

/**
 * Check if polygon is clockwise
 */
export function isClockwise(polygon: Point[]): boolean {
  return polygonArea(polygon) > 0;
}

/**
 * Reverse polygon winding
 */
export function reversePolygon(polygon: Point[]): Point[] {
  return [...polygon].reverse();
}

// ============================================================================
// Line Segment Intersection
// ============================================================================

interface Intersection {
  point: Point;
  t1: number; // Parameter on first segment (0-1)
  t2: number; // Parameter on second segment (0-1)
}

function lineIntersection(p1: Point, p2: Point, p3: Point, p4: Point): Intersection | null {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;

  const cross = d1x * d2y - d1y * d2x;

  if (Math.abs(cross) < 1e-10) {
    return null; // Parallel lines
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

// ============================================================================
// Boolean Operations
// ============================================================================

/**
 * Find all intersection points between two polygons
 */
function findIntersections(poly1: Point[], poly2: Point[]): Point[] {
  const intersections: Point[] = [];

  for (let i = 0; i < poly1.length; i++) {
    const p1 = poly1[i];
    const p2 = poly1[(i + 1) % poly1.length];

    for (let j = 0; j < poly2.length; j++) {
      const p3 = poly2[j];
      const p4 = poly2[(j + 1) % poly2.length];

      const intersection = lineIntersection(p1, p2, p3, p4);
      if (intersection) {
        intersections.push(intersection.point);
      }
    }
  }

  return intersections;
}

/**
 * Union of two polygons (simplified algorithm)
 */
export function unionPolygons(poly1: Point[], poly2: Point[]): Point[][] {
  // Simplified: if no intersections and one contains the other, return container
  const intersections = findIntersections(poly1, poly2);

  if (intersections.length === 0) {
    // Check containment
    if (poly1.length > 0 && pointInPolygon(poly1[0], poly2)) {
      return [poly2];
    }
    if (poly2.length > 0 && pointInPolygon(poly2[0], poly1)) {
      return [poly1];
    }
    // Disjoint - return both
    return [poly1, poly2];
  }

  // For complex cases, use convex hull as approximation
  return [convexHull([...poly1, ...poly2])];
}

/**
 * Subtract poly2 from poly1 (simplified)
 */
export function subtractPolygons(poly1: Point[], poly2: Point[]): Point[][] {
  const intersections = findIntersections(poly1, poly2);

  if (intersections.length === 0) {
    // Check if poly2 is completely inside poly1
    if (poly2.length > 0 && pointInPolygon(poly2[0], poly1)) {
      // Create a hole - return original with inner polygon reversed
      return [poly1]; // Simplified - full implementation would handle holes
    }
    // Check if poly1 is completely inside poly2
    if (poly1.length > 0 && pointInPolygon(poly1[0], poly2)) {
      return []; // Completely subtracted
    }
    // Disjoint - return original
    return [poly1];
  }

  // Complex case - simplified by returning points outside poly2
  const result: Point[] = [];
  for (const p of poly1) {
    if (!pointInPolygon(p, poly2)) {
      result.push(p);
    }
  }
  return result.length > 2 ? [result] : [];
}

/**
 * Intersect two polygons (simplified)
 */
export function intersectPolygons(poly1: Point[], poly2: Point[]): Point[][] {
  const intersections = findIntersections(poly1, poly2);

  if (intersections.length === 0) {
    // Check containment
    if (poly1.length > 0 && pointInPolygon(poly1[0], poly2)) {
      return [poly1];
    }
    if (poly2.length > 0 && pointInPolygon(poly2[0], poly1)) {
      return [poly2];
    }
    // Disjoint
    return [];
  }

  // Complex case - return points inside both
  const result: Point[] = [];

  for (const p of poly1) {
    if (pointInPolygon(p, poly2)) {
      result.push(p);
    }
  }

  for (const p of poly2) {
    if (pointInPolygon(p, poly1)) {
      result.push(p);
    }
  }

  result.push(...intersections);

  return result.length > 2 ? [convexHull(result)] : [];
}

/**
 * Exclude (XOR) two polygons (simplified)
 */
export function excludePolygons(poly1: Point[], poly2: Point[]): Point[][] {
  // XOR = Union - Intersection
  const subtracted1 = subtractPolygons(poly1, poly2);
  const subtracted2 = subtractPolygons(poly2, poly1);
  return [...subtracted1, ...subtracted2];
}

// ============================================================================
// Convex Hull (Graham Scan)
// ============================================================================

function convexHull(points: Point[]): Point[] {
  if (points.length < 3) return [...points];

  // Find lowest point
  let lowest = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].y < points[lowest].y || (points[i].y === points[lowest].y && points[i].x < points[lowest].x)) {
      lowest = i;
    }
  }

  // Swap to first position
  [points[0], points[lowest]] = [points[lowest], points[0]];
  const pivot = points[0];

  // Sort by polar angle
  const sorted = points.slice(1).sort((a, b) => {
    const angleA = Math.atan2(a.y - pivot.y, a.x - pivot.x);
    const angleB = Math.atan2(b.y - pivot.y, b.x - pivot.x);
    return angleA - angleB;
  });

  // Build hull
  const hull: Point[] = [pivot];

  for (const point of sorted) {
    while (hull.length >= 2) {
      const top = hull[hull.length - 1];
      const second = hull[hull.length - 2];
      const cross = (top.x - second.x) * (point.y - second.y) - (top.y - second.y) * (point.x - second.x);

      if (cross <= 0) {
        hull.pop();
      } else {
        break;
      }
    }
    hull.push(point);
  }

  return hull;
}

// ============================================================================
// Path Boolean Operations API
// ============================================================================

export type PathOperation = 'union' | 'subtract' | 'intersect' | 'exclude';

export function performPathOperation(
  path1: PathElement,
  path2: PathElement,
  operation: PathOperation
): PathElement | null {
  const poly1 = pathToPoints(path1.commands);
  const poly2 = pathToPoints(path2.commands);

  let resultPolygons: Point[][];

  switch (operation) {
    case 'union':
      resultPolygons = unionPolygons(poly1, poly2);
      break;
    case 'subtract':
      resultPolygons = subtractPolygons(poly1, poly2);
      break;
    case 'intersect':
      resultPolygons = intersectPolygons(poly1, poly2);
      break;
    case 'exclude':
      resultPolygons = excludePolygons(poly1, poly2);
      break;
  }

  if (resultPolygons.length === 0) return null;

  // Combine all result polygons into a single path
  const commands: PathCommand[] = [];
  for (const poly of resultPolygons) {
    commands.push(...pointsToPath(poly, true));
  }

  return {
    id: generateId(),
    type: 'path',
    name: `${operation.charAt(0).toUpperCase() + operation.slice(1)} Result`,
    visible: true,
    locked: false,
    opacity: 1,
    transform: createTransform(),
    fill: path1.fill,
    stroke: path1.stroke,
    commands,
    closed: true,
  };
}

// ============================================================================
// Path Utilities
// ============================================================================

/**
 * Offset a path (expand/contract)
 */
export function offsetPath(commands: PathCommand[], offset: number): PathCommand[] {
  const points = pathToPoints(commands);
  if (points.length < 3) return commands;

  const offsetPoints: Point[] = [];

  for (let i = 0; i < points.length; i++) {
    const prev = points[(i - 1 + points.length) % points.length];
    const curr = points[i];
    const next = points[(i + 1) % points.length];

    // Calculate normals
    const n1 = normalize({ x: -(curr.y - prev.y), y: curr.x - prev.x });
    const n2 = normalize({ x: -(next.y - curr.y), y: next.x - curr.x });

    // Average normal
    const avgNormal = normalize({ x: n1.x + n2.x, y: n1.y + n2.y });

    offsetPoints.push({
      x: curr.x + avgNormal.x * offset,
      y: curr.y + avgNormal.y * offset,
    });
  }

  return pointsToPath(offsetPoints, true);
}

function normalize(v: Point): Point {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

/**
 * Simplify a path by removing points that are close to a line between neighbors
 */
export function simplifyPath(commands: PathCommand[], tolerance: number): PathCommand[] {
  const points = pathToPoints(commands);
  if (points.length < 3) return commands;

  const simplified = ramerDouglasPeucker(points, tolerance);
  return pointsToPath(simplified, commands.some((c) => c.type === 'Z'));
}

function ramerDouglasPeucker(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return points;

  // Find the point with maximum distance
  let maxDist = 0;
  let maxIndex = 0;

  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], start, end);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  if (maxDist > epsilon) {
    const left = ramerDouglasPeucker(points.slice(0, maxIndex + 1), epsilon);
    const right = ramerDouglasPeucker(points.slice(maxIndex), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  return [start, end];
}

function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  if (dx === 0 && dy === 0) {
    return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
  }

  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);

  const nearestX = lineStart.x + t * dx;
  const nearestY = lineStart.y + t * dy;

  return Math.sqrt((point.x - nearestX) ** 2 + (point.y - nearestY) ** 2);
}
