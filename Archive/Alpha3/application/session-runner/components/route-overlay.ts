/**
 * Route Overlay Component
 *
 * SVG overlay showing travel route with path lines and waypoint markers.
 * Supports waypoint interaction (click, drag) for route editing.
 */

import type { HexCoordinate } from '@core/schemas/coordinates';
import { hexToPixel } from '@core/schemas/hex-geometry';
import type { Route, Waypoint } from '@/features/travel';

// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════

const PATH_COLOR = '#ef4444'; // Red
const PATH_WIDTH = 3;
const PATH_DASH = '8,4';

const WAYPOINT_RADIUS = 12;
const WAYPOINT_COLOR = '#ef4444';
const WAYPOINT_STROKE = '#991b1b';
const WAYPOINT_STROKE_WIDTH = 2;

const WAYPOINT_HIGHLIGHT_COLOR = '#f87171';
const WAYPOINT_HOVER_SCALE = 1.2;

const PREVIEW_PATH_COLOR = 'rgba(239, 68, 68, 0.5)';
const PREVIEW_PATH_WIDTH = 2;
const PREVIEW_PATH_DASH = '4,4';

// ═══════════════════════════════════════════════════════════════
// Route Overlay
// ═══════════════════════════════════════════════════════════════

export class RouteOverlay {
  private readonly parent: SVGGElement;
  private readonly hexSize: number;

  private readonly pathGroup: SVGGElement;
  private readonly waypointsGroup: SVGGElement;
  private readonly previewGroup: SVGGElement;

  private waypointElements: Map<string, SVGGElement> = new Map();
  private currentRoute: Route | null = null;
  private partyPosition: HexCoordinate | null = null;

  private highlightedWaypointId: string | null = null;
  private dragPreviewElement: SVGCircleElement | null = null;
  private previewLineElement: SVGLineElement | null = null;
  private dragPathPreviewElements: SVGPolylineElement[] = [];
  private partyDragPreviewLine: SVGPolylineElement | null = null;

  constructor(parent: SVGGElement, hexSize: number) {
    this.parent = parent;
    this.hexSize = hexSize;

    // Create sub-groups
    this.pathGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.pathGroup.classList.add('route-paths');

    this.waypointsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.waypointsGroup.classList.add('route-waypoints');

    this.previewGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.previewGroup.classList.add('route-preview');

    this.parent.appendChild(this.pathGroup);
    this.parent.appendChild(this.waypointsGroup);
    this.parent.appendChild(this.previewGroup);
  }

  // ─────────────────────────────────────────────────────────────
  // Route Display
  // ─────────────────────────────────────────────────────────────

  /**
   * Set and render route
   */
  setRoute(route: Route, partyPosition: HexCoordinate): void {
    this.currentRoute = route;
    this.partyPosition = partyPosition;
    this.clear();

    if (route.segments.length === 0) return;

    // Draw path lines for each segment
    const partyPixel = hexToPixel(partyPosition, this.hexSize);
    let previousPoint = partyPixel;

    for (const segment of route.segments) {
      // Draw path through all hexes in segment
      const pathPoints: string[] = [`${previousPoint.x},${previousPoint.y}`];

      for (const coord of segment.path.slice(1)) {
        const pixel = hexToPixel(coord, this.hexSize);
        pathPoints.push(`${pixel.x},${pixel.y}`);
      }

      const pathLine = this.createPath(pathPoints);
      this.pathGroup.appendChild(pathLine);

      // Update previous point
      const lastCoord = segment.path[segment.path.length - 1];
      previousPoint = hexToPixel(lastCoord, this.hexSize);
    }

    // Draw waypoint markers
    for (const waypoint of route.waypoints) {
      this.createWaypointMarker(waypoint);
    }
  }

  /**
   * Clear all route visuals
   */
  clearRoute(): void {
    this.currentRoute = null;
    this.partyPosition = null;
    this.clear();
  }

  private clear(): void {
    this.pathGroup.innerHTML = '';
    this.waypointsGroup.innerHTML = '';
    this.previewGroup.innerHTML = '';
    this.waypointElements.clear();
    this.previewLineElement = null;
    this.dragPreviewElement = null;
    this.dragPathPreviewElements = [];
    this.partyDragPreviewLine = null;
  }

  // ─────────────────────────────────────────────────────────────
  // Waypoint Interaction
  // ─────────────────────────────────────────────────────────────

