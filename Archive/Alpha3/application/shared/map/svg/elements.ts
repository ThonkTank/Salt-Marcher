/**
 * Generic SVG Element Utilities
 *
 * Provides low-level SVG element creation functions.
 * Used by canvas components, RouteOverlay, PartyToken, etc.
 */

// ═══════════════════════════════════════════════════════════════
// SVG Namespace
// ═══════════════════════════════════════════════════════════════

export const SVG_NS = 'http://www.w3.org/2000/svg';

// ═══════════════════════════════════════════════════════════════
// Style Interfaces
// ═══════════════════════════════════════════════════════════════

export interface CircleStyle {
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  className?: string;
}

export interface PolylineStyle {
  stroke: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  strokeLinecap?: 'butt' | 'round' | 'square';
  strokeLinejoin?: 'miter' | 'round' | 'bevel';
  fill?: string;
  className?: string;
}

export interface LineStyle {
  stroke: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  strokeLinecap?: 'butt' | 'round' | 'square';
  className?: string;
}

export interface TextStyle {
  fill?: string;
  fontSize?: number | string;
  fontWeight?: string | number;
  fontFamily?: string;
  textAnchor?: 'start' | 'middle' | 'end';
  dominantBaseline?: 'auto' | 'middle' | 'hanging' | 'text-bottom';
  pointerEvents?: string;
  className?: string;
}

export interface PolygonStyle {
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  className?: string;
}

// ═══════════════════════════════════════════════════════════════
// Element Creation
// ═══════════════════════════════════════════════════════════════

/**
 * Create an SVG circle element
 */
export function createCircle(
  cx: number,
  cy: number,
  r: number,
  style: CircleStyle
): SVGCircleElement {
  const circle = document.createElementNS(SVG_NS, 'circle');
  circle.setAttribute('cx', cx.toString());
  circle.setAttribute('cy', cy.toString());
  circle.setAttribute('r', r.toString());
  circle.setAttribute('fill', style.fill);

  if (style.stroke) {
    circle.setAttribute('stroke', style.stroke);
  }
  if (style.strokeWidth !== undefined) {
    circle.setAttribute('stroke-width', style.strokeWidth.toString());
  }
  if (style.opacity !== undefined) {
    circle.setAttribute('opacity', style.opacity.toString());
  }
  if (style.className) {
    circle.classList.add(...style.className.split(' '));
  }

  return circle;
}

/**
 * Create an SVG polyline element
 */
export function createPolyline(
  points: Array<{ x: number; y: number }>,
  style: PolylineStyle
): SVGPolylineElement {
  const polyline = document.createElementNS(SVG_NS, 'polyline');
  const pointsStr = points.map((p) => `${p.x},${p.y}`).join(' ');
  polyline.setAttribute('points', pointsStr);
  polyline.setAttribute('fill', style.fill ?? 'none');
  polyline.setAttribute('stroke', style.stroke);

  if (style.strokeWidth !== undefined) {
    polyline.setAttribute('stroke-width', style.strokeWidth.toString());
  }
  if (style.strokeDasharray) {
    polyline.setAttribute('stroke-dasharray', style.strokeDasharray);
  }
  if (style.strokeLinecap) {
    polyline.setAttribute('stroke-linecap', style.strokeLinecap);
  }
  if (style.strokeLinejoin) {
    polyline.setAttribute('stroke-linejoin', style.strokeLinejoin);
  }
  if (style.className) {
    polyline.classList.add(...style.className.split(' '));
  }

  return polyline;
}

/**
 * Create an SVG line element
 */
export function createLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  style: LineStyle
): SVGLineElement {
  const line = document.createElementNS(SVG_NS, 'line');
  line.setAttribute('x1', x1.toString());
  line.setAttribute('y1', y1.toString());
  line.setAttribute('x2', x2.toString());
  line.setAttribute('y2', y2.toString());
  line.setAttribute('stroke', style.stroke);

  if (style.strokeWidth !== undefined) {
    line.setAttribute('stroke-width', style.strokeWidth.toString());
  }
  if (style.strokeDasharray) {
    line.setAttribute('stroke-dasharray', style.strokeDasharray);
  }
  if (style.strokeLinecap) {
    line.setAttribute('stroke-linecap', style.strokeLinecap);
  }
  if (style.className) {
    line.classList.add(...style.className.split(' '));
  }

  return line;
}

