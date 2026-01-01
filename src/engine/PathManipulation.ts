/**
 * PathManipulation - Advanced path editing operations
 *
 * Implements:
 * - Offset path (expand/contract)
 * - Smooth path
 * - Simplify path
 * - Join paths
 * - Split paths
 * - Convert anchor points (smooth/corner)
 * - Add/delete anchor points
 */

import type { Point, PathCommand, PathElement } from '../types';
import { generateId, createTransform } from '../types';

// ============================================================================
// Geometry Utilities
// ============================================================================

function distance(p1: Point, p2: Point): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

function normalize(v: Point): Point {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

function perpendicular(v: Point): Point {
  return { x: -v.y, y: v.x };
}

function add(p1: Point, p2: Point): Point {
  return { x: p1.x + p2.x, y: p1.y + p2.y };
}

function subtract(p1: Point, p2: Point): Point {
  return { x: p1.x - p2.x, y: p1.y - p2.y };
}

function scale(p: Point, s: number): Point {
  return { x: p.x * s, y: p.y * s };
}

function lerp(p1: Point, p2: Point, t: number): Point {
  return {
    x: p1.x + (p2.x - p1.x) * t,
    y: p1.y + (p2.y - p1.y) * t,
  };
}

// ============================================================================
// Path to Points Conversion
// ============================================================================

interface AnchorPoint {
  anchor: Point;
  handleIn: Point | null;
  handleOut: Point | null;
  type: 'corner' | 'smooth' | 'symmetric';
}

/**
 * Convert path commands to anchor points
 */
export function commandsToAnchorPoints(commands: PathCommand[]): AnchorPoint[] {
  const points: AnchorPoint[] = [];
  let currentX = 0;
  let currentY = 0;
  let lastHandleOut: Point | null = null;

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];

    switch (cmd.type) {
      case 'M':
        points.push({
          anchor: { x: cmd.x, y: cmd.y },
          handleIn: null,
          handleOut: null,
          type: 'corner',
        });
        currentX = cmd.x;
        currentY = cmd.y;
        break;

      case 'L':
        points.push({
          anchor: { x: cmd.x, y: cmd.y },
          handleIn: null,
          handleOut: null,
          type: 'corner',
        });
        currentX = cmd.x;
        currentY = cmd.y;
        break;

      case 'C':
        // Update previous point's handleOut
        if (points.length > 0) {
          points[points.length - 1].handleOut = { x: cmd.x1, y: cmd.y1 };
        }
        points.push({
          anchor: { x: cmd.x, y: cmd.y },
          handleIn: { x: cmd.x2, y: cmd.y2 },
          handleOut: null,
          type: 'smooth',
        });
        currentX = cmd.x;
        currentY = cmd.y;
        break;

      case 'Q':
        if (points.length > 0) {
          points[points.length - 1].handleOut = { x: cmd.x1, y: cmd.y1 };
        }
        points.push({
          anchor: { x: cmd.x, y: cmd.y },
          handleIn: { x: cmd.x1, y: cmd.y1 },
          handleOut: null,
          type: 'smooth',
        });
        currentX = cmd.x;
        currentY = cmd.y;
        break;

      case 'H':
        points.push({
          anchor: { x: cmd.x, y: currentY },
          handleIn: null,
          handleOut: null,
          type: 'corner',
        });
        currentX = cmd.x;
        break;

      case 'V':
        points.push({
          anchor: { x: currentX, y: cmd.y },
          handleIn: null,
          handleOut: null,
          type: 'corner',
        });
        currentY = cmd.y;
        break;

      case 'Z':
        // Close path - don't add point
        break;
    }
  }

  return points;
}

/**
 * Convert anchor points back to path commands
 */
