/**
 * Map Canvas Panel.
 *
 * Renders the hex map using Canvas 2D API.
 * Handles mouse interactions for tile selection and movement.
 */

import {
  axialToPixel,
  hexCorners,
  pixelToAxial,
  hexEquals,
  isSome,
} from '@core/index';
import type { HexCoordinate, OverworldTile, TerrainDefinition } from '@core/schemas';
import type { TerrainStoragePort } from '@/features/map';
import type { RenderState, RenderHint } from '../types';

// ============================================================================
// Constants
// ============================================================================

/** Hex size (radius from center to corner) */
const HEX_SIZE = 30;

/** Party token radius */
const PARTY_TOKEN_RADIUS = 12;

/** Waypoint marker size */
const WAYPOINT_MARKER_SIZE = 8;

/** Colors */
const COLORS = {
  grid: '#444444',
  hover: 'rgba(255, 255, 255, 0.3)',
  selected: 'rgba(255, 255, 0, 0.4)',
  partyToken: '#FF6600',
  partyTokenBorder: '#FFFFFF',
  background: '#1a1a1a',
  // Route planning
  planningRoute: '#3b82f6', // Blue for planning
  planningRouteWidth: 3,
  activeRoute: '#22c55e', // Green for active
  activeRouteWidth: 4,
  waypointFill: '#ffffff',
  waypointBorder: '#3b82f6',
  waypointActiveBorder: '#22c55e',
};

// ============================================================================
// Map Canvas
// ============================================================================

export interface MapCanvasCallbacks {
  onTileClick: (coord: HexCoordinate) => void;
  onTileHover: (coord: HexCoordinate | null) => void;
  onPan: (deltaX: number, deltaY: number) => void;
  onZoom: (delta: number) => void;
}

export interface MapCanvasDeps {
  terrainStorage: TerrainStoragePort;
  callbacks: MapCanvasCallbacks;
}

/**
 * Create a map canvas panel.
 */
