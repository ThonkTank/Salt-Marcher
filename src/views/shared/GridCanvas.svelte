<script lang="ts">
  // Ziel: Square-Grid Rendering mit Entities, Terrain und Highlights
  // Siehe: docs/views/shared.md#gridcanvas
  //
  // ============================================================================
  // TODO
  // ============================================================================
  //
  // [TODO]: Implementiere Terrain-Rendering
  // - Spec: shared.md#terrain
  // - Difficult Terrain, Cover, Walls, Hazards
  //
  // [TODO]: Implementiere Highlight-System
  // - Spec: shared.md#highlights
  // - Movement Range, Target Cells, Path
  //
  // [TODO]: Implementiere Token-Size Support
  // - Spec: shared.md#token-darstellung
  // - Large (2x2), Huge (3x3), etc.
  //
  // [TODO]: Implementiere Condition-Icons auf Tokens
  // - Spec: shared.md#token-darstellung
  //
  // ============================================================================

  import { onMount } from 'svelte';
  import type { GridCanvasProps, GridEntity, GridPosition, TerrainCell } from './types';

  // Props
  let {
    width,
    height,
    cellSize = 32,
    entities,
    selectedEntityId,
    highlightedCells = [],
    targetedCells = [],
    terrain = [],
    onEntityClick,
    onCellClick,
    onCellHover,
  }: GridCanvasProps = $props();

  // Canvas Reference
  let canvas: HTMLCanvasElement | undefined = $state();

  // Computed
  let canvasWidth = $derived(width * cellSize);
  let canvasHeight = $derived(height * cellSize);

  // Colors
  const COLORS = {
    grid: 'rgba(255, 255, 255, 0.1)',
    gridMajor: 'rgba(255, 255, 255, 0.2)',
    party: '#4A90D9',
    enemy: '#D94A4A',
    neutral: '#888888',
    ally: '#4AD94A',
    background: '#1a1a2e',
    tokenBorder: '#ffffff',
    selection: '#fbbf24',
    active: '#fbbf24',
    movement: 'rgba(74, 144, 217, 0.3)',
    target: 'rgba(217, 74, 74, 0.3)',
  };

  // ============================================================================
  // RENDERING
  // ============================================================================

  function drawGrid(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;

    for (let x = 0; x <= width; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellSize, 0);
      ctx.lineTo(x * cellSize, canvasHeight);
      ctx.stroke();
    }

    for (let y = 0; y <= height; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellSize);
      ctx.lineTo(canvasWidth, y * cellSize);
      ctx.stroke();
    }

    // Major grid lines every 5 cells
    ctx.strokeStyle = COLORS.gridMajor;
    for (let i = 0; i <= Math.max(width, height); i += 5) {
      if (i <= width) {
        ctx.beginPath();
        ctx.moveTo(i * cellSize, 0);
        ctx.lineTo(i * cellSize, canvasHeight);
        ctx.stroke();
      }
      if (i <= height) {
        ctx.beginPath();
        ctx.moveTo(0, i * cellSize);
        ctx.lineTo(canvasWidth, i * cellSize);
        ctx.stroke();
      }
    }
  }

  /** TODO: siehe Header - Terrain-Rendering nicht implementiert */
  function drawTerrain(ctx: CanvasRenderingContext2D, _terrain: TerrainCell[]): void {
    // Placeholder - terrain rendering not yet implemented
  }

  /** TODO: siehe Header - Highlights nicht implementiert */
  function drawHighlights(
    ctx: CanvasRenderingContext2D,
    _highlighted: GridPosition[],
    _targeted: GridPosition[]
  ): void {
    // Placeholder - highlight rendering not yet implemented
  }

  function drawToken(ctx: CanvasRenderingContext2D, entity: GridEntity): void {
    const centerX = entity.position.x * cellSize + cellSize / 2;
    const centerY = entity.position.y * cellSize + cellSize / 2;
    const radius = cellSize * 0.4;

    // Token circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = entity.color;
    ctx.fill();
    ctx.strokeStyle = COLORS.tokenBorder;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Selection ring
    if (entity.id === selectedEntityId) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 4, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.selection;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Active marker
    if (entity.isActive) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 6, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.active;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Label
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${cellSize * 0.4}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(entity.label, centerX, centerY);
  }

  function draw(): void {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Layer 1: Grid
    drawGrid(ctx);

    // Layer 2: Terrain
    drawTerrain(ctx, terrain);

    // Layer 3: Highlights
    drawHighlights(ctx, highlightedCells, targetedCells);

    // Layer 4: Tokens
    for (const entity of entities) {
      drawToken(ctx, entity);
    }
  }

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  function handleClick(event: MouseEvent): void {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / cellSize);
    const y = Math.floor((event.clientY - rect.top) / cellSize);

    // Check if clicked on entity
    const clickedEntity = entities.find(
      e => e.position.x === x && e.position.y === y
    );

    if (clickedEntity) {
      onEntityClick(clickedEntity.id);
    } else {
      onCellClick({ x, y });
    }
  }

  function handleMouseMove(event: MouseEvent): void {
    if (!canvas || !onCellHover) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / cellSize);
    const y = Math.floor((event.clientY - rect.top) / cellSize);
    onCellHover({ x, y });
  }

  function handleMouseLeave(): void {
    if (onCellHover) {
      onCellHover(null);
    }
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  $effect(() => {
    // Redraw when dependencies change
    const _ = entities;
    const __ = selectedEntityId;
    const ___ = highlightedCells;
    const ____ = targetedCells;
    const _____ = terrain;
    if (canvas) {
      requestAnimationFrame(draw);
    }
  });
</script>

<canvas
  bind:this={canvas}
  width={canvasWidth}
  height={canvasHeight}
  onclick={handleClick}
  onmousemove={handleMouseMove}
  onmouseleave={handleMouseLeave}
  class="grid-canvas"
></canvas>

<style>
  .grid-canvas {
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    cursor: pointer;
  }
</style>