export function anchorPointsToCommands(points: AnchorPoint[], closed: boolean): PathCommand[] {
  if (points.length === 0) return [];

  const commands: PathCommand[] = [];

  // Start with moveTo
  commands.push({ type: 'M', x: points[0].anchor.x, y: points[0].anchor.y });

  // Add segments
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    if (prev.handleOut && curr.handleIn) {
      // Cubic bezier
      commands.push({
        type: 'C',
        x1: prev.handleOut.x,
        y1: prev.handleOut.y,
        x2: curr.handleIn.x,
        y2: curr.handleIn.y,
        x: curr.anchor.x,
        y: curr.anchor.y,
      });
    } else if (prev.handleOut) {
      // Quadratic with handleOut only
      commands.push({
        type: 'Q',
        x1: prev.handleOut.x,
        y1: prev.handleOut.y,
        x: curr.anchor.x,
        y: curr.anchor.y,
      });
    } else if (curr.handleIn) {
      // Quadratic with handleIn only
      commands.push({
        type: 'Q',
        x1: curr.handleIn.x,
        y1: curr.handleIn.y,
        x: curr.anchor.x,
        y: curr.anchor.y,
      });
    } else {
      // Straight line
      commands.push({ type: 'L', x: curr.anchor.x, y: curr.anchor.y });
    }
  }

  // Close path if needed
  if (closed && points.length > 1) {
    const last = points[points.length - 1];
    const first = points[0];

    if (last.handleOut || first.handleIn) {
      if (last.handleOut && first.handleIn) {
        commands.push({
          type: 'C',
          x1: last.handleOut.x,
          y1: last.handleOut.y,
          x2: first.handleIn.x,
          y2: first.handleIn.y,
          x: first.anchor.x,
          y: first.anchor.y,
        });
      } else if (last.handleOut) {
        commands.push({
          type: 'Q',
          x1: last.handleOut.x,
          y1: last.handleOut.y,
          x: first.anchor.x,
          y: first.anchor.y,
        });
      }
    }
    commands.push({ type: 'Z' });
  }

  return commands;
}

// ============================================================================
// Offset Path
// ============================================================================

/**
 * Offset a path by a distance (positive = outward, negative = inward)
 */
export function offsetPath(element: PathElement, offset: number): PathElement {
  const points = commandsToAnchorPoints(element.commands);
  if (points.length < 2) return element;

  const offsetPoints: AnchorPoint[] = [];

  for (let i = 0; i < points.length; i++) {
    const prev = points[(i - 1 + points.length) % points.length];
    const curr = points[i];
    const next = points[(i + 1) % points.length];

    // Calculate direction vectors
    const dirIn = normalize(subtract(curr.anchor, prev.anchor));
    const dirOut = normalize(subtract(next.anchor, curr.anchor));

    // Calculate normals
    const normalIn = perpendicular(dirIn);
    const normalOut = perpendicular(dirOut);

    // Average normal for smooth offset at corners
    const avgNormal = normalize(add(normalIn, normalOut));

    // Miter join: calculate proper offset to maintain distance
    const dot = normalIn.x * avgNormal.x + normalIn.y * avgNormal.y;
    const miterLength = dot !== 0 ? offset / dot : offset;

    const offsetAnchor = add(curr.anchor, scale(avgNormal, miterLength));

    // Offset handles proportionally
    let offsetHandleIn: Point | null = null;
    let offsetHandleOut: Point | null = null;

    if (curr.handleIn) {
      const handleDir = normalize(subtract(curr.handleIn, curr.anchor));
      const handleLen = distance(curr.handleIn, curr.anchor);
      offsetHandleIn = add(offsetAnchor, scale(handleDir, handleLen));
    }

    if (curr.handleOut) {
      const handleDir = normalize(subtract(curr.handleOut, curr.anchor));
      const handleLen = distance(curr.handleOut, curr.anchor);
      offsetHandleOut = add(offsetAnchor, scale(handleDir, handleLen));
    }

    offsetPoints.push({
      anchor: offsetAnchor,
      handleIn: offsetHandleIn,
      handleOut: offsetHandleOut,
      type: curr.type,
    });
  }

  return {
    ...element,
    id: generateId(),
    name: `${element.name} (Offset)`,
    commands: anchorPointsToCommands(offsetPoints, element.closed),
  };
}

// ============================================================================
// Smooth Path
// ============================================================================

/**
 * Smooth a path by converting corner points to smooth curves
 */