export function createMapCanvas(
  container: HTMLElement,
  deps: MapCanvasDeps
): MapCanvasPanel {
  const { terrainStorage, callbacks } = deps;

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.className = 'salt-marcher-map-canvas';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d')!;

  // State
  let currentState: RenderState | null = null;
  let isDragging = false;
  let lastMousePos = { x: 0, y: 0 };
  let animationFrameId: number | null = null;

  // =========================================================================
  // Resize Handling
  // =========================================================================

  function resize(): void {
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    ctx.scale(dpr, dpr);

    if (currentState) {
      render(currentState, ['full']);
    }
  }

  // =========================================================================
  // Coordinate Conversion
  // =========================================================================

  function screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const state = currentState!;
    const zoom = state.zoom;
    const offset = state.cameraOffset;

    // Convert to canvas coordinates
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;

    // Apply camera transform (inverse)
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const worldX = (canvasX - centerX - offset.x) / zoom;
    const worldY = (canvasY - centerY - offset.y) / zoom;

    return { x: worldX, y: worldY };
  }

  function worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const state = currentState!;
    const zoom = state.zoom;
    const offset = state.cameraOffset;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const screenX = worldX * zoom + centerX + offset.x;
    const screenY = worldY * zoom + centerY + offset.y;

    return { x: screenX, y: screenY };
  }

  // =========================================================================
  // Rendering
  // =========================================================================

  function render(state: RenderState, _hints: RenderHint[]): void {
    currentState = state;

    // Cancel any existing animation frame
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    renderFrame(state);

    // Start animation loop if token animation is active
    if (state.tokenAnimation) {
      startAnimationLoop();
    }
  }

  function renderFrame(state: RenderState): void {
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Clear
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);

    if (!state.map) return;

    // Apply camera transform
    ctx.save();
    ctx.translate(width / 2 + state.cameraOffset.x, height / 2 + state.cameraOffset.y);
    ctx.scale(state.zoom, state.zoom);

    // Render tiles
    for (const tile of state.map.tiles) {
      renderTile(tile, state);
    }

    // Render route and waypoints (between tiles and party token)
    renderRoute(state);

    // Render party token
    if (state.partyPosition) {
      renderPartyToken(state.partyPosition, state);
    }

    ctx.restore();
  }

  function startAnimationLoop(): void {
    function animationTick() {
      if (!currentState || !currentState.tokenAnimation) {
        animationFrameId = null;
        return;
      }

      // Check if animation is still in progress
      const elapsed = performance.now() - currentState.tokenAnimation.startTime;
      if (elapsed >= currentState.tokenAnimation.durationMs) {
        animationFrameId = null;
        return;
      }

      // Re-render frame
      renderFrame(currentState);
      animationFrameId = requestAnimationFrame(animationTick);
    }

    animationFrameId = requestAnimationFrame(animationTick);
  }

  function renderTile(
    tile: OverworldTile,
    state: RenderState
  ): void {
    const pixel = axialToPixel(tile.coordinate, HEX_SIZE);
    const corners = hexCorners(pixel, HEX_SIZE);

    // Get terrain color
    const terrain = terrainStorage.get(tile.terrain);
    const color = isSome(terrain) ? terrain.value.color : '#808080';

    // Draw hex fill
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 6; i++) {
      ctx.lineTo(corners[i].x, corners[i].y);
    }
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill();

    // Draw hex border
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Hover highlight
    if (
      state.hoveredTile &&
      hexEquals(state.hoveredTile, tile.coordinate)
    ) {
      ctx.fillStyle = COLORS.hover;
      ctx.fill();
    }

    // Selected highlight
    if (
      state.selectedTile &&
      hexEquals(state.selectedTile, tile.coordinate)
    ) {
      ctx.fillStyle = COLORS.selected;
      ctx.fill();
    }
  }

  function renderPartyToken(position: HexCoordinate, state: RenderState): void {
    const { tokenAnimation } = state;
    let pixel: { x: number; y: number };

    // Interpolate position if animation is active
    if (tokenAnimation) {
      // Use direct progress if available (time-based travel), otherwise calculate from time
      let rawProgress: number;
      if (tokenAnimation.progress > 0 || tokenAnimation.durationMs === 0) {
        // Direct progress from travel state (new time-based animation)
        rawProgress = tokenAnimation.progress;
      } else {
        // Time-based animation (legacy for position changes)
        const elapsed = performance.now() - tokenAnimation.startTime;
        rawProgress = Math.min(1, elapsed / tokenAnimation.durationMs);
      }

      // Ease-out: 1 - (1 - t)^2
      const eased = 1 - Math.pow(1 - rawProgress, 2);

      const fromPixel = axialToPixel(tokenAnimation.fromHex, HEX_SIZE);
      const toPixel = axialToPixel(tokenAnimation.toHex, HEX_SIZE);

      pixel = {
        x: fromPixel.x + (toPixel.x - fromPixel.x) * eased,
        y: fromPixel.y + (toPixel.y - fromPixel.y) * eased,
      };
    } else {
      pixel = axialToPixel(position, HEX_SIZE);
    }

    // Token circle
    ctx.beginPath();
    ctx.arc(pixel.x, pixel.y, PARTY_TOKEN_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.partyToken;
    ctx.fill();
    ctx.strokeStyle = COLORS.partyTokenBorder;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Token icon (simple "P")
    ctx.fillStyle = COLORS.partyTokenBorder;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('P', pixel.x, pixel.y);
  }

  /**
   * Render route lines and waypoint markers.
   * Uses previewPath for both planning and active routes (just changes color).
   */
  function renderRoute(state: RenderState): void {
    const { planningWaypoints, previewPath, activeRoute } = state;

    // Draw route line (previewPath works for both planning and active)
    if (previewPath && previewPath.length > 1) {
      const isActive = activeRoute !== null;
      const color = isActive ? COLORS.activeRoute : COLORS.planningRoute;
      const width = isActive ? COLORS.activeRouteWidth : COLORS.planningRouteWidth;
      drawRouteLine(previewPath, color, width);
    }

    // Waypoint markers
    if (activeRoute) {
      drawWaypointMarkers(activeRoute.waypoints.slice(1), COLORS.waypointActiveBorder);
    } else if (planningWaypoints.length > 0) {
      drawWaypointMarkers(planningWaypoints, COLORS.waypointBorder);
    }
  }

  /**
   * Draw a line connecting waypoints.
   */
  function drawRouteLine(
    waypoints: HexCoordinate[],
    color: string,
    lineWidth: number
  ): void {
    if (waypoints.length < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const firstPixel = axialToPixel(waypoints[0], HEX_SIZE);
    ctx.moveTo(firstPixel.x, firstPixel.y);

    for (let i = 1; i < waypoints.length; i++) {
      const pixel = axialToPixel(waypoints[i], HEX_SIZE);
      ctx.lineTo(pixel.x, pixel.y);
    }

    ctx.stroke();
  }

  /**
   * Draw waypoint markers.
   */
  function drawWaypointMarkers(
    waypoints: HexCoordinate[],
    borderColor: string
  ): void {
    for (let i = 0; i < waypoints.length; i++) {
      const waypoint = waypoints[i];
      const pixel = axialToPixel(waypoint, HEX_SIZE);
      const isDestination = i === waypoints.length - 1;

      // Draw diamond for intermediate, circle for destination
      ctx.beginPath();
      if (isDestination) {
        // Circle for destination
        ctx.arc(pixel.x, pixel.y, WAYPOINT_MARKER_SIZE, 0, Math.PI * 2);
      } else {
        // Diamond for intermediate waypoints
        const s = WAYPOINT_MARKER_SIZE;
        ctx.moveTo(pixel.x, pixel.y - s);
        ctx.lineTo(pixel.x + s, pixel.y);
        ctx.lineTo(pixel.x, pixel.y + s);
        ctx.lineTo(pixel.x - s, pixel.y);
        ctx.closePath();
      }

      ctx.fillStyle = COLORS.waypointFill;
      ctx.fill();
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw waypoint number
      ctx.fillStyle = borderColor;
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), pixel.x, pixel.y);
    }
  }

  // =========================================================================
  // Event Handlers
  // =========================================================================

  function onMouseDown(e: MouseEvent): void {
    if (e.button === 0) {
      isDragging = true;
      lastMousePos = { x: e.clientX, y: e.clientY };
    }
  }

  function onMouseUp(e: MouseEvent): void {
    if (e.button === 0) {
      if (!isDragging) return;

      // Check if it was a click (minimal movement)
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 5 && currentState) {
        // It's a click
        const world = screenToWorld(e.clientX, e.clientY);
        const coord = pixelToAxial(world, HEX_SIZE);
        callbacks.onTileClick(coord);
      }

      isDragging = false;
    }
  }

  function onMouseMove(e: MouseEvent): void {
    if (!currentState) return;

    if (isDragging) {
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      callbacks.onPan(dx, dy);
      lastMousePos = { x: e.clientX, y: e.clientY };
    } else {
      // Hover
      const world = screenToWorld(e.clientX, e.clientY);
      const coord = pixelToAxial(world, HEX_SIZE);

      // Check if coord is in map bounds
      if (currentState.map) {
        const { width, height } = currentState.map.dimensions;
        if (coord.q >= 0 && coord.q < width && coord.r >= 0 && coord.r < height) {
          callbacks.onTileHover(coord);
        } else {
          callbacks.onTileHover(null);
        }
      }
    }
  }

  function onMouseLeave(): void {
    isDragging = false;
    callbacks.onTileHover(null);
  }

  function onWheel(e: WheelEvent): void {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    callbacks.onZoom(delta);
  }

  // =========================================================================
  // Setup
  // =========================================================================

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseleave', onMouseLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  // Initial resize
  resize();

  // ResizeObserver for container size changes
  const resizeObserver = new ResizeObserver(() => resize());
  resizeObserver.observe(container);

  // =========================================================================
  // Public API
  // =========================================================================

  return {
    render,
    resize,
    dispose(): void {
      // Cancel any pending animation
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('wheel', onWheel);
      resizeObserver.disconnect();
      canvas.remove();
    },
  };
}

export interface MapCanvasPanel {
  render(state: RenderState, hints: RenderHint[]): void;
  resize(): void;
  dispose(): void;
}
