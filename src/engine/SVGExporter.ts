/**
 * SVGExporter - Export vector documents to SVG format
 *
 * Generates clean, standards-compliant SVG output.
 */

import type {
  Document,
  Layer,
  VectorElement,
  PathElement,
  RectElement,
  EllipseElement,
  PolygonElement,
  StarElement,
  TextElement,
  GroupElement,
  PathCommand,
  Color,
  Fill,
  Stroke,
  Gradient,
  LinearGradient,
  RadialGradient,
  Transform,
} from '../types';
import { colorToHex, colorToRgba } from '../types';

export class SVGExporter {
  private defs: string[] = [];
  private gradientId = 0;

  export(doc: Document): string {
    this.defs = [];
    this.gradientId = 0;

    const elements = doc.layers
      .filter((layer) => layer.visible)
      .map((layer) => this.exportLayer(layer))
      .join('\n');

    const defsContent = this.defs.length > 0 ? `<defs>\n${this.defs.join('\n')}\n</defs>\n` : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${doc.width}"
     height="${doc.height}"
     viewBox="0 0 ${doc.width} ${doc.height}">
${defsContent}${elements}
</svg>`;
  }

  private exportLayer(layer: Layer): string {
    if (!layer.visible || layer.elements.length === 0) return '';

    const opacity = layer.opacity < 1 ? ` opacity="${layer.opacity}"` : '';
    const elements = layer.elements.map((el) => this.exportElement(el)).join('\n');

    return `<g id="${this.escape(layer.id)}"${opacity}>
${elements}
</g>`;
  }

  private exportElement(element: VectorElement): string {
    if (!element.visible) return '';

    switch (element.type) {
      case 'path':
        return this.exportPath(element);
      case 'rect':
        return this.exportRect(element);
      case 'ellipse':
        return this.exportEllipse(element);
      case 'polygon':
        return this.exportPolygon(element);
      case 'star':
        return this.exportStar(element);
      case 'text':
        return this.exportText(element);
      case 'group':
        return this.exportGroup(element);
    }
  }

  private exportPath(element: PathElement): string {
    const d = this.pathToString(element.commands);
    const attrs = this.getCommonAttributes(element);
    return `<path d="${d}"${attrs}/>`;
  }

  private exportRect(element: RectElement): string {
    const attrs = this.getCommonAttributes(element);
    let rectAttrs = ` x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}"`;

    if (element.rx > 0) rectAttrs += ` rx="${element.rx}"`;
    if (element.ry > 0) rectAttrs += ` ry="${element.ry}"`;