export function smoothPath(element: PathElement, smoothness: number = 0.5): PathElement {
  const points = commandsToAnchorPoints(element.commands);
  if (points.length < 3) return element;

  const smoothedPoints: AnchorPoint[] = [];

  for (let i = 0; i < points.length; i++) {
    const prev = points[(i - 1 + points.length) % points.length];
    const curr = points[i];
    const next = points[(i + 1) % points.length];

    // Calculate tangent direction
    const toPrev = subtract(prev.anchor, curr.anchor);
    const toNext = subtract(next.anchor, curr.anchor);

    // Tangent is perpendicular to the bisector of the angle
    const tangent = normalize(subtract(toNext, toPrev));

    // Handle lengths based on neighbor distances
    const prevDist = distance(prev.anchor, curr.anchor) * smoothness * 0.4;
    const nextDist = distance(next.anchor, curr.anchor) * smoothness * 0.4;

    const handleIn = subtract(curr.anchor, scale(tangent, prevDist));
    const handleOut = add(curr.anchor, scale(tangent, nextDist));

    smoothedPoints.push({
      anchor: curr.anchor,
      handleIn: handleIn,
      handleOut: handleOut,
      type: 'smooth',
    });
  }

  return {
    ...element,
    id: generateId(),
    name: `${element.name} (Smoothed)`,
    commands: anchorPointsToCommands(smoothedPoints, element.closed),
  };
}

// ============================================================================
// Simplify Path (Ramer-Douglas-Peucker)
// ============================================================================

/**
 * Simplify a path by reducing anchor points
 */
export function simplifyPath(element: PathElement, tolerance: number = 2): PathElement {
  const points = commandsToAnchorPoints(element.commands);
  if (points.length < 3) return element;

  // Convert to flat array of anchor points
  const anchors = points.map((p) => p.anchor);

  // Apply Ramer-Douglas-Peucker
  const simplified = ramerDouglasPeucker(anchors, tolerance);

  // Convert back to anchor points (as corners)
  const simplifiedPoints: AnchorPoint[] = simplified.map((p) => ({
    anchor: p,
    handleIn: null,
    handleOut: null,
    type: 'corner' as const,
  }));

  return {
    ...element,
    id: generateId(),
    name: `${element.name} (Simplified)`,
    commands: anchorPointsToCommands(simplifiedPoints, element.closed),
  };
}

function ramerDouglasPeucker(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return points;

  // Find point with maximum distance from line
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

  // If max distance is greater than epsilon, recursively simplify
  if (maxDist > epsilon) {
    const left = ramerDouglasPeucker(points.slice(0, maxIndex + 1), epsilon);
    const right = ramerDouglasPeucker(points.slice(maxIndex), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  // Return just endpoints
  return [start, end];
}

function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  if (dx === 0 && dy === 0) {
    return distance(point, lineStart);
  }

  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);
  const nearestX = lineStart.x + t * dx;
  const nearestY = lineStart.y + t * dy;

  return Math.sqrt((point.x - nearestX) ** 2 + (point.y - nearestY) ** 2);
}

// ============================================================================
// Join Paths
// ============================================================================

/**
 * Join two open paths at their nearest endpoints
 */
export function joinPaths(path1: PathElement, path2: PathElement): PathElement {
  const points1 = commandsToAnchorPoints(path1.commands);
  const points2 = commandsToAnchorPoints(path2.commands);

  if (points1.length === 0) return path2;
  if (points2.length === 0) return path1;

  // Find closest endpoints
  const first1 = points1[0].anchor;
  const last1 = points1[points1.length - 1].anchor;
  const first2 = points2[0].anchor;
  const last2 = points2[points2.length - 1].anchor;

  const distances = [
    { dist: distance(last1, first2), reverse1: false, reverse2: false },
    { dist: distance(last1, last2), reverse1: false, reverse2: true },
    { dist: distance(first1, first2), reverse1: true, reverse2: false },
    { dist: distance(first1, last2), reverse1: true, reverse2: true },
  ];

  const closest = distances.reduce((min, d) => (d.dist < min.dist ? d : min));

  let joinedPoints: AnchorPoint[];

  if (closest.reverse1 && closest.reverse2) {
    joinedPoints = [...points1.reverse(), ...points2.reverse()];
  } else if (closest.reverse1) {
    joinedPoints = [...points1.reverse(), ...points2];
  } else if (closest.reverse2) {
    joinedPoints = [...points1, ...points2.reverse()];
  } else {
    joinedPoints = [...points1, ...points2];
  }

  return {
    ...path1,
    id: generateId(),
    name: 'Joined Path',
    commands: anchorPointsToCommands(joinedPoints, false),
    closed: false,
  };
}