/**
 * Create an SVG text element
 */
export function createText(
  x: number,
  y: number,
  content: string,
  style: TextStyle = {}
): SVGTextElement {
  const text = document.createElementNS(SVG_NS, 'text');
  text.setAttribute('x', x.toString());
  text.setAttribute('y', y.toString());
  text.textContent = content;

  if (style.fill) {
    text.setAttribute('fill', style.fill);
  }
  if (style.fontSize !== undefined) {
    text.setAttribute(
      'font-size',
      typeof style.fontSize === 'number' ? `${style.fontSize}px` : style.fontSize
    );
  }
  if (style.fontWeight !== undefined) {
    text.setAttribute('font-weight', style.fontWeight.toString());
  }
  if (style.fontFamily) {
    text.setAttribute('font-family', style.fontFamily);
  }
  if (style.textAnchor) {
    text.setAttribute('text-anchor', style.textAnchor);
  }
  if (style.dominantBaseline) {
    text.setAttribute('dominant-baseline', style.dominantBaseline);
  }
  if (style.pointerEvents) {
    text.setAttribute('pointer-events', style.pointerEvents);
  }
  if (style.className) {
    text.classList.add(...style.className.split(' '));
  }

  return text;
}

/**
 * Create an SVG group element
 */
export function createGroup(id?: string, className?: string): SVGGElement {
  const group = document.createElementNS(SVG_NS, 'g');
  if (id) {
    group.setAttribute('id', id);
  }
  if (className) {
    group.classList.add(...className.split(' '));
  }
  return group;
}

/**
 * Create an SVG polygon element
 */
export function createPolygon(
  points: string,
  style: PolygonStyle
): SVGPolygonElement {
  const polygon = document.createElementNS(SVG_NS, 'polygon');
  polygon.setAttribute('points', points);
  polygon.setAttribute('fill', style.fill);

  if (style.stroke) {
    polygon.setAttribute('stroke', style.stroke);
  }
  if (style.strokeWidth !== undefined) {
    polygon.setAttribute('stroke-width', style.strokeWidth.toString());
  }
  if (style.opacity !== undefined) {
    polygon.setAttribute('opacity', style.opacity.toString());
  }
  if (style.className) {
    polygon.classList.add(...style.className.split(' '));
  }

  return polygon;
}

// ═══════════════════════════════════════════════════════════════
// Update Helpers
// ═══════════════════════════════════════════════════════════════

/**
 * Update circle position
 */
export function updateCirclePosition(
  circle: SVGCircleElement,
  cx: number,
  cy: number
): void {
  circle.setAttribute('cx', cx.toString());
  circle.setAttribute('cy', cy.toString());
}

/**
 * Update circle style
 */
export function updateCircleStyle(
  circle: SVGCircleElement,
  style: Partial<CircleStyle>
): void {
  if (style.fill !== undefined) {
    circle.setAttribute('fill', style.fill);
  }
  if (style.stroke !== undefined) {
    circle.setAttribute('stroke', style.stroke);
  }
  if (style.strokeWidth !== undefined) {
    circle.setAttribute('stroke-width', style.strokeWidth.toString());
  }
  if (style.opacity !== undefined) {
    circle.setAttribute('opacity', style.opacity.toString());
  }
}

/**
 * Update line positions
 */
export function updateLinePosition(
  line: SVGLineElement,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): void {
  line.setAttribute('x1', x1.toString());
  line.setAttribute('y1', y1.toString());
  line.setAttribute('x2', x2.toString());
  line.setAttribute('y2', y2.toString());
}

/**
 * Update polyline points
 */
export function updatePolylinePoints(
  polyline: SVGPolylineElement,
  points: Array<{ x: number; y: number }>
): void {
  const pointsStr = points.map((p) => `${p.x},${p.y}`).join(' ');
  polyline.setAttribute('points', pointsStr);
}
