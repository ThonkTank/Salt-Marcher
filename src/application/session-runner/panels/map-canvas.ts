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
  hexNeighbors,
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

/** Colors */
const COLORS = {
  grid: '#444444',
  hover: 'rgba(255, 255, 255, 0.3)',
  selected: 'rgba(255, 255, 0, 0.4)',
  partyToken: '#FF6600',
  partyTokenBorder: '#FFFFFF',
  movableHighlight: 'rgba(0, 255, 0, 0.2)',
  background: '#1a1a1a',
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

    // Get movable tiles for highlighting
    const movableTiles = state.partyPosition
      ? hexNeighbors(state.partyPosition)
      : [];

    // Render tiles
    for (const tile of state.map.tiles) {
      renderTile(tile, state, movableTiles);
    }

    // Render party token
    if (state.partyPosition) {
      renderPartyToken(state.partyPosition);
    }

    ctx.restore();
  }

  function renderTile(
    tile: OverworldTile,
    state: RenderState,
    movableTiles: HexCoordinate[]
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

    // Movable highlight
    const isMovable = movableTiles.some((m) =>
      hexEquals(m, tile.coordinate)
    );
    if (isMovable) {
      ctx.fillStyle = COLORS.movableHighlight;
      ctx.fill();
    }

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

  function renderPartyToken(position: HexCoordinate): void {
    const pixel = axialToPixel(position, HEX_SIZE);

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