// ============================================================================
// Split Path
// ============================================================================

/**
 * Split a path at a specific anchor point index
 */
export function splitPathAtPoint(element: PathElement, pointIndex: number): [PathElement, PathElement] | null {
  const points = commandsToAnchorPoints(element.commands);

  if (pointIndex <= 0 || pointIndex >= points.length - 1) {
    return null; // Can't split at endpoints
  }

  const firstPart = points.slice(0, pointIndex + 1);
  const secondPart = points.slice(pointIndex);

  return [
    {
      ...element,
      id: generateId(),
      name: `${element.name} (Part 1)`,
      commands: anchorPointsToCommands(firstPart, false),
      closed: false,
    },
    {
      ...element,
      id: generateId(),
      name: `${element.name} (Part 2)`,
      commands: anchorPointsToCommands(secondPart, false),
      closed: false,
    },
  ];
}

/**
 * Split a path at a parameter t along a segment
 */
export function splitPathAtParameter(
  element: PathElement,
  segmentIndex: number,
  t: number
): [PathElement, PathElement] | null {
  const points = commandsToAnchorPoints(element.commands);

  if (segmentIndex < 0 || segmentIndex >= points.length - 1) {
    return null;
  }

  const prev = points[segmentIndex];
  const next = points[segmentIndex + 1];

  // Calculate split point
  let splitPoint: AnchorPoint;

  if (prev.handleOut && next.handleIn) {
    // Split cubic bezier using de Casteljau's algorithm
    const p0 = prev.anchor;
    const p1 = prev.handleOut;
    const p2 = next.handleIn;
    const p3 = next.anchor;

    const p01 = lerp(p0, p1, t);
    const p12 = lerp(p1, p2, t);
    const p23 = lerp(p2, p3, t);
    const p012 = lerp(p01, p12, t);
    const p123 = lerp(p12, p23, t);
    const p0123 = lerp(p012, p123, t);

    // Update handles
    prev.handleOut = p01;
    next.handleIn = p23;

    splitPoint = {
      anchor: p0123,
      handleIn: p012,
      handleOut: p123,
      type: 'smooth',
    };
  } else {
    // Split line
    splitPoint = {
      anchor: lerp(prev.anchor, next.anchor, t),
      handleIn: null,
      handleOut: null,
      type: 'corner',
    };
  }

  const firstPart = [...points.slice(0, segmentIndex + 1), splitPoint];
  const secondPart = [splitPoint, ...points.slice(segmentIndex + 1)];

  return [
    {
      ...element,
      id: generateId(),
      name: `${element.name} (Part 1)`,
      commands: anchorPointsToCommands(firstPart, false),
      closed: false,
    },
    {
      ...element,
      id: generateId(),
      name: `${element.name} (Part 2)`,
      commands: anchorPointsToCommands(secondPart, false),
      closed: false,
    },
  ];
}

// ============================================================================
// Convert Anchor Points
// ============================================================================

/**
 * Convert an anchor point from smooth to corner
 */
export function convertToCorner(element: PathElement, pointIndex: number): PathElement {
  const points = commandsToAnchorPoints(element.commands);

  if (pointIndex < 0 || pointIndex >= points.length) return element;

  points[pointIndex] = {
    ...points[pointIndex],
    handleIn: null,
    handleOut: null,
    type: 'corner',
  };

  return {
    ...element,
    commands: anchorPointsToCommands(points, element.closed),
  };
}

/**
 * Convert an anchor point from corner to smooth
 */
export function convertToSmooth(element: PathElement, pointIndex: number, handleLength: number = 30): PathElement {
  const points = commandsToAnchorPoints(element.commands);

  if (pointIndex < 0 || pointIndex >= points.length) return element;

  const prev = points[(pointIndex - 1 + points.length) % points.length];
  const curr = points[pointIndex];
  const next = points[(pointIndex + 1) % points.length];

  // Calculate tangent direction
  const toPrev = subtract(prev.anchor, curr.anchor);
  const toNext = subtract(next.anchor, curr.anchor);
  const tangent = normalize(subtract(toNext, toPrev));

  points[pointIndex] = {
    anchor: curr.anchor,
    handleIn: subtract(curr.anchor, scale(tangent, handleLength)),
    handleOut: add(curr.anchor, scale(tangent, handleLength)),
    type: 'smooth',
  };

  return {
    ...element,
    commands: anchorPointsToCommands(points, element.closed),
  };
}