    return `<rect${rectAttrs}${attrs}/>`;
  }

  private exportEllipse(element: EllipseElement): string {
    const attrs = this.getCommonAttributes(element);
    return `<ellipse cx="${element.cx}" cy="${element.cy}" rx="${element.rx}" ry="${element.ry}"${attrs}/>`;
  }

  private exportPolygon(element: PolygonElement): string {
    const points = element.points.map((p) => `${p.x},${p.y}`).join(' ');
    const attrs = this.getCommonAttributes(element);
    return `<polygon points="${points}"${attrs}/>`;
  }

  private exportStar(element: StarElement): string {
    // Convert star to path
    const { cx, cy, points, outerRadius, innerRadius, rotation } = element;
    const angleStep = Math.PI / points;
    const startAngle = ((rotation - 90) * Math.PI) / 180;
    const pathPoints: string[] = [];

    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = startAngle + i * angleStep;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      pathPoints.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`);
    }

    pathPoints.push('Z');
    const d = pathPoints.join(' ');
    const attrs = this.getCommonAttributes(element);
    return `<path d="${d}"${attrs}/>`;
  }

  private exportText(element: TextElement): string {
    const attrs = this.getCommonAttributes(element);
    const fontStyle = element.fontStyle === 'italic' ? ` font-style="italic"` : '';
    return `<text x="${element.x}" y="${element.y}" font-family="${element.fontFamily}" font-size="${element.fontSize}" font-weight="${element.fontWeight}"${fontStyle} text-anchor="${element.textAnchor}"${attrs}>${this.escape(element.text)}</text>`;
  }

  private exportGroup(element: GroupElement): string {
    const children = element.children.map((el) => this.exportElement(el)).join('\n');
    const transform = this.getTransformAttribute(element.transform);
    const opacity = element.opacity < 1 ? ` opacity="${element.opacity}"` : '';
    return `<g id="${this.escape(element.id)}"${transform}${opacity}>
${children}
</g>`;
  }

  private getCommonAttributes(element: VectorElement): string {
    const parts: string[] = [];

    // ID
    parts.push(` id="${this.escape(element.id)}"`);

    // Fill
    if (element.type !== 'group') {
      const fill = this.getFillAttribute(element.fill);
      parts.push(fill);
    }

    // Stroke
    if (element.type !== 'group' && element.stroke) {
      parts.push(this.getStrokeAttributes(element.stroke));
    }

    // Opacity
    if (element.opacity < 1) {
      parts.push(` opacity="${element.opacity}"`);
    }

    // Transform
    parts.push(this.getTransformAttribute(element.transform));

    return parts.join('');
  }

  private getFillAttribute(fill: Fill): string {
    if (!fill) return ' fill="none"';

    if ('type' in fill) {
      const id = this.addGradient(fill);
      return ` fill="url(#${id})"`;
    }

    if (fill.a < 1) {
      return ` fill="${colorToRgba(fill)}"`;
    }

    return ` fill="${colorToHex(fill)}"`;
  }

  private getStrokeAttributes(stroke: Stroke): string {
    const parts: string[] = [];

    parts.push(` stroke="${colorToHex(stroke.color)}"`);
    parts.push(` stroke-width="${stroke.width}"`);

    if (stroke.cap !== 'butt') {
      parts.push(` stroke-linecap="${stroke.cap}"`);
    }

    if (stroke.join !== 'miter') {
      parts.push(` stroke-linejoin="${stroke.join}"`);
    }

    if (stroke.dashArray.length > 0) {
      parts.push(` stroke-dasharray="${stroke.dashArray.join(' ')}"`);
      if (stroke.dashOffset !== 0) {
        parts.push(` stroke-dashoffset="${stroke.dashOffset}"`);
      }
    }

    if (stroke.color.a < 1) {
      parts.push(` stroke-opacity="${stroke.color.a}"`);
    }

    return parts.join('');
  }

  private getTransformAttribute(transform: Transform): string {
    const transforms: string[] = [];

    if (transform.translateX !== 0 || transform.translateY !== 0) {
      transforms.push(`translate(${transform.translateX}, ${transform.translateY})`);
    }

    if (transform.rotation !== 0) {
      transforms.push(`rotate(${transform.rotation}, ${transform.originX}, ${transform.originY})`);
    }

    if (transform.scaleX !== 1 || transform.scaleY !== 1) {
      transforms.push(`scale(${transform.scaleX}, ${transform.scaleY})`);
    }

    if (transforms.length === 0) return '';
    return ` transform="${transforms.join(' ')}"`;
  }

  private addGradient(gradient: Gradient): string {
    const id = `gradient${++this.gradientId}`;

    if (gradient.type === 'linear') {
      this.defs.push(this.createLinearGradient(id, gradient));
    } else {
      this.defs.push(this.createRadialGradient(id, gradient));
    }

    return id;
  }

  private createLinearGradient(id: string, gradient: LinearGradient): string {
    const stops = gradient.stops
      .map((stop) => `  <stop offset="${stop.offset * 100}%" stop-color="${colorToHex(stop.color)}"${stop.color.a < 1 ? ` stop-opacity="${stop.color.a}"` : ''}/>`)
      .join('\n');

    return `<linearGradient id="${id}" x1="${gradient.x1}" y1="${gradient.y1}" x2="${gradient.x2}" y2="${gradient.y2}">
${stops}
</linearGradient>`;
  }

  private createRadialGradient(id: string, gradient: RadialGradient): string {
    const stops = gradient.stops
      .map((stop) => `  <stop offset="${stop.offset * 100}%" stop-color="${colorToHex(stop.color)}"${stop.color.a < 1 ? ` stop-opacity="${stop.color.a}"` : ''}/>`)
      .join('\n');

    let attrs = `cx="${gradient.cx}" cy="${gradient.cy}" r="${gradient.r}"`;
    if (gradient.fx !== undefined) attrs += ` fx="${gradient.fx}"`;
    if (gradient.fy !== undefined) attrs += ` fy="${gradient.fy}"`;

    return `<radialGradient id="${id}" ${attrs}>
${stops}
</radialGradient>`;
  }

  private pathToString(commands: PathCommand[]): string {
    return commands
      .map((cmd) => {
        switch (cmd.type) {
          case 'M':
            return `M ${cmd.x} ${cmd.y}`;
          case 'L':
            return `L ${cmd.x} ${cmd.y}`;
          case 'H':
            return `H ${cmd.x}`;
          case 'V':
            return `V ${cmd.y}`;
          case 'C':
            return `C ${cmd.x1} ${cmd.y1} ${cmd.x2} ${cmd.y2} ${cmd.x} ${cmd.y}`;
          case 'S':
            return `S ${cmd.x2} ${cmd.y2} ${cmd.x} ${cmd.y}`;
          case 'Q':
            return `Q ${cmd.x1} ${cmd.y1} ${cmd.x} ${cmd.y}`;
          case 'T':
            return `T ${cmd.x} ${cmd.y}`;
          case 'A':
            return `A ${cmd.rx} ${cmd.ry} ${cmd.angle} ${cmd.largeArc ? 1 : 0} ${cmd.sweep ? 1 : 0} ${cmd.x} ${cmd.y}`;
          case 'Z':
            return 'Z';
        }
      })
      .join(' ');
  }

  private escape(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

// ============================================================================
// SVG Parser (for import)
// ============================================================================

export class SVGParser {
  parse(svgString: string): Document | null {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, 'image/svg+xml');
      const svg = doc.querySelector('svg');

      if (!svg) return null;

      const width = parseFloat(svg.getAttribute('width') || '800');
      const height = parseFloat(svg.getAttribute('height') || '600');

      return {
        id: `doc-${Date.now()}`,
        name: 'Imported SVG',
        width,
        height,
        background: { r: 255, g: 255, b: 255, a: 1 },
        layers: [
          {
            id: `layer-${Date.now()}`,
            name: 'Imported',
            visible: true,
            locked: false,
            opacity: 1,
            elements: this.parseElements(svg),
            collapsed: false,
          },
        ],
        guides: [],
      };
    } catch {
      return null;
    }
  }

  private parseElements(parent: Element): VectorElement[] {
    const elements: VectorElement[] = [];

    for (const child of Array.from(parent.children)) {
      const element = this.parseElement(child);
      if (element) {
        elements.push(element);
      }
    }

    return elements;
  }

  private parseElement(node: Element): VectorElement | null {
    const tagName = node.tagName.toLowerCase();

    switch (tagName) {
      case 'path':
        return this.parsePath(node);
      case 'rect':
        return this.parseRect(node);
      case 'ellipse':
        return this.parseEllipse(node);
      case 'circle':
        return this.parseCircle(node);
      case 'polygon':
        return this.parsePolygon(node);
      case 'text':
        return this.parseText(node);
      case 'g':
        return this.parseGroup(node);
      default:
        return null;
    }
  }

  private parsePath(node: Element): PathElement | null {
    const d = node.getAttribute('d');
    if (!d) return null;

    return {
      id: node.getAttribute('id') || `path-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: 'path',
      name: 'Path',
      visible: true,
      locked: false,
      opacity: parseFloat(node.getAttribute('opacity') || '1'),
      transform: this.parseTransform(node.getAttribute('transform')),
      fill: this.parseFill(node.getAttribute('fill')),
      stroke: this.parseStroke(node),
      commands: this.parsePathData(d),
      closed: d.toUpperCase().includes('Z'),
    };
  }

  private parseRect(node: Element): RectElement {
    return {
      id: node.getAttribute('id') || `rect-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: 'rect',
      name: 'Rectangle',
      visible: true,
      locked: false,
      opacity: parseFloat(node.getAttribute('opacity') || '1'),
      transform: this.parseTransform(node.getAttribute('transform')),
      fill: this.parseFill(node.getAttribute('fill')),
      stroke: this.parseStroke(node),
      x: parseFloat(node.getAttribute('x') || '0'),
      y: parseFloat(node.getAttribute('y') || '0'),
      width: parseFloat(node.getAttribute('width') || '0'),
      height: parseFloat(node.getAttribute('height') || '0'),
      rx: parseFloat(node.getAttribute('rx') || '0'),
      ry: parseFloat(node.getAttribute('ry') || '0'),
    };
  }

  private parseEllipse(node: Element): EllipseElement {
    return {
      id: node.getAttribute('id') || `ellipse-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: 'ellipse',
      name: 'Ellipse',
      visible: true,
      locked: false,
      opacity: parseFloat(node.getAttribute('opacity') || '1'),
      transform: this.parseTransform(node.getAttribute('transform')),
      fill: this.parseFill(node.getAttribute('fill')),
      stroke: this.parseStroke(node),
      cx: parseFloat(node.getAttribute('cx') || '0'),
      cy: parseFloat(node.getAttribute('cy') || '0'),
      rx: parseFloat(node.getAttribute('rx') || '0'),
      ry: parseFloat(node.getAttribute('ry') || '0'),
    };
  }

  private parseCircle(node: Element): EllipseElement {
    const r = parseFloat(node.getAttribute('r') || '0');
    return {
      id: node.getAttribute('id') || `circle-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: 'ellipse',
      name: 'Circle',
      visible: true,
      locked: false,
      opacity: parseFloat(node.getAttribute('opacity') || '1'),
      transform: this.parseTransform(node.getAttribute('transform')),
      fill: this.parseFill(node.getAttribute('fill')),
      stroke: this.parseStroke(node),
      cx: parseFloat(node.getAttribute('cx') || '0'),
      cy: parseFloat(node.getAttribute('cy') || '0'),
      rx: r,
      ry: r,
    };
  }

  private parsePolygon(node: Element): PolygonElement {
    const pointsStr = node.getAttribute('points') || '';
    const points = pointsStr
      .trim()
      .split(/\s+/)
      .map((pair) => {
        const [x, y] = pair.split(',').map(parseFloat);
        return { x: x || 0, y: y || 0 };
      });

    return {
      id: node.getAttribute('id') || `polygon-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: 'polygon',
      name: 'Polygon',
      visible: true,
      locked: false,
      opacity: parseFloat(node.getAttribute('opacity') || '1'),
      transform: this.parseTransform(node.getAttribute('transform')),
      fill: this.parseFill(node.getAttribute('fill')),
      stroke: this.parseStroke(node),
      points,
    };
  }

  private parseText(node: Element): TextElement {
    return {
      id: node.getAttribute('id') || `text-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: 'text',
      name: 'Text',
      visible: true,
      locked: false,
      opacity: parseFloat(node.getAttribute('opacity') || '1'),
      transform: this.parseTransform(node.getAttribute('transform')),
      fill: this.parseFill(node.getAttribute('fill')),
      stroke: this.parseStroke(node),
      x: parseFloat(node.getAttribute('x') || '0'),
      y: parseFloat(node.getAttribute('y') || '0'),
      text: node.textContent || '',
      fontFamily: node.getAttribute('font-family') || 'sans-serif',
      fontSize: parseFloat(node.getAttribute('font-size') || '16'),
      fontWeight: parseInt(node.getAttribute('font-weight') || '400', 10),
      fontStyle: node.getAttribute('font-style') === 'italic' ? 'italic' : 'normal',
      textAnchor: (node.getAttribute('text-anchor') as 'start' | 'middle' | 'end') || 'start',
      lineHeight: 1.2,
    };
  }

  private parseGroup(node: Element): GroupElement {
    return {
      id: node.getAttribute('id') || `group-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: 'group',
      name: 'Group',
      visible: true,
      locked: false,
      opacity: parseFloat(node.getAttribute('opacity') || '1'),
      transform: this.parseTransform(node.getAttribute('transform')),
      fill: null,
      stroke: null,
      children: this.parseElements(node),
    };
  }

  private parseTransform(transformStr: string | null): Transform {
    const transform: Transform = {
      translateX: 0,
      translateY: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      originX: 0,
      originY: 0,
    };

    if (!transformStr) return transform;

    const translateMatch = transformStr.match(/translate\(([^,]+),?\s*([^)]*)\)/);
    if (translateMatch) {
      transform.translateX = parseFloat(translateMatch[1]);
      transform.translateY = parseFloat(translateMatch[2] || '0');
    }

    const rotateMatch = transformStr.match(/rotate\(([^,)]+)/);
    if (rotateMatch) {
      transform.rotation = parseFloat(rotateMatch[1]);
    }

    const scaleMatch = transformStr.match(/scale\(([^,]+),?\s*([^)]*)\)/);
    if (scaleMatch) {
      transform.scaleX = parseFloat(scaleMatch[1]);
      transform.scaleY = parseFloat(scaleMatch[2] || scaleMatch[1]);
    }

    return transform;
  }

  private parseFill(fillStr: string | null): Fill {
    if (!fillStr || fillStr === 'none') return null;

    return this.parseColor(fillStr);
  }

  private parseStroke(node: Element): Stroke | null {
    const strokeColor = node.getAttribute('stroke');
    if (!strokeColor || strokeColor === 'none') return null;

    const color = this.parseColor(strokeColor);
    if (!color) return null;

    return {
      color,
      width: parseFloat(node.getAttribute('stroke-width') || '1'),
      cap: (node.getAttribute('stroke-linecap') as 'butt' | 'round' | 'square') || 'butt',
      join: (node.getAttribute('stroke-linejoin') as 'miter' | 'round' | 'bevel') || 'miter',
      dashArray: (node.getAttribute('stroke-dasharray') || '')
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(parseFloat),
      dashOffset: parseFloat(node.getAttribute('stroke-dashoffset') || '0'),
      miterLimit: parseFloat(node.getAttribute('stroke-miterlimit') || '10'),
    };
  }

  private parseColor(colorStr: string): Color {
    // Hex color
    if (colorStr.startsWith('#')) {
      const hex = colorStr.slice(1);
      if (hex.length === 3) {
        return {
          r: parseInt(hex[0] + hex[0], 16),
          g: parseInt(hex[1] + hex[1], 16),
          b: parseInt(hex[2] + hex[2], 16),
          a: 1,
        };
      }
      if (hex.length === 6) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
          a: 1,
        };
      }
    }

    // RGB(A) color
    const rgbMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (rgbMatch) {
      return {
        r: parseInt(rgbMatch[1], 10),
        g: parseInt(rgbMatch[2], 10),
        b: parseInt(rgbMatch[3], 10),
        a: rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1,
      };
    }

    // Default black
    return { r: 0, g: 0, b: 0, a: 1 };
  }

  private parsePathData(d: string): PathCommand[] {
    const commands: PathCommand[] = [];
    const regex = /([MLHVCSQTAZ])([^MLHVCSQTAZ]*)/gi;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(d)) !== null) {
      const type = match[1].toUpperCase();
      const args = match[2]
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(parseFloat);

      switch (type) {
        case 'M':
          commands.push({ type: 'M', x: args[0], y: args[1] });
          break;
        case 'L':
          commands.push({ type: 'L', x: args[0], y: args[1] });
          break;
        case 'H':
          commands.push({ type: 'H', x: args[0] });
          break;
        case 'V':
          commands.push({ type: 'V', y: args[0] });
          break;
        case 'C':
          commands.push({
            type: 'C',
            x1: args[0],
            y1: args[1],
            x2: args[2],
            y2: args[3],
            x: args[4],
            y: args[5],
          });
          break;
        case 'S':
          commands.push({ type: 'S', x2: args[0], y2: args[1], x: args[2], y: args[3] });
          break;
        case 'Q':
          commands.push({ type: 'Q', x1: args[0], y1: args[1], x: args[2], y: args[3] });
          break;
        case 'T':
          commands.push({ type: 'T', x: args[0], y: args[1] });
          break;
        case 'A':
          commands.push({
            type: 'A',
            rx: args[0],
            ry: args[1],
            angle: args[2],
            largeArc: args[3] === 1,
            sweep: args[4] === 1,
            x: args[5],
            y: args[6],
          });
          break;
        case 'Z':
          commands.push({ type: 'Z' });
          break;
      }
    }

    return commands;
  }
}
