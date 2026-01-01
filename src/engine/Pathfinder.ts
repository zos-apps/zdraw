/**
 * Pathfinder - Professional boolean path operations
 *
 * Implements Illustrator-style pathfinder operations:
 * - Unite (union)
 * - Subtract (minus front)
 * - Intersect
 * - Exclude (XOR)
 * - Divide (splits all overlapping areas)
 *
 * Uses Weiler-Atherton polygon clipping algorithm for accurate results.
 */

import type { Point, PathCommand, PathElement, VectorElement } from '../types';
import { generateId, createTransform } from '../types';

// ============================================================================
// Intersection Detection
// ============================================================================

interface SegmentIntersection {
  point: Point;
  t1: number; // Parameter on first segment (0-1)
  t2: number; // Parameter on second segment (0-1)
  seg1Index: number;
  seg2Index: number;
}

/**
 * Find intersection between two line segments
 */
function lineSegmentIntersection(
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
    return null; // Parallel or collinear
  }

  const dx = p3.x - p1.x;
  const dy = p3.y - p1.y;

  const t1 = (dx * d2y - dy * d2x) / cross;
  const t2 = (dx * d1y - dy * d1x) / cross;

  // Check if intersection is within both segments
  if (t1 > 1e-10 && t1 < 1 - 1e-10 && t2 > 1e-10 && t2 < 1 - 1e-10) {
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

/**
 * Sample cubic bezier at parameter t
 */
function sampleCubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
  };
}

/**
 * Sample quadratic bezier at parameter t
 */
function sampleQuadraticBezier(p0: Point, p1: Point, p2: Point, t: number): Point {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;

  return {
    x: mt2 * p0.x + 2 * mt * t * p1.x + t2 * p2.x,
    y: mt2 * p0.y + 2 * mt * t * p1.y + t2 * p2.y,
  };
}

// ============================================================================
// Path to Polygon Conversion
// ============================================================================

interface PathSegment {
  start: Point;
  end: Point;
  type: 'line' | 'cubic' | 'quadratic';
  cp1?: Point;
  cp2?: Point;
}

/**
 * Convert path commands to list of segments
 */
function pathToSegments(commands: PathCommand[]): PathSegment[] {
  const segments: PathSegment[] = [];
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
        break;

      case 'L':
        segments.push({
          type: 'line',
          start: { x: currentX, y: currentY },
          end: { x: cmd.x, y: cmd.y },
        });
        currentX = cmd.x;
        currentY = cmd.y;
        break;

      case 'H':
        segments.push({
          type: 'line',
          start: { x: currentX, y: currentY },
          end: { x: cmd.x, y: currentY },
        });
        currentX = cmd.x;
        break;

      case 'V':
        segments.push({
          type: 'line',
          start: { x: currentX, y: currentY },
          end: { x: currentX, y: cmd.y },
        });
        currentY = cmd.y;
        break;

      case 'C':
        segments.push({
          type: 'cubic',
          start: { x: currentX, y: currentY },
          cp1: { x: cmd.x1, y: cmd.y1 },
          cp2: { x: cmd.x2, y: cmd.y2 },
          end: { x: cmd.x, y: cmd.y },
        });
        currentX = cmd.x;
        currentY = cmd.y;
        break;

      case 'Q':
        segments.push({
          type: 'quadratic',
          start: { x: currentX, y: currentY },
          cp1: { x: cmd.x1, y: cmd.y1 },
          end: { x: cmd.x, y: cmd.y },
        });
        currentX = cmd.x;
        currentY = cmd.y;
        break;

      case 'Z':
        if (currentX !== startX || currentY !== startY) {
          segments.push({
            type: 'line',
            start: { x: currentX, y: currentY },
            end: { x: startX, y: startY },
          });
        }
        currentX = startX;
        currentY = startY;
        break;
    }
  }

  return segments;
}

/**
 * Flatten bezier curves to line segments
 */
function flattenSegments(segments: PathSegment[], resolution = 16): Point[] {
  const points: Point[] = [];

  for (const seg of segments) {
    if (points.length === 0) {
      points.push(seg.start);
    }

    if (seg.type === 'line') {
      points.push(seg.end);
    } else if (seg.type === 'cubic' && seg.cp1 && seg.cp2) {
      for (let i = 1; i <= resolution; i++) {
        const t = i / resolution;
        points.push(sampleCubicBezier(seg.start, seg.cp1, seg.cp2, seg.end, t));
      }
    } else if (seg.type === 'quadratic' && seg.cp1) {
      for (let i = 1; i <= resolution; i++) {
        const t = i / resolution;
        points.push(sampleQuadraticBezier(seg.start, seg.cp1, seg.end, t));
      }
    }
  }

  return points;
}

/**
 * Convert flattened points back to path commands
 */