// ============================================================================
// Add/Delete Anchor Points
// ============================================================================

/**
 * Add an anchor point on a segment at parameter t
 */
export function addAnchorPoint(element: PathElement, segmentIndex: number, t: number = 0.5): PathElement {
  const points = commandsToAnchorPoints(element.commands);

  if (segmentIndex < 0 || segmentIndex >= points.length - (element.closed ? 0 : 1)) {
    return element;
  }

  const prev = points[segmentIndex];
  const nextIndex = (segmentIndex + 1) % points.length;
  const next = points[nextIndex];

  let newPoint: AnchorPoint;

  if (prev.handleOut && next.handleIn) {
    // Split cubic bezier
    const p0 = prev.anchor;
    const p1 = prev.handleOut;
    const p2 = next.handleIn;
    const p3 = next.anchor;

    const p01 = lerp(p0, p1, t);
    const p12 = lerp(p1, p2, t);
    const p23 = lerp(p2, p3, t);
    const p012 = lerp(p01, p12, t);
    const p123 = lerp(p12, p23, t);
    const p0123 = lerp(p012, p123, t);

    prev.handleOut = p01;
    next.handleIn = p23;

    newPoint = {
      anchor: p0123,
      handleIn: p012,
      handleOut: p123,
      type: 'smooth',
    };
  } else {
    // Split line
    newPoint = {
      anchor: lerp(prev.anchor, next.anchor, t),
      handleIn: null,
      handleOut: null,
      type: 'corner',
    };
  }

  // Insert new point
  points.splice(segmentIndex + 1, 0, newPoint);

  return {
    ...element,
    commands: anchorPointsToCommands(points, element.closed),
  };
}

/**
 * Delete an anchor point
 */
export function deleteAnchorPoint(element: PathElement, pointIndex: number): PathElement {
  const points = commandsToAnchorPoints(element.commands);

  if (points.length <= 2) return element; // Can't delete if too few points

  if (pointIndex < 0 || pointIndex >= points.length) return element;

  points.splice(pointIndex, 1);

  return {
    ...element,
    commands: anchorPointsToCommands(points, element.closed),
  };
}

// ============================================================================
// Reverse Path
// ============================================================================

/**
 * Reverse the direction of a path
 */
export function reversePath(element: PathElement): PathElement {
  const points = commandsToAnchorPoints(element.commands);

  // Reverse array and swap handles
  const reversed = points.reverse().map((p) => ({
    anchor: p.anchor,
    handleIn: p.handleOut,
    handleOut: p.handleIn,
    type: p.type,
  }));

  return {
    ...element,
    commands: anchorPointsToCommands(reversed, element.closed),
  };
}

// ============================================================================
// Outline Stroke
// ============================================================================

/**
 * Convert stroke to filled path (outline stroke)
 */
export function outlineStroke(element: PathElement): PathElement | null {
  if (!element.stroke) return null;

  const halfWidth = element.stroke.width / 2;

  // Create offset paths on both sides
  const outer = offsetPath(element, halfWidth);
  const inner = offsetPath(element, -halfWidth);

  // Combine into single closed path
  const outerPoints = commandsToAnchorPoints(outer.commands);
  const innerPoints = commandsToAnchorPoints(inner.commands).reverse();

  // Swap handles for inner path since we reversed it
  const reversedInner = innerPoints.map((p) => ({
    anchor: p.anchor,
    handleIn: p.handleOut,
    handleOut: p.handleIn,
    type: p.type,
  }));

  const combined = [...outerPoints, ...reversedInner];

  return {
    ...element,
    id: generateId(),
    name: `${element.name} (Outlined)`,
    fill: element.stroke ? { ...element.stroke.color } : null,
    stroke: null,
    commands: anchorPointsToCommands(combined, true),
    closed: true,
  };
}