  /**
   * Highlight a waypoint
   */
  highlightWaypoint(waypointId: string | null): void {
    // Remove previous highlight
    if (this.highlightedWaypointId) {
      const prevGroup = this.waypointElements.get(this.highlightedWaypointId);
      const prevCircle = prevGroup?.querySelector('circle');
      if (prevCircle) {
        prevCircle.setAttribute('fill', WAYPOINT_COLOR);
        prevGroup!.setAttribute('transform', '');
      }
    }

    this.highlightedWaypointId = waypointId;

    // Apply new highlight
    if (waypointId) {
      const group = this.waypointElements.get(waypointId);
      const circle = group?.querySelector('circle');
      if (circle && group) {
        circle.setAttribute('fill', WAYPOINT_HIGHLIGHT_COLOR);
        // Scale around center
        const cx = parseFloat(circle.getAttribute('cx') || '0');
        const cy = parseFloat(circle.getAttribute('cy') || '0');
        group.setAttribute(
          'transform',
          `translate(${cx}, ${cy}) scale(${WAYPOINT_HOVER_SCALE}) translate(${-cx}, ${-cy})`
        );
      }
    }
  }

  /**
   * Set waypoint visibility (used for drag preview)
   */
  private setWaypointVisibility(waypointId: string, visible: boolean): void {
    const group = this.waypointElements.get(waypointId);
    if (group) {
      group.setAttribute('opacity', visible ? '1' : '0');
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Preview Line
  // ─────────────────────────────────────────────────────────────

  /**
   * Show preview line from point to hovered hex
   */
  showPreviewLine(from: HexCoordinate, to: HexCoordinate): void {
    this.hidePreviewLine();

    const fromPixel = hexToPixel(from, this.hexSize);
    const toPixel = hexToPixel(to, this.hexSize);

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', fromPixel.x.toString());
    line.setAttribute('y1', fromPixel.y.toString());
    line.setAttribute('x2', toPixel.x.toString());
    line.setAttribute('y2', toPixel.y.toString());
    line.setAttribute('stroke', PREVIEW_PATH_COLOR);
    line.setAttribute('stroke-width', PREVIEW_PATH_WIDTH.toString());
    line.setAttribute('stroke-dasharray', PREVIEW_PATH_DASH);
    line.classList.add('route-preview-line');

    this.previewGroup.appendChild(line);
    this.previewLineElement = line;
  }

  /**
   * Hide preview line
   */
  hidePreviewLine(): void {
    if (this.previewLineElement) {
      this.previewLineElement.remove();
      this.previewLineElement = null;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Drag Preview
  // ─────────────────────────────────────────────────────────────

  /**
   * Show drag preview at world pixel position (not hex-snapped)
   * Ghost follows cursor directly for smooth dragging
   */
  showDragPreviewAtPixel(waypointId: string, worldX: number, worldY: number): void {
    this.hideDragPreview();

    // Create ghost waypoint at pixel position
    const ghost = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    ghost.setAttribute('cx', worldX.toString());
    ghost.setAttribute('cy', worldY.toString());
    ghost.setAttribute('r', WAYPOINT_RADIUS.toString());
    ghost.setAttribute('fill', WAYPOINT_HIGHLIGHT_COLOR);
    ghost.setAttribute('stroke', WAYPOINT_STROKE);
    ghost.setAttribute('stroke-width', WAYPOINT_STROKE_WIDTH.toString());
    ghost.setAttribute('opacity', '0.7');
    ghost.classList.add('route-drag-preview');

    this.previewGroup.appendChild(ghost);
    this.dragPreviewElement = ghost;

    // Draw path preview lines
    if (this.currentRoute && this.partyPosition) {
      const waypoint = this.currentRoute.waypoints.find((w) => w.id === waypointId);
      if (waypoint) {
        // Previous point (party position or previous waypoint)
        let prevPixel: { x: number; y: number };
        if (waypoint.order === 0) {
          prevPixel = hexToPixel(this.partyPosition, this.hexSize);
        } else {
          const prevWaypoint = this.currentRoute.waypoints.find(
            (w) => w.order === waypoint.order - 1
          );
          prevPixel = prevWaypoint
            ? hexToPixel(prevWaypoint.coord, this.hexSize)
            : hexToPixel(this.partyPosition, this.hexSize);
        }

        // Preview line from prev → ghost
        const prevLine = this.createPreviewPath([
          `${prevPixel.x},${prevPixel.y}`,
          `${worldX},${worldY}`,
        ]);
        this.previewGroup.appendChild(prevLine);
        this.dragPathPreviewElements.push(prevLine);

        // Next waypoint (if any)
        const nextWaypoint = this.currentRoute.waypoints.find(
          (w) => w.order === waypoint.order + 1
        );
        if (nextWaypoint) {
          const nextPixel = hexToPixel(nextWaypoint.coord, this.hexSize);
          const nextLine = this.createPreviewPath([
            `${worldX},${worldY}`,
            `${nextPixel.x},${nextPixel.y}`,
          ]);
          this.previewGroup.appendChild(nextLine);
          this.dragPathPreviewElements.push(nextLine);
        }
      }
    }

    // Hide the original waypoint being dragged
    this.setWaypointVisibility(waypointId, false);
    this.highlightedWaypointId = waypointId;
  }

  /**
   * Hide drag preview
   */
  hideDragPreview(): void {
    // Remove ghost element
    if (this.dragPreviewElement) {
      this.dragPreviewElement.remove();
      this.dragPreviewElement = null;
    }
    // Remove path preview elements
    for (const line of this.dragPathPreviewElements) {
      line.remove();
    }
    this.dragPathPreviewElements = [];
    // Restore visibility of original waypoint
    if (this.highlightedWaypointId) {
      this.setWaypointVisibility(this.highlightedWaypointId, true);
      this.highlightedWaypointId = null;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Party Token Drag Preview
  // ─────────────────────────────────────────────────────────────

  /**
   * Show preview line from pixel position to first waypoint (for party token drag)
   */
  showPartyDragPreview(worldX: number, worldY: number): void {
    this.hidePartyDragPreview();

    if (!this.currentRoute || this.currentRoute.waypoints.length === 0) return;

    const firstWaypoint = this.currentRoute.waypoints[0];
    const waypointPixel = hexToPixel(firstWaypoint.coord, this.hexSize);

    const line = this.createPreviewPath([
      `${worldX},${worldY}`,
      `${waypointPixel.x},${waypointPixel.y}`,
    ]);
    this.previewGroup.appendChild(line);
    this.partyDragPreviewLine = line;
  }

  /**
   * Hide party drag preview line
   */
  hidePartyDragPreview(): void {
    if (this.partyDragPreviewLine) {
      this.partyDragPreviewLine.remove();
      this.partyDragPreviewLine = null;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────

  private createPath(points: string[]): SVGPolylineElement {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    path.setAttribute('points', points.join(' '));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', PATH_COLOR);
    path.setAttribute('stroke-width', PATH_WIDTH.toString());
    path.setAttribute('stroke-dasharray', PATH_DASH);
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.classList.add('route-path');
    return path;
  }

  private createPreviewPath(points: string[]): SVGPolylineElement {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    path.setAttribute('points', points.join(' '));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', PREVIEW_PATH_COLOR);
    path.setAttribute('stroke-width', PREVIEW_PATH_WIDTH.toString());
    path.setAttribute('stroke-dasharray', PREVIEW_PATH_DASH);
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.classList.add('route-drag-path-preview');
    return path;
  }

  private createWaypointMarker(waypoint: Waypoint): void {
    const pixel = hexToPixel(waypoint.coord, this.hexSize);

    // Wrapper group for circle + text
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('route-waypoint-group');
    group.setAttribute('data-waypoint-id', waypoint.id);

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', pixel.x.toString());
    circle.setAttribute('cy', pixel.y.toString());
    circle.setAttribute('r', WAYPOINT_RADIUS.toString());
    circle.setAttribute('fill', WAYPOINT_COLOR);
    circle.setAttribute('stroke', WAYPOINT_STROKE);
    circle.setAttribute('stroke-width', WAYPOINT_STROKE_WIDTH.toString());
    circle.classList.add('route-waypoint');

    // Order number text
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', pixel.x.toString());
    text.setAttribute('y', (pixel.y + 4).toString());
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', 'white');
    text.setAttribute('font-size', '12');
    text.setAttribute('font-weight', 'bold');
    text.setAttribute('pointer-events', 'none');
    text.textContent = (waypoint.order + 1).toString();

    group.appendChild(circle);
    group.appendChild(text);
    this.waypointsGroup.appendChild(group);
    this.waypointElements.set(waypoint.id, group);
  }

  // ─────────────────────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────────────────────

  dispose(): void {
    this.clear();
    this.pathGroup.remove();
    this.waypointsGroup.remove();
    this.previewGroup.remove();
  }
}

// ═══════════════════════════════════════════════════════════════
// Factory
// ═══════════════════════════════════════════════════════════════

export function createRouteOverlay(parent: SVGGElement, hexSize: number): RouteOverlay {
  return new RouteOverlay(parent, hexSize);
}