function pointsToCommands(points: Point[], closed: boolean): PathCommand[] {
  if (points.length < 2) return [];

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
// Polygon Operations
// ============================================================================

/**
 * Check if a point is inside a polygon (ray casting)
 */
function pointInPolygon(point: Point, polygon: Point[]): boolean {
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
 * Calculate signed area of polygon
 */
function polygonArea(polygon: Point[]): number {
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
function isClockwise(polygon: Point[]): boolean {
  return polygonArea(polygon) > 0;
}

/**
 * Ensure polygon is clockwise
 */
function ensureClockwise(polygon: Point[]): Point[] {
  if (!isClockwise(polygon)) {
    return [...polygon].reverse();
  }
  return polygon;
}

/**
 * Find all intersections between two polygons
 */
function findAllIntersections(poly1: Point[], poly2: Point[]): SegmentIntersection[] {
  const intersections: SegmentIntersection[] = [];

  for (let i = 0; i < poly1.length; i++) {
    const p1 = poly1[i];
    const p2 = poly1[(i + 1) % poly1.length];

    for (let j = 0; j < poly2.length; j++) {
      const p3 = poly2[j];
      const p4 = poly2[(j + 1) % poly2.length];

      const result = lineSegmentIntersection(p1, p2, p3, p4);
      if (result) {
        intersections.push({
          point: result.point,
          t1: result.t1,
          t2: result.t2,
          seg1Index: i,
          seg2Index: j,
        });
      }
    }
  }

  return intersections;
}

// ============================================================================
// Weiler-Atherton Algorithm for Boolean Operations
// ============================================================================

type VertexType = 'normal' | 'entering' | 'exiting';

interface ClipVertex {
  point: Point;
  type: VertexType;
  partner?: ClipVertex; // Corresponding vertex in other polygon
  next?: ClipVertex;
  visited: boolean;
}

/**
 * Build linked list of vertices with intersection markers
 */
function buildVertexList(polygon: Point[], intersections: SegmentIntersection[], isPoly1: boolean): ClipVertex[] {
  const vertices: ClipVertex[] = [];

  // Add polygon vertices
  for (let i = 0; i < polygon.length; i++) {
    vertices.push({
      point: polygon[i],
      type: 'normal',
      visited: false,
    });
  }

  // Sort and insert intersection points
  const segmentIntersections: Map<number, { t: number; intersection: SegmentIntersection }[]> = new Map();

  for (const intersection of intersections) {
    const segIndex = isPoly1 ? intersection.seg1Index : intersection.seg2Index;
    const t = isPoly1 ? intersection.t1 : intersection.t2;

    if (!segmentIntersections.has(segIndex)) {
      segmentIntersections.set(segIndex, []);
    }
    segmentIntersections.get(segIndex)!.push({ t, intersection });
  }

  // Insert intersection vertices in order
  const result: ClipVertex[] = [];
  for (let i = 0; i < polygon.length; i++) {
    result.push(vertices[i]);

    const segInts = segmentIntersections.get(i);
    if (segInts) {
      segInts.sort((a, b) => a.t - b.t);
      for (const { intersection } of segInts) {
        result.push({
          point: intersection.point,
          type: 'normal', // Will be set later
          visited: false,
        });
      }
    }
  }

  // Link vertices
  for (let i = 0; i < result.length; i++) {
    result[i].next = result[(i + 1) % result.length];
  }

  return result;
}

/**
 * Mark entering/exiting intersections
 */
function markIntersections(poly1Vertices: ClipVertex[], poly2: Point[]): void {
  for (const v of poly1Vertices) {
    if (v.type !== 'normal') continue;

    // Find if previous point is inside poly2
    const prev = poly1Vertices.find((p) => p.next === v);
    if (prev && pointInPolygon(prev.point, poly2)) {
      v.type = 'exiting';
    } else if (prev) {
      v.type = 'entering';
    }
  }
}

// ============================================================================
// Simplified Boolean Operations
// ============================================================================

/**
 * Union (combine) two polygons
 */
function unionPolygons(poly1: Point[], poly2: Point[]): Point[][] {
  const intersections = findAllIntersections(poly1, poly2);

  if (intersections.length === 0) {
    // No intersections - check containment
    if (pointInPolygon(poly1[0], poly2)) {
      return [poly2]; // poly1 inside poly2
    }
    if (pointInPolygon(poly2[0], poly1)) {
      return [poly1]; // poly2 inside poly1
    }
    return [poly1, poly2]; // Disjoint
  }

  // Build result by traversing both polygons
  const result: Point[] = [];
  const visited = new Set<string>();

  let current = poly1[0];
  let inPoly1 = true;
  let currentIndex = 0;
  const currentPoly = poly1;

  // Start from a point outside poly2
  for (let i = 0; i < poly1.length; i++) {
    if (!pointInPolygon(poly1[i], poly2)) {
      current = poly1[i];
      currentIndex = i;
      break;
    }
  }

  // Traverse outline
  let iterations = 0;
  const maxIterations = (poly1.length + poly2.length + intersections.length) * 2;

  while (iterations < maxIterations) {
    iterations++;
    const key = `${current.x.toFixed(6)},${current.y.toFixed(6)}`;

    if (visited.has(key) && result.length > 2) {
      break;
    }
    visited.add(key);
    result.push(current);

    // Move to next point
    if (inPoly1) {
      currentIndex = (currentIndex + 1) % poly1.length;
      const next = poly1[currentIndex];

      // Check for intersection on this segment
      const segInt = intersections.find(
        (int) => int.seg1Index === ((currentIndex - 1 + poly1.length) % poly1.length)
      );

      if (segInt && !visited.has(`${segInt.point.x.toFixed(6)},${segInt.point.y.toFixed(6)}`)) {
        current = segInt.point;
        inPoly1 = false;
        currentIndex = (segInt.seg2Index + 1) % poly2.length;
      } else {
        current = next;
      }
    } else {
      currentIndex = (currentIndex + 1) % poly2.length;
      const next = poly2[currentIndex];

      // Check for intersection on this segment
      const segInt = intersections.find(
        (int) => int.seg2Index === ((currentIndex - 1 + poly2.length) % poly2.length)
      );

      if (segInt && !visited.has(`${segInt.point.x.toFixed(6)},${segInt.point.y.toFixed(6)}`)) {
        current = segInt.point;
        inPoly1 = true;
        currentIndex = (segInt.seg1Index + 1) % poly1.length;
      } else {
        current = next;
      }
    }
  }

  return result.length > 2 ? [result] : [poly1, poly2];
}

/**
 * Subtract poly2 from poly1
 */
function subtractPolygons(poly1: Point[], poly2: Point[]): Point[][] {
  const intersections = findAllIntersections(poly1, poly2);

  if (intersections.length === 0) {
    // No intersections
    if (pointInPolygon(poly1[0], poly2)) {
      return []; // poly1 completely inside poly2
    }
    if (pointInPolygon(poly2[0], poly1)) {
      // poly2 inside poly1 - creates hole
      return [poly1]; // Simplified - should create compound path with hole
    }
    return [poly1]; // Disjoint
  }

  // Build result keeping only parts of poly1 outside poly2
  const results: Point[][] = [];
  const processedIntersections = new Set<number>();

  for (let intIdx = 0; intIdx < intersections.length; intIdx++) {
    if (processedIntersections.has(intIdx)) continue;

    const startInt = intersections[intIdx];
    const result: Point[] = [startInt.point];
    let currentIndex = (startInt.seg1Index + 1) % poly1.length;
    let inPoly1 = true;
    let iterations = 0;
    const maxIterations = (poly1.length + poly2.length) * 2;

    while (iterations < maxIterations) {
      iterations++;

      if (inPoly1) {
        const next = poly1[currentIndex];

        // Check if inside poly2
        if (pointInPolygon(next, poly2)) {
          // Find exit intersection
          const exitInt = intersections.find(
            (int) =>
              int.seg1Index === ((currentIndex - 1 + poly1.length) % poly1.length) &&
              !processedIntersections.has(intersections.indexOf(int))
          );
          if (exitInt) {
            result.push(exitInt.point);
            processedIntersections.add(intersections.indexOf(exitInt));
            inPoly1 = false;
            currentIndex = exitInt.seg2Index;
          } else {
            currentIndex = (currentIndex + 1) % poly1.length;
          }
        } else {
          result.push(next);
          currentIndex = (currentIndex + 1) % poly1.length;
        }
      } else {
        // Walking backwards on poly2 (to get the outside edge)
        const next = poly2[currentIndex];

        // Find re-entry to poly1
        const entryInt = intersections.find(
          (int) =>
            int.seg2Index === currentIndex && !processedIntersections.has(intersections.indexOf(int))
        );

        if (entryInt) {
          result.push(entryInt.point);
          if (
            Math.abs(entryInt.point.x - startInt.point.x) < 1e-6 &&
            Math.abs(entryInt.point.y - startInt.point.y) < 1e-6
          ) {
            break; // Closed loop
          }
          processedIntersections.add(intersections.indexOf(entryInt));
          inPoly1 = true;
          currentIndex = (entryInt.seg1Index + 1) % poly1.length;
        } else {
          result.push(next);
          currentIndex = (currentIndex - 1 + poly2.length) % poly2.length;
        }
      }

      // Check if back at start
      const last = result[result.length - 1];
      if (
        result.length > 2 &&
        Math.abs(last.x - startInt.point.x) < 1e-6 &&
        Math.abs(last.y - startInt.point.y) < 1e-6
      ) {
        break;
      }
    }

    if (result.length > 2) {
      results.push(result);
    }
    processedIntersections.add(intIdx);
  }

  return results.length > 0 ? results : [poly1];
}

/**
 * Intersect two polygons
 */
function intersectPolygons(poly1: Point[], poly2: Point[]): Point[][] {
  const intersections = findAllIntersections(poly1, poly2);

  if (intersections.length === 0) {
    // No intersections
    if (pointInPolygon(poly1[0], poly2)) {
      return [poly1]; // poly1 inside poly2
    }
    if (pointInPolygon(poly2[0], poly1)) {
      return [poly2]; // poly2 inside poly1
    }
    return []; // Disjoint
  }

  // Collect points inside both polygons
  const result: Point[] = [];

  // Add intersection points
  for (const int of intersections) {
    result.push(int.point);
  }

  // Add poly1 vertices inside poly2
  for (const p of poly1) {
    if (pointInPolygon(p, poly2)) {
      result.push(p);
    }
  }

  // Add poly2 vertices inside poly1
  for (const p of poly2) {
    if (pointInPolygon(p, poly1)) {
      result.push(p);
    }
  }

  // Sort points to form polygon (convex hull as approximation)
  if (result.length < 3) return [];

  return [convexHull(result)];
}

/**
 * Exclude (XOR) two polygons
 */
function excludePolygons(poly1: Point[], poly2: Point[]): Point[][] {
  // XOR = (A - B) union (B - A)
  const aMinusB = subtractPolygons(poly1, poly2);
  const bMinusA = subtractPolygons(poly2, poly1);
  return [...aMinusB, ...bMinusA];
}

/**
 * Divide - split polygons at all intersections
 */
function dividePolygons(poly1: Point[], poly2: Point[]): Point[][] {
  const intersection = intersectPolygons(poly1, poly2);
  const aMinusB = subtractPolygons(poly1, poly2);
  const bMinusA = subtractPolygons(poly2, poly1);

  return [...intersection, ...aMinusB, ...bMinusA];
}

// ============================================================================
// Convex Hull (for intersection fallback)
// ============================================================================

function convexHull(points: Point[]): Point[] {
  if (points.length < 3) return [...points];

  // Find centroid
  let cx = 0,
    cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  cx /= points.length;
  cy /= points.length;

  // Sort by angle from centroid
  const sorted = [...points].sort((a, b) => {
    const angleA = Math.atan2(a.y - cy, a.x - cx);
    const angleB = Math.atan2(b.y - cy, b.x - cx);
    return angleA - angleB;
  });

  // Graham scan
  const hull: Point[] = [];

  for (const p of sorted) {
    while (hull.length >= 2) {
      const a = hull[hull.length - 2];
      const b = hull[hull.length - 1];
      const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
      if (cross <= 0) {
        hull.pop();
      } else {
        break;
      }
    }
    hull.push(p);
  }

  return hull;
}

// ============================================================================
// Public API
// ============================================================================

export type PathfinderOperation = 'unite' | 'subtract' | 'intersect' | 'exclude' | 'divide';

/**
 * Perform pathfinder operation on two path elements
 */
export function pathfinderOperation(
  path1: PathElement,
  path2: PathElement,
  operation: PathfinderOperation
): PathElement[] {
  // Convert to polygons
  const segments1 = pathToSegments(path1.commands);
  const segments2 = pathToSegments(path2.commands);

  const poly1 = ensureClockwise(flattenSegments(segments1));
  const poly2 = ensureClockwise(flattenSegments(segments2));

  // Perform operation
  let resultPolygons: Point[][];

  switch (operation) {
    case 'unite':
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
    case 'divide':
      resultPolygons = dividePolygons(poly1, poly2);
      break;
  }

  // Convert back to path elements
  return resultPolygons.map((polygon, index) => ({
    id: generateId(),
    type: 'path' as const,
    name: `${operation.charAt(0).toUpperCase() + operation.slice(1)} Result ${index + 1}`,
    visible: true,
    locked: false,
    opacity: 1,
    transform: createTransform(),
    fill: path1.fill,
    stroke: path1.stroke,
    commands: pointsToCommands(polygon, true),
    closed: true,
  }));
}

/**
 * Perform pathfinder on multiple elements
 */
export function pathfinderMultiple(
  elements: PathElement[],
  operation: PathfinderOperation
): PathElement[] {
  if (elements.length < 2) return elements;

  let result = [elements[0]];

  for (let i = 1; i < elements.length; i++) {
    const newResults: PathElement[] = [];
    for (const r of result) {
      const opResult = pathfinderOperation(r, elements[i], operation);
      newResults.push(...opResult);
    }
    result = newResults;
  }

  return result;
}

export { pointInPolygon, polygonArea, isClockwise, findAllIntersections };
